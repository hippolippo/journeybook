<script setup lang="ts">
import { computed, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import type { Placement, RoomItem } from '@/data/types';
import type { Band } from '@/catalog/types';
import type { Viewport } from '@/stores/app';
import { getCatalogItem } from '@/catalog/catalog';
import { EMPTY_VISUALS, resolveVisuals } from '@/catalog/effects';
import { colorizeSvg, svgToDataUrl } from '@/catalog/svgColor';
import {
  bandFor,
  deriveMobile,
  resolveAttachedFlatStyle,
  resolveItemStyle,
} from '@/room/geometry';
import {
  attachedPct,
  attachedResizeRatio,
  centerPx,
  childCenterScreen,
  hostFrame,
  localRotation,
  looseAnchorPoint,
  looseRotation,
  resizeLoose,
  screenToHostLocal,
  type HostFrame,
  type StageRect,
} from '@/room/transform';
import { canHost, hostAt } from '@/room/attach';
import { attachAnchorOf, displayAnchor } from '@/room/anchor';
import { itemsAtPoint } from '@/room/pick';
import { composePose, defaultShadowAmount, levelShadowTransform, ovalShadowStyle, shadowFilter } from '@/room/shadow';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import WallClock from './WallClock.vue';
import FxLayer from './FxLayer.vue';

const props = defineProps<{ item: RoomItem; layout: Viewport; editable?: boolean; ghost?: boolean; light?: boolean }>();
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

// While dragging, the host the item is currently over (live attach preview).
const preview = computed(() => (editor.attachPreview?.itemId === props.item.id ? editor.attachPreview : null));
const removePreview = computed(() => !props.ghost && editor.removePreviewId === props.item.id);
const previewHost = computed(() => {
  const pv = preview.value;
  return pv ? (allItems.value.find((i) => i.id === pv.hostId) ?? null) : null;
});
const previewHostCat = computed(() => (previewHost.value ? getCatalogItem(previewHost.value.catalogId) : undefined));
const previewHostPlacement = computed<Placement | null>(() => {
  const h = previewHost.value;
  if (!h) return null;
  if (props.layout === 'mobile') return h.mobile ?? deriveMobile(h.desktop);
  return h.desktop;
});

const canEdit = computed(() => !props.ghost && !props.light && !!props.editable && editor.isEditing);
const colorVars = computed(() => {
  const vars: Record<string, string> = {};
  for (const slot of cat.value?.colorSlots ?? []) {
    vars[`--c-${slot.id}`] = props.item.color[slot.id] ?? slot.default;
  }
  return vars;
});
const selected = computed(() => !props.ghost && !props.light && editor.isEditing && editor.selectedId === props.item.id);

/** Effective shadow: the item's own amount, else the catalog default. */
const shadowAmount = computed(() => props.item.shadow ?? (cat.value ? defaultShadowAmount(cat.value) : 0));
/** Shape-following drop-shadow for every shadow item (resting items also get the oval). */
const shadowCss = computed(() => {
  const c = cat.value;
  if (!c || c.repeat) return 'none';
  return shadowFilter(shadowAmount.value);
});
/** Contact (oval) shadow style for resting items (trinkets/furniture). */
const ovalStyle = computed(() =>
  cat.value && !cat.value.repeat ? ovalShadowStyle(cat.value.category, shadowAmount.value) : null,
);
/** Effective on-screen pose, including a rotated/flipped host for attached items. */
const ovalPose = computed(() => {
  const p = placement.value;
  if (!p) return { rotation: 0, flip: false };
  const child = { rotation: p.rotation, flip: p.flip };
  if (attached.value && hostPlacement.value) {
    return hostCat.value?.repeat ? child : composePose(hostPlacement.value, child);
  }
  if (preview.value && previewHostPlacement.value) {
    return previewHostCat.value?.repeat ? child : composePose(previewHostPlacement.value, child);
  }
  return child;
});
/** Cancels the item's rotation so the contact shadow stays level and centred. */
const ovalWrapperStyle = computed(() => ({ transform: levelShadowTransform(ovalPose.value) }));

const positionBand = computed<Band>(() =>
  cat.value?.layer === 'surface' ? 'both' : (cat.value?.band ?? 'floor'),
);
const sizeBand = computed<Band>(() => cat.value?.band ?? 'floor');

/** Nested style: positioned relative to the host box so host transforms cascade. */
const nestedStyle = computed<Record<string, string> | null>(() => {
  const c = cat.value;
  const p = placement.value;
  const hc = hostCat.value;
  const hp = hostPlacement.value;
  if (!c || !p || !hc || !hp) return null;
  const { heightPct, widthPct } = attachedPct(c, p, hc);
  const ax = p.ax ?? 0.5;
  const ay = p.ay ?? 0;
  const hostH = hp.scale * bandFor(hc.band).height * 100;
  const childH = (heightPct / 100) * hostH;
  const childW = childH * c.aspect;
  const q = displayAnchor(attachAnchorOf(c), p.flip);
  return {
    left: `calc(${(ax * 100).toFixed(4)}% - ${(q.x * childW).toFixed(4)}cqh)`,
    top: `calc(${(ay * 100).toFixed(4)}% - ${(q.y * childH).toFixed(4)}cqh)`,
    bottom: 'auto',
    width: `${widthPct.toFixed(4)}%`,
    height: `${heightPct.toFixed(4)}%`,
    transform: `rotate(${p.rotation}deg) scaleX(${p.flip ? -1 : 1})`,
    transformOrigin: '50% 50%',
    zIndex: String(props.ghost ? 9999 : props.item.z),
    ...colorVars.value,
  };
});

const baseStyle = computed(() => {
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
  // Attached children nest inside their host. The floating drag preview uses
  // the equivalent flat screen style so it lines up exactly.
  if (attached.value && !props.ghost) return nestedStyle.value ?? { display: 'none' };
  if (attached.value && props.ghost && hostCat.value && hostPlacement.value) {
    const base = resolveAttachedFlatStyle(hostCat.value, hostPlacement.value, cat.value, placement.value, z);
    return { ...base, ...colorVars.value };
  }
  // While dragging over a host, show the attached rotation/size live (as it
  // will look once dropped), instead of the loose transform.
  if (preview.value && previewHostCat.value && previewHostPlacement.value) {
    const childPlacement: Placement = { ...placement.value, ax: preview.value.ax, ay: preview.value.ay };
    const base = resolveAttachedFlatStyle(
      previewHostCat.value,
      previewHostPlacement.value,
      cat.value,
      childPlacement,
      z,
    );
    return { ...base, ...colorVars.value };
  }
  // Loose surface items can be dragged anywhere on the stage (floor or wall) so
  // they can be dropped onto a shelf or rest on the wall; size still uses the
  // item's own band.
  const base = resolveItemStyle(positionBand.value, z, placement.value, cat.value, cat.value.band);
  return { ...base, ...colorVars.value };
});
const style = computed<Record<string, string>>(() => ({
  ...baseStyle.value,
  '--room-shadow': shadowCss.value,
}));
const dayNight = computed(() => (editor.isEditing ? editor.timeOfDay : app.timeOfDay));
const night = computed(() => dayNight.value === 'night');
const art = computed(() => {
  if (!cat.value) return '';
  return night.value && cat.value.art.night ? cat.value.art.night : cat.value.art.day;
});
/** Inline SVG for recoloured assets, picking the day or night variant. */
const rawArt = computed(() => {
  const c = cat.value;
  if (!c) return '';
  return night.value && c.rawNight ? c.rawNight : (c.raw ?? '');
});
// Tiled background; recoloured by substituting the slots into the inline SVG.
const repeatImage = computed(() => {
  if (!cat.value?.repeat) return '';
  if (rawArt.value && cat.value.colorSlots.length) {
    return svgToDataUrl(colorizeSvg(rawArt.value, props.item.color, cat.value.colorSlots));
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

// ---- effects (configured on the asset, no code change) ----
// Freeze animations for the item being dragged too, so the translucent preview
// and the real (animated) item sit at the same base transform and line up.
const draggingHere = computed(() => !props.ghost && editor.draggingId === props.item.id);
const visuals = computed(() =>
  !props.ghost && !draggingHere.value && cat.value ? resolveVisuals(cat.value, night.value) : EMPTY_VISUALS,
);

// The emissive bloom of a light-emitting item, surfaced in the lights layer
// that renders above the night overlay so its light is not swallowed.
const bloom = computed(() => visuals.value.animations.find((a) => a.bloom));
const lightStyle = computed<Record<string, string>>(() => ({
  '--fx-color': bloom.value?.vars?.['--fx-color'] ?? '#ffd88a',
  '--fx-dur': bloom.value?.duration ?? '3.5s',
}));

// --- robust pointer dragging / scaling / rotating ---
type Mode = 'move' | 'resize' | 'rotate';
const DRAG_THRESHOLD = 4;
const dragging = ref(false);
let mode: Mode = 'move';
let pointerId = -1;
let startX = 0;
let startY = 0;
let origin: Placement | null = null;
let originScale = 1;
let pending = false;
let moved = false;
let looseMove = false;
let startedAttached = false;
let stageEl: HTMLElement | null = null;
const stack: string[] = [];

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function stageRect(): StageRect | null {
  // Cache the stage element for the gesture: an item can be re-parented
  // (e.g. detached from its host) mid-drag, which makes `rootEl` null.
  const stage = stageEl ?? (rootEl.value?.closest('.room') as HTMLElement | null);
  const r = stage?.getBoundingClientRect();
  if (!r) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
function hostFrameOf(stage: StageRect): HostFrame | null {
  if (!hostCat.value || !hostPlacement.value) return null;
  return hostFrame(hostCat.value, hostPlacement.value, stage);
}
function begin(event: PointerEvent, m: Mode) {
  if (!canEdit.value || event.button !== 0) return;
  event.stopPropagation();
  editor.select(props.item.id);
  if (props.item.locked || !placement.value) return;
  mode = m;
  pointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  origin = { ...placement.value };
  originScale = placement.value.scale;
  pending = true;
  moved = false;
  looseMove = false;
  startedAttached = attached.value;
  editor.setAttachPreview(null);
  editor.setRemovePreview(null);
  stageEl = (rootEl.value?.closest('.room') as HTMLElement | null) ?? null;
  stack.length = 0;
  if (m === 'move') {
    for (const it of itemsAtPoint(allItems.value, event.clientX, event.clientY)) stack.push(it.id);
  }
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}
function onDown(event: PointerEvent) {
  begin(event, 'move');
}
function onResizeDown(event: PointerEvent) {
  begin(event, 'resize');
}
function onRotateDown(event: PointerEvent) {
  begin(event, 'rotate');
}
/**
 * Turn the dragged item into a free (screen-space) item at the same centre.
 * Its own rotation is kept, so removing it from furniture restores its
 * upright orientation instead of keeping the furniture's tilt.
 */
function detachLoose(stage: StageRect, frame: HostFrame) {
  if (!cat.value || !hostCat.value || !origin) return;
  const { heightPct } = attachedPct(cat.value, origin, hostCat.value);
  const childH = (heightPct / 100) * frame.heightPx;
  const childW = childH * cat.value.aspect;
  const center = childCenterScreen(
    origin.ax ?? 0.5,
    origin.ay ?? 0,
    childH,
    frame,
    attachAnchorOf(cat.value),
    childW,
    origin.flip,
  );
  const h = origin.scale * bandFor(sizeBand.value).height * stage.height;
  editor.detach(
    props.item.id,
    props.layout,
    clamp((center.x - stage.left) / stage.width, 0.02, 0.98),
    clamp((center.y - stage.top + h / 2) / stage.height, 0, 1),
  );
  if (placement.value) origin = { ...placement.value };
  looseMove = true;
}
/** Set (or clear) the live "will attach here" preview for a dragged loose item. */
function updateAttachPreview(stage: StageRect) {
  const p = placement.value;
  if (!p || !cat.value || attached.value) {
    editor.setAttachPreview(null);
    return;
  }
  const anchor = looseAnchorPoint(cat.value, positionBand.value, sizeBand.value, p, stage);
  const hit = hostAt(anchor.x, anchor.y + 2, cat.value, props.item.id);
  const hitCat = hit ? getCatalogItem(hit.catalogId) : undefined;
  const host = hit ? allItems.value.find((i) => i.id === hit.id) : undefined;
  if (!hit || !host || !hitCat || !canHost(cat.value, hitCat)) {
    editor.setAttachPreview(null);
    // Started on furniture and now over nothing -> it will be removed.
    editor.setRemovePreview(startedAttached ? props.item.id : null);
    return;
  }
  const hostPlacement =
    props.layout === 'mobile' ? (host.mobile ?? deriveMobile(host.desktop)) : host.desktop;
  const frame = hostFrame(hitCat, hostPlacement, stage);
  const local = screenToHostLocal(anchor.x - frame.pivot.x, anchor.y - frame.pivot.y, frame);
  editor.setAttachPreview({
    itemId: props.item.id,
    hostId: hit.id,
    ax: clamp(local.x / frame.widthPx + 0.5, 0, 1),
    ay: clamp(local.y / frame.heightPx + 0.5, 0, 1),
  });
  editor.setRemovePreview(null);
}
function onMove(event: PointerEvent) {
  if (!pending || event.pointerId !== pointerId || !origin || !placement.value || !cat.value) return;
  if (!moved) {
    if (Math.abs(event.clientX - startX) < DRAG_THRESHOLD && Math.abs(event.clientY - startY) < DRAG_THRESHOLD) {
      return;
    }
    moved = true;
    dragging.value = true;
    editor.snapshot();
    if (mode === 'move') editor.setDragging(props.item.id);
  }
  const stage = stageRect();
  if (!stage) return;
  const pointer = { x: event.clientX, y: event.clientY };
  if (mode === 'move') {
    if (attached.value && !looseMove) {
      const frame = hostFrameOf(stage);
      if (!frame) return;
      const local = screenToHostLocal(event.clientX - startX, event.clientY - startY, frame);
      const nax = (origin.ax ?? 0.5) + local.x / frame.widthPx;
      const nay = (origin.ay ?? 0) + local.y / frame.heightPx;
      // While the base stays on the furniture it remains attached; once it
      // leaves, it detaches and continues as a free, screen-space item.
      if (nax < -0.02 || nax > 1.02 || nay < -0.02 || nay > 1.02) {
        detachLoose(stage, frame);
      } else {
        editor.updatePlacement(props.item.id, props.layout, { ax: nax, ay: nay });
        editor.setAttachPreview(null);
        editor.setRemovePreview(null);
        return;
      }
    }
    const band = bandFor(positionBand.value);
    const dx = (event.clientX - startX) / stage.width;
    const dy = (event.clientY - startY) / (stage.height * band.height);
    editor.updatePlacement(props.item.id, props.layout, {
      x: clamp(origin.x + dx, 0.02, 0.98),
      y: clamp(origin.y + dy, 0, 1),
    });
    updateAttachPreview(stage);
    return;
  }
  if (mode === 'resize') {
    if (attached.value && hostCat.value) {
      const frame = hostFrameOf(stage);
      if (!frame) return;
      const { heightPct } = attachedPct(cat.value, origin, hostCat.value);
      const childH = (heightPct / 100) * frame.heightPx;
      const childW = childH * cat.value.aspect;
      const ratio = attachedResizeRatio(origin.ax ?? 0.5, origin.ay ?? 0, origin.rotation, childW, childH, pointer, frame);
      editor.updatePlacement(props.item.id, props.layout, { scale: clamp(originScale * ratio, 0.03, 4) });
      return;
    }
    const next = resizeLoose(positionBand.value, sizeBand.value, origin, cat.value.aspect, pointer, stage);
    editor.updatePlacement(props.item.id, props.layout, { ...next, scale: clamp(next.scale, 0.03, 4) });
    return;
  }
  // rotate about the item's centre (easier to use than the bottom anchor)
  if (attached.value && hostCat.value) {
    const frame = hostFrameOf(stage);
    if (!frame) return;
    const { heightPct } = attachedPct(cat.value, origin, hostCat.value);
    const childH = (heightPct / 100) * frame.heightPx;
    const center = childCenterScreen(origin.ax ?? 0.5, origin.ay ?? 0, childH, frame);
    const screenAngle = looseRotation(center, pointer);
    editor.updatePlacement(props.item.id, props.layout, { rotation: localRotation(screenAngle, frame) });
    return;
  }
  const center = centerPx(positionBand.value, sizeBand.value, origin, stage);
  editor.updatePlacement(props.item.id, props.layout, { rotation: looseRotation(center, pointer) });
}
function onUp(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  const wasMoved = moved;
  const isSurface = cat.value?.layer === 'surface';
  const stage = stageRect();
  const p = placement.value;
  // Decide what the item is dropped on from its attach point, not the grab
  // point, so a surface item resting on furniture re-attaches when nudged.
  // Hit-test while the `dragging` class is set (it ignores pointer events then).
  const anchor =
    cat.value && stage && p
      ? looseAnchorPoint(cat.value, positionBand.value, sizeBand.value, p, stage)
      : null;
  const hit =
    mode === 'move' && wasMoved && isSurface && !props.item.locked && cat.value && stage && p && anchor
      ? hostAt(anchor.x, anchor.y + 2, cat.value, props.item.id)
      : null;
  // A click (no drag) cycles selection through items stacked at the point.
  if (mode === 'move' && !wasMoved && stack.length) {
    editor.pickAt([...stack], event.clientX, event.clientY);
    stack.length = 0;
  }
  pending = false;
  moved = false;
  dragging.value = false;
  stageEl = null;
  editor.setAttachPreview(null);
  editor.setRemovePreview(null);
  if (mode === 'move' && canEdit.value) editor.setDragging(null);
  pointerId = -1;
  if (mode !== 'move' || !wasMoved || !cat.value || props.item.locked || !isSurface) return;
  // If it stayed attached the whole drag, onMove already set its host-relative
  // position — leave it alone (re-attaching here would jump it).
  if (attached.value) return;
  if (!stage || !hit || !p || !anchor) return;
  if (!canHost(cat.value, getCatalogItem(hit.catalogId))) return;
  const dropHostCat = getCatalogItem(hit.catalogId);
  const dropHost = allItems.value.find((i) => i.id === hit.id);
  const dropHostPlacement = dropHost
    ? props.layout === 'mobile'
      ? (dropHost.mobile ?? deriveMobile(dropHost.desktop))
      : dropHost.desktop
    : null;
  if (!dropHostCat || !dropHostPlacement) return;
  // Pin the item's declared attach point to the host. Its own rotation is kept,
  // so it tilts with the furniture while attached.
  const frame = hostFrame(dropHostCat, dropHostPlacement, stage);
  const local = screenToHostLocal(anchor.x - frame.pivot.x, anchor.y - frame.pivot.y, frame);
  editor.setAttach(
    props.item.id,
    props.layout,
    hit.id,
    clamp(local.x / frame.widthPx + 0.5, 0, 1),
    clamp(local.y / frame.heightPx + 0.5, 0, 1),
  );
}

</script>

<template>
  <div
    v-if="cat && placement"
    ref="rootEl"
    :class="
      props.light
        ? 'room-light'
        : [
            'room-item',
            {
              'room-item--editable': canEdit,
              'room-item--selected': selected,
              'room-item--dragging': dragging,
              'room-item--ghost': props.ghost,
              'room-item--locked': props.item.locked,
              'room-item--hidden-mobile': hiddenHere,
              'room-item--repeat': !!cat.repeat,
              'room-item--attached': attached && !props.ghost,
            },
          ]
    "
    :style="style"
    :data-catalog="props.ghost || props.light ? undefined : props.item.catalogId"
    :data-item-id="props.ghost || props.light ? undefined : props.item.id"
    draggable="false"
    @pointerdown="onDown"
    @dragstart.prevent
  >
    <template v-if="props.light">
      <span v-if="bloom" class="room-light__glow" :style="lightStyle" aria-hidden="true"></span>
      <span v-if="bloom" class="room-light__body" aria-hidden="true">
        <span v-if="rawArt" class="room-item__svg" v-html="rawArt"></span>
        <img v-else-if="!cat.repeat && !cat.component" :src="art" alt="" draggable="false" />
      </span>
      <slot />
    </template>
    <template v-else>
      <span v-if="canEdit && cat.hitbox?.bottom" class="room-item__hitbox" :style="{ height: `${(cat.hitbox?.bottom ?? 0) * 100}%` }" aria-hidden="true"></span>
      <span v-if="ovalStyle" class="room-item__shadow-wrap" :style="ovalWrapperStyle" aria-hidden="true">
        <span class="room-item__shadow" :style="ovalStyle"></span>
      </span>
      <span class="room-item__art">
        <FxLayer :animations="visuals.animations" :particles="visuals.particles" :seed="props.item.id" :light-level="props.item.lightLevel ?? 1">
          <span v-if="cat.repeat" class="room-item__repeat" :style="repeatStyle"></span>
          <WallClock v-else-if="cat.component === 'clock'" />
          <span v-else-if="rawArt" class="room-item__svg" v-html="rawArt"></span>
          <img v-else :src="art" alt="" draggable="false" />
        </FxLayer>
      </span>
      <slot />
      <Icon name="lock" v-if="canEdit && props.item.locked" class="room-item__lock" aria-hidden="true" />
      <span v-if="preview && !props.ghost" class="room-item__attach-badge" aria-hidden="true"></span>
      <span v-if="removePreview" class="room-item__remove-badge" aria-hidden="true"></span>
      <template v-if="selected && canEdit && !props.item.locked">
        <span class="pe-handle pe-handle--br" title="Scale" @pointerdown="onResizeDown"></span>
        <span class="pe-rot" title="Rotate" @pointerdown="onRotateDown"></span>
      </template>
    </template>
  </div>
</template>
