import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appMetaPath = join(__dirname, '..', 'app-metadata.json');

function parseGithubRepo(url) {
  if (!url || typeof url !== 'string') return 'FlokeStudio/BLIP';
  const m = url.match(/github\.com\/([^/]+\/[^/]+)/i);
  return m ? m[1].replace(/\.git$/, '') : 'FlokeStudio/BLIP';
}

export function loadGithubRepo() {
  try {
    if (existsSync(appMetaPath)) {
      const meta = JSON.parse(readFileSync(appMetaPath, 'utf8'));
      return parseGithubRepo(meta.githubUrl);
    }
  } catch {
    /* ignore */
  }
  return 'FlokeStudio/BLIP';
}

export function getGithubPublishConfig() {
  const [owner, repo] = loadGithubRepo().split('/');
  return { provider: 'github', owner: owner || 'FlokeStudio', repo: repo || 'BLIP' };
}

/** @param {string} tag */
export function releaseTagCandidates(tag) {
  const raw = String(tag || '').trim();
  if (!raw) return [];
  /** @type {string[]} */
  const out = [];
  const add = (t) => {
    if (t && !out.includes(t)) out.push(t);
  };
  add(raw);
  const bare = raw.replace(/^v/i, '');
  add(bare);
  if (bare) add(`v${bare}`);
  return out;
}

/**
 * GitHub asset URLs must use the release tag exactly (1.1.0 vs v1.1.0).
 * @param {string} tag
 * @returns {Promise<string | null>} tag string that has latest.yml
 */
export async function releaseHasUpdateManifest(tag) {
  const repo = loadGithubRepo();
  for (const t of releaseTagCandidates(tag)) {
    const url = `https://github.com/${repo}/releases/download/${encodeURIComponent(t)}/latest.yml`;
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'User-Agent': 'BLIP-Desktop' },
      });
      if (res.ok) return t;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/**
 * Generic feed URL for electron-updater (latest.yml + Setup on the release).
 * @param {{ receiveBetaUpdates?: boolean }} [config]
 * @returns {Promise<{ provider: string, url?: string, owner?: string, repo?: string, channelTag?: string | null }>}
 */
export async function resolveUpdateFeedUrl(config = {}) {
  const receiveBeta = !!config?.receiveBetaUpdates;
  const repo = loadGithubRepo();
  const result = await fetchGithubReleases(25);

  if (result.ok && result.releases?.length) {
    const stable = result.releases.filter((r) => !r.prerelease);
    const betas = result.releases.filter((r) => r.prerelease);
    const queues = receiveBeta ? [betas, stable] : [stable];

    for (const list of queues) {
      for (const release of list) {
        const tag = await releaseHasUpdateManifest(release.tag);
        if (tag) {
          return {
            provider: 'generic',
            url: `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/`,
            channelTag: tag,
          };
        }
      }
    }
  }

  return { ...getGithubPublishConfig(), channelTag: null };
}

function githubApiHeaders() {
  const token = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '').trim();
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'BLIP-Desktop',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * @param {number} [limit]
 * @returns {Promise<{ ok: boolean, releases?: object[], error?: string }>}
 */
export async function fetchGithubReleases(limit = 8) {
  const repo = loadGithubRepo();
  const url = `https://api.github.com/repos/${repo}/releases?per_page=${Math.min(Math.max(limit, 1), 20)}`;
  try {
    const res = await fetch(url, { headers: githubApiHeaders() });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    if (!Array.isArray(data)) return { ok: false, error: 'invalid_response' };
    const releases = data.map((r) => ({
      tag: r.tag_name || '',
      name: r.name || r.tag_name || '',
      publishedAt: r.published_at || '',
      url: r.html_url || '',
      body: typeof r.body === 'string' ? r.body.trim() : '',
      prerelease: !!r.prerelease,
    }));
    return { ok: true, releases };
  } catch (e) {
    return { ok: false, error: e?.message || 'fetch_failed' };
  }
}
