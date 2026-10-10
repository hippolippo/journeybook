<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { useAppStore } from '@/stores/app';
import { usePageEditorStore } from '@/stores/pageEditor';
import { useViewport } from '@/composables/useViewport';
import { PAPERS, paperById, paperCss } from '@/scrapbook/paper';
import { STICKER_COLORS, STICKERS, TAPES, TAPE_COLORS, stickerById, tapeById } from '@/scrapbook/decor';
import PageItemEditor from '@/scrapbook/PageItemEditor.vue';
import LayersPane from '@/scrapbook/LayersPane.vue';
import ImageEditor from '@/scrapbook/ImageEditor.vue';
import NoteEditor from '@/scrapbook/NoteEditor.vue';
import ColorSlotsEditor from '@/scrapbook/ColorSlotsEditor.vue';
import PaperSurface from '@/scrapbook/PaperSurface.vue';

const pe = usePageEditorStore();
const app = useAppStore();
const { width, height } = useViewport();

// The panel is fixed on the right and always expanded.
const inset = computed(() => ({ left: 0, right: 340, top: 0, bottom: 0 }));
const availW = computed(() => Math.max(160, width.value - inset.value.left - inset.value.right - 40));
const availH = computed(() => Math.max(160, height.value - inset.value.top - inset.value.bottom - 40));
const pageSize = computed(() => Math.floor(Math.min(availW.value, availH.value)));
const backdropStyle = computed(() => ({
  paddingLeft: `${inset.value.left + 20}px`,
  paddingRight: `${inset.value.right + 20}px`,
  paddingTop: `${inset.value.top + 20}px`,
  paddingBottom: `${inset.value.bottom + 20}px`,
}));
const stageStyle = computed(() => ({
  width: `${pageSize.value}px`,
  height: `${pageSize.value}px`,
  '--page-scale': String(pageSize.value / 480),
}));
const pageStyle = computed(() => paperCss(paperById(pe.background), pe.paperColors));
const paperDef = computed(() => paperById(pe.background));
const paperSlots = computed(() => paperDef.value.colorSlots ?? []);
const paperPresets = computed(() => paperDef.value.presets ?? []);
function onPaperSlotColor(slotId: string, color: string) {
  pe.setPaperColor(slotId, color);
}
function onPaperPresetColors(colors: Record<string, string>) {
  pe.applyPaperColors(colors);
}

const album = computed(() => app.mediaFor(pe.bookId));
watchEffect(() => {
  for (const m of album.value) if (!app.assetUrl(m.id)) void app.ensureAsset(m.id);
});

const sel = computed(() => pe.selected);
const selImage = computed(() => (sel.value && sel.value.kind === 'image' ? sel.value : null));
const selNote = computed(() => (sel.value && sel.value.kind === 'note' ? sel.value : null));
const selSticker = computed(() => (sel.value && sel.value.kind === 'sticker' ? stickerById(sel.value.icon) : null));
const selTape = computed(() => (sel.value && sel.value.kind === 'tape' ? tapeById(sel.value.style) : null));
const selSlots = computed(() => selSticker.value?.colorSlots ?? selTape.value?.colorSlots ?? []);
const selPresets = computed(() => selSticker.value?.presets ?? selTape.value?.presets ?? []);
const selColors = computed(() => {
  const s = sel.value;
  return s && (s.kind === 'sticker' || s.kind === 'tape') ? (s.colors ?? {}) : {};
});
const colorable = computed(() => {
  const k = sel.value?.kind;
  if (k === 'tape') return true;
  if (k === 'sticker') return !!selSticker.value?.tint;
  return false;
});
function onSlotColor(slotId: string, color: string) {
  if (sel.value) pe.setElementSlotColor(sel.value.id, slotId, color);
}
function onPresetColors(colors: Record<string, string>) {
  if (!sel.value) return;
  pe.snapshot();
  pe.applyElementColors(sel.value.id, colors);
}
const palette = computed(() => {
  const k = sel.value?.kind;
  if (k === 'tape') return TAPE_COLORS;
  if (k === 'sticker') return STICKER_COLORS;
  return [];
});
const selColor = computed(() => {
  const s = sel.value;
  return s && 'color' in s && s.color ? s.color : palette.value[0] ?? '#d98c8c';
});
/** Images always keep their aspect here; only the item's aspectLocked flag applies to other kinds. */
const selAspectLocked = computed(() => {
  const s = sel.value;
  if (!s) return true;
  if (s.kind === 'image') return true;
  return s.aspectLocked !== false;
});

