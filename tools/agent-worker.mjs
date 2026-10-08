#!/usr/bin/env node
// Darts 100 agent worker: lend your spare AI capacity to the project.
//
//   npm run worker -- --agent claude            pick one task, do it, open a PR
//   npm run worker -- --agent codex --tasks 3   do up to three tasks
//   npm run worker -- --dry-run                 show what would be picked
//   npm run worker -- --task 42                 a specific task
//
// What happens:
//   1. Finds an open issue labelled task:ready that fits your time budget.
//   2. Checks a maintainer approved it (the label was set by someone listed in
//      tasks/maintainers.json on the main branch).
//   3. Claims it with a comment (first claim wins), creates a branch.
//   4. Runs YOUR agent CLI with YOUR subscription on YOUR machine.
//   5. Runs `npm test` and the scope check; gives the agent one chance to fix.
//   6. Commits, pushes to your fork and opens a pull request.
//
// Nothing here ever sees your credentials: it only calls `gh`, `git` and the
// agent command configured in tools/agents.json (override locally in
// .agent-worker.json).
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/content.mjs';
import { gh, ghJson, ghApiList, currentLogin, repoFromGit } from './lib/github.mjs';
import { LABELS, SIZE_MINUTES, activeClaim, claimComment, releaseComment, parseIssueForm, taskScope, taskDependencies, prMarker } from './lib/tasks.mjs';

// ---- options ---------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, def) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : def);
if (flag('help')) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}
const AGENT = opt('agent', 'claude');
const BUDGET = Number(opt('minutes', 30));
const MAX_TASKS = Number(opt('tasks', 1));
const ONLY_TASK = opt('task', null);
const DRY = flag('dry-run');
const BASE = opt('base', 'main');
const FIX_ATTEMPTS = Number(opt('fix-attempts', 1));

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const REMOTES = git('remote').split('\n');
// `gh repo fork --clone` names the original repo "upstream" and your fork "origin".
const UPSTREAM_REMOTE = opt('upstream', REMOTES.includes('upstream') ? 'upstream' : 'origin');
const log = (...a) => console.log('[worker]', ...a);

function agentConfig() {
  const shared = JSON.parse(readFileSync(join(ROOT, 'tools', 'agents.json'), 'utf8'));
  const localPath = join(ROOT, '.agent-worker.json');
  const local = existsSync(localPath) ? JSON.parse(readFileSync(localPath, 'utf8')) : {};
  const cfg = { ...shared, ...local }[AGENT];
  if (!cfg) throw new Error(`unknown agent "${AGENT}"; configure it in tools/agents.json or .agent-worker.json`);
  return cfg;
}

function pushRemote() {
  if (opt('push-remote')) return opt('push-remote');
  if (REMOTES.includes('fork')) return 'fork';
  return UPSTREAM_REMOTE === 'upstream' ? 'origin' : UPSTREAM_REMOTE;
}

// ---- picking a task ----------------------------------------------------------------

function maintainers() {
  git('fetch', '--quiet', UPSTREAM_REMOTE, BASE);
  return JSON.parse(git('show', `${UPSTREAM_REMOTE}/${BASE}:tasks/maintainers.json`)).maintainers.map((m) => m.toLowerCase());
}

function approvedByMaintainer(repo, number, trusted) {
  const events = ghApiList(`repos/${repo}/issues/${number}/events`);
  const labeled = events.filter((e) => e.event === 'labeled' && e.label?.name === LABELS.ready.name);
  const last = labeled[labeled.length - 1];
  return Boolean(last && trusted.includes(last.actor?.login?.toLowerCase()));
}

function candidates(repo) {
  const fields = 'number,title,body,labels,createdAt';
  if (ONLY_TASK) return [ghJson(['issue', 'view', ONLY_TASK, '-R', repo, '--json', `${fields},state`])];
  return ghJson(['issue', 'list', '-R', repo, '--state', 'open', '--label', LABELS.ready.name, '--limit', '200', '--json', fields]);
}

function rank(issue) {
  const names = issue.labels.map((l) => l.name);
  const prio = names.includes(LABELS.p1.name) ? 1 : names.includes(LABELS.p3.name) ? 3 : 2;
  return prio * 1e13 + new Date(issue.createdAt).getTime();
}

