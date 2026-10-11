import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, '../../.opencode/skills/room-decor-json');
const CLI = join(SKILL, 'scripts', 'room-decor.mjs');
const FIXTURES = join(SKILL, 'fixtures');
const ASSETS = resolve(HERE, '../assets/svg');

const basket = join(FIXTURES, 'example-basket.svg');
const lamp = join(FIXTURES, 'example-lamp.svg');
const lampNight = join(FIXTURES, 'example-lamp-night.svg');
const smokeMotion = join(FIXTURES, 'motion-smoke.json');

function run(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function tempJson(name: string, value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'room-decor-'));
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(value, null, 2));
  return path;
}

describe('room-decor-json skill: inspect', () => {
  it('derives the id, aspect, and recolor slots from a single SVG', () => {
    const { status, stdout } = run(['inspect', basket, '--json']);
    expect(status).toBe(0);
    const info = JSON.parse(stdout);
    expect(info.id).toBe('example-basket');
    expect(info.aspect).toBeCloseTo(120 / 132, 2);
    expect(info.slots.map((s: { id: string }) => s.id)).toEqual(['body', 'trim']);
    expect(info.slots[0]).toMatchObject({ default: '#d3b184', variants: ['day'] });
  });

  it('reports slots present across day and night variants', () => {
    const { status, stdout } = run(['inspect', lamp, '--night', lampNight, '--json']);
    expect(status).toBe(0);
    const info = JSON.parse(stdout);
    expect(info.aspect).toBe(0.5);
    expect(info.slots).toHaveLength(1);
    expect(info.slots[0]).toMatchObject({ id: 'shade', variants: ['day', 'night'] });
  });
});

describe('room-decor-json skill: scaffold', () => {
  it('emits a placement + palette definition with no motion by default', () => {
    const { status, stdout } = run([
      'scaffold',
      '--svg',
      basket,
      '--category',
      'trinket',
      '--layer',
      'surface',
      '--attach',
      'furniture',
    ]);
    expect(status).toBe(0);
    const def = JSON.parse(stdout);
    expect(def).toMatchObject({
      kind: 'room',
      category: 'trinket',
      layer: 'surface',
      band: 'floor',
      attach: 'furniture',
      aspect: 0.909,
      defaultScale: 0.18,
    });
    expect(def.colorSlots).toHaveLength(2);
    expect(def.colorSlots[0]).toMatchObject({
      id: 'body',
      label: 'Body',
      default: '#d3b184',
      allowCustom: true,
    });
    expect(def.colorSlots[0].palette.length).toBeGreaterThan(3);
    expect(def.presets.length).toBeGreaterThan(0);
    expect(def).not.toHaveProperty('effect');
    expect(def).not.toHaveProperty('animations');
    expect(def).not.toHaveProperty('particles');
  });

  it('applies category defaults when placement flags are omitted', () => {
    const { stdout } = run(['scaffold', '--svg', basket]);
    const def = JSON.parse(stdout);
    expect(def).toMatchObject({
      category: 'trinket',
      layer: 'surface',
      band: 'floor',
      attach: 'furniture',
    });
  });

  it('adds an explicit day/night art pair when a night SVG is given', () => {
    const { stdout } = run([
      'scaffold',
      '--svg',
      lamp,
      '--night',
      lampNight,
      '--category',
      'wallDecor',
    ]);
    const def = JSON.parse(stdout);
    expect(def.art).toEqual({ day: 'example-lamp.svg', night: { src: 'example-lamp-night.svg' } });
    expect(def.colorSlots).toHaveLength(1);
    expect(def).not.toHaveProperty('presets');
  });

  it('merges motion only when a fragment is supplied', () => {
    const item = JSON.parse(run(['scaffold', '--svg', basket, '--motion', smokeMotion]).stdout);
    expect(item.effect).toMatchObject({ type: 'smoke' });

    const night = JSON.parse(
      run(['scaffold', '--svg', lamp, '--night', lampNight, '--night-motion', smokeMotion]).stdout,
    );
    expect(night.art.night.effect).toMatchObject({ type: 'smoke' });
    expect(night).not.toHaveProperty('effect');
  });

  it('refuses to attach a non-surface item', () => {
    const { status, stderr } = run([
      'scaffold',
      '--svg',
      basket,
      '--category',
      'wallDecor',
      '--attach',
      'shelf',
    ]);
    expect(status).toBe(2);
    expect(stderr).toContain('attach');
  });
});

describe('room-decor-json skill: check', () => {
  it('passes the shipped room sidecars', () => {
    for (const name of [
      'trailing-plant.json',
      'paper-lantern.json',
      'fairy-lights.json',
      'chai-cup.json',
      'window-day.json',
      'curtain.json',
      'string-lights.json',
      'wall-shelf.json',
      'corkboard.json',
      'desk.json',
      'beanbag.json',
      'rug.json',
      'raccoon-sleeping.json',
      'coffee-cup.json',
      'pencil-cup.json',
      'laptop.json',
      'scissors.json',
      'owala.json',
      'potted-plant.json',
    ]) {
      const { status, stdout } = run(['check', join(ASSETS, name), '--json']);
      expect(status, `${name} should have no errors`).toBe(0);
      expect(JSON.parse(stdout).ok).toBe(true);
    }
  });

  it('round-trips a scaffolded definition through check', () => {
    const scaffolded = JSON.parse(
      run(['scaffold', '--svg', basket, '--category', 'trinket', '--attach', 'furniture']).stdout,
    );
    const path = tempJson('example-basket.json', scaffolded);
    const { status, stdout } = run(['check', path, '--svg-dir', FIXTURES, '--json']);
    expect(status).toBe(0);
    expect(JSON.parse(stdout).ok).toBe(true);
  });

  it('fails when a declared slot is not used in the art', () => {
    const path = tempJson('example-basket.json', {
      kind: 'room',
      id: 'example-basket',
      category: 'trinket',
      layer: 'surface',
      band: 'floor',
      aspect: 0.909,
      attach: 'furniture',
      colorSlots: [
        { id: 'nope', label: 'Nope', default: '#ffffff', palette: ['#ffffff'], allowCustom: true },
      ],
    });
    const { status, stdout } = run(['check', path, '--svg-dir', FIXTURES, '--json']);
    expect(status).toBe(1);
    const report = JSON.parse(stdout);
    expect(report.ok).toBe(false);
    expect(report.errors.join(' ')).toContain('nope');
  });

  it('fails when a preset references an unknown slot', () => {
    const path = tempJson('example-basket.json', {
      kind: 'room',
      id: 'example-basket',
      category: 'trinket',
      layer: 'surface',
      band: 'floor',
      aspect: 0.909,
      attach: 'furniture',
      colorSlots: [
        { id: 'body', label: 'Body', default: '#d3b184', palette: ['#d3b184'], allowCustom: true },
      ],
      presets: [{ id: 'oops', label: 'Oops', colors: { ghost: '#ffffff' } }],
    });
    const { status, stdout } = run(['check', path, '--svg-dir', FIXTURES, '--json']);
    expect(status).toBe(1);
    expect(JSON.parse(stdout).errors.join(' ')).toContain('ghost');
  });
});
