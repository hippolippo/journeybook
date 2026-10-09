<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import { useAuthStore } from '@/stores/auth';
import { floorById, wallById } from '@/catalog/options';
import RoomItem from '@/room/RoomItem.vue';
import RoomBar from '@/components/RoomBar.vue';
import EditorPanel from '@/editor/EditorPanel.vue';

const app = useAppStore();
const editor = useEditorStore();
const auth = useAuthStore();

onMounted(() => void auth.init());
watch(
  () => auth.isAuthed,
  (authed) => {
    if (authed) void app.initBackend();
  },
  { immediate: true },
);

const wallClass = computed(() => wallById(app.room.wallId).className);
const floorClass = computed(() => floorById(app.room.floorId).className);
const night = computed(() => app.timeOfDay === 'night');
const sortedItems = computed(() => [...app.roomItems].sort((a, b) => a.z - b.z));
const motes = Array.from({ length: 8 }, (_, i) => i);

function onContentDown(event: PointerEvent) {
  if (event.target === event.currentTarget) editor.select(null);
}
</script>

<template>
  <div :class="{ 'is-editing': editor.isEditing }">
    <div class="room">
      <div class="room__wall" :class="wallClass"></div>
      <div class="room__floor" :class="floorClass"></div>
      <div class="room__baseboard"></div>
      <div class="room__decor">
        <RoomItem v-for="item in sortedItems" :key="item.id" :item="item" />
      </div>
      <div class="room__dust" aria-hidden="true">
        <span v-for="n in motes" :key="n" class="mote"></span>
      </div>
      <div class="room__vignette"></div>
      <div class="room__night" :style="{ opacity: night ? 1 : 0 }"></div>
    </div>
    <div class="app-shell">
      <RoomBar />
      <div class="content" @pointerdown="onContentDown">
        <router-view />
      </div>
    </div>
    <EditorPanel v-if="editor.isEditing" />
  </div>
</template>
