<script setup lang="ts">
import { computed } from 'vue';
import type { RoomItem } from '@/data/types';
import { getCatalogItem } from '@/catalog/catalog';
import { colorizeSvg } from '@/catalog/svgColor';
import WallClock from './WallClock.vue';

const props = defineProps<{ item: RoomItem; night: boolean }>();

const cat = computed(() => getCatalogItem(props.item.catalogId));
const colorVars = computed(() => {
  const vars: Record<string, string> = {};
  for (const slot of cat.value?.colorSlots ?? []) {
    vars[`--c-${slot.id}`] = props.item.color[slot.id] ?? slot.default;
  }
  return vars;
});
const art = computed(() => {
  const c = cat.value;
  if (!c) return '';
  return props.night && c.art.night ? c.art.night : c.art.day;
});
const rawHtml = computed(() => {
  const c = cat.value;
  if (c?.raw && c.colorSlots.length) return colorizeSvg(c.raw, props.item.color, c.colorSlots);
  return '';
});
/** Show the item's colour and rotation, but not its scale (always legible). */
const transform = computed(
  () => `rotate(${props.item.desktop.rotation}deg) scaleX(${props.item.desktop.flip ? -1 : 1})`,
);
</script>

<template>
  <span class="room-thumb" :style="colorVars" aria-hidden="true">
    <span class="room-thumb__art" :style="{ transform }">
      <span v-if="rawHtml" class="room-thumb__svg" v-html="rawHtml"></span>
      <WallClock v-else-if="cat?.component === 'clock'" />
      <img v-else-if="art" :src="art" alt="" draggable="false" />
    </span>
  </span>
</template>
