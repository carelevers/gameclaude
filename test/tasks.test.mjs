import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIssueForm, taskScope, taskDependencies, activeClaim, claimComment, releaseComment } from '../tools/lib/tasks.mjs';
import { matchesAny } from '../tools/lib/glob.mjs';
import { zoneOf } from '../tools/lib/zones.mjs';

test('parses issue forms', () => {
  const body = '### Zone\n\nplayers\n\n### Scope\n\n+content/players/*.json\n- `test/x.test.mjs`\n\n### Depends on\n\n#4, #17\n\n### Details\n\n_No response_';
  const form = parseIssueForm(body);
  assert.equal(form.zone, 'players');
  assert.equal(form.details, '');
  assert.deepEqual(taskScope(form), ['+content/players/*.json', 'test/x.test.mjs']);
  assert.deepEqual(taskDependencies(form), [4, 17]);
});

test('the first claim after the last release wins', () => {
  const c = (body) => ({ body, user: { login: 'x' } });
  assert.equal(activeClaim([]), null);
  assert.equal(activeClaim([c(claimComment('alice', 'claude')), c(claimComment('bob', 'codex'))]).login, 'alice');
  assert.equal(activeClaim([c(claimComment('alice', 'claude')), c(releaseComment('gave up'))]), null);
  assert.equal(activeClaim([c(claimComment('alice', 'claude')), c(releaseComment('gave up')), c(claimComment('bob', 'codex'))]).login, 'bob');
});

test('glob matching and zones', () => {
  assert.ok(matchesAny('content/players/oma_jo.json', ['content/players/*.json']));
  assert.ok(!matchesAny('content/players/sub/x.json', ['content/players/*.json']));
  assert.ok(matchesAny('game/ui/board-view.js', ['game/**']));
  assert.equal(zoneOf('content/modes/royale.js').name, 'modes');
  assert.equal(zoneOf('server/server.mjs').owner, 'core');
  assert.equal(zoneOf('README.md').name, 'docs');
  assert.equal(zoneOf('random/file.txt'), undefined);
});
