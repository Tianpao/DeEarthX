import { readFileSync, readdirSync, writeFileSync, appendFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const assets = [
  'deearthx-windows-amd64.zip',
  'deearthx-darwin-arm64.app.zip',
  'deearthx-darwin-amd64.app.zip',
  'deearthx-linux-amd64.tar.gz',
];
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const fail = (message) => { throw new Error(message); };
const [command, argument] = process.argv.slice(2);
if (command === 'install-wails') {
  // Parse the module using Go itself; do not silently choose latest or a replace.
  const result = spawnSync('go', ['mod', 'edit', '-json'], { encoding: 'utf8' });
  if (result.status !== 0) fail(result.stderr || 'go mod edit failed');
  const mod = JSON.parse(result.stdout);
  const module = 'github.com/wailsapp/wails/v3';
  const requirement = mod.Require?.filter((entry) => entry.Path === module) ?? [];
  if (requirement.length !== 1 || !/^v3\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(requirement[0].Version)) {
    fail('Expected one exact Wails v3 version in go.mod');
  }
  if (mod.Replace?.some((entry) => entry.Old.Path === module)) fail('Wails replace is not supported by CI');
  const version = requirement[0].Version;
  console.log('Installing Wails CLI matching go.mod: ' + version);
  const install = spawnSync('go', ['install', module + '/cmd/wails3@' + version], { stdio: 'inherit' });
  if (install.status !== 0) process.exit(install.status ?? 1);
} else if (command === 'checksum') {
  if (!assets.includes(argument)) fail('Unexpected archive name');
  const names = readdirSync('dist');
  if (names.length !== 1 || names[0] !== argument || !lstatSync(join('dist', argument)).isFile()) {
    fail('dist must contain exactly the requested portable archive');
  }
  writeFileSync(join('dist', argument + '.sha256'), digest(join('dist', argument)) + '  ' + argument + '\n');
} else if (command === 'release-manifest') {
  // Downloaded artifacts are data only. Never execute any downloaded content.
  const expected = assets.flatMap((name) => [name, name + '.sha256']).sort();
  const actual = readdirSync('dist').sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) fail('Missing or unexpected release files');
  const lines = assets.map((name) => {
    for (const path of [name, name + '.sha256']) {
      if (!lstatSync(join('dist', path)).isFile()) fail('Release asset is not a regular file');
    }
    const line = digest(join('dist', name)) + '  ' + name + '\n';
    if (readFileSync(join('dist', name + '.sha256'), 'utf8') !== line) fail('Checksum mismatch: ' + name);
    return line;
  });
  writeFileSync('dist/SHA256SUMS', lines.join(''));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, 'Verified all four portable archives and SHA-256 sidecars.\n');
} else {
  fail('Usage: portable-ci.mjs install-wails | checksum <asset> | release-manifest');
}
