<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import { useRouter } from 'vue-router';
import type { DayNightMode, TrashItem, TrashKind } from '@/data/types';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import { useViewport } from '@/composables/useViewport';
import { exportLibrary, importLibrary } from '@/data/libraryTransfer';
import { notify } from '@/utils/notify';

const app = useAppStore();
const editor = useEditorStore();
const router = useRouter();
const { isMobile } = useViewport();

const busy = ref(false);
const importInput = ref<HTMLInputElement | null>(null);

const mode = computed(() => app.data.room.dayNightMode);
const night = computed(() => app.timeOfDay === 'night');

const KIND_LABELS: Record<TrashKind, string> = {
  book: 'Scrapbook',
  page: 'Page',
  media: 'Photo',
  event: 'Calendar',
  layout: 'Room layout',
  preset: 'Image preset',
};

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
function kindLabel(kind: TrashKind): string {
  return KIND_LABELS[kind];
}
async function restore(item: TrashItem) {
  try {
    await app.restoreItem(item);
  } catch (e) {
    console.error(e);
    notify('error', "Couldn't restore that item", 'Please try again.');
  }
}
async function purge(item: TrashItem) {
  if (!window.confirm(`Permanently delete "${item.label}"? This cannot be undone.`)) return;
  try {
    await app.purgeItem(item);
  } catch (e) {
    console.error(e);
    notify('error', "Couldn't delete that item", 'Please try again.');
  }
}
async function emptyTrash() {
  if (!window.confirm('Permanently delete everything in the trash? This cannot be undone.')) return;
  try {
    await app.emptyTrash();
  } catch (e) {
    console.error(e);
    notify('error', "Couldn't empty the trash", 'Please try again.');
  }
}

function cleanOrphans() {
  if (window.confirm('Remove items that are no longer attached to a scrapbook?')) app.cleanOrphans();
}

async function exportAll() {
  busy.value = true;
  try {
    const json = await exportLibrary();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journeybook-library-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    notify('error', "Couldn't export your library", 'Please try again.');
  } finally {
    busy.value = false;
  }
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const warning =
    'Importing replaces EVERY scrapbook, photo, note and event for BOTH of you.\n\n' +
    'The current library is moved to Trash first and can be restored there.\n\n' +
    'Type REPLACE to continue.';
  if (window.prompt(warning) !== 'REPLACE') return;
  busy.value = true;
  try {
    const text = await file.text();
    await importLibrary(text);
    notify('success', 'Library imported', 'The previous library is in the Trash if you need it.');
  } catch (e) {
    console.error(e);
    notify('error', "Couldn't import that file", 'It may not be a Journeybook library export.');
  } finally {
    busy.value = false;
  }
}

onMounted(() => void app.loadTrash());
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

    <div class="settings__card">
      <div class="settings__row settings__row--field">
        <div class="settings__text">
          <span class="settings__label">
            <Icon name="trash" />
            Trash
          </span>
          <span class="settings__sub">Deleted things wait here so either of you can restore them.</span>
        </div>
        <button v-if="app.trash.length" class="btn btn--small" type="button" @click="emptyTrash">
          Empty
        </button>
      </div>

      <p v-if="!app.trash.length" class="settings__muted">Nothing in the trash.</p>
      <ul v-else class="trash">
        <li v-for="item in app.trash" :key="item.id" class="trash__row">
          <span class="trash__text">
            <span class="trash__label">{{ item.label }}</span>
            <span class="trash__meta">
              {{ kindLabel(item.kind) }}<template v-if="item.detail"> · {{ item.detail }}</template>
            </span>
          </span>
          <span class="trash__actions">
            <button class="btn btn--small" type="button" @click="restore(item)">Restore</button>
            <button class="btn btn--small is-danger" type="button" @click="purge(item)">Delete</button>
          </span>
        </li>
      </ul>
    </div>

    <div class="settings__card">
      <div class="settings__row settings__row--field">
        <div class="settings__text">
          <span class="settings__label">
            <Icon name="book" />
            Back up everything
          </span>
          <span class="settings__sub">
            Export the whole library to a file, or restore it from one. This is shared — it affects
            both of you.
          </span>
        </div>
      </div>
      <div class="settings__actions">
        <button class="btn btn--small" type="button" :disabled="busy" @click="exportAll">
          Export everything
        </button>
        <button
          class="btn btn--small is-danger"
          type="button"
          :disabled="busy"
          @click="importInput?.click()"
        >
          Import everything
        </button>
        <input
          ref="importInput"
          class="visually-hidden"
          type="file"
          accept=".json,application/json"
          @change="onImportFile"
        />
      </div>
      <p class="settings__warn">
        Importing replaces everything for both of you. The current library is moved to the Trash
        first, so you can undo it from there.
      </p>

      <div class="settings__divider"></div>
      <div class="settings__row settings__row--field">
        <div class="settings__text">
          <span class="settings__label">Library check</span>
          <span class="settings__sub">
            <template v-if="app.integrity.total === 0">Everything looks intact.</template>
            <template v-else>{{ app.integrity.total }} orphaned item(s) found.</template>
          </span>
        </div>
        <button
          v-if="app.integrity.total > 0"
          class="btn btn--small"
          type="button"
          @click="cleanOrphans"
        >
          Clean up
        </button>
      </div>
    </div>
  </section>
</template>
