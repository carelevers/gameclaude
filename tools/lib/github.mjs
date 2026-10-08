// Thin wrapper around the GitHub CLI (`gh`). Volunteers use their own login;
// GitHub Actions provide GH_TOKEN. Nobody ever shares credentials.
import { execFileSync } from 'node:child_process';

export function gh(args, { input } = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim();
}

export function ghJson(args) {
  const out = gh(args);
  return out ? JSON.parse(out) : null;
}

// Paginated REST GET returning one flat array.
export function ghApiList(path) {
  const out = gh(['api', '--paginate', '--slurp', path]);
  return JSON.parse(out).flat();
}

export function currentLogin() {
  return gh(['api', 'user', '--jq', '.login']);
}

export function repoFromGit(remote = 'origin') {
  const url = execFileSync('git', ['remote', 'get-url', remote], { encoding: 'utf8' }).trim();
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+?)(\.git)?$/) ?? url.match(/\/git\/([^/]+)\/([^/.]+?)(\.git)?$/);
  if (!m) throw new Error(`cannot find owner/repo in remote ${remote} (${url})`);
  return `${m[1]}/${m[2]}`;
}
