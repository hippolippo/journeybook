<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Placement, RoomItem } from '@/data/types';
import type { Viewport } from '@/stores/app';
import { getCatalogItem } from '@/catalog/catalog';
import { activeEffects, effectClasses, effectVars, hasGlow, smokeCount } from '@/catalog/effects';
import { colorizeSvg, svgToDataUrl } from '@/catalog/svgColor';
import { LAYER_BASE, bandFor, deriveMobile, resolveItemStyle } from '@/room/geometry';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import WallClock from './WallClock.vue';

const props = defineProps<{ item: RoomItem; layout: Viewport; editable?: boolean }>();
const rootEl = ref<HTMLElement | null>(null);
const app = useAppStore();
const editor = useEditorStore();

const cat = computed(() => getCatalogItem(props.item.catalogId));
const hiddenHere = computed(() => props.layout === 'mobile' && !!props.item.hideMobile);
const placement = computed<Placement | null>(() => {
  if (props.layout === 'mobile') {
    if (!props.editable && hiddenHere.value) return null;
    return props.item.mobile ?? deriveMobile(props.item.desktop);
  }
  return props.item.desktop;
});
const canEdit = computed(() => !!props.editable && editor.isEditing);
const colorVars = computed(() => {
  const vars: Record<string, string> = {};
  for (const slot of cat.value?.colorSlots ?? []) {
    vars[`--c-${slot.id}`] = props.item.color[slot.id] ?? slot.default;
  }
  return vars;
});
const style = computed(() => {
  if (!cat.value || !placement.value) return { display: 'none' };
  const z = LAYER_BASE[props.item.layer] + props.item.z;
  // Repeating items tile across the whole band width.
  if (cat.value.repeat) {
    const band = bandFor(props.item.layer);
    const h = placement.value.scale * band.height * 100;
    const bottomFrac = band.top + placement.value.y * band.height;
    return {
      left: '0%',
      width: cat.value.repeat === 'y' ? `${cat.value.aspect * h}cqh` : '100%',
      top: `${(bottomFrac * 100 - h).toFixed(2)}cqh`,
      height: `${h.toFixed(2)}cqh`,
      transform: 'none',
      zIndex: String(z),
      ...colorVars.value,
    };
  }
  const base = resolveItemStyle(props.item.layer, z, placement.value, cat.value);
  return { ...base, ...colorVars.value };
});
// Tiled background; recoloured by substituting the slots into the inline SVG.
const repeatImage = computed(() => {
  if (!cat.value?.repeat) return '';
  if (cat.value.raw && cat.value.colorSlots.length) {
    return svgToDataUrl(colorizeSvg(cat.value.raw, props.item.color, cat.value.colorSlots));
  }
  return `url("${art.value}")`;
});
const repeatStyle = computed(() => {
  if (!cat.value?.repeat || !placement.value) return {};
  return {
    backgroundImage: repeatImage.value,
    backgroundRepeat: cat.value.repeat === 'both' ? 'repeat' : cat.value.repeat === 'y' ? 'repeat-y' : 'repeat-x',
    // Tile height = the strip height; width comes from the SVG's own ratio.
    backgroundSize: 'auto 100%',
    backgroundPosition: '0 0',
  };
});
const selected = computed(() => editor.isEditing && editor.selectedId === props.item.id);
const dayNight = computed(() => (editor.isEditing ? editor.timeOfDay : app.timeOfDay));
const night = computed(() => dayNight.value === 'night');
const art = computed(() => {
  if (!cat.value) return '';
  return night.value && cat.value.art.night ? cat.value.art.night : cat.value.art.day;
});

// ---- effects (configured on the asset, no code change) ----
const fx = computed(() => activeEffects(cat.value?.effect ?? null, night.value));
const fxClass = computed(() => effectClasses(fx.value));
const fxStyle = computed(() => effectVars(fx.value));
const smokeN = computed(() => smokeCount(fx.value));
const glow = computed(() => hasGlow(fx.value));
function smokeStyle(i: number): Record<string, string> {
  return { animationDelay: `${(i * 0.85).toFixed(2)}s` };
}

// --- robust pointer dragging ---
const DRAG_THRESHOLD = 4;
const dragging = ref(false);
let pointerId = -1;
let startX = 0;
let startY = 0;
let origin: Placement | null = null;
let pending = false;
let moved = false;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function onDown(event: PointerEvent) {
  if (!canEdit.value || event.button !== 0) return;
  event.stopPropagation();
  editor.select(props.item.id);
  if (props.item.locked) return;
  pointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  pending = true;
  moved = false;
  origin = null;
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}
function onMove(event: PointerEvent) {
  if (!pending || event.pointerId !== pointerId || !placement.value || !cat.value) return;
  if (!moved) {
    if (Math.abs(event.clientX - startX) < DRAG_THRESHOLD && Math.abs(event.clientY - startY) < DRAG_THRESHOLD) {
      return;
    }
    moved = true;
    dragging.value = true;
    origin = { ...placement.value };
  }
  if (!origin) return;
  const stage = rootEl.value?.closest('.room') as HTMLElement | null;
  const rect = stage?.getBoundingClientRect();
  const w = rect?.width ?? window.innerWidth;
  const h = rect?.height ?? window.innerHeight;
  const band = bandFor(props.item.layer);
  const dx = (event.clientX - startX) / w;
  const dy = (event.clientY - startY) / (h * band.height);
  editor.updatePlacement(props.item.id, props.layout, {
    x: clamp(origin.x + dx, 0.02, 0.98),
    y: clamp(origin.y + dy, 0, 1),
  });
}
function onUp(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  pending = false;
  moved = false;
  dragging.value = false;
  pointerId = -1;
}
</script>

<template>
  <div
    v-if="cat && placement"
    ref="rootEl"
    class="room-item"
    :class="{
      'room-item--editable': canEdit,
      'room-item--selected': selected,
      'room-item--dragging': dragging,
      'room-item--locked': props.item.locked,
      'room-item--hidden-mobile': hiddenHere,
      'room-item--repeat': !!cat.repeat,
    }"
    :style="style"
    :data-catalog="props.item.catalogId"
    :data-item-id="props.item.id"
    draggable="false"
    @pointerdown="onDown"
    @dragstart.prevent
  >
    <span class="room-item__art" :class="fxClass" :style="fxStyle">
      <span v-if="cat.repeat" class="room-item__repeat" :style="repeatStyle"></span>
      <WallClock v-else-if="cat.component === 'clock'" />
      <span v-else-if="cat.raw" class="room-item__svg" v-html="cat.raw"></span>
      <img v-else :src="art" alt="" draggable="false" />
      <span v-if="glow" class="fx-glow" aria-hidden="true"></span>
      <span v-for="n in smokeN" :key="n" class="fx-smoke" :style="smokeStyle(n)" aria-hidden="true"></span>
    </span>
    <span v-if="canEdit && props.item.locked" class="room-item__lock icon icon--lock" aria-hidden="true"></span>
  </div>
</template>
