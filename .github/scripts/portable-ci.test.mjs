// Offline tests: virtual filesystem and mocked Go; no downloads/builds/releases.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('./portable-ci.mjs', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '');
const assets = [
  'deearthx-windows-amd64.zip', 'deearthx-darwin-arm64.app.zip',
  'deearthx-darwin-amd64.app.zip', 'deearthx-linux-amd64.tar.gz',
];
const hash = (data) => createHash('sha256').update(data).digest('hex');
const pathKey = (path) => path.replaceAll('\\', '/');
function execute(args, initial = {}, mod = {}, installStatus = 0) {
  const files = new Map(Object.entries(initial));
  const calls = [];
  const context = {
    createHash, join, console: { log() {} },
    readFileSync(path) {
      const value = files.get(pathKey(path));
      if (value === undefined) throw new Error('Missing test file: ' + path);
      return value;
    },
    readdirSync() { return [...files.keys()].filter((path) => path.startsWith('dist/')).map((path) => path.slice(5)); },
    lstatSync() { return { isFile: () => true }; },
    writeFileSync(path, data) { files.set(pathKey(path), data); },
    appendFileSync() {},
    spawnSync(command, argv) {
      calls.push([command, ...argv]);
      return argv[0] === 'mod' ? { status: 0, stdout: JSON.stringify(mod) } : { status: installStatus };
    },
    process: { argv: ['node', 'helper', ...args], env: {}, exit(code) { throw new Error('exit:' + code); } },
  };
  runInNewContext(source, context);
  return { files, calls };
}
const module = 'github.com/wailsapp/wails/v3';
const validMod = { Require: [{ Path: module, Version: 'v3.0.0-alpha2.106' }] };
assert.deepEqual(execute(['install-wails'], {}, validMod).calls, [
  ['go', 'mod', 'edit', '-json'], ['go', 'install', module + '/cmd/wails3@v3.0.0-alpha2.106'],
]);
assert.throws(() => execute(['install-wails'], {}, {}), /exact Wails/);
assert.throws(() => execute(['install-wails'], {}, { Require: [{ Path: module, Version: 'v3x0x0' }] }), /exact Wails/);
assert.throws(() => execute(['install-wails'], {}, { ...validMod, Replace: [{ Old: { Path: module } }] }), /replace/);
assert.throws(() => execute(['install-wails'], {}, validMod, 1), /exit:1/);
assert.throws(() => execute(['checksum', 'installer.exe']), /Unexpected/);
for (const asset of assets) {
  const result = execute(['checksum', asset], { ['dist/' + asset]: 'sample' });
  assert.equal(result.files.get('dist/' + asset + '.sha256'), hash('sample') + '  ' + asset + '\n');
}
assert.throws(() => execute(['checksum', assets[0]], { ['dist/' + assets[0]]: 'sample', 'dist/extra.exe': 'x' }), /exactly/);
const releaseFiles = Object.fromEntries(assets.flatMap((asset) => [
  ['dist/' + asset, 'sample'], ['dist/' + asset + '.sha256', hash('sample') + '  ' + asset + '\n'],
]));
const manifest = execute(['release-manifest'], releaseFiles).files.get('dist/SHA256SUMS');
assert.equal(manifest, assets.map((asset) => hash('sample') + '  ' + asset + '\n').join(''));
assert.throws(() => execute(['release-manifest'], {}), /Missing or unexpected/);
assert.throws(() => execute(['release-manifest'], { ...releaseFiles, 'dist/extra.dmg': 'x' }), /Missing or unexpected/);
assert.throws(() => execute(['release-manifest'], { ...releaseFiles, ['dist/' + assets[0]]: 'tampered' }), /Checksum mismatch/);
console.log('PASS: exact Wails install, invalid/replace/failure rejection, four SHA-256 sidecars, manifest, missing/extra/tampered artifacts');
