<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Placement, RoomItem } from '@/data/types';
import type { Band } from '@/catalog/types';
import type { Viewport } from '@/stores/app';
import { getCatalogItem } from '@/catalog/catalog';
import { EMPTY_VISUALS, resolveVisuals } from '@/catalog/effects';
import { colorizeSvg, svgToDataUrl } from '@/catalog/svgColor';
import {
  bandFor,
  deriveMobile,
  itemRect,
  resolveAttachedStyle,
  resolveItemStyle,
} from '@/room/geometry';
import { canHost, hostAt } from '@/room/attach';
import { itemsAtPoint } from '@/room/pick';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import WallClock from './WallClock.vue';
import FxLayer from './FxLayer.vue';

const props = defineProps<{ item: RoomItem; layout: Viewport; editable?: boolean; ghost?: boolean }>();
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

// ---- host (furniture/shelf) for attached surface items ----
const allItems = computed<RoomItem[]>(() => (editor.isEditing ? editor.items : app.roomItems));
const hostItem = computed(() => (props.item.attachTo ? allItems.value.find((i) => i.id === props.item.attachTo) : undefined));
const hostCat = computed(() => (hostItem.value ? getCatalogItem(hostItem.value.catalogId) : undefined));
const hostPlacement = computed<Placement | null>(() => {
  const h = hostItem.value;
  if (!h) return null;
  if (props.layout === 'mobile') {
    if (!props.editable && h.hideMobile) return null;
    return h.mobile ?? deriveMobile(h.desktop);
  }
  return h.desktop;
});
const attached = computed(
  () => !!hostItem.value && !!hostCat.value && !!hostPlacement.value && placement.value?.ax != null,
);

