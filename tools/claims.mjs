#!/usr/bin/env node
// Keeps task labels in sync with the claim protocol. Runs in GitHub Actions
// (GH_TOKEN set), because volunteers usually cannot edit labels themselves.
//
//   node tools/claims.mjs sync <issue-number>   after a comment: ready <-> claimed
//   node tools/claims.mjs pr <pr-number>        after a PR opens/closes: claimed <-> review
//   node tools/claims.mjs expire [hours=3]      release claims without a PR
import { gh, ghJson, ghApiList } from './lib/github.mjs';
import { LABELS, activeClaim, releaseComment } from './lib/tasks.mjs';

const repo = process.env.GITHUB_REPOSITORY;
if (!repo) throw new Error('GITHUB_REPOSITORY is not set');
const [cmd, arg] = process.argv.slice(2);

const labelsOf = (n) => ghJson(['issue', 'view', String(n), '-R', repo, '--json', 'labels,state']);
const edit = (n, add, remove) => {
  const args = ['issue', 'edit', String(n), '-R', repo];
  for (const a of add) args.push('--add-label', a);
  for (const r of remove) args.push('--remove-label', r);
  if (add.length || remove.length) gh(args);
};

function openPrFor(number) {
  const prs = ghJson(['pr', 'list', '-R', repo, '--state', 'open', '--search', `#${number} in:body`, '--json', 'number,body']);
  return prs.find((p) => new RegExp(`(close[sd]?|fix(e[sd])?|resolve[sd]?) #${number}\\b`, 'i').test(p.body));
}

function sync(number) {
  const issue = labelsOf(number);
  const names = issue.labels.map((l) => l.name);
  if (issue.state !== 'OPEN' || names.includes(LABELS.review.name)) return;
  const claim = activeClaim(ghApiList(`repos/${repo}/issues/${number}/comments`));
  if (claim && names.includes(LABELS.ready.name)) {
    // Keep task:ready too: it records the maintainer's approval.
    edit(number, [LABELS.claimed.name], []);
    console.log(`#${number}: claimed by ${claim.login}`);
  } else if (!claim && names.includes(LABELS.claimed.name)) {
    edit(number, [], [LABELS.claimed.name]);
    console.log(`#${number}: released`);
  }
}

function pr(number) {
  const p = ghJson(['pr', 'view', String(number), '-R', repo, '--json', 'body,state']);
  const tasks = [...(p.body ?? '').matchAll(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?) #(\d+)/gi)].map((m) => Number(m[1]));
  for (const t of tasks) {
    const names = labelsOf(t).labels.map((l) => l.name);
    if (p.state === 'OPEN' && !names.includes(LABELS.review.name)) edit(t, [LABELS.review.name], [LABELS.claimed.name]);
    if (p.state === 'CLOSED' && names.includes(LABELS.review.name) && !openPrFor(t)) {
      // Closed without merging: the task goes back into the queue.
      gh(['issue', 'comment', String(t), '-R', repo, '--body', releaseComment(`pull request #${number} was closed without merging.`)]);
      edit(t, [], [LABELS.review.name, LABELS.claimed.name]);
    }
  }
}

function expire(hours) {
  const issues = ghJson(['issue', 'list', '-R', repo, '--state', 'open', '--label', LABELS.claimed.name, '--limit', '500', '--json', 'number']);
  for (const { number } of issues) {
    const claim = activeClaim(ghApiList(`repos/${repo}/issues/${number}/comments`));
    if (!claim) {
      edit(number, [], [LABELS.claimed.name]); // label out of sync; nothing to announce
      continue;
    }
    const age = (Date.now() - claim.at.getTime()) / 3.6e6;
    if (age < hours || openPrFor(number)) continue;
    gh(['issue', 'comment', String(number), '-R', repo, '--body', releaseComment(`no pull request within ${hours} hours. Free to pick up again.`)]);
    edit(number, [], [LABELS.claimed.name]);
    console.log(`#${number}: expired claim released`);
  }
}

if (cmd === 'sync') sync(Number(arg));
else if (cmd === 'pr') pr(Number(arg));
else if (cmd === 'expire') expire(Number(arg ?? 3));
else {
  console.error('usage: claims.mjs sync <issue> | pr <pr> | expire [hours]');
  process.exit(2);
}
