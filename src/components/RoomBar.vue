<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';

const app = useAppStore();
const editor = useEditorStore();
const router = useRouter();

const NEXT_VISIT = new Date('2026-11-19T00:00:00');
const days = computed(() => Math.max(0, Math.ceil((NEXT_VISIT.getTime() - Date.now()) / 86400000)));
const night = computed(() => app.timeOfDay === 'night');

function toggleNight() {
  app.setDayNightMode(night.value ? 'day' : 'night');
}
function home() {
  router.push({ name: 'home' });
}
</script>

<template>
  <header class="roombar">
    <button class="roombar__brand" type="button" @click="home">
      <span class="icon icon--home"></span>
      <span class="roombar__title hand">our little room</span>
    </button>
    <div class="roombar__right">
      <span class="countdown" title="until we are together again">
        <span class="countdown__num">{{ days }}</span>
        <span class="countdown__txt">days until we are together ♥</span>
      </span>
      <button
        class="roombar__btn"
        type="button"
        :title="night ? 'Switch to day' : 'Switch to night'"
        @click="toggleNight"
      >
        {{ night ? '☾' : '☀' }}
      </button>
      <button
        v-if="!editor.isEditing"
        class="roombar__btn roombar__btn--edit"
        type="button"
        title="Edit room"
        @click="editor.start()"
      >
        ✎
      </button>
      <button
        v-else
        class="roombar__btn roombar__btn--edit"
        type="button"
        title="Done editing"
        @click="editor.stop()"
      >
        ✓
      </button>
      <span class="people" aria-label="you and me">
        <span class="avatar avatar--a"><span class="icon icon--heart"></span></span>
        <span class="avatar avatar--b"><span class="icon icon--star"></span></span>
      </span>
    </div>
  </header>
</template>
