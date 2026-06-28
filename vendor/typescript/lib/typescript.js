import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const ts = await import(pathToFileURL(join(globalRoot, 'typescript', 'lib', 'typescript.js')).href);

export default ts.default ?? ts;
