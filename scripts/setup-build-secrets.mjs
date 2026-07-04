#!/usr/bin/env node

import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const example = join(root, 'build-secrets.local.example');
const target = join(root, '.env.build');

if (existsSync(target)) {
  console.log('[setup-build-secrets] .env.build already exists — edit BLIP_MESH_PUBLIC_KEY if needed.');
  process.exit(0);
}

if (!existsSync(example)) {
  writeFileSync(target, 'BLIP_MESH_PUBLIC_KEY=\n', 'utf8');
} else {
  copyFileSync(example, target);
}

console.log('[setup-build-secrets] created .env.build — set BLIP_MESH_PUBLIC_KEY, then: npm run electron:build:all');
