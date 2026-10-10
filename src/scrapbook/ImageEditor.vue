<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ImageEffects, ImageElement, ImagePreset } from '@/data/types';
import { useAppStore } from '@/stores/app';
import { usePageEditorStore } from '@/stores/pageEditor';
import { useViewport } from '@/composables/useViewport';
import { FRAMES, frameAspect, frameById } from '@/scrapbook/frames';
import { EFFECT_SLIDERS, isBuiltinPreset, mergedPresets } from '@/scrapbook/effects';
import PageElementContent from '@/scrapbook/PageElementContent.vue';
import ColorSlotsEditor from '@/scrapbook/ColorSlotsEditor.vue';

const pe = usePageEditorStore();
const app = useAppStore();
const { width, height } = useViewport();

const FRAME_COLORS = ['#fdf8ef', '#ffffff', '#f3ead6', '#e8d9c0', '#f6eccb', '#3b3a44'];

const el = computed<ImageElement | null>(() => {
  const e = pe.editingImage;
  return e && e.kind === 'image' ? e : null;
});
const frameDef = computed(() => frameById(el.value ? (el.value.frame ?? 'polaroid') : undefined));
/** Frames with an intrinsic shape (polaroid, circle, film…) fix the crop aspect. */
const frameFixed = computed(() => !!frameAspect(frameDef.value));
/** Frames whose background is visible (so it can be colored or made transparent). */
const frameColorable = computed(() => {
  const f = frameDef.value;
  if (f.colorSlots?.length) return false;
  return !!f.colorable || !!f.radius || !!f.clip;
});
const frameSlots = computed(() => frameDef.value.colorSlots ?? []);
const framePresets = computed(() => frameDef.value.presets ?? []);
const frameColors = computed(() => (el.value && el.value.kind === 'image' ? (el.value.frameColors ?? {}) : {}));
function onFrameSlotColor(slotId: string, color: string) {
  if (el.value) pe.setFrameSlotColor(el.value.id, slotId, color);
}
function onFramePresetColors(colors: Record<string, string>) {
  if (!el.value) return;
  pe.snapshot();
  pe.applyFrameColors(el.value.id, colors);
}

// Render at the same 480px logical reference as the scrapbook (then scale), so
// frame details (radii, tape, sprockets) look identical to the real page.
const LOGICAL = 480;
const availW = computed(() => Math.max(120, width.value - 340 - 48));
const availH = computed(() => Math.max(120, height.value - 48));
const logicalW = computed(() => Math.max(20, (el.value?.w ?? 0.5) * LOGICAL));
const logicalH = computed(() => Math.max(20, (el.value?.h ?? 0.5) * LOGICAL));
const previewScale = computed(() => Math.min(availW.value / logicalW.value, availH.value / logicalH.value));
const boxStyle = computed(() => ({
  width: `${logicalW.value}px`,
  height: `${logicalH.value}px`,
  transform: `scale(${previewScale.value})`,
}));
const CROP_RATIOS: { label: string; ratio: number }[] = [
  { label: '1:1', ratio: 1 },
  { label: '4:5', ratio: 0.8 },
  { label: '3:4', ratio: 0.75 },
  { label: '2:3', ratio: 0.667 },
  { label: '3:2', ratio: 1.5 },
  { label: '4:3', ratio: 1.333 },
  { label: '16:9', ratio: 1.778 },
];
function setAspect(ratio: number) {
  const e0 = el.value;
  if (!e0) return;
  pe.updateElement(e0.id, { h: Math.min(1, Math.max(0.06, e0.w / ratio)) });
}
/** Crop to the source image's natural aspect ratio. */
function setOriginalAspect() {
  const img = previewEl.value?.querySelector('.frame__img') as HTMLImageElement | null;
  if (img && img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight);
}
function resetEffect(key: keyof ImageEffects) {
  const e0 = el.value;
  if (!e0) return;
  pe.snapshot();
  pe.setEffect(e0.id, key, 0);
}

const previewEl = ref<HTMLElement | null>(null);

