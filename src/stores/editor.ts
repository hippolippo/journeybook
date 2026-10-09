import { defineStore } from 'pinia';
import type { Viewport } from './app';

export const useEditorStore = defineStore('editor', {
  state: () => ({
    isEditing: false,
    selectedId: null as string | null,
    viewport: 'desktop' as Viewport,
  }),
  actions: {
    start() {
      this.isEditing = true;
    },
    stop() {
      this.isEditing = false;
      this.selectedId = null;
    },
    select(id: string | null) {
      this.selectedId = id;
    },
    setViewport(viewport: Viewport) {
      this.viewport = viewport;
    },
  },
});
