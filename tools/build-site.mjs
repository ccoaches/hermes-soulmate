#!/usr/bin/env node
// Deterministic public-only GitHub Pages artifact. No user data is included.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const publicFiles = Object.freeze([
  'index.html', 'app.mjs', 'styles.css', 'interview.mjs', 'questions.json',
  'START-HERE.md', 'RESEARCH.md', 'ai-client.mjs',
]);
const generatedFiles = [...publicFiles, '.nojekyll', 'site-manifest.json'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function requireRegularFile(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected a regular file: ${file}`);
}

export function buildSite({ root, check = false }) {
  const repository = fs.realpathSync(root);
  const source = path.join(repository, 'v2');
  const destination = path.join(repository, 'docs');
  const sourceStat = fs.lstatSync(source);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw new Error('v2 must be a real directory.');
  if (fs.existsSync(destination)) {
    const stat = fs.lstatSync(destination);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('docs must be a real directory.');
    for (const name of fs.readdirSync(destination)) {
      if (!generatedFiles.includes(name)) throw new Error(`Unexpected docs file; preserve and review it before building: ${name}`);
      requireRegularFile(path.join(destination, name));
    }
  }

  // Read and validate the complete source set before writing anything.
  const bytes = new Map();
  for (const name of publicFiles) {
    const file = path.join(source, name);
    requireRegularFile(file);
    // All allowlisted inputs are UTF-8 text. Match Git's published LF bytes on
    // Windows as well as Unix so the manifest attests the committed artifact.
    bytes.set(name, Buffer.from(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')));
  }
  bytes.set('.nojekyll', Buffer.alloc(0));
  const manifest = {
    version: 1,
    algorithm: 'sha256',
    files: Object.fromEntries([...bytes].map(([name, data]) => [name, hash(data)])),
  };
  bytes.set('site-manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  if (check) {
    for (const [name, expected] of bytes) {
      const file = path.join(destination, name);
      if (!fs.existsSync(file) || !fs.readFileSync(file).equals(expected)) {
        throw new Error(`Published site is missing or stale: docs/${name}. Run node tools/build-site.mjs.`);
      }
    }
  } else {
    if (!fs.existsSync(destination)) fs.mkdirSync(destination);
    for (const [name, data] of bytes) fs.writeFileSync(path.join(destination, name), data);
  }
  return { files: bytes.size, destination, check };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--check') || args.length > 1) throw new Error('Usage: node tools/build-site.mjs [--check]');
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const result = buildSite({ root, check: args.includes('--check') });
    console.log(`${result.check ? 'Verified' : 'Built'} ${result.files} public site files in docs/.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
