
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const TARGETS = [
  'main/entitlement-codec.js',
  'main/mesh-plus-license.js',
  'main/mesh-plus-public-key.js',
  'main/mesh-plus-public-key-loader.js',
  'shared/mesh-plus-gates.js',
];

const OBF_OPTS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.4,
  deadCodeInjection: false,
  stringArray: true,
  stringArrayThreshold: 0.75,
  rotateStringArray: true,
  selfDefending: false,
  target: 'node',
};

module.exports = async function afterPack(context) {
  const appDir = join(context.appOutDir, 'resources', 'app');
  if (!existsSync(appDir)) {
    console.warn('[obfuscate-after-pack] skip — no resources/app at', appDir);
    return;
  }

  for (const rel of TARGETS) {
    const filePath = join(appDir, rel);
    if (!existsSync(filePath)) {
      console.warn('[obfuscate-after-pack] missing', rel);
      continue;
    }
    const code = readFileSync(filePath, 'utf8');
    const out = JavaScriptObfuscator.obfuscate(code, OBF_OPTS).getObfuscatedCode();
    writeFileSync(filePath, out, 'utf8');
    console.log('[obfuscate-after-pack] ok', rel);
  }
};
