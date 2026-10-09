<script setup lang="ts">
import { computed } from 'vue';
import type { Category } from '@/catalog/types';
import { CATALOG } from '@/catalog/catalog';
import { FLOORS, WALLS } from '@/catalog/options';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';

const app = useAppStore();
const editor = useEditorStore();

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'furniture', label: 'Furniture' },
  { id: 'wallDecor', label: 'Wall decor' },
  { id: 'trinket', label: 'Items' },
  { id: 'pet', label: 'Pets' },
];

const selected = computed(() => (editor.selectedId ? app.itemById(editor.selectedId) : undefined));
const selectedCat = computed(() =>
  selected.value ? CATALOG.find((c) => c.id === selected.value?.catalogId) : undefined,
);
const placement = computed(() =>
  selected.value ? app.placementFor(selected.value, editor.viewport) : null,
);

function setNum(field: 'x' | 'y' | 'scale' | 'rotation', value: string) {
  if (!selected.value) return;
  app.updatePlacement(selected.value.id, editor.viewport, { [field]: Number(value) });
}
function setFlip(value: boolean) {
  if (!selected.value) return;
  app.updatePlacement(selected.value.id, editor.viewport, { flip: value });
}
function setZ(value: string) {
  if (selected.value) app.setZ(selected.value.id, Number(value));
}
function toggleHideMobile(value: boolean) {
  if (selected.value) app.setHideMobile(selected.value.id, value);
}
function addItem(catalogId: string) {
  const item = app.addRoomItem(catalogId);
  if (item) editor.select(item.id);
}
function removeSelected() {
  if (selected.value) {
    app.removeRoomItem(selected.value.id);
    editor.select(null);
  }
}
</script>

<template>
  <aside class="editor">
    <h2>Room editor</h2>

    <section>
      <div class="editor__row">
        <button
          class="btn btn--small"
          :class="{ 'btn--primary': editor.viewport === 'desktop' }"
          type="button"
          @click="editor.setViewport('desktop')"
        >
          Desktop
        </button>
        <button
          class="btn btn--small"
          :class="{ 'btn--primary': editor.viewport === 'mobile' }"
          type="button"
          @click="editor.setViewport('mobile')"
        >
          Mobile preview
        </button>
      </div>
      <p style="font-size: 0.78rem; color: var(--ink-2); margin: 0.4rem 0 0">
        Editing the <strong>{{ editor.viewport }}</strong> layout.
      </p>
    </section>

    <section>
      <label>Time of day</label>
      <select
        :value="app.room.dayNightMode"
        @change="app.setDayNightMode(($event.target as HTMLSelectElement).value as 'auto' | 'day' | 'night')"
      >
        <option value="auto">Automatic (by time)</option>
        <option value="day">Day (override)</option>
        <option value="night">Night (override)</option>
      </select>
      <label style="margin-top: 0.5rem">Reference timezone</label>
      <input
        type="text"
        :value="app.room.referenceTz"
        @change="app.setReferenceTz(($event.target as HTMLInputElement).value)"
      />
    </section>

    <section>
      <label>Wall</label>
      <div class="swatches">
        <button
          v-for="w in WALLS"
          :key="w.id"
          class="swatch"
          :class="{ 'swatch--active': app.room.wallId === w.id }"
          :style="{ background: w.swatch }"
          :title="w.label"
          type="button"
          @click="app.setWall(w.id)"
        ></button>
      </div>
      <label style="margin-top: 0.6rem">Floor</label>
      <div class="swatches">
        <button
          v-for="f in FLOORS"
          :key="f.id"
          class="swatch"
          :class="{ 'swatch--active': app.room.floorId === f.id }"
          :style="{ background: f.swatch }"
          :title="f.label"
          type="button"
          @click="app.setFloor(f.id)"
        ></button>
      </div>
    </section>

    <section v-for="group in CATEGORIES" :key="group.id">
      <label>Add {{ group.label.toLowerCase() }}</label>
      <div class="catalog-list">
        <button
          v-for="item in CATALOG.filter((c) => c.category === group.id)"
          :key="item.id"
          class="btn btn--ghost btn--small"
          type="button"
          @click="addItem(item.id)"
        >
          <span class="icon icon--plus"></span>{{ item.label }}
        </button>
      </div>
    </section>

    <section v-if="selected && selectedCat && placement">
      <label>Selected: {{ selectedCat.label }}</label>
      <label>X {{ placement.x.toFixed(2) }}</label>
      <input type="range" min="0" max="1" step="0.01" :value="placement.x" @input="setNum('x', ($event.target as HTMLInputElement).value)" />
      <label>Y {{ placement.y.toFixed(2) }}</label>
      <input type="range" min="0" max="1" step="0.01" :value="placement.y" @input="setNum('y', ($event.target as HTMLInputElement).value)" />
      <label>Size {{ placement.scale.toFixed(2) }}</label>
      <input type="range" min="0.05" max="1.6" step="0.01" :value="placement.scale" @input="setNum('scale', ($event.target as HTMLInputElement).value)" />
      <label>Rotation {{ placement.rotation.toFixed(0) }}°</label>
      <input type="range" min="-45" max="45" step="1" :value="placement.rotation" @input="setNum('rotation', ($event.target as HTMLInputElement).value)" />
      <label>Depth {{ selected.z }}</label>
      <input type="range" min="0" max="14" step="1" :value="selected.z" @input="setZ(($event.target as HTMLInputElement).value)" />

      <label style="margin-top: 0.4rem">
        <input type="checkbox" :checked="placement.flip" @change="setFlip(($event.target as HTMLInputElement).checked)" />
        Flip horizontally
      </label>
      <label>
        <input type="checkbox" :checked="selected.hideMobile" @change="toggleHideMobile(($event.target as HTMLInputElement).checked)" />
        Hide in mobile layout
      </label>

      <template v-if="selectedCat.colorSlots.length">
        <label style="margin-top: 0.5rem">Colors</label>
        <div v-for="slot in selectedCat.colorSlots" :key="slot.id" style="margin-bottom: 0.4rem">
          <div style="font-size: 0.78rem; color: var(--ink-2)">{{ slot.label }}</div>
          <div class="swatches">
            <button
              v-for="color in slot.palette"
              :key="color"
              class="swatch"
              :style="{ background: color }"
              type="button"
              @click="app.setColor(selected.id, slot.id, color)"
            ></button>
          </div>
          <input
            v-if="slot.allowCustom"
            type="color"
            :value="selected.color[slot.id] ?? slot.default"
            @input="app.setColor(selected.id, slot.id, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </template>

      <button class="btn btn--small" type="button" style="margin-top: 0.4rem" @click="removeSelected">
        <span class="icon icon--trash"></span>Remove item
      </button>
    </section>
    <section v-else>
      <p style="font-size: 0.82rem; color: var(--ink-2); margin: 0">
        Click an item in the room to move it, resize it, recolor it, or hide it on mobile.
      </p>
    </section>

    <button class="btn btn--ghost btn--small" type="button" @click="app.reset()">Reset room</button>
  </aside>
</template>
