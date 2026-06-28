#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (args[0] !== 'build') { console.error('Only vite build is supported in this repository fixture.'); process.exit(1); }
const r = spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
