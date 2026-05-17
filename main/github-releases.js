import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appMetaPath = join(__dirname, '..', 'app-metadata.json');

function parseGithubRepo(url) {
  if (!url || typeof url !== 'string') return 'krwg/BLIP';
  const m = url.match(/github\.com\/([^/]+\/[^/]+)/i);
  return m ? m[1].replace(/\.git$/, '') : 'krwg/BLIP';
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
  return 'krwg/BLIP';
}

export function getGithubPublishConfig() {
  const [owner, repo] = loadGithubRepo().split('/');
  return { provider: 'github', owner: owner || 'krwg', repo: repo || 'BLIP' };
}

/**
 * @param {number} [limit]
 * @returns {Promise<{ ok: boolean, releases?: object[], error?: string }>}
 */
export async function fetchGithubReleases(limit = 8) {
  const repo = loadGithubRepo();
  const url = `https://api.github.com/repos/${repo}/releases?per_page=${Math.min(Math.max(limit, 1), 20)}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'BLIP-Desktop',
      },
    });
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
