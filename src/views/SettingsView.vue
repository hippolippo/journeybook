<script setup lang="ts">
import { computed } from 'vue';
import Icon from '@/components/Icon.vue';
import { useRouter } from 'vue-router';
import type { DayNightMode } from '@/data/types';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import { useViewport } from '@/composables/useViewport';

const app = useAppStore();
const editor = useEditorStore();
const router = useRouter();
const { isMobile } = useViewport();

const mode = computed(() => app.data.room.dayNightMode);
const night = computed(() => app.timeOfDay === 'night');

function setMode(next: DayNightMode) {
  app.setDayNightMode(next);
}
function togglePerformance() {
  app.setPerformanceMode(!app.performanceMode);
}
function toggleEdit() {
  if (editor.isEditing) editor.requestExit();
  else void editor.start();
}
</script>

<template>
  <section class="settings">
    <header class="settings__head">
      <button class="backlink" type="button" @click="router.back()">
        <Icon name="back" />Back
      </button>
      <h1 class="tag settings__title">Settings</h1>
    </header>

    <div class="settings__card">
      <div class="settings__row settings__row--field">
        <div class="settings__text">
          <span class="settings__label">
            <Icon :name="night ? 'moon' : 'sun'" />
            Time of day
          </span>
          <span class="settings__sub">Auto follows day and night where you are.</span>
        </div>
        <div class="settings__seg" role="group" aria-label="Time of day">
          <button
            type="button"
            :class="{ 'is-on': mode === 'day' }"
            :aria-pressed="mode === 'day'"
            @click="setMode('day')"
          >
            Day
          </button>
          <button
            type="button"
            :class="{ 'is-on': mode === 'night' }"
            :aria-pressed="mode === 'night'"
            @click="setMode('night')"
          >
            Night
          </button>
          <button
            type="button"
            :class="{ 'is-on': mode === 'auto' }"
            :aria-pressed="mode === 'auto'"
            @click="setMode('auto')"
          >
            Auto
          </button>
        </div>
      </div>

      <div class="settings__divider"></div>

      <button
        class="settings__row"
        type="button"
        :aria-pressed="app.performanceMode"
        @click="togglePerformance"
      >
        <span class="settings__text">
          <span class="settings__label">
            <Icon name="settings" />
            Performance lighting
          </span>
          <span class="settings__sub">A lighter, CSS-based glow for older phones.</span>
        </span>
        <span
          class="settings__switch"
          :class="{ 'is-on': app.performanceMode }"
          aria-hidden="true"
        ></span>
      </button>

      <template v-if="!isMobile">
        <div class="settings__divider"></div>
        <button class="settings__row" type="button" @click="toggleEdit">
          <span class="settings__text">
            <span class="settings__label">
              <Icon :name="editor.isEditing ? 'check' : 'pencil'" />
              {{ editor.isEditing ? 'Done editing' : 'Edit room' }}
            </span>
            <span class="settings__sub">Move, add, and restyle the room.</span>
          </span>
          <Icon name="chev-right" class="settings__chev" aria-hidden="true" />
        </button>
      </template>
    </div>
  </section>
</template>
