<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Category } from '@/catalog/types';
import { CATALOG, getCatalogItem } from '@/catalog/catalog';
import { FLOORS, WALLS } from '@/catalog/options';
import { bandFor, deriveMobile } from '@/room/geometry';
import { hostFrame, screenToHostLocal } from '@/room/transform';
import { canHost, hostAt } from '@/room/attach';
import { useEditorStore, type Dock } from '@/stores/editor';
import RoomThumb from '@/room/RoomThumb.vue';

const editor = useEditorStore();

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'furniture', label: 'Furniture' },
  { id: 'wallDecor', label: 'Wall decor' },
  { id: 'trinket', label: 'Items' },
  { id: 'pet', label: 'Pets' },
];
const DOCKS: Dock[] = ['left', 'right'];

/** Collapse/expand arrow points away from the docked edge. */
const collapseArrow = computed(() => {
  const right = editor.dock === 'right';
  if (editor.collapsed) return right ? '‹' : '›';
  return right ? '›' : '‹';
});

const selected = computed(() => editor.selected);
const selectedCat = computed(() => (selected.value ? getCatalogItem(selected.value.catalogId) : undefined));
const items = computed(() => [...editor.items].sort((a, b) => b.z - a.z));
const topLevel = computed(() => items.value.filter((i) => !i.attachTo || !editor.itemById(i.attachTo)));
const night = computed(() => editor.timeOfDay === 'night');
function childrenOf(hostId: string) {
  return items.value.filter((i) => i.attachTo === hostId);
}
function itemLabel(catalogId: string): string {
  return getCatalogItem(catalogId)?.label ?? catalogId;
}
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

// ---- reorder the depth list (pointer-based so it works on touch too) ----
const draggingId = ref<string | null>(null);
const dropId = ref<string | null>(null);
const dropAfter = ref(false);
const ghostPos = ref<{ x: number; y: number } | null>(null);
const draggedItem = computed(() => (draggingId.value ? (editor.itemById(draggingId.value) ?? null) : null));
let rowPid = -1;
let rowStartX = 0;
let rowStartY = 0;
let rowMoved = false;
let dragParent = '';
let dropBeforeId: string | null = null;
let suppressClick = false;

function siblingRows(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`.item-list__row[data-reorder-id][data-parent="${dragParent}"]`),
  );
}
function computeDrop(clientY: number): { beforeId: string | null; lastId: string | null } {
  const rows = siblingRows();
  for (const row of rows) {
    const b = row.getBoundingClientRect();
    if (clientY < b.top + b.height / 2) return { beforeId: row.dataset.reorderId ?? null, lastId: null };
  }
  return { beforeId: null, lastId: rows.length ? (rows[rows.length - 1].dataset.reorderId ?? null) : null };
}
function onRowDown(event: PointerEvent, id: string, parent: string) {
  if (event.button !== 0) return;
  const item = editor.itemById(id);
  if (!item || item.locked) return;
  rowPid = event.pointerId;
  rowStartX = event.clientX;
  rowStartY = event.clientY;
  rowMoved = false;
  dragParent = parent;
  draggingId.value = id;
  dropId.value = null;
  dropAfter.value = false;
  dropBeforeId = null;
  window.addEventListener('pointermove', onRowMove);
  window.addEventListener('pointerup', onRowUp);
  window.addEventListener('pointercancel', onRowUp);
}
function onRowMove(event: PointerEvent) {
  if (event.pointerId !== rowPid) return;
  if (!rowMoved) {
    if (Math.abs(event.clientY - rowStartY) < 4 && Math.abs(event.clientX - rowStartX) < 4) return;
    rowMoved = true;
  }
  ghostPos.value = { x: event.clientX, y: event.clientY };
  const { beforeId, lastId } = computeDrop(event.clientY);
  dropBeforeId = beforeId;
  dropAfter.value = beforeId === null;
  dropId.value = beforeId ?? lastId;
}
function onRowUp(event: PointerEvent) {
  if (event.pointerId !== rowPid) return;
  window.removeEventListener('pointermove', onRowMove);
  window.removeEventListener('pointerup', onRowUp);
  window.removeEventListener('pointercancel', onRowUp);
  if (rowMoved && draggingId.value) {
    editor.reorderSibling(draggingId.value, dropBeforeId, dragParent);
    suppressClick = true;
  }
  draggingId.value = null;
  dropId.value = null;
  dropAfter.value = false;
  ghostPos.value = null;
  dropBeforeId = null;
  rowMoved = false;
  rowPid = -1;
}
function onRowClick(id: string) {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  editor.select(id);
}

