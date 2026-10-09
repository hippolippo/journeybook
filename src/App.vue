<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useAppStore, type Viewport } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import { useAuthStore } from '@/stores/auth';
import { useViewport } from '@/composables/useViewport';
import RoomStage from '@/room/RoomStage.vue';
import RoomBar from '@/components/RoomBar.vue';
import EditorPanel from '@/editor/EditorPanel.vue';
import EditorExit from '@/editor/EditorExit.vue';

const app = useAppStore();
const editor = useEditorStore();
const auth = useAuthStore();
const { width, height, isMobile } = useViewport();

onMounted(() => void auth.init());
watch(
  () => auth.isAuthed,
  (authed) => {
    if (authed) void app.initBackend();
  },
  { immediate: true },
);

const mobilePreview = computed(() => editor.isEditing && editor.viewport === 'mobile');
const mainLayout = computed<Viewport>(() =>
  editor.isEditing ? 'desktop' : isMobile.value ? 'mobile' : 'desktop',
);
const mainInteractive = computed(() => editor.isEditing && editor.viewport === 'desktop');
const rootClass = computed(() =>
  editor.isEditing
    ? {
        'is-editing': true,
        [`dock-${editor.dock}`]: true,
        'editor-collapsed': editor.collapsed,
      }
    : {},
);
const phoneScale = computed(() => {
  const panelW = editor.dock === 'left' || editor.dock === 'right' ? (editor.collapsed ? 46 : 340) : 0;
  const panelH = editor.dock === 'top' || editor.dock === 'bottom' ? (editor.collapsed ? 46 : 320) : 0;
  const availW = width.value - panelW - 48;
  const availH = height.value - panelH - 48;
  return Math.min(1, availW / 410, availH / 864);
});

function onContentDown(event: PointerEvent) {
  if (event.target === event.currentTarget) editor.select(null);
}
</script>

<template>
  <div :class="rootClass">
    <template v-if="!mobilePreview">
      <RoomStage :layout="mainLayout" :interactive="mainInteractive" />
      <div class="app-shell">
        <RoomBar />
        <div class="content" @pointerdown="onContentDown">
          <router-view />
        </div>
      </div>
    </template>

    <div v-else class="preview-backdrop" @pointerdown.self="editor.select(null)">
      <div class="phone" :style="{ '--phone-scale': phoneScale }">
        <div class="phone__screen">
          <RoomStage layout="mobile" embedded interactive />
        </div>
      </div>
    </div>

    <EditorPanel v-if="editor.isEditing" />
    <EditorExit v-if="editor.showExit" />
  </div>
</template>