function num(v: string) {
  return Number(v);
}
function setField(field: 'x' | 'y' | 'rotation' | 'opacity', value: string, min = -Infinity, max = Infinity) {
  if (!sel.value) return;
  const v = Math.min(max, Math.max(min, num(value)));
  pe.updateElement(sel.value.id, { [field]: v });
}
function setSize(field: 'w' | 'h', value: string) {
  const s = sel.value;
  if (!s) return;
  const v = Math.min(1, Math.max(0.06, num(value)));
  let w = s.w;
  let h = s.h;
  if (selAspectLocked.value) {
    const aspect = s.w / s.h;
    if (field === 'w') {
      w = v;
      h = v / aspect;
    } else {
      h = v;
      w = v * aspect;
    }
  } else if (field === 'w') {
    w = v;
  } else {
    h = v;
  }
  pe.updateElement(s.id, { w, h });
}
function setZ(value: string) {
  if (sel.value) pe.setZ(sel.value.id, num(value));
}
function setColor(color: string) {
  if (sel.value) pe.updateElement(sel.value.id, { color });
}
function toggleLock() {
  if (sel.value) pe.setLocked(sel.value.id, !sel.value.locked);
}
function toggleAspect() {
  if (sel.value) pe.setAspectLocked(sel.value.id, !selAspectLocked.value);
}

const fileInput = ref<HTMLInputElement | null>(null);
const uploadError = ref('');
async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files) return;
  uploadError.value = '';
  for (const file of Array.from(files)) {
    try {
      const asset = await app.addMedia(pe.bookId, file);
      pe.addImage(asset.id);
    } catch (err) {
      console.error(err);
      uploadError.value = `Couldn't read ${file.name}. Supported: JPG, PNG, WebP, GIF, AVIF, HEIC.`;
    }
  }
  input.value = '';
}
function useMedia(id: string) {
  if (selImage.value) pe.changeMedia(selImage.value.id, id);
  else pe.addImage(id);
}
async function deleteMedia(id: string) {
  await app.removeMedia(id);
}