// crop (pan + zoom)
let pid = -1;
let start = { x: 0, y: 0 };
let originFocus = { x: 0.5, y: 0.5 };
function onPanDown(e: PointerEvent) {
  const e0 = el.value;
  if (!e0 || e0.kind !== 'image' || e.button !== 0) return;
  pe.snapshot();
  pid = e.pointerId;
  start = { x: e.clientX, y: e.clientY };
  originFocus = { x: e0.focusX ?? 0.5, y: e0.focusY ?? 0.5 };
  window.addEventListener('pointermove', onPanMove);
  window.addEventListener('pointerup', onPanUp);
  window.addEventListener('pointercancel', onPanUp);
}
function onPanMove(e: PointerEvent) {
  const e0 = el.value;
  if (e.pointerId !== pid || !e0) return;
  const win = previewEl.value?.querySelector('.frame__window')?.getBoundingClientRect();
  const img = previewEl.value?.querySelector('.frame__img')?.getBoundingClientRect();
  if (!win || !img) return;
  const RW = (img.width / win.width) * 100;
  const RH = (img.height / win.height) * 100;
  const dfx = -((e.clientX - start.x) / win.width) * (100 / RW);
  const dfy = -((e.clientY - start.y) / win.height) * (100 / RH);
  pe.setFocus(e0.id, originFocus.x + dfx, originFocus.y + dfy);
}
function onPanUp(e: PointerEvent) {
  if (e.pointerId !== pid) return;
  window.removeEventListener('pointermove', onPanMove);
  window.removeEventListener('pointerup', onPanUp);
  window.removeEventListener('pointercancel', onPanUp);
  pid = -1;
}
function onWheel(e: WheelEvent) {
  const e0 = el.value;
  if (!e0) return;
  e.preventDefault();
  pe.setZoom(e0.id, (e0.zoom ?? 1) * (1 - e.deltaY * 0.0015));
}

function num(v: string) {
  return Number(v);
}
function effectVal(key: keyof ImageEffects): number {
  return el.value?.kind === 'image' ? (el.value.effects?.[key] ?? 0) : 0;
}

// presets
const presets = computed<ImagePreset[]>(() => mergedPresets(app.imagePresets));
const presetName = ref('');
const uploadError = ref('');
function presetId(): string {
  const raw = (Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '');
  return `p-${raw.slice(0, 12)}`;
}
async function savePreset() {
  const e0 = el.value;
  if (!e0) return;
  const name = presetName.value.trim() || 'My preset';
  const existing = presets.value.find((p) => p.name.toLowerCase() === name.toLowerCase());
  await app.saveImagePreset({ id: existing?.id ?? presetId(), name, effects: { ...(e0.effects ?? {}) } });
  presetName.value = '';
}
async function deletePreset(p: ImagePreset) {
  await app.deleteImagePreset(p.id);
}
function applyPreset(p: ImagePreset) {
  if (el.value) pe.applyPreset(el.value.id, p.id, p.effects);
}

// album swap
const album = computed(() => (pe.bookId ? app.mediaFor(pe.bookId) : []));
function useMedia(id: string) {
  if (el.value) pe.changeMedia(el.value.id, id);
}
const fileInput = ref<HTMLInputElement | null>(null);
async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files) return;
  uploadError.value = '';
  for (const file of Array.from(files)) {
    try {
      const asset = await app.addMedia(pe.bookId, file);
      if (el.value) pe.changeMedia(el.value.id, asset.id);
    } catch (err) {
      console.error(err);
      uploadError.value = `Couldn't read ${file.name}.`;
    }
  }
  input.value = '';
}
</script>

