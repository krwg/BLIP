
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][a-zA-Z0-9-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][a-zA-Z0-9-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const meta = JSON.parse(readFileSync(join(root, 'app-metadata.json'), 'utf8'));
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const semver = String(meta.version || '').trim();
if (!SEMVER_RE.test(semver)) {
  console.error(
    `[sync-app-metadata] Invalid semver in app-metadata.json "version": "${semver}"\n` +
      'Use major.minor.patch or major.minor.patch-prerelease (e.g. 0.7.1-beta.1).\n' +
      'Put labels like 0.7.0.1 in "displayVersion" for the UI.'
  );
  process.exit(1);
}

pkg.version = semver;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
console.log('[sync-app-metadata] package.json version →', semver);
if (meta.displayVersion) {
  console.log('[sync-app-metadata] UI displayVersion →', meta.displayVersion);
}
