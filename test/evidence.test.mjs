import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { finishedVideo, leftovers, sweepCaptures } from '../src/evidence/cleanup.mjs';
import { stillOptions, parseFlags } from '../src/evidence/command.mjs';
import { cutawayCli, doctorProblem, frameArgs, recordArgs } from '../src/evidence/cutaway.mjs';
import { byFreshness, evidenceGap, readManifest, withItems, writeManifest } from '../src/evidence/manifest.mjs';
import { captionText } from '../src/evidence/mark.mjs';
import { planTarget, resolvePlan } from '../src/evidence/record.mjs';
import { stillName, stillProfiles } from '../src/evidence/stills.mjs';
import { normalizeApps } from '../src/verify/apps.mjs';

const APPS = normalizeApps({ apps: [{ name: 'web', src: 'src' }, { name: 'admin', src: 'admin/src' }] });

test('cutaway: record with the PR settings, per device', () => {
  assert.deepEqual(recordArgs({ plan: '/p.json', out: '/o', device: 'desktop' }), ['record', '/p.json', '--out', '/o', '--width', '1280', '--height', '720', '--quality', 'standard']);
  assert.deepEqual(recordArgs({ plan: '/p.json', out: '/o', device: 'phone' }).slice(4), ['--width', '720', '--height', '1280', '--quality', 'standard']);
});

test('cutaway: frame in a browser window with the address, or in the drawn iPhone', () => {
  assert.deepEqual(frameArgs({ input: '/s.png', output: '/s.framed.png', url: 'http://127.0.0.1:3000/conta', device: 'desktop' }), ['frame', '/s.png', '--output', '/s.framed.png', '--url', 'http://127.0.0.1:3000/conta']);
  assert.deepEqual(frameArgs({ input: '/s.png', output: '/f.png', url: 'x', device: 'phone' }).slice(4), ['--device', 'iPhone 15 Pro']);
});

test('cutaway: the pinned CLI inside the kit dependencies, or the install hint', () => {
  assert.match(cutawayCli(join(import.meta.dirname, '..')), /node_modules\/cutaway\/src\/cli\.mjs$/);
  assert.throws(() => cutawayCli('/nowhere'), /quality-kit install/);
  assert.throws(() => cutawayCli(null), /quality-kit install/);
});

test('cutaway doctor: a missing FFmpeg says how to get one', () => {
  const ready = { checks: [{ name: 'node', ok: true }, { name: 'ffmpeg', ok: true }] };
  assert.equal(doctorProblem(ready), null);
  const noFfmpeg = { checks: [{ name: 'ffmpeg', ok: false, error: 'spawn ffmpeg ENOENT' }] };
  assert.match(doctorProblem(noFfmpeg), /FFmpeg with libx264: run `quality-kit install` again[\s\S]*brew install ffmpeg/);
  assert.match(doctorProblem({ checks: [{ name: 'canvas', ok: false, error: 'no binding' }] }), /cutaway canvas: no binding/);
});

test('manifest: a recapture replaces the same screen, device and caption; others stay', () => {
  const item = (screen, device, tree, caption = null) => ({ kind: 'still', screen, device, caption, tree });
  const manifest = { items: [item('/a', 'desktop', 't1'), item('/a', 'phone', 't1'), item('/a', 'desktop', 't1', 'Actual: 0')] };
  const next = withItems(manifest, [item('/a', 'desktop', 't2')]);
  assert.equal(next.items.length, 3);
  assert.deepEqual(next.items.map((entry) => entry.tree), ['t1', 't1', 't2']);
  const { fresh, stale } = byFreshness(next.items, 't2');
  assert.equal(fresh.length, 1);
  assert.equal(stale.length, 2);
});

