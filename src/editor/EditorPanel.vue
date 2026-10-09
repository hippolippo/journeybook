<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Category } from '@/catalog/types';
import { CATALOG, getCatalogItem } from '@/catalog/catalog';
import { FLOORS, WALLS } from '@/catalog/options';
import { bandFor } from '@/room/geometry';
import { useEditorStore, type Dock } from '@/stores/editor';

const editor = useEditorStore();

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'furniture', label: 'Furniture' },
  { id: 'wallDecor', label: 'Wall decor' },
  { id: 'trinket', label: 'Items' },
  { id: 'pet', label: 'Pets' },
];
const DOCKS: Dock[] = ['top', 'bottom', 'left', 'right'];

const selected = computed(() => editor.selected);
const selectedCat = computed(() => (selected.value ? getCatalogItem(selected.value.catalogId) : undefined));
const placement = computed(() => {
  const item = selected.value;
  if (!item) return null;
  if (editor.viewport === 'desktop') return item.desktop;
  return item.mobile ?? item.desktop;
});

function num(value: string) {
  return Number(value);
}
function setPlacement(field: 'x' | 'y' | 'scale' | 'rotation', value: string) {
  if (selected.value) editor.updatePlacement(selected.value.id, editor.viewport, { [field]: num(value) });
}
function setFlip(value: boolean) {
  if (selected.value) editor.updatePlacement(selected.value.id, editor.viewport, { flip: value });
}
function setZ(value: string) {
  if (selected.value) editor.setZ(selected.value.id, num(value));
}
function toggleHide(value: boolean) {
  if (selected.value) editor.setHideMobile(selected.value.id, value);
}
function toggleLock(value: boolean) {
  if (selected.value) editor.setLocked(selected.value.id, value);
}

// ---- drag a catalog item out into the room ----
const ghost = ref<{ x: number; y: number; label: string } | null>(null);
function startPlace(event: PointerEvent, catalogId: string, label: string) {
  if (event.button !== 0) return;
  event.preventDefault();
  const cat = getCatalogItem(catalogId);
  if (!cat) return;
  const target = event.currentTarget as HTMLElement;
  try {
    target.setPointerCapture(event.pointerId);
  } catch {
    /* ignore */
  }
  ghost.value = { x: event.clientX, y: event.clientY, label };
  const move = (ev: PointerEvent) => {
    if (ghost.value) ghost.value = { ...ghost.value, x: ev.clientX, y: ev.clientY };
  };
  const up = (ev: PointerEvent) => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
    ghost.value = null;
    const overPanel = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.editor');
    if (overPanel) return;
    const band = bandFor(cat.layer);
    const x = Math.min(0.98, Math.max(0.02, ev.clientX / window.innerWidth));
    const y = Math.min(1, Math.max(0, (ev.clientY / window.innerHeight - band.top) / band.height));
    editor.addItem(catalogId, { x, y });
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
}
function clickAdd(catalogId: string) {
  editor.addItem(catalogId);
}

// ---- named layouts ----
const layoutName = ref('');
async function saveNamed() {
  const name = layoutName.value.trim() || `Layout ${editor.layouts.length + 1}`;
  await editor.saveAs(name);
  layoutName.value = '';
}
</script>

