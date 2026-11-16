import { readdirSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const root = resolve('android/app/src/main/assets/public');
const expected = resolve('android/app/src/main/assets');
if (!root.startsWith(expected + sep)) throw new Error('Unexpected Android asset path');
for (const entry of readdirSync(root)) {
  if (entry === 'server' || entry === '.openai' || entry.endsWith('.apk')) {
    rmSync(resolve(root, entry), { recursive: true, force: true });
  }
}
