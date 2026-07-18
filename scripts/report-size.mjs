import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const distRoot = 'dist';
const files = [];

function toPosix(path) {
  return path.split('\\').join('/');
}

function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else {
      const content = readFileSync(path);
      files.push({
        path: toPosix(relative(distRoot, path)),
        bytes: stat.size,
        hash: createHash('sha256').update(content).digest('hex')
      });
    }
  }
}

if (!existsSync(distRoot)) {
  console.error('size report failed: dist directory does not exist; run npm run build first');
  process.exit(1);
}

walk(distRoot);
files.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));

const total = files.reduce((sum, file) => sum + file.bytes, 0);
const duplicateGroups = new Map();
for (const file of files) {
  const group = duplicateGroups.get(file.hash) || [];
  group.push(file.path);
  duplicateGroups.set(file.hash, group);
}

console.log(`dist total: ${total} bytes (${(total / 1024).toFixed(2)} KiB)`);
console.log(`dist files: ${files.length}`);
console.log('largest files:');
for (const file of files.slice(0, 10)) {
  console.log(`${String(file.bytes).padStart(8)}  ${file.path}`);
}

const duplicates = [...duplicateGroups.values()]
  .filter(group => group.length > 1)
  .sort((a, b) => a[0].localeCompare(b[0]));

if (duplicates.length) {
  console.log('duplicate-content groups:');
  for (const group of duplicates) console.log(`- ${group.join(', ')}`);
} else {
  console.log('duplicate-content groups: none');
}

console.log('size report complete: total size is informational and has no fixed failure threshold');