function pickTask(repo, login, trusted, skip) {
  const issues = candidates(repo).filter(Boolean).sort((a, b) => rank(a) - rank(b));
  for (const issue of issues) {
    if (skip.has(issue.number)) continue;
    const names = issue.labels.map((l) => l.name);
    const why = (reason) => ONLY_TASK && log(`#${issue.number} skipped: ${reason}`);
    if (!names.includes(LABELS.ready.name)) { why('not task:ready'); continue; }
    if (names.includes(LABELS.claimed.name) || names.includes(LABELS.review.name) || names.includes(LABELS.human.name)) { why('claimed, in review or needs a human'); continue; }
    const size = names.find((n) => n in SIZE_MINUTES);
    if (!size || SIZE_MINUTES[size] > BUDGET) { why(`size ${size ?? 'unknown'} does not fit ${BUDGET} minutes`); continue; }
    const agentLabels = names.filter((n) => n.startsWith('agent:'));
    if (agentLabels.length && !agentLabels.includes(`agent:${AGENT}`) && !agentLabels.includes('agent:any')) { why(`reserved for ${agentLabels.join(', ')}`); continue; }
    const form = parseIssueForm(issue.body);
    const scope = taskScope(form);
    if (scope.length === 0) { why('no scope'); continue; }
    const deps = taskDependencies(form);
    const openDeps = deps.filter((d) => ghJson(['issue', 'view', String(d), '-R', repo, '--json', 'state']).state === 'OPEN');
    if (openDeps.length) { why(`waiting for ${openDeps.map((d) => `#${d}`).join(', ')}`); continue; }
    const comments = ghApiList(`repos/${repo}/issues/${issue.number}/comments`);
    if (activeClaim(comments)) { why('already claimed'); continue; }
    if (!approvedByMaintainer(repo, issue.number, trusted)) {
      log(`#${issue.number} skipped: task:ready was not set by a maintainer listed in tasks/maintainers.json`);
      continue;
    }
    return { issue, form, scope, size };
  }
  return null;
}

function claim(repo, number, login) {
  gh(['issue', 'comment', String(number), '-R', repo, '--body', claimComment(login, AGENT)]);
  const winner = activeClaim(ghApiList(`repos/${repo}/issues/${number}/comments`));
  return winner?.login.toLowerCase() === login.toLowerCase();
}

function release(repo, number, reason) {
  try {
    gh(['issue', 'comment', String(number), '-R', repo, '--body', releaseComment(reason)]);
  } catch (err) {
    log(`could not post release comment: ${err.message}`);
  }
}

// ---- running the agent -----------------------------------------------------------------

function buildPrompt(task, login) {
  const template = readFileSync(join(ROOT, 'tools', 'prompt-template.md'), 'utf8');
  const vars = {
    number: task.issue.number,
    title: task.issue.title,
    zone: task.form.zone ?? 'unknown',
    minutes: SIZE_MINUTES[task.size],
    scope: task.scope.map((s) => `\`${s}\``).join(', '),
    login,
    body: task.issue.body.replace(/<\/?task-description>/g, ''),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
}

function runAgent(prompt, minutes) {
  const cfg = agentConfig();
  const args = cfg.args.map((a) => a.replace('{prompt}', prompt));
  log(`running ${cfg.command} (limit ${minutes} min)...`);
  return new Promise((resolve) => {
    const child = spawn(cfg.command, args, { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
    const timer = setTimeout(() => {
      log('time budget exceeded, stopping the agent');
      child.kill('SIGTERM');
    }, minutes * 60_000);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, error: code === 0 ? null : `agent exited with code ${code}` });
    });
  });
}

function check(scope) {
  const run = (cmd, args) => {
    try {
      return { ok: true, out: execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (err) {
      return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
    }
  };
  const test = run('npm', ['test', '--silent']);
  const scopeArgs = ['tools/scope-check.mjs', '--base', `${UPSTREAM_REMOTE}/${BASE}`, ...scope.flatMap((s) => ['--scope', s])];
  const sc = run('node', scopeArgs);
  return { ok: test.ok && sc.ok, report: `$ npm test\n${test.out.slice(-4000)}\n$ node ${scopeArgs.join(' ')}\n${sc.out}` };
}

// ---- main ------------------------------------------------------------------------

async function doOneTask(repo, login, trusted, skip) {
  const task = pickTask(repo, login, trusted, skip);
  if (!task) return false;
  const { issue } = task;
  skip.add(issue.number);
  log(`picked #${issue.number}: ${issue.title} (${task.size}, scope ${task.scope.join(' ')})`);
  const prompt = buildPrompt(task, login);
  if (DRY) {
    console.log(`\n----- prompt -----\n${prompt}\n------------------`);
    return true;
  }
  if (git('status', '--porcelain')) throw new Error('your working tree has uncommitted changes; commit or stash them first');
  if (!claim(repo, issue.number, login)) {
    log(`someone else claimed #${issue.number} first; trying another task`);
    return doOneTask(repo, login, trusted, skip);
  }
  const original = git('rev-parse', '--abbrev-ref', 'HEAD');
  const slug = issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const branch = `task/${issue.number}-${slug}`;
  const started = Date.now();
  let attempts = 0;
  try {
    git('checkout', '-B', branch, `${UPSTREAM_REMOTE}/${BASE}`);
    let result = await runAgent(prompt, SIZE_MINUTES[task.size]);
    attempts = 1;
    let verdict = check(task.scope);
    while (!verdict.ok && attempts <= FIX_ATTEMPTS) {
      log('checks failed; asking the agent to fix them');
      const left = Math.max(5, SIZE_MINUTES[task.size] - (Date.now() - started) / 60000);
      result = await runAgent(`${prompt}\n\n## Your previous attempt failed these checks. Fix them.\n\n\`\`\`\n${verdict.report}\n\`\`\``, left);
      attempts++;
      verdict = check(task.scope);
    }
    if (!verdict.ok) throw Object.assign(new Error('checks still failing'), { report: verdict.report, agentError: result.error });
    const minutes = Math.round((Date.now() - started) / 6000) / 10;
    git('add', '-A');
    git('commit', '-m', `${issue.title}\n\nCloses #${issue.number}\n\nAgent: ${AGENT}\nAgent-Minutes: ${minutes}\nVolunteer: @${login}`);
    const remote = pushRemote();
    git('push', '-u', remote, branch);
    const headOwner = repoFromGit(remote).split('/')[0];
    const body = [
      `Closes #${issue.number}`,
      '',
      `Made by @${login}'s **${AGENT}** agent in ${minutes} minutes (${attempts} attempt${attempts === 1 ? '' : 's'}) via \`npm run worker\`.`,
      '',
      '### Checks run locally',
      '- `npm test` (validation, unit tests, 100-bot simulation): passed',
      `- scope check (${task.scope.map((s) => `\`${s}\``).join(', ')}): passed`,
      '',
      '### Reviewer checklist',
      '- [ ] Fits the vision in docs/VISIE.md (tone, fairness, art)',
      '- [ ] Looks right in the gallery / plays well',
      '',
      prMarker({ v: 1, task: issue.number, agent: AGENT, minutes, attempts, volunteer: login }),
    ].join('\n');
    const url = gh(['pr', 'create', '-R', repo, '--base', BASE, '--head', `${headOwner}:${branch}`, '--title', issue.title, '--body', body]);
    log(`pull request opened: ${url}`);
  } catch (err) {
    log(`task #${issue.number} failed: ${err.message}`);
    if (err.report) console.log(err.report);
    release(repo, issue.number, `the ${AGENT} agent could not finish (${err.message}). Free to pick up again.`);
    try {
      git('reset', '--hard');
      git('clean', '-fd');
    } catch {}
  } finally {
    try {
      git('checkout', original);
    } catch {}
  }
  return true;
}

const repo = opt('repo', repoFromGit(UPSTREAM_REMOTE));
const login = currentLogin();
const trusted = maintainers();
log(`${login} lending a ${AGENT} agent to ${repo} (budget ${BUDGET} min/task, up to ${MAX_TASKS} task(s))${DRY ? ' [dry run]' : ''}`);
const skip = new Set();
let done = 0;
while (done < MAX_TASKS) {
  if (!(await doOneTask(repo, login, trusted, skip))) {
    log(done ? 'no more suitable tasks. Thank you!' : 'no suitable tasks right now. Thank you anyway!');
    break;
  }
  done++;
}