<template>
  <Teleport to="body">
    <div v-if="el && el.kind === 'image'" class="imgedit">
      <div class="imgedit-stage" @pointerdown="onPanDown" @wheel="onWheel">
        <div ref="previewEl" class="img-box" :style="boxStyle">
          <div class="el el--static">
            <PageElementContent :el="el" />
          </div>
        </div>
      </div>

      <aside class="editor editor--right imgedit-panel">
        <header class="editor__head">
          <h2>Edit image</h2>
          <button class="btn btn--small btn--primary" type="button" @click="pe.closeImageEditor()">Done</button>
        </header>
        <div class="editor__body">
          <section>
            <label>Frame</label>
            <div class="frame-row">
              <button
                v-for="f in FRAMES"
                :key="f.id"
                class="frame-chip"
                :class="{ 'is-active': (el.frame ?? 'polaroid') === f.id }"
                type="button"
                :title="f.label"
                @click="pe.setFrame(el.id, f.id)"
              >
                <span class="frame-chip__box" :class="`frame-chip--${f.id}`"></span>
                <span class="frame-chip__label">{{ f.label }}</span>
              </button>
            </div>
            <ColorSlotsEditor
              v-if="frameSlots.length"
              :slots="frameSlots"
              :presets="framePresets"
              :values="frameColors"
              style="margin-top: 0.35rem"
              @update="onFrameSlotColor"
              @preset="onFramePresetColors"
            />
            <div v-else-if="frameColorable" class="swatches" style="margin-top: 0.35rem">
              <button
                class="swatch swatch--transparent"
                type="button"
                title="Transparent (cut-off parts show the page)"
                @click="pe.setFrameColor(el.id, 'transparent')"
              ></button>
              <button
                v-for="c in FRAME_COLORS"
                :key="c"
                class="swatch"
                :style="{ background: c }"
                type="button"
                @click="pe.setFrameColor(el.id, c)"
              ></button>
              <input
                type="color"
                title="Custom frame color"
                :value="el.frameColor && el.frameColor !== 'transparent' ? el.frameColor : (frameDef?.bg ?? '#fdf8ef')"
                @input="pe.setFrameColor(el.id, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </section>

          <section>
            <label>Crop</label>
            <p class="editor__muted">
              Drag the image to reposition; wheel or the slider to zoom.
              <template v-if="frameFixed">This frame fixes the crop aspect ratio.</template>
              <template v-else>Set any crop shape below.</template>
            </p>
            <div class="field">
              <span>Zoom</span>
              <input type="range" min="1" max="4" step="0.01" :value="el.zoom ?? 1" @pointerdown="pe.snapshot()" @input="pe.setZoom(el.id, num(($event.target as HTMLInputElement).value))" />
              <input type="number" min="1" max="4" step="0.05" :value="el.zoom ?? 1" @change="pe.snapshot(); pe.setZoom(el.id, num(($event.target as HTMLInputElement).value))" />
            </div>
            <template v-if="!frameFixed">
              <label style="margin-top: 0.4rem">Crop shape</label>
              <div class="chip-row">
                <button class="chip chip--wide" type="button" @click="setOriginalAspect">Original</button>
                <button
                  v-for="r in CROP_RATIOS"
                  :key="r.label"
                  class="chip chip--wide"
                  type="button"
                  @click="setAspect(r.ratio)"
                >
                  {{ r.label }}
                </button>
              </div>
              <div class="field">
                <span>W</span>
                <input type="range" min="0.06" max="1" step="0.005" :value="el.w" @pointerdown="pe.snapshot()" @input="pe.updateElement(el.id, { w: num(($event.target as HTMLInputElement).value) })" />
              </div>
              <div class="field">
                <span>H</span>
                <input type="range" min="0.06" max="1" step="0.005" :value="el.h" @pointerdown="pe.snapshot()" @input="pe.updateElement(el.id, { h: num(($event.target as HTMLInputElement).value) })" />
              </div>
            </template>
            <button class="btn btn--small" type="button" @click="pe.resetCrop(el.id)">Reset crop</button>
          </section>

          <section>
            <label>Album</label>
            <div class="editor__row">
              <button class="btn btn--small" type="button" @click="fileInput?.click()">Upload</button>
              <input ref="fileInput" class="visually-hidden" type="file" accept="image/*,.heic,.heif" @change="onFiles" />
            </div>
            <div v-if="album.length" class="album">
              <button
                v-for="m in album"
                :key="m.id"
                class="album__thumb"
                type="button"
                :class="{ 'is-active': m.id === el.mediaId }"
                @click="useMedia(m.id)"
              >
                <img v-if="app.assetUrl(m.id)" :src="app.assetUrl(m.id)" alt="" draggable="false" />
              </button>
            </div>
            <p v-if="uploadError" class="editor__error">{{ uploadError }}</p>
          </section>

          <section>
            <label>Effects</label>
            <div class="chip-row">
              <span v-for="p in presets" :key="p.id" class="preset">
                <button class="chip chip--wide" :class="{ 'is-active': (el.preset ?? 'custom') === p.id }" type="button" @click="applyPreset(p)">{{ p.name }}</button>
                <button v-if="!isBuiltinPreset(p.id)" class="preset__del" type="button" title="Delete preset" @click="deletePreset(p)">×</button>
              </span>
            </div>
            <div class="editor__row" style="margin-top: 0.4rem">
              <input v-model="presetName" type="text" placeholder="Preset name…" />
              <button class="btn btn--small" type="button" @click="savePreset">Save preset</button>
            </div>

            <div v-for="s in EFFECT_SLIDERS" :key="s.key" class="eslider">
              <span class="eslider__name" title="Double-click to reset" @dblclick="resetEffect(s.key)">{{ s.label }}</span>
              <div class="eslider__row">
                <input type="range" :min="s.min" :max="s.max" :step="s.step" :value="effectVal(s.key)" @pointerdown="pe.snapshot()" @input="pe.setEffect(el.id, s.key, num(($event.target as HTMLInputElement).value))" />
                <input type="number" :min="s.min" :max="s.max" :step="s.step" :value="effectVal(s.key)" @change="pe.snapshot(); pe.setEffect(el.id, s.key, num(($event.target as HTMLInputElement).value))" />
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
