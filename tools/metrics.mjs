#!/usr/bin/env node
// Usage: npm run metrics [-- --repo owner/name] [--markdown]
//
// The experiment's scoreboard. Answers the question that matters most:
// does the 101st contributor add more than they cost?
//   - accepted PRs per agent-hour, rejection rate, per agent
//   - human review cost: review comments and hours until merge
//   - per week: active volunteers vs merged PRs vs review load
import { ghJson, repoFromGit } from './lib/github.mjs';
import { PR_MARKER_RE } from './lib/tasks.mjs';

const argv = process.argv.slice(2);
const repo = argv.includes('--repo') ? argv[argv.indexOf('--repo') + 1] : repoFromGit();
const md = argv.includes('--markdown');

const prs = ghJson(['pr', 'list', '-R', repo, '--state', 'all', '--limit', '1000', '--json', 'number,body,state,createdAt,mergedAt,closedAt,additions,deletions,reviews,comments,author']);
const rows = prs
  .map((p) => {
    const m = (p.body ?? '').match(PR_MARKER_RE);
    if (!m) return null;
    let meta;
    try {
      meta = JSON.parse(m[1]);
    } catch {
      return null;
    }
    const reviewComments = (p.reviews ?? []).filter((r) => r.author?.login !== p.author?.login).length + (p.comments ?? []).filter((c) => c.author?.login !== p.author?.login).length;
    return {
      ...meta,
      state: p.mergedAt ? 'merged' : p.state === 'CLOSED' ? 'rejected' : 'open',
      created: new Date(p.createdAt),
      hoursToMerge: p.mergedAt ? (new Date(p.mergedAt) - new Date(p.createdAt)) / 3.6e6 : null,
      reviewComments,
      size: p.additions + p.deletions,
    };
  })
  .filter(Boolean);

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const f = (x, d = 1) => (x == null || Number.isNaN(x) ? '-' : x.toFixed(d));

function summarize(list) {
  const merged = list.filter((r) => r.state === 'merged');
  const decided = list.filter((r) => r.state !== 'open');
  const agentHours = list.reduce((s, r) => s + (r.minutes ?? 0), 0) / 60;
  return {
    prs: list.length,
    merged: merged.length,
    rejectRate: decided.length ? (100 * (decided.length - merged.length)) / decided.length : null,
    perAgentHour: agentHours ? merged.length / agentHours : null,
    medianMinutes: median(list.map((r) => r.minutes)),
    medianHoursToMerge: median(merged.map((r) => r.hoursToMerge)),
    reviewPerMerged: merged.length ? list.reduce((s, r) => s + r.reviewComments, 0) / merged.length : null,
    volunteers: new Set(list.map((r) => r.volunteer)).size,
  };
}

const table = (head, data) => {
  if (md) return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...data.map((r) => `| ${r.join(' | ')} |`)].join('\n');
  const widths = head.map((h, i) => Math.max(h.length, ...data.map((r) => String(r[i]).length)));
  return [head, ...data].map((r) => r.map((c, i) => String(c).padEnd(widths[i])).join('  ')).join('\n');
};

const head = ['group', 'PRs', 'merged', 'rejected %', 'merged/agent-hour', 'median agent min', 'median h to merge', 'review comments/merge', 'volunteers'];
const line = (name, s) => [name, s.prs, s.merged, f(s.rejectRate, 0), f(s.perAgentHour, 2), f(s.medianMinutes), f(s.medianHoursToMerge), f(s.reviewPerMerged), s.volunteers];

console.log(md ? '## Agent contributions\n' : `Agent contributions to ${repo}\n`);
const agents = [...new Set(rows.map((r) => r.agent))];
console.log(table(head, [line('all', summarize(rows)), ...agents.map((a) => line(a, summarize(rows.filter((r) => r.agent === a))))]));

// The scaling question: as more volunteers join each week, does output grow
// faster than the review load?
const weekOf = (d) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  return t.toISOString().slice(0, 10);
};
const weeks = [...new Set(rows.map((r) => weekOf(r.created)))].sort();
console.log(md ? '\n## Per week (is the 101st volunteer worth it?)\n' : '\nPer week (is the 101st volunteer worth it?)');
console.log(
  table(
    ['week', 'volunteers', 'PRs', 'merged', 'merged per volunteer', 'review comments', 'review comments per merge'],
    weeks.map((w) => {
      const s = summarize(rows.filter((r) => weekOf(r.created) === w));
      return [w, s.volunteers, s.prs, s.merged, f(s.merged / (s.volunteers || 1), 2), f(s.reviewPerMerged * s.merged, 0), f(s.reviewPerMerged)];
    }),
  ),
);
if (rows.length === 0) console.log('\n(no pull requests from the agent worker yet)');
