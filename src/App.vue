<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useAppStore, type Viewport } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import { usePageEditorStore } from '@/stores/pageEditor';
import { useAuthStore } from '@/stores/auth';
import { useViewport } from '@/composables/useViewport';
import RoomStage from '@/room/RoomStage.vue';
import RoomBar from '@/components/RoomBar.vue';
import EditorPanel from '@/editor/EditorPanel.vue';
import EditorExit from '@/editor/EditorExit.vue';
import ToastHost from '@/components/ToastHost.vue';
import rotatePhone from '@/assets/svg/rotate-phone.svg';

const app = useAppStore();
const editor = useEditorStore();
const pageEditor = usePageEditorStore();
const auth = useAuthStore();
const { width, height, isMobile, rotate } = useViewport();

onMounted(() => void auth.init());
watch(
  () => auth.isAuthed,
  (authed) => {
    if (authed) void app.initBackend();
  },
  { immediate: true },
);

// Warn before closing the tab with unsaved editor work.
function onBeforeUnload(event: BeforeUnloadEvent) {
  const dirtyRoom = editor.isEditing && editor.dirty;
  const dirtyPage = pageEditor.isEditing && pageEditor.dirty;
  if (dirtyRoom || dirtyPage) {
    event.preventDefault();
    event.returnValue = '';
  }
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload));

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
  const panelW = editor.collapsed ? 46 : 340;
  const availW = width.value - panelW - 48;
  const availH = height.value - 48;
  return Math.min(1, availW / 410, availH / 864);
});

function onContentDown(event: PointerEvent) {
  if (event.target === event.currentTarget) editor.select(null);
}

// Clicking empty room space (not the bar, panel, or an item) deselects.
function onGlobalPointerDown(event: PointerEvent) {
  if (!editor.isEditing) return;
  const target = event.target as Element | null;
  if (target?.closest?.('.editor, .roombar, .room-item')) return;
  editor.select(null);
}
onMounted(() => window.addEventListener('pointerdown', onGlobalPointerDown));
onBeforeUnmount(() => window.removeEventListener('pointerdown', onGlobalPointerDown));
</script>

<template>
  <div :class="rootClass">
    <div v-if="rotate" class="rotate-gate">
      <img :src="rotatePhone" alt="" aria-hidden="true" />
      <p class="rotate-gate__title">Please rotate your phone</p>
      <p class="rotate-gate__sub">this little room is best standing up</p>
    </div>

    <div v-else-if="app.loading" class="boot-gate">
      <p class="boot-gate__title">Opening your scrapbook…</p>
    </div>

    <div v-else-if="app.loadError" class="boot-gate">
      <p class="boot-gate__title">We couldn't load your memories</p>
      <p class="boot-gate__sub">Your saved work is safe. Check your connection and try again.</p>
      <button class="btn btn--primary" type="button" @click="app.retryInit()">Try again</button>
    </div>

    <template v-else>
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
    </template>

    <ToastHost />
  </div>
</template>
