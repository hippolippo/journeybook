<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Viewport } from '@/stores/app';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import { getCatalogItem } from '@/catalog/catalog';
import type { CatalogItem } from '@/catalog/types';
import type { Placement, RoomItem } from '@/data/types';
import { deriveMobile } from '@/room/geometry';
import { resolveItemLights, type ResolvedLight } from './lights/resolve';
import { drawLightmap } from './lights/render';
import { lightDistributionDef, lightTypeDef } from './lights/registry';

const props = withDefaults(defineProps<{ layout: Viewport; night: boolean; animated?: boolean }>(), {
  animated: true,
});

const app = useAppStore();
const editor = useEditorStore();

const darkEl = ref<HTMLCanvasElement | null>(null);
const glowEl = ref<HTMLCanvasElement | null>(null);

const NIGHT_ALPHA = 0.64;
const AMBIENT_COLOR = 'rgb(34, 33, 58)';
const PARTICLE_R = 0.05;
const FRAME_MS = 33;

let raf = 0;
let nightAmount = 0;
let lastTs = 0;
let lastDraw = 0;
let ro: ResizeObserver | null = null;

function placementFor(item: RoomItem): Placement | null {
  if (props.layout === 'mobile') {
    if (item.hideMobile && !editor.isEditing) return null;
    return item.mobile ?? deriveMobile(item.desktop);
  }
  return item.desktop;
}

function staticLights(stageAspect: number): ResolvedLight[] {
  const items = editor.isEditing ? editor.items : app.roomItems;
  const out: ResolvedLight[] = [];
  for (const item of items) {
    const cat = getCatalogItem(item.catalogId);
    if (!cat) continue;
    const p = placementFor(item);
    if (!p) continue;
    let host: CatalogItem | undefined;
    let hostPlacement: Placement | null = null;
    if (item.attachTo) {
      const hi = items.find((i) => i.id === item.attachTo);
      if (hi) {
        host = getCatalogItem(hi.catalogId);
        hostPlacement = host ? placementFor(hi) : null;
      }
    }
    out.push(
      ...(host && hostPlacement
        ? resolveItemLights(item, cat, p, stageAspect, host, hostPlacement)
        : resolveItemLights(item, cat, p, stageAspect)),
    );
  }
  return out;
}

/** Light sources from live particle nodes, so fireflies follow their own motion. */
function particleLights(room: HTMLElement, rect: DOMRect): ResolvedLight[] {
  const out: ResolvedLight[] = [];
  const type = lightTypeDef('firefly');
  const dist = lightDistributionDef('point');
  room.querySelectorAll<HTMLElement>('.fx-particle--light').forEach((n) => {
    const b = n.getBoundingClientRect();
    if (!b.width && !b.height) return;
    const level = Number(n.dataset.lightLevel ?? '1');
    out.push({
      key: `p:${n.dataset.pid ?? Math.round(b.left)}`,
      cx: (b.left + b.width / 2 - rect.left) / rect.width,
      cy: (b.top + b.height / 2 - rect.top) / rect.height,
      r: PARTICLE_R,
      color: n.dataset.light || '#ffd76b',
      intensity: type.intensity * level * dist.gain,
      flicker: type.flicker,
      stops: dist.stops,
      distribution: 'point',
      directional: false,
      angle: 0,
      direction: 90,
      penumbra: 0,
    });
  });
  return out;
}

function draw(ts: number): void {
  const dark = darkEl.value;
  const glow = glowEl.value;
  const room = dark?.parentElement as HTMLElement | null;
  if (!dark || !glow || !room) return;
  const rect = room.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let lights: ResolvedLight[] = [];
  if (nightAmount > 0.002) {
    const aspect = rect.width / Math.max(1, rect.height);
    lights = [...staticLights(aspect), ...particleLights(room, rect)].map((l) => ({
      ...l,
      intensity: l.intensity * nightAmount,
    }));
  }
  drawLightmap(
    dark,
    glow,
    rect.width,
    rect.height,
    dpr,
    lights,
    { color: AMBIENT_COLOR, alpha: NIGHT_ALPHA * nightAmount },
    ts,
  );
}

function step(ts: number): void {
  const target = props.night ? 1 : 0;
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;
  if (target !== nightAmount) {
    nightAmount += (target - nightAmount) * Math.min(1, dt / 0.6);
    if (Math.abs(target - nightAmount) < 0.002) nightAmount = target;
  }
  const settling = target !== nightAmount;
  let keep = settling;
  if (!settling && nightAmount > 0.002) {
    const room = darkEl.value?.parentElement as HTMLElement | null;
    const r = room?.getBoundingClientRect();
    const aspect = r ? r.width / Math.max(1, r.height) : 1;
    const flickering = staticLights(aspect).some((l) => l.flicker > 0) || !!room?.querySelector('.fx-particle--light');
    // Keep animating while editing (things move) or while any light flickers.
    keep = flickering || editor.isEditing;
  }
  if (settling || ts - lastDraw >= FRAME_MS) {
    draw(ts);
    lastDraw = ts;
  }
  raf = keep ? requestAnimationFrame(step) : 0;
}

function ensureLoop(): void {
  if (!props.animated) {
    nightAmount = props.night ? 1 : 0;
    draw(performance.now());
    return;
  }
  if (!raf) {
    lastTs = 0;
    raf = requestAnimationFrame(step);
  }
}

onMounted(() => {
  nightAmount = props.night ? 1 : 0;
  ensureLoop();
  const room = darkEl.value?.parentElement;
  if (room && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => ensureLoop());
    ro.observe(room);
  }
});

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf);
  ro?.disconnect();
  ro = null;
});

watch([() => props.night, () => props.layout, () => app.roomItems, () => editor.items], () => ensureLoop());
</script>

<template>
  <canvas ref="darkEl" class="room__darkness" aria-hidden="true"></canvas>
  <canvas ref="glowEl" class="room__glow" aria-hidden="true"></canvas>
</template>
