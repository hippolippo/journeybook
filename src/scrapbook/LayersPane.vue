<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import type { PageElement } from '@/data/types';
import { usePageEditorStore } from '@/stores/pageEditor';
import { elementLabel } from '@/scrapbook/groups';

const pe = usePageEditorStore();
const newGroup = ref('');
let draggedId: string | null = null;
const dropRow = ref<string | null>(null);
const dropGroup = ref<string | null>(null);
const editingNameId = ref<string | null>(null);

const KIND_ICON: Record<PageElement['kind'], string> = {
  photo: 'icon-camera',
  image: 'icon-camera',
  note: 'icon-pencil',
  sticker: 'icon-star',
  tape: 'icon-tape',
};

const groups = computed(() => pe.groups);
const elements = computed(() => pe.elements);
function itemsOf(groupId: string): PageElement[] {
  return elements.value.filter((e) => (e.groupId ?? '') === groupId).sort((a, b) => b.z - a.z);
}

function onDragStart(id: string, e: DragEvent) {
  draggedId = id;
  e.dataTransfer?.setData('text/plain', id);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}
function onDragEnd() {
  draggedId = null;
  dropRow.value = null;
  dropGroup.value = null;
}
function onDropBefore(targetId: string, groupId: string) {
  if (draggedId && draggedId !== targetId) pe.placeElement(draggedId, groupId, targetId);
  onDragEnd();
}
function onDropGroup(groupId: string) {
  if (draggedId) pe.placeElement(draggedId, groupId, null);
  onDragEnd();
}
function addGroup() {
  if (!newGroup.value.trim()) return;
  pe.addGroup(newGroup.value);
  newGroup.value = '';
}
async function startRename(el: PageElement) {
  editingNameId.value = el.id;
  await nextTick();
  const input = document.querySelector<HTMLInputElement>('.layer-row__rename');
  input?.focus();
  input?.select();
}
function commitRename(el: PageElement, value: string) {
  if (editingNameId.value !== el.id) return;
  pe.updateElement(el.id, { name: value.trim() });
  editingNameId.value = null;
}
</script>

<template>
  <section class="layers">
    <div class="editor__row">
      <input v-model="newGroup" type="text" placeholder="New group…" @keyup.enter="addGroup" />
      <button class="btn btn--small" type="button" @click="addGroup">Add</button>
    </div>

    <ul class="layer-groups">
      <li v-for="g in groups" :key="g.id" class="layer-group">
        <div
          class="layer-group__head"
          :class="{ 'is-drop': dropGroup === g.id }"
          @dragover.prevent="dropGroup = g.id"
          @drop.prevent="onDropGroup(g.id)"
        >
          <button class="layer-toggle" type="button" :title="g.collapsed ? 'Expand' : 'Collapse'" @click="pe.toggleGroup(g.id)">
            <span class="icon icon--chev-right" :class="{ 'is-open': !g.collapsed }"></span>
          </button>
          <input
            class="layer-group__name"
            :value="g.name"
            @change="pe.renameGroup(g.id, ($event.target as HTMLInputElement).value)"
          />
          <button class="layer-mini" type="button" title="Move up" @click="pe.moveGroup(g.id, -1)">
            <span class="icon icon--chev-right rot-up"></span>
          </button>
          <button class="layer-mini" type="button" title="Move down" @click="pe.moveGroup(g.id, 1)">
            <span class="icon icon--chev-right rot-down"></span>
          </button>
          <button class="layer-mini" type="button" title="Delete group" @click="pe.deleteGroup(g.id)">
            <span class="icon icon--trash"></span>
          </button>
        </div>

        <ul v-if="!g.collapsed" class="layer-items">
          <li
            v-for="el in itemsOf(g.id)"
            :key="el.id"
            class="layer-row"
            :class="{ 'is-selected': pe.selectedId === el.id, 'is-locked': el.locked, 'is-drop-before': dropRow === el.id }"
            draggable="true"
            @dragstart="onDragStart(el.id, $event)"
            @dragend="onDragEnd"
            @dragover.prevent="dropRow = el.id"
            @drop.prevent="onDropBefore(el.id, g.id)"
            @click="pe.select(el.id)"
          >
            <span class="icon icon--grip layer-row__grip" aria-hidden="true"></span>
            <span class="icon layer-row__icon" :class="KIND_ICON[el.kind]" aria-hidden="true"></span>
            <input
              v-if="editingNameId === el.id"
              class="layer-row__rename"
              :value="el.name ?? ''"
              @keyup.enter="commitRename(el, ($event.target as HTMLInputElement).value)"
              @keyup.esc="editingNameId = null"
              @blur="commitRename(el, ($event.target as HTMLInputElement).value)"
            />
            <span v-else class="layer-row__label" @dblclick.stop="startRename(el)">{{ elementLabel(el) }}</span>
            <button class="layer-mini" type="button" :title="el.locked ? 'Unlock' : 'Lock'" @click.stop="pe.setLocked(el.id, !el.locked)">
              <span class="icon" :class="el.locked ? 'icon--lock' : 'icon--unlock'"></span>
            </button>
          </li>
          <li v-if="itemsOf(g.id).length === 0" class="layer-empty">Drop items here</li>
        </ul>
      </li>
    </ul>
  </section>
</template>
