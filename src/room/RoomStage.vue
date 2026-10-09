<script setup lang="ts">
import { computed } from 'vue';
import { useAppStore, type Viewport } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import { floorById, wallById } from '@/catalog/options';
import RoomItem from './RoomItem.vue';

const props = defineProps<{ layout: Viewport; embedded?: boolean; interactive?: boolean }>();
const app = useAppStore();
const editor = useEditorStore();

const room = computed(() => (editor.isEditing && editor.draftRoom ? editor.draftRoom : app.room));
const items = computed(() => (editor.isEditing ? editor.items : app.roomItems));
const sorted = computed(() => [...items.value].sort((a, b) => a.z - b.z));
const wallClass = computed(() => wallById(room.value.wallId).className);
const floorClass = computed(() => floorById(room.value.floorId).className);
const night = computed(() => (editor.isEditing ? editor.timeOfDay : app.timeOfDay) === 'night');
const motes = Array.from({ length: 8 }, (_, i) => i);
</script>

<template>
  <div class="room" :class="{ 'room--embedded': props.embedded }">
    <div class="room__wall" :class="wallClass"></div>
    <div class="room__floor" :class="floorClass"></div>
    <div class="room__baseboard"></div>
    <div class="room__decor">
      <RoomItem
        v-for="item in sorted"
        :key="item.id"
        :item="item"
        :layout="props.layout"
        :editable="!!props.interactive"
      />
    </div>
    <div v-if="!props.embedded" class="room__dust" aria-hidden="true">
      <span v-for="n in motes" :key="n" class="mote"></span>
    </div>
    <div class="room__vignette"></div>
    <div class="room__night" :style="{ opacity: night ? 1 : 0 }"></div>
  </div>
</template>