test('manifest: on disk, per branch folder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qk-evidence-'));
  try {
    assert.deepEqual(readManifest(dir), { items: [] });
    writeManifest(dir, { items: [{ screen: '/' }] });
    assert.deepEqual(readManifest(dir), { items: [{ screen: '/' }] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('evidence gap: stale evidence, changed screens with none, and nothing to show', () => {
  const fresh = [{ screen: '/a', kind: 'still', device: 'desktop' }];
  assert.match(evidenceGap({ screens: ['/a'], fresh: [], stale: fresh }), /captured before the last change: \/a \(still, desktop\)/);
  assert.match(evidenceGap({ screens: ['/a', '/b'], fresh: [], stale: [] }), /changes screens \(\/a, \/b\) and has no evidence/);
  assert.equal(evidenceGap({ screens: ['/a'], fresh, stale: [] }), null);
  assert.equal(evidenceGap({ screens: [], fresh: [], stale: [] }), null);
});

test('mark caption: actual vs expected, in the project language', () => {
  assert.equal(captionText('en', { actual: 'R$ 0,00', expected: 'R$ 120,00' }), 'Actual: R$ 0,00 · Expected: R$ 120,00');
  assert.equal(captionText('pt-BR', { actual: 'vazio', expected: 'o total' }), 'Atual: vazio · Esperado: o total');
  assert.equal(captionText('en', { expected: 'a total' }), 'Expected: a total');
  assert.equal(captionText('en', {}), '');
});

test('still options: screens, --changed, origin and the mark', () => {
  assert.deepEqual(parseFlags(['/a', '--origin', 'http://x', '--changed']), { values: { origin: 'http://x', changed: true }, positionals: ['/a'] });
  const options = stillOptions(APPS, ['/conta', 'admin:/users', '--mark', '[data-testid=total]', '--actual', '0', '--expected', '120'], 'en');
  assert.deepEqual(options.targets, [{ app: 'web', path: '/conta' }, { app: 'admin', path: '/users' }]);
  assert.deepEqual(options.mark, { selector: '[data-testid=total]', caption: 'Actual: 0 · Expected: 120' });
  assert.equal(stillOptions(APPS, ['--changed'], 'en').changed, true);
  assert.equal(stillOptions(APPS, ['/a', '--mark', 'h1'], 'en').mark.caption, null);
  assert.throws(() => stillOptions(APPS, [], 'en'), /Usage/);
  assert.throws(() => stillOptions(APPS, ['/a', '--actual', '0'], 'en'), /caption a --mark/);
});

test('still sizes: what cutaway frames pixel for pixel', () => {
  const devices = { 'iPhone 15 Pro': { screen: { width: 393, height: 852 }, userAgent: 'iPhone UA' } };
  const { desktop, phone } = stillProfiles(devices);
  assert.deepEqual(desktop, { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2 });
  assert.deepEqual(phone.viewport, { width: 393, height: 764 });
  assert.equal(phone.deviceScaleFactor, 3);
  const target = { app: 'web', path: '/conta' };
  assert.equal(stillName(target, 'phone', null), 'web-conta-phone.png');
  assert.match(stillName(target, 'phone', { selector: 'h1', caption: 'x' }), /^web-conta-phone-[0-9a-f]{6}\.png$/);
  assert.notEqual(stillName(target, 'phone', { selector: 'h1', caption: 'x' }), stillName(target, 'phone', { selector: 'h1', caption: 'y' }));
});

test('video plan: a screen path gets the app origin and absolute upload files', () => {
  assert.deepEqual(planTarget(APPS, 'admin:/users'), { app: 'admin', path: '/users', screen: 'admin:/users' });
  assert.deepEqual(planTarget(APPS, 'http://localhost:3000/conta?x=1'), { app: null, screen: '/conta' });
  const plan = { url: '/conta', steps: [{ action: 'click', selector: 'button' }, { action: 'upload', selector: 'button', file: 'photo.png' }, { action: 'upload', selector: 'b', file: ['/abs.png', 'b.png'] }] };
  const resolved = resolvePlan(plan, { origin: 'http://127.0.0.1:5000', path: '/conta', planDir: '/plans' });
  assert.equal(resolved.url, 'http://127.0.0.1:5000/conta');
  assert.equal(resolved.steps[1].file, '/plans/photo.png');
  assert.deepEqual(resolved.steps[2].file, ['/abs.png', '/plans/b.png']);
  assert.equal(resolvePlan({ url: 'http://x/y', steps: [] }, { origin: null, path: undefined, planDir: '/p' }).url, 'http://x/y');
});


test('cleanup: only the delivered video stays, and only finished takes are swept', () => {
  assert.deepEqual(leftovers(['frames', 'timeline.json', 'camera.json', 'poster.png', 'render.json', 'workflow.json', 'video.mp4'], '/x/recording/video.mp4'), ['frames', 'timeline.json', 'camera.json', 'poster.png', 'render.json', 'workflow.json']);
  assert.equal(finishedVideo(['frames', 'timeline.json', 'workflow.json', 'video.mp4']), 'video.mp4');
  assert.equal(finishedVideo(['frames', 'timeline.json']), null, 'still recording');
  assert.equal(finishedVideo(['frames', 'timeline.json', 'video.mp4']), null, 'still exporting');
  assert.equal(finishedVideo(['workflow.json', 'video.mp4']), null, 'already trimmed');
});

test('cleanup: the sweep trims finished takes under the kit evidence folders, nothing else', () => {
  const home = mkdtempSync(join(tmpdir(), 'qk-sweep-'));
  const take = (branch, name, files) => {
    const recording = join(home, 'projects', 'app-1', 'branches', branch, 'evidence', 'videos', name, 'recording');
    mkdirSync(join(recording, 'frames'), { recursive: true });
    writeFileSync(join(recording, 'frames', '000000.png'), 'png');
    for (const file of files) writeFileSync(join(recording, file), '{}');
    return recording;
  };
  try {
    const done = take('main', 'root-desktop-1', ['timeline.json', 'workflow.json', 'video.mp4']);
    const busy = take('feat', 'root-phone-2', ['timeline.json']);
    const other = join(home, 'projects', 'app-1', 'branches', 'main', 'stills', 'frames');
    mkdirSync(other, { recursive: true });
    sweepCaptures(home);
    assert.deepEqual(readdirSync(done), ['video.mp4']);
    assert.deepEqual(readdirSync(busy).sort(), ['frames', 'timeline.json']);
    assert.ok(existsSync(other));
    sweepCaptures(join(home, 'nowhere'));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