<template>
  <aside class="editor" :class="[`editor--${editor.dock}`, { 'editor--collapsed': editor.collapsed }]">
    <header class="editor__head">
      <button class="editor__icon" type="button" :title="editor.collapsed ? 'Expand' : 'Collapse'" @click="editor.toggleCollapsed()">
        {{ editor.collapsed ? '‹' : '›' }}
      </button>
      <h2 v-if="!editor.collapsed">Room editor</h2>
      <span v-if="editor.dirty && !editor.collapsed" class="editor__dot" title="Unsaved changes"></span>
      <button
        v-if="!editor.collapsed"
        class="btn btn--small btn--primary"
        type="button"
        @click="editor.requestExit()"
      >
        Done
      </button>
      <div v-if="!editor.collapsed" class="editor__docks">
        <button
          v-for="d in DOCKS"
          :key="d"
          class="editor__dock"
          :class="{ 'is-active': editor.dock === d }"
          type="button"
          :title="`Dock ${d}`"
          @click="editor.setDock(d)"
        >
          {{ d[0].toUpperCase() }}
        </button>
      </div>
    </header>

    <div v-if="!editor.collapsed" class="editor__body">
      <section class="editor__row">
        <button class="btn btn--small" :class="{ 'btn--primary': editor.viewport === 'desktop' }" type="button" @click="editor.setViewport('desktop')">Desktop</button>
        <button class="btn btn--small" :class="{ 'btn--primary': editor.viewport === 'mobile' }" type="button" @click="editor.setViewport('mobile')">Mobile preview</button>
      </section>

      <section>
        <label>Time of day</label>
        <select :value="editor.draftRoom?.dayNightMode" @change="editor.setDayNightMode(($event.target as HTMLSelectElement).value as 'auto' | 'day' | 'night')">
          <option value="auto">Automatic (by time)</option>
          <option value="day">Day (override)</option>
          <option value="night">Night (override)</option>
        </select>
        <label style="margin-top: 0.5rem">Reference timezone</label>
        <input type="text" :value="editor.draftRoom?.referenceTz" @change="editor.setReferenceTz(($event.target as HTMLInputElement).value)" />
      </section>

      <section>
        <label>Wall</label>
        <div class="swatches">
          <button v-for="w in WALLS" :key="w.id" class="swatch" :class="{ 'swatch--active': editor.draftRoom?.wallId === w.id }" :style="{ background: w.swatch }" :title="w.label" type="button" @click="editor.setWall(w.id)"></button>
        </div>
        <label style="margin-top: 0.6rem">Floor</label>
        <div class="swatches">
          <button v-for="f in FLOORS" :key="f.id" class="swatch" :class="{ 'swatch--active': editor.draftRoom?.floorId === f.id }" :style="{ background: f.swatch }" :title="f.label" type="button" @click="editor.setFloor(f.id)"></button>
        </div>
      </section>

      <section v-for="group in CATEGORIES" :key="group.id">
        <label>{{ group.label }}</label>
        <div class="palette">
          <button
            v-for="cat in CATALOG.filter((c) => c.category === group.id)"
            :key="cat.id"
            class="palette__item"
            type="button"
            :title="cat.label"
            @pointerdown="startPlace($event, cat.id, cat.label)"
            @click="clickAdd(cat.id)"
          >
            <img class="palette__thumb" :src="cat.art.day" :alt="cat.label" draggable="false" />
            <span class="palette__name">{{ cat.label }}</span>
          </button>
        </div>
      </section>

      <section v-if="selected && selectedCat && placement">
        <label>Selected: {{ selectedCat.label }}</label>

        <div class="field">
          <span>X</span>
          <input type="range" min="0" max="1" step="0.005" :value="placement.x" @input="setPlacement('x', ($event.target as HTMLInputElement).value)" />
          <input type="number" min="0" max="1" step="0.01" :value="placement.x" @change="setPlacement('x', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field">
          <span>Y</span>
          <input type="range" min="0" max="1" step="0.005" :value="placement.y" @input="setPlacement('y', ($event.target as HTMLInputElement).value)" />
          <input type="number" min="0" max="1" step="0.01" :value="placement.y" @change="setPlacement('y', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field">
          <span>Size</span>
          <input type="range" min="0.05" max="1.6" step="0.01" :value="placement.scale" @input="setPlacement('scale', ($event.target as HTMLInputElement).value)" />
          <input type="number" min="0.05" max="1.6" step="0.01" :value="placement.scale" @change="setPlacement('scale', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field">
          <span>Rot°</span>
          <input type="range" min="-180" max="180" step="1" :value="placement.rotation" @input="setPlacement('rotation', ($event.target as HTMLInputElement).value)" />
          <input type="number" min="-180" max="180" step="1" :value="placement.rotation" @change="setPlacement('rotation', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field">
          <span>Depth</span>
          <input type="range" min="0" max="20" step="1" :value="selected.z" @input="setZ(($event.target as HTMLInputElement).value)" />
          <input type="number" min="0" max="20" step="1" :value="selected.z" @change="setZ(($event.target as HTMLInputElement).value)" />
        </div>

        <label><input type="checkbox" :checked="placement.flip" @change="setFlip(($event.target as HTMLInputElement).checked)" /> Flip horizontally</label>
        <label><input type="checkbox" :checked="selected.hideMobile" @change="toggleHide(($event.target as HTMLInputElement).checked)" /> Hide in mobile layout</label>
        <label><input type="checkbox" :checked="selected.locked" @change="toggleLock(($event.target as HTMLInputElement).checked)" /> Lock in place</label>

        <template v-if="selectedCat.colorSlots.length">
          <label style="margin-top: 0.5rem">Colors</label>
          <div v-for="slot in selectedCat.colorSlots" :key="slot.id" style="margin-bottom: 0.5rem">
            <div class="editor__muted">{{ slot.label }}</div>
            <div class="swatches">
              <button v-for="color in slot.palette" :key="color" class="swatch" :style="{ background: color }" type="button" @click="editor.setColor(selected.id, slot.id, color)"></button>
            </div>
            <input v-if="slot.allowCustom" type="color" :value="selected.color[slot.id] ?? slot.default" @input="editor.setColor(selected.id, slot.id, ($event.target as HTMLInputElement).value)" />
          </div>
        </template>

        <template v-if="selectedCat.presets?.length">
          <label style="margin-top: 0.5rem">Color presets</label>
          <div class="editor__row">
            <button
              v-for="preset in selectedCat.presets"
              :key="preset.id"
              class="btn btn--small"
              type="button"
              :title="preset.label"
              @click="editor.setColors(selected.id, preset.colors)"
            >
              {{ preset.label }}
            </button>
          </div>
        </template>

        <div class="editor__row" style="margin-top: 0.4rem">
          <button class="btn btn--small" type="button" @click="editor.duplicateItem(selected.id)">Duplicate</button>
          <button class="btn btn--small" type="button" @click="editor.removeItem(selected.id)"><span class="icon icon--trash"></span>Remove</button>
        </div>
      </section>
      <section v-else>
        <p class="editor__muted">Click an item to edit it, or drag one out of the palette above.</p>
      </section>

      <section>
        <label>Named layouts</label>
        <div class="editor__row">
          <input v-model="layoutName" type="text" placeholder="Name a layout…" />
          <button class="btn btn--small" type="button" @click="saveNamed">Save as</button>
        </div>
        <ul class="layout-list">
          <li v-for="layout in editor.layouts" :key="layout.id">
            <span>{{ layout.name }}</span>
            <span class="editor__row">
              <button class="btn btn--small" type="button" @click="editor.loadLayout(layout.id)">Load</button>
              <button class="btn btn--small" type="button" @click="editor.deleteLayout(layout.id)"><span class="icon icon--trash"></span></button>
            </span>
          </li>
        </ul>
      </section>
    </div>
  </aside>

  <div v-if="ghost" class="drag-ghost" :style="{ left: `${ghost.x}px`, top: `${ghost.y}px` }">
    {{ ghost.label }}
  </div>
</template>
