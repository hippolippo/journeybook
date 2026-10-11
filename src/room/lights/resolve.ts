import type { CatalogItem, LightDef, LightDistribution, LightType } from '@/catalog/types';
import type { Placement, RoomItem } from '@/data/types';
import { bandFor } from '@/room/geometry';
import { effectList } from '@/catalog/effects';
import { lightDistributionDef, lightTypeDef, TYPE_DISTRIBUTION } from './registry';

/** A light resolved into stage fractions, ready to draw on the lightmap. */
export interface ResolvedLight {
  key: string;
  /** Centre and reach as fractions of the stage (0–1, x of width / y of height). */
  cx: number;
  cy: number;
  r: number;
  color: string;
  intensity: number;
  flicker: number;
  /** Falloff alpha at [0, 0.2, 0.45, 0.7, 1] of the radius. */
  stops: number[];
  distribution: LightDistribution;
  /** Directional lights only. */
  directional: boolean;
  /** Cone full angle (degrees). */
  angle: number;
  /** Aim (degrees; 0 = right, 90 = down). */
  direction: number;
  /** Edge softness 0 (hard) – 1 (very soft). */
  penumbra: number;
}

/** An item's box in stage fractions (centre-x/centre-y + size), plus orientation. */
interface StageBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
  flip: boolean;
}

/**
 * `stageAspect` is width/height of the stage. Item widths are authored in
 * height units (cqh), so x offsets must be divided by the stage aspect to land
 * correctly when the room isn't square.
 */
function looseBox(cat: CatalogItem, p: Placement, stageAspect: number): StageBox {
  const pos = bandFor(cat.layer === 'surface' ? 'both' : cat.band);
  const size = bandFor(cat.band);
  const h = p.scale * size.height;
  const w = (h * cat.aspect) / stageAspect;
  const bottom = pos.top + p.y * pos.height;
  return { cx: p.x, cy: bottom - h / 2, w, h, rotation: p.rotation, flip: p.flip };
}

/** Mirror of `resolveAttachedFlatStyle`, returning stage fractions and orientation. */
function attachedBox(
  host: CatalogItem,
  hostP: Placement,
  child: CatalogItem,
  childP: Placement,
  stageAspect: number,
): StageBox {
  const hostRange = bandFor(host.band);
  const hostH = hostP.scale * hostRange.height;
  const hostW = (hostH * host.aspect) / stageAspect;
  const childH = childP.scale * bandFor(child.band).height * (hostP.scale / host.defaultScale);
  const childW = (childH * child.aspect) / stageAspect;
  const ax = childP.ax ?? 0.5;
  const ay = childP.ay ?? 0;
  let offsetX = (ax - 0.5) * hostW;
  const offsetY = (ay - 0.5) * hostH - childH / 2;
  if (hostP.flip) offsetX = -offsetX;
  const rad = (hostP.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = offsetX * cos - offsetY * sin;
  const ry = offsetX * sin + offsetY * cos;
  const hostCx = hostP.x;
  const hostCy = hostRange.top + hostP.y * hostRange.height - hostH / 2;
  return {
    cx: hostCx + rx,
    cy: hostCy + ry,
    w: childW,
    h: childH,
    rotation: hostP.rotation + (hostP.flip ? -childP.rotation : childP.rotation),
    flip: hostP.flip ? !childP.flip : childP.flip,
  };
}

function slotColor(cat: CatalogItem, item: RoomItem, slot: string): string {
  const def = cat.colorSlots.find((s) => s.id === slot);
  return item.color[slot] ?? def?.default ?? '#ffd88a';
}

/** Asset-declared lights, or one synthesized from legacy `glow` effects. */
function lightDefs(cat: CatalogItem): LightDef[] {
  if (cat.lights?.length) return cat.lights;
  const defs: LightDef[] = [];
  for (const e of effectList(cat.effect)) {
    if (e.type === 'glow') defs.push({ type: 'lamp', x: 50, y: 50, slot: e.slot, color: e.color });
  }
  return defs;
}

function makeLight(
  key: string,
  cx: number,
  cy: number,
  boxH: number,
  def: LightDef,
  cat: CatalogItem,
  item: RoomItem,
  level: number,
): ResolvedLight {
  const type: LightType = def.type ?? 'lamp';
  const td = lightTypeDef(type);
  const distribution: LightDistribution = def.distribution ?? TYPE_DISTRIBUTION[type] ?? 'semi';
  const dd = lightDistributionDef(distribution);
  const radiusPct = def.radius ?? td.radius;
  const intensity = Math.max(0, (def.intensity ?? 1) * td.intensity * level * dd.gain);
  const flicker = (def.flicker === undefined ? td.flicker : def.flicker ? 1 : 0) || 0;
  const color = def.slot ? slotColor(cat, item, def.slot) : (def.color ?? td.color ?? '#ffd88a');
  return {
    key,
    cx,
    cy,
    r: (radiusPct / 100) * boxH,
    color,
    intensity,
    flicker,
    stops: dd.stops,
    distribution,
    directional: !!dd.directional,
    angle: def.angle ?? dd.angle ?? 0,
    direction: def.direction ?? 90,
    penumbra: def.penumbra ?? dd.penumbra ?? 0.35,
  };
}

export function resolveItemLights(
  item: RoomItem,
  cat: CatalogItem,
  placement: Placement,
  stageAspect = 1,
  host?: CatalogItem,
  hostPlacement?: Placement,
): ResolvedLight[] {
  const defs = lightDefs(cat);
  if (!defs.length) return [];
  const level = item.lightLevel ?? 1;
  const out: ResolvedLight[] = [];

  if (cat.repeat && !host) {
    // Repeating strip: the light pattern tiles with the art along its axis.
    const band = bandFor(cat.band);
    const h = placement.scale * band.height;
    const top = band.top + placement.y * band.height - h;
    const tileW = (h * cat.aspect) / stageAspect;
    const tileH = h;
    const axis = cat.repeat;
    const cols = axis === 'y' ? 1 : Math.ceil(1 / Math.max(1e-6, tileW)) + 1;
    const rows = axis === 'x' ? 1 : Math.ceil(1 / Math.max(1e-6, tileH)) + 1;
    defs.forEach((def, i) => {
      const xFrac = (def.x ?? 50) / 100;
      const yFrac = (def.y ?? 50) / 100;
      if (def.repeat) {
        for (let ty = 0; ty < rows; ty++) {
          for (let tx = 0; tx < cols; tx++) {
            out.push(
              makeLight(
                `${item.id}#${def.id ?? i}@${tx},${ty}`,
                tx * tileW + xFrac * tileW,
                top + ty * tileH + yFrac * tileH,
                h,
                def,
                cat,
                item,
                level,
              ),
            );
          }
        }
      } else {
        out.push(makeLight(`${item.id}#${def.id ?? i}`, xFrac, top + yFrac * h, h, def, cat, item, level));
      }
    });
    return out;
  }

  const box =
    host && hostPlacement
      ? attachedBox(host, hostPlacement, cat, placement, stageAspect)
      : looseBox(cat, placement, stageAspect);
  defs.forEach((def, i) => {
    let ox = ((def.x ?? 50) / 100 - 0.5) * box.w;
    const oy = ((def.y ?? 50) / 100 - 0.5) * box.h;
    if (box.flip) ox = -ox;
    const rad = (box.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    out.push(
      makeLight(
        `${item.id}#${def.id ?? i}`,
        box.cx + (ox * cos - oy * sin),
        box.cy + (ox * sin + oy * cos),
        box.h,
        def,
        cat,
        item,
        level,
      ),
    );
  });
  return out;
}
