<script setup lang="ts">
import { computed, ref } from 'vue';
import type { RoomItem } from '@/data/types';
import { getCatalogItem } from '@/catalog/catalog';
import { LAYER_BASE, bandFor, resolveItemStyle } from '@/room/geometry';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import { useViewport } from '@/composables/useViewport';
import WallClock from './WallClock.vue';

const props = defineProps<{ item: RoomItem }>();
const app = useAppStore();
const editor = useEditorStore();
const { isMobile } = useViewport();

const cat = computed(() => getCatalogItem(props.item.catalogId));
const placement = computed(() =>
  app.placementFor(props.item, isMobile.value ? 'mobile' : 'desktop'),
);
const art = computed(() => {
  if (!cat.value) return '';
  const night = app.timeOfDay === 'night';
  return night && cat.value.art.night ? cat.value.art.night : cat.value.art.day;
});
const style = computed(() => {
  if (!cat.value || !placement.value) return { display: 'none' };
  const z = LAYER_BASE[props.item.layer] + props.item.z;
  const base = resolveItemStyle(props.item.layer, z, placement.value, cat.value);
  const vars: Record<string, string> = {};
  for (const slot of cat.value.colorSlots) {
    vars[`--c-${slot.id}`] = props.item.color[slot.id] ?? slot.default;
  }
  return { ...base, ...vars };
});
const selected = computed(() => editor.isEditing && editor.selectedId === props.item.id);

const dragging = ref(false);
function onDown(event: PointerEvent) {
  if (!editor.isEditing) return;
  event.stopPropagation();
  editor.select(props.item.id);
  dragging.value = true;
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
function onMove(event: PointerEvent) {
  if (!dragging.value) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const band = bandFor(props.item.layer);
  const x = Math.min(0.98, Math.max(0.02, event.clientX / w));
  const y = Math.min(1, Math.max(0, (event.clientY / h - band.top) / band.height));
  app.updatePlacement(props.item.id, editor.viewport, { x, y });
}
function onUp() {
  dragging.value = false;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
}
</script>

<template>
  <div
    v-if="cat && placement"
    class="room-item"
    :class="{
      'room-item--editable': editor.isEditing,
      'room-item--selected': selected,
      'room-item--dragging': dragging,
    }"
    :style="style"
    @pointerdown="onDown"
  >
    <WallClock v-if="cat.component === 'clock'" />
    <span v-else-if="cat.raw" class="room-item__svg" v-html="cat.raw"></span>
    <img v-else :src="art" alt="" />
  </div>
</template>