/* ---------------- keyboard ---------------- */
function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}
function onKey(e: KeyboardEvent) {
  if (!editor.isEditing || isTyping(e.target)) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) editor.redo();
    else editor.undo();
    return;
  }
  if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    editor.redo();
    return;
  }
  const sel = editor.selected;
  if (!sel || sel.locked) return;
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault();
    editor.removeItem(sel.id);
    return;
  }
  const step = e.shiftKey ? 0.02 : 0.005;
  const dir: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const d = dir[e.key];
  if (d) {
    e.preventDefault();
    editor.snapshot();
    editor.nudge(sel.id, d[0], d[1]);
  }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

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
  let moved = false;
  const move = (ev: PointerEvent) => {
    moved = true;
    if (ghost.value) ghost.value = { ...ghost.value, x: ev.clientX, y: ev.clientY };
  };
  const up = (ev: PointerEvent) => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
    ghost.value = null;
    // A click (no drag) just drops the item at its default place.
    if (!moved) {
      editor.addItem(catalogId);
      return;
    }
    const overPanel = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.editor');
    if (overPanel) return;
    const band = bandFor(cat.layer === 'surface' ? 'both' : cat.band);
    const x = Math.min(0.98, Math.max(0.02, ev.clientX / window.innerWidth));
    const y = Math.min(1, Math.max(0, (ev.clientY / window.innerHeight - band.top) / band.height));
    // Dropping a surface item onto a compatible host attaches it.
    const hit = cat.layer === 'surface' ? hostAt(ev.clientX, ev.clientY, cat) : null;
    const hitCat = hit ? getCatalogItem(hit.catalogId) : undefined;
    if (hit && canHost(cat, hitCat)) {
      const hostItem = editor.items.find((i) => i.id === hit.id);
      const stageEl = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.room') as HTMLElement | null;
      const stageRect = stageEl?.getBoundingClientRect();
      if (hostItem && hitCat && stageRect) {
        const hostPlacement =
          editor.viewport === 'mobile' ? (hostItem.mobile ?? deriveMobile(hostItem.desktop)) : hostItem.desktop;
        const frame = hostFrame(hitCat, hostPlacement, {
          left: stageRect.left,
          top: stageRect.top,
          width: stageRect.width,
          height: stageRect.height,
        });
        // Place the dropped item's base-centre at the pointer, in the host's
        // (possibly rotated) frame so it lands where it was dropped.
        const local = screenToHostLocal(ev.clientX - frame.pivot.x, ev.clientY - frame.pivot.y, frame);
        const ax = Math.min(1, Math.max(0, local.x / frame.widthPx + 0.5));
        const ay = Math.min(1, Math.max(0, local.y / frame.heightPx + 0.5));
        editor.addItem(catalogId, { hostId: hit.id, ax, ay });
        return;
      }
    }
    editor.addItem(catalogId, { x, y });
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
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
        {{ collapseArrow }}
      </button>
      <h2 v-if="!editor.collapsed">Room editor</h2>
      <span v-if="editor.dirty && !editor.collapsed" class="editor__dot" title="Unsaved changes"></span>
      <template v-if="!editor.collapsed">
        <button class="btn btn--small" type="button" title="Undo (⌘Z)" :disabled="!editor.canUndo" @click="editor.undo()">↶</button>
        <button class="btn btn--small" type="button" title="Redo (⌘Y)" :disabled="!editor.canRedo" @click="editor.redo()">↷</button>
        <button class="btn btn--small btn--primary" type="button" @click="editor.requestExit()">Done</button>
      </template>
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
      <section>
        <label>Items (front to back)</label>
        <ul class="item-list">
          <li v-for="it in topLevel" :key="it.id">
            <div
              class="item-list__row"
              :class="{
                'is-active': editor.selectedId === it.id,
                'is-drop-before': dropId === it.id && !dropAfter,
                'is-drop-after': dropId === it.id && dropAfter,
                'is-dragging': draggingId === it.id,
              }"
              :data-reorder-id="it.id"
              data-parent=""
              @pointerdown="onRowDown($event, it.id, '')"
              @click="onRowClick(it.id)"
            >
              <span class="icon icon--grip item-list__grip" aria-hidden="true"></span>
              <span class="item-list__thumb"><RoomThumb :item="it" :night="night" /></span>
              <span class="item-list__label">{{ itemLabel(it.catalogId) }}</span>
              <button class="layer-mini" type="button" :title="it.locked ? 'Unlock' : 'Lock'" @pointerdown.stop @click.stop="editor.snapshot(); editor.setLocked(it.id, !it.locked)">
                <span class="icon" :class="it.locked ? 'icon--lock' : 'icon--unlock'"></span>
              </button>
            </div>
            <ul v-if="childrenOf(it.id).length" class="item-list item-list--children">
              <li v-for="child in childrenOf(it.id)" :key="child.id">
                <div
                  class="item-list__row item-list__row--child"
                  :class="{
                    'is-active': editor.selectedId === child.id,
                    'is-drop-before': dropId === child.id && !dropAfter,
                    'is-drop-after': dropId === child.id && dropAfter,
                    'is-dragging': draggingId === child.id,
                  }"
                  :data-reorder-id="child.id"
                  :data-parent="it.id"
                  @pointerdown="onRowDown($event, child.id, it.id)"
                  @click="onRowClick(child.id)"
                >
                  <span class="icon icon--grip item-list__grip" aria-hidden="true"></span>
                  <span class="item-list__thumb"><RoomThumb :item="child" :night="night" /></span>
                  <span class="item-list__label">{{ itemLabel(child.catalogId) }}</span>
                  <button class="layer-mini" type="button" :title="child.locked ? 'Unlock' : 'Lock'" @pointerdown.stop @click.stop="editor.snapshot(); editor.setLocked(child.id, !child.locked)">
                    <span class="icon" :class="child.locked ? 'icon--lock' : 'icon--unlock'"></span>
                  </button>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <!-- Environment + catalog: only while nothing is selected. -->
      <template v-if="!selected">
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
              @keydown.enter.prevent="editor.addItem(cat.id)"
              @keydown.space.prevent="editor.addItem(cat.id)"
            >
              <img class="palette__thumb" :src="cat.art.day" :alt="cat.label" draggable="false" />
              <span class="palette__name">{{ cat.label }}</span>
            </button>
          </div>
        </section>
      </template>

      <section v-if="selected && selectedCat && placement">
        <label>Selected: {{ selectedCat.label }}</label>

        <div class="field">
          <span>X</span>
          <input type="range" min="0" max="1" step="0.005" :value="placement.x" @pointerdown="editor.snapshot()" @input="setPlacement('x', ($event.target as HTMLInputElement).value)" />
          <input type="number" min="0" max="1" step="0.01" :value="placement.x" @change="editor.snapshot(); setPlacement('x', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field">
          <span>Y</span>
          <input type="range" min="0" max="1" step="0.005" :value="placement.y" @pointerdown="editor.snapshot()" @input="setPlacement('y', ($event.target as HTMLInputElement).value)" />
          <input type="number" min="0" max="1" step="0.01" :value="placement.y" @change="editor.snapshot(); setPlacement('y', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field">
          <span>Size</span>
          <input type="range" min="0.05" max="1.6" step="0.01" :value="placement.scale" @pointerdown="editor.snapshot()" @input="setPlacement('scale', ($event.target as HTMLInputElement).value)" />
          <input type="number" min="0.05" max="1.6" step="0.01" :value="placement.scale" @change="editor.snapshot(); setPlacement('scale', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field">
          <span>Rot°</span>
          <input type="range" min="-180" max="180" step="1" :value="placement.rotation" @pointerdown="editor.snapshot()" @input="setPlacement('rotation', ($event.target as HTMLInputElement).value)" />
          <input type="number" min="-180" max="180" step="1" :value="placement.rotation" @change="editor.snapshot(); setPlacement('rotation', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="field">
          <span>Depth</span>
          <input type="range" min="0" max="60" step="1" :value="selected.z" @pointerdown="editor.snapshot()" @input="setZ(($event.target as HTMLInputElement).value)" />
          <input type="number" min="0" max="60" step="1" :value="selected.z" @change="editor.snapshot(); setZ(($event.target as HTMLInputElement).value)" />
        </div>

        <label><input type="checkbox" :checked="placement.flip" @change="editor.snapshot(); setFlip(($event.target as HTMLInputElement).checked)" /> Flip horizontally</label>
        <label><input type="checkbox" :checked="selected.hideMobile" @change="editor.snapshot(); toggleHide(($event.target as HTMLInputElement).checked)" /> Hide in mobile layout</label>
        <label><input type="checkbox" :checked="selected.locked" @change="editor.snapshot(); toggleLock(($event.target as HTMLInputElement).checked)" /> Lock in place</label>

        <template v-if="selectedCat.colorSlots.length">
          <label style="margin-top: 0.5rem">Colors</label>
          <div v-for="slot in selectedCat.colorSlots" :key="slot.id" style="margin-bottom: 0.5rem">
            <div class="editor__muted">{{ slot.label }}</div>
            <div class="swatches">
              <button v-for="color in slot.palette" :key="color" class="swatch" :style="{ background: color }" type="button" @click="editor.snapshot(); editor.setColor(selected.id, slot.id, color)"></button>
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
              @click="editor.snapshot(); editor.setColors(selected.id, preset.colors)"
            >
              {{ preset.label }}
            </button>
          </div>
        </template>

        <div class="editor__row" style="margin-top: 0.4rem">
          <button class="btn btn--small" type="button" @click="editor.duplicateItem(selected.id)">Duplicate</button>
          <button class="btn btn--small" type="button" :disabled="!!selected.locked" @click="editor.removeItem(selected.id)"><span class="icon icon--trash"></span>Remove</button>
        </div>
      </section>
      <section v-else>
        <p class="editor__muted">Click an item to edit it, or drag one out of the palette above.</p>
      </section>

      <section v-if="!selected">
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

      <section>
        <button class="btn btn--small clear-room" type="button" title="Remove all items (undoable)" @click="editor.clearItems()">
          <span class="icon icon--trash"></span>Clear room
        </button>
      </section>
    </div>
  </aside>

  <div v-if="ghost" class="drag-ghost" :style="{ left: `${ghost.x}px`, top: `${ghost.y}px` }">
    {{ ghost.label }}
  </div>

  <div
    v-if="ghostPos && draggedItem"
    class="layer-drag-ghost"
    :style="{ left: `${ghostPos.x + 12}px`, top: `${ghostPos.y + 10}px` }"
  >
    <span class="item-list__thumb"><RoomThumb :item="draggedItem" :night="night" /></span>
    <span class="item-list__label">{{ itemLabel(draggedItem.catalogId) }}</span>
  </div>
</template>