const canEdit = computed(() => !props.ghost && !!props.editable && editor.isEditing);
const colorVars = computed(() => {
  const vars: Record<string, string> = {};
  for (const slot of cat.value?.colorSlots ?? []) {
    vars[`--c-${slot.id}`] = props.item.color[slot.id] ?? slot.default;
  }
  return vars;
});
const selected = computed(() => !props.ghost && editor.isEditing && editor.selectedId === props.item.id);
const style = computed(() => {
  if (!cat.value || !placement.value) return { display: 'none' };
  // Depth is a single absolute scale for every item; items keep their own depth
  // even while selected. The moving preview is a separate translucent element.
  const z = props.ghost ? 9999 : props.item.z;
  // Repeating items tile across the whole band width.
  if (cat.value.repeat) {
    const band = bandFor(cat.value.band);
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
  // Attached surface items are positioned relative to their host box.
  if (attached.value && hostCat.value && hostPlacement.value) {
    const hostRect = itemRect(hostCat.value.band, hostPlacement.value, hostCat.value.aspect);
    const base = resolveAttachedStyle(
      hostRect,
      hostPlacement.value.x,
      z,
      placement.value,
      cat.value.aspect,
      cat.value.band,
    );
    return { ...base, ...colorVars.value };
  }
  // Loose surface items can be dragged anywhere on the stage (floor or wall) so
  // they can be dropped onto a shelf or rest on the wall; size still uses the
  // item's own band.
  const positionBand: Band = cat.value.layer === 'surface' ? 'both' : cat.value.band;
  const base = resolveItemStyle(positionBand, z, placement.value, cat.value, cat.value.band);
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
const dayNight = computed(() => (editor.isEditing ? editor.timeOfDay : app.timeOfDay));
const night = computed(() => dayNight.value === 'night');
const art = computed(() => {
  if (!cat.value) return '';
  return night.value && cat.value.art.night ? cat.value.art.night : cat.value.art.day;
});

// ---- effects (configured on the asset, no code change) ----
const visuals = computed(() => (!props.ghost && cat.value ? resolveVisuals(cat.value, night.value) : EMPTY_VISUALS));

// --- robust pointer dragging ---
const DRAG_THRESHOLD = 4;
const dragging = ref(false);
let pointerId = -1;
let startX = 0;
let startY = 0;
let origin: Placement | null = null;
let pending = false;
let moved = false;
const stack: string[] = [];

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function onDown(event: PointerEvent) {
  if (!canEdit.value || event.button !== 0) return;
  event.stopPropagation();
  editor.select(props.item.id);
  if (props.item.locked) return;
  stack.length = 0;
  for (const it of itemsAtPoint(allItems.value, event.clientX, event.clientY)) stack.push(it.id);
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
    if (canEdit.value) editor.setDragging(props.item.id);
  }
  if (!origin) return;
  const stage = rootEl.value?.closest('.room') as HTMLElement | null;
  const rect = stage?.getBoundingClientRect();
  const w = rect?.width ?? window.innerWidth;
  const h = rect?.height ?? window.innerHeight;
  // Dragging an attached item moves it (host-relative) along its host, keeping
  // the grab point under the cursor.
  if (attached.value && hostItem.value) {
    const hostEl = stage?.querySelector(`[data-item-id="${hostItem.value.id}"]`) as HTMLElement | null;
    if (hostEl) {
      const hr = hostEl.getBoundingClientRect();
      const dax = (event.clientX - startX) / (hr.width || 1);
      const day = (event.clientY - startY) / (hr.height || 1);
      editor.updatePlacement(props.item.id, props.layout, {
        // Allow dragging beyond the host so the item can be pulled off to detach.
        ax: clamp((origin.ax ?? 0.5) + dax, -1, 2),
        ay: clamp((origin.ay ?? 0) + day, -1, 2),
      });
      return;
    }
  }
  const band = bandFor(cat.value.layer === 'surface' ? 'both' : cat.value.band);
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
  const wasMoved = moved;
  // Hit-test before clearing the `dragging` class: while it is set the dragged
  // item ignores pointer events, so we can see the host underneath it.
  const isSurface = cat.value?.layer === 'surface';
  const hit = wasMoved && isSurface && !props.item.locked && cat.value
    ? hostAt(event.clientX, event.clientY, cat.value, props.item.id)
    : null;
  // A click (no drag) cycles selection through items stacked at the point.
  if (!wasMoved && stack.length) {
    editor.pickAt([...stack], event.clientX, event.clientY);
    stack.length = 0;
  }
  pending = false;
  moved = false;
  dragging.value = false;
  if (canEdit.value) editor.setDragging(null);
  pointerId = -1;
  if (!wasMoved || !cat.value || props.item.locked || !isSurface) return;
  const stage = rootEl.value?.closest('.room') as HTMLElement | null;
  if (hit && canHost(cat.value, getCatalogItem(hit.catalogId))) {
    if (attached.value && hostItem.value?.id === hit.id) return; // already attached here; offset set while dragging
    const hostEl = stage?.querySelector(`[data-item-id="${hit.id}"]`);
    const elR = rootEl.value?.getBoundingClientRect();
    if (hostEl && elR) {
      // Attach without moving: map the item's current anchor (bottom-centre)
      // into the host's box rather than snapping it to the pointer.
      const hr = hostEl.getBoundingClientRect();
      const ax = clamp((elR.left + elR.width / 2 - hr.left) / (hr.width || 1), 0, 1);
      const ay = clamp((elR.bottom - hr.top) / (hr.height || 1), 0, 1);
      editor.setAttach(props.item.id, props.layout, hit.id, ax, ay);
    }
    return;
  }
  if (props.item.attachTo) {
    // Detach, keeping the item where it currently sits on screen.
    const stageR = stage?.getBoundingClientRect();
    const elR = rootEl.value?.getBoundingClientRect();
    if (stageR && elR) {
      const band = bandFor(cat.value.layer === 'surface' ? 'both' : cat.value.band);
      const x = clamp((elR.left + elR.width / 2 - stageR.left) / stageR.width, 0.02, 0.98);
      const y = clamp(((elR.bottom - stageR.top) / stageR.height - band.top) / band.height, 0, 1);
      editor.detach(props.item.id, props.layout, x, y);
    }
  }
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
      'room-item--ghost': props.ghost,
      'room-item--locked': props.item.locked,
      'room-item--hidden-mobile': hiddenHere,
      'room-item--repeat': !!cat.repeat,
    }"
    :style="style"
    :data-catalog="props.item.catalogId"
    :data-item-id="props.ghost ? undefined : props.item.id"
    draggable="false"
    @pointerdown="onDown"
    @dragstart.prevent
  >
    <span class="room-item__art">
      <FxLayer :animations="visuals.animations" :particles="visuals.particles" :seed="props.item.id">
        <span v-if="cat.repeat" class="room-item__repeat" :style="repeatStyle"></span>
        <WallClock v-else-if="cat.component === 'clock'" />
        <span v-else-if="cat.raw" class="room-item__svg" v-html="cat.raw"></span>
        <img v-else :src="art" alt="" draggable="false" />
      </FxLayer>
    </span>
    <span v-if="canEdit && props.item.locked" class="room-item__lock icon icon--lock" aria-hidden="true"></span>
  </div>
</template>