/* ---------------- keyboard ---------------- */
function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}
function onKey(e: KeyboardEvent) {
  if (!pe.isEditing || isTyping(e.target)) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) pe.redo();
    else pe.undo();
    return;
  }
  if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    pe.redo();
    return;
  }
  if ((e.key === 'Backspace' || e.key === 'Delete') && !pe.editingImageId) {
    const s = pe.selected;
    if (s && !s.locked) {
      e.preventDefault();
      pe.removeElement(s.id);
    }
  }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body">
    <div v-if="pe.isEditing" class="peditor">
      <div class="peditor-backdrop" :style="backdropStyle" @pointerdown.self="pe.select(null)">
        <div class="peditor-stage" :style="stageStyle">
          <div class="page-scaler">
            <div class="square-page" :style="pageStyle" @pointerdown.self="pe.select(null)">
              <PaperSurface :paper="paperDef" />
              <PageItemEditor v-for="el in pe.elements" :key="el.id" :el="el" />
              <span class="square-page__num">{{ pe.index + 1 }}</span>
            </div>
          </div>
        </div>
      </div>

      <aside class="editor editor--right">
        <header class="editor__head">
          <h2>Page editor</h2>
          <span v-if="pe.dirty" class="editor__dot" title="Unsaved changes"></span>
          <button class="btn btn--small" type="button" title="Undo (⌘Z)" :disabled="!pe.canUndo" @click="pe.undo()">↶</button>
          <button class="btn btn--small" type="button" title="Redo (⌘Y)" :disabled="!pe.canRedo" @click="pe.redo()">↷</button>
          <button class="btn btn--small btn--primary" type="button" @click="pe.requestExit()">Done</button>
        </header>

        <div class="editor__body">
          <section>
            <label>Paper</label>
            <div class="swatches">
              <button
                v-for="p in PAPERS"
                :key="p.id"
                class="swatch"
                :class="{ 'swatch--active': pe.background === p.id }"
                :style="{ background: p.color }"
                :title="p.label"
                type="button"
                @click="pe.setPaper(p.id)"
              ></button>
            </div>
            <template v-if="paperSlots.length">
              <label style="margin-top: 0.5rem">Paper colors</label>
              <ColorSlotsEditor
                :slots="paperSlots"
                :presets="paperPresets"
                :values="pe.paperColors"
                @update="onPaperSlotColor"
                @preset="onPaperPresetColors"
              />
            </template>
          </section>

          <section>
            <div class="editor__row">
              <label style="margin: 0; flex: 1">Album</label>
              <button class="btn btn--small" type="button" @click="fileInput?.click()">Upload</button>
              <input
                ref="fileInput"
                class="visually-hidden"
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                @change="onFiles"
              />
            </div>
            <div v-if="album.length" class="album">
              <div v-for="m in album" :key="m.id" class="album__item">
                <button class="album__thumb" type="button" :title="m.name" @click="useMedia(m.id)">
                  <img v-if="app.assetUrl(m.id)" :src="app.assetUrl(m.id)" alt="" draggable="false" />
                </button>
                <button class="album__del" type="button" title="Delete from album" @click="deleteMedia(m.id)">×</button>
              </div>
            </div>
            <p v-else class="editor__muted">Upload a photo to start this book's album.</p>
            <p v-if="uploadError" class="editor__error">{{ uploadError }}</p>
          </section>

          <section>
            <label>Add to page</label>
            <div class="editor__row">
              <button class="btn btn--small" type="button" @click="pe.addNote()">Note</button>
              <button class="btn btn--small" type="button" @click="fileInput?.click()">Photo</button>
            </div>
            <div class="chip-row">
              <button v-for="s in STICKERS" :key="s.id" class="chip" type="button" :title="`Sticker: ${s.label}`" @click="pe.addSticker(s.id)">
                <img :src="s.art" alt="" draggable="false" />
              </button>
            </div>
            <div class="chip-row">
              <button
                v-for="t in TAPES"
                :key="t.id"
                class="chip chip--tape"
                type="button"
                :title="`Tape: ${t.label}`"
                @click="pe.addTape(t.id)"
              >
                <span :style="{ background: t.defaultColor, maskImage: `url('${t.mask}')`, WebkitMaskImage: `url('${t.mask}')` }"></span>
              </button>
            </div>
          </section>

          <section>
            <label>Layers</label>
            <LayersPane />
          </section>

          <section v-if="sel">
            <label>Selected</label>

            <div class="field">
              <span>X</span>
              <input type="range" min="0" max="1" step="0.005" :value="sel.x" @pointerdown="pe.snapshot()" @input="setField('x', ($event.target as HTMLInputElement).value, 0, 1)" />
              <input type="number" min="0" max="1" step="0.01" :value="sel.x" @change="pe.snapshot(); setField('x', ($event.target as HTMLInputElement).value, 0, 1)" />
            </div>
            <div class="field">
              <span>Y</span>
              <input type="range" min="0" max="1" step="0.005" :value="sel.y" @pointerdown="pe.snapshot()" @input="setField('y', ($event.target as HTMLInputElement).value, 0, 1)" />
              <input type="number" min="0" max="1" step="0.01" :value="sel.y" @change="pe.snapshot(); setField('y', ($event.target as HTMLInputElement).value, 0, 1)" />
            </div>
            <div class="field">
              <span>W</span>
              <input type="range" min="0.06" max="1" step="0.005" :value="sel.w" @pointerdown="pe.snapshot()" @input="setSize('w', ($event.target as HTMLInputElement).value)" />
              <input type="number" min="0.06" max="1" step="0.01" :value="sel.w" @change="pe.snapshot(); setSize('w', ($event.target as HTMLInputElement).value)" />
            </div>
            <div class="field">
              <span>H</span>
              <input type="range" min="0.06" max="1" step="0.005" :value="sel.h" @pointerdown="pe.snapshot()" @input="setSize('h', ($event.target as HTMLInputElement).value)" />
              <input type="number" min="0.06" max="1" step="0.01" :value="sel.h" @change="pe.snapshot(); setSize('h', ($event.target as HTMLInputElement).value)" />
            </div>
            <div class="field">
              <span>Rot°</span>
              <input type="range" min="-180" max="180" step="1" :value="sel.rotation" @pointerdown="pe.snapshot()" @input="setField('rotation', ($event.target as HTMLInputElement).value, -180, 180)" />
              <input type="number" min="-180" max="180" step="1" :value="sel.rotation" @change="pe.snapshot(); setField('rotation', ($event.target as HTMLInputElement).value, -180, 180)" />
            </div>
            <div class="field">
              <span>Layer</span>
              <input type="range" min="0" max="40" step="1" :value="sel.z" @input="setZ(($event.target as HTMLInputElement).value)" />
              <input type="number" min="0" max="40" step="1" :value="sel.z" @change="setZ(($event.target as HTMLInputElement).value)" />
            </div>
            <div class="field">
              <span>Opacity</span>
              <input type="range" min="0" max="1" step="0.01" :value="sel.opacity" @pointerdown="pe.snapshot()" @input="setField('opacity', ($event.target as HTMLInputElement).value, 0, 1)" />
              <input type="number" min="0" max="1" step="0.01" :value="sel.opacity" @change="pe.snapshot(); setField('opacity', ($event.target as HTMLInputElement).value, 0, 1)" />
            </div>

            <template v-if="selSlots.length">
              <label style="margin-top: 0.5rem">Colors</label>
              <ColorSlotsEditor
                :slots="selSlots"
                :presets="selPresets"
                :values="selColors"
                @update="onSlotColor"
                @preset="onPresetColors"
              />
            </template>
            <template v-else-if="colorable">
              <label style="margin-top: 0.5rem">Color</label>
              <div class="swatches">
                <button v-for="c in palette" :key="c" class="swatch" :style="{ background: c }" type="button" @click="setColor(c)"></button>
              </div>
              <input type="color" :value="selColor" @input="setColor(($event.target as HTMLInputElement).value)" />
            </template>

            <label style="margin-top: 0.5rem"><input type="checkbox" :checked="selAspectLocked" :disabled="sel.kind === 'image'" @change="toggleAspect" /> Lock aspect ratio</label>
            <label><input type="checkbox" :checked="!!sel.locked" @change="toggleLock" /> Lock item (finished)</label>

            <template v-if="selImage">
              <button class="btn btn--small btn--primary" style="margin-top: 0.25rem" type="button" @click="pe.openImageEditor(selImage.id)">
                Edit image (frame, crop, effects)
              </button>
            </template>
            <template v-if="selNote">
              <button class="btn btn--small btn--primary" style="margin-top: 0.25rem" type="button" @click="pe.openNoteEditor(selNote.id)">
                Edit note (write, pen, paper)
              </button>
            </template>

            <div class="editor__row" style="margin-top: 0.4rem">
              <button class="btn btn--small" type="button" @click="pe.duplicateElement(sel.id)">Duplicate</button>
              <button class="btn btn--small" type="button" :disabled="!!sel.locked" @click="pe.removeElement(sel.id)">
                <span class="icon icon--trash"></span>Remove
              </button>
            </div>
          </section>
          <section v-else>
            <p class="editor__muted">Tap an element to edit it, or add one above.</p>
          </section>
        </div>
      </aside>

      <div v-if="pe.showExit" class="dialog-backdrop" @pointerdown.self="pe.cancelExit()">
        <div class="dialog" role="dialog" aria-label="Leave the page editor">
          <h2>Leave the page editor?</h2>
          <p v-if="pe.dirty">You have unsaved changes.</p>
          <p v-else>No changes to save.</p>
          <div class="dialog__actions">
            <button class="btn btn--primary" type="button" :disabled="!pe.dirty" @click="pe.save()">Save</button>
            <button class="btn" type="button" @click="pe.discard()">Discard</button>
            <button class="btn btn--ghost" type="button" @click="pe.cancelExit()">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <ImageEditor />
  <NoteEditor />
</template>
