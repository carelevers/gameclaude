// Everything about task issues: labels, the issue-form layout, and the
// claim/release protocol (plain comments with hidden markers, so volunteers
// without write access can take part).

export const LABELS = {
  ready: { name: 'task:ready', color: '0e8a16', description: 'Approved by a maintainer; free to pick up' },
  claimed: { name: 'task:claimed', color: 'fbca04', description: 'A volunteer agent is working on it' },
  review: { name: 'task:review', color: '1d76db', description: 'A pull request is open' },
  sizeS: { name: 'size:s', color: 'c5def5', description: '~30 minutes of agent time' },
  sizeM: { name: 'size:m', color: 'bfd4f2', description: '~60 minutes of agent time' },
  human: { name: 'needs:human', color: 'd93f0b', description: 'Needs a human decision; agents skip it' },
  p1: { name: 'priority:1', color: 'b60205', description: 'Do first' },
  p2: { name: 'priority:2', color: 'e99695', description: 'Normal' },
  p3: { name: 'priority:3', color: 'f9d0c4', description: 'Nice to have' },
  playerZone: { name: 'zone:players', color: 'c2e0c6', description: 'content/players' },
  boardZone: { name: 'zone:boards', color: 'c2e0c6', description: 'content/boards' },
  modeZone: { name: 'zone:modes', color: 'c2e0c6', description: 'content/modes' },
  coreZone: { name: 'zone:core', color: '5319e7', description: 'Engine, UI, server, tooling' },
  docsZone: { name: 'zone:docs', color: 'c2e0c6', description: 'Documentation and tests' },
};

export const SIZE_MINUTES = { 'size:s': 30, 'size:m': 60 };

export const CLAIM_RE = /<!-- agent-worker:claim login=([A-Za-z0-9-]+) at=([0-9T:.\-Z]+) -->/;
export const RELEASE_RE = /<!-- agent-worker:release -->/;

export const claimComment = (login, agent) =>
  `🎯 Claimed by @${login}'s ${agent} agent via \`npm run worker\`. If no pull request appears within 3 hours, the claim expires automatically.\n\n<!-- agent-worker:claim login=${login} at=${new Date().toISOString()} -->`;

export const releaseComment = (reason) => `↩️ Released: ${reason}\n\n<!-- agent-worker:release -->`;

// Given an issue's comments (oldest first), return the active claim, if any:
// the earliest claim made after the most recent release.
export function activeClaim(comments) {
  let claim = null;
  for (const c of comments) {
    if (RELEASE_RE.test(c.body ?? '')) claim = null;
    const m = (c.body ?? '').match(CLAIM_RE);
    if (m && !claim) claim = { login: m[1], at: new Date(m[2]), commentLogin: c.user?.login ?? c.author?.login };
  }
  return claim;
}

// Issue forms render as "### Heading\n\nvalue" blocks.
export function parseIssueForm(body) {
  const out = {};
  const parts = (body ?? '').split(/^### /m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const key = part.slice(0, nl).trim().toLowerCase();
    const value = part.slice(nl + 1).trim();
    out[key] = value === '_No response_' ? '' : value;
  }
  return out;
}

export function taskScope(form) {
  return (form.scope ?? '')
    .split('\n')
    .map((l) => l.replace(/^[-*]\s*/, '').replace(/`/g, '').trim())
    .filter(Boolean);
}

export function taskDependencies(form) {
  return [...(form['depends on'] ?? '').matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
}

// Marker in pull request bodies, read back by tools/metrics.mjs.
export const PR_MARKER_RE = /<!-- agent-worker (\{.*?\}) -->/;
export const prMarker = (data) => `<!-- agent-worker ${JSON.stringify(data)} -->`;
