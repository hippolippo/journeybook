<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from '@/components/Icon.vue';
import { useRouter } from 'vue-router';
import type { DayNightMode, TrashItem, TrashKind } from '@/data/types';
import { wallById } from '@/catalog/options';
import windowArt from '@/assets/svg/window-day.svg';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useEditorStore } from '@/stores/editor';
import { useNotesStore } from '@/stores/notes';
import { useViewport } from '@/composables/useViewport';
import { exportLibrary, importLibrary } from '@/data/libraryTransfer';
import { pbOutbox } from '@/data/backend';
import { notify, onSyncStatus, type SyncStatus } from '@/utils/notify';

const app = useAppStore();
const auth = useAuthStore();
const editor = useEditorStore();
const notes = useNotesStore();
const router = useRouter();
const { isMobile } = useViewport();

const busy = ref(false);
const importInput = ref<HTMLInputElement | null>(null);
const glowDraft = ref(auth.roomGlow);
const glowPercent = computed(() => Math.round(glowDraft.value * 100));
const showGlowPreview = ref(false);
const integrityTotal = computed(() => app.integrity.total + notes.integrity.orphanNotes);
const sync = ref<SyncStatus>(
  pbOutbox?.status() ?? { pending: 0, working: false, failed: false, dead: 0 },
);
let glowPreviewTimer: ReturnType<typeof setTimeout> | undefined;
let stopSyncStatus: (() => void) | null = null;
const wallClass = computed(() => wallById(app.room.wallId).className);

function revealGlowPreview() {
  if (glowPreviewTimer) {
    clearTimeout(glowPreviewTimer);
    glowPreviewTimer = undefined;
  }
  showGlowPreview.value = true;
}
function hideGlowPreviewSoon() {
  if (glowPreviewTimer) clearTimeout(glowPreviewTimer);
  glowPreviewTimer = setTimeout(() => {
    showGlowPreview.value = false;
    glowPreviewTimer = undefined;
  }, 400);
}
onBeforeUnmount(() => {
  if (glowPreviewTimer) clearTimeout(glowPreviewTimer);
  stopSyncStatus?.();
});

watch(
  () => auth.roomGlow,
  (value) => {
    glowDraft.value = value;
  },
);

const mode = computed(() => app.data.room.dayNightMode);
const night = computed(() => app.timeOfDay === 'night');

const KIND_LABELS: Record<TrashKind, string> = {
  book: 'Scrapbook',
  page: 'Page',
  media: 'Photo',
  event: 'Calendar',
  layout: 'Room layout',
  note: 'Letter',
  preset: 'Image preset',
};

function setMode(next: DayNightMode) {
  app.setDayNightMode(next);
}
function onGlowInput(event: Event) {
  revealGlowPreview();
  glowDraft.value = Number((event.target as HTMLInputElement).value) / 100;
}
async function saveGlow() {
  try {
    await auth.setRoomGlow(glowDraft.value);
  } catch (e) {
    console.error(e);
    notify('error', "Couldn't save the glow", 'Please try again.');
  }
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
  if (
    !window.confirm(
      'Clean up orphaned pages, photos, broken room attachments and orphaned letters?',
    )
  )
    return;
  app.cleanOrphans();
  const orphanNotes = notes.cleanOrphanNotes();
  if (orphanNotes) notify('info', 'Moved orphaned letters to the trash');
}

function retrySync() {
  pbOutbox?.retryFailed();
}

function discardSync() {
  if (!window.confirm('Discard the changes that could not be saved? This cannot be undone.'))
    return;
  pbOutbox?.discardFailed();
  notify('info', 'Unsynced changes discarded');
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

onMounted(() => {
  void app.loadTrash();
  stopSyncStatus = onSyncStatus((next) => {
    sync.value = next;
  });
});
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

      <div class="settings__divider"></div>
      <div class="settings__glow-control">
        <div class="settings__row settings__row--field">
          <div class="settings__text">
            <span class="settings__label">
              <Icon name="sun" />
              Room text glow
            </span>
            <span class="settings__sub">
              Soft halo behind text sitting on the room. Daytime only; saved per user.
            </span>
          </div>
          <span class="settings__glow-value">{{ glowPercent }}%</span>
        </div>
        <div class="settings__glow-slider">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            :value="glowPercent"
            aria-label="Room text glow"
            @pointerdown="revealGlowPreview"
            @pointerup="hideGlowPreviewSoon"
            @pointercancel="hideGlowPreviewSoon"
            @focus="revealGlowPreview"
            @blur="hideGlowPreviewSoon"
            @input="onGlowInput"
            @change="saveGlow"
          />
        </div>
        <div
          v-if="showGlowPreview"
          class="settings__glow-preview"
          :style="{ '--room-glow-strength': glowDraft }"
          aria-hidden="true"
        >
          <div class="settings__glow-preview-scene" :class="wallClass">
            <img class="settings__glow-preview-window" :src="windowArt" alt="" />
            <div class="settings__glow-preview-copy">
              <span class="settings__glow-preview-text room-glow">Welcome back, you two</span>
            </div>
          </div>
        </div>
      </div>

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

    <div v-if="sync.dead > 0" class="settings__card">
      <div class="settings__row settings__row--field">
        <div class="settings__text">
          <span class="settings__label">
            <Icon name="lock" />
            Unsynced changes
          </span>
          <span class="settings__sub">
            {{ sync.dead }} change{{ sync.dead === 1 ? '' : 's' }} couldn’t be saved. Your other
            writes are still safe.
          </span>
        </div>
        <span class="settings__actions">
          <button class="btn btn--small" type="button" @click="retrySync">Retry</button>
          <button class="btn btn--small is-danger" type="button" @click="discardSync">
            Discard
          </button>
        </span>
      </div>
    </div>

    <div v-if="!isMobile" class="settings__card">
      <div class="settings__row settings__row--field">
        <div class="settings__text">
          <span class="settings__label">
            <Icon name="trash" />
            Trash
          </span>
          <span class="settings__sub"
            >Deleted things wait here so either of you can restore them.</span
          >
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
            <button class="btn btn--small is-danger" type="button" @click="purge(item)">
              Delete
            </button>
          </span>
        </li>
      </ul>
    </div>

    <div v-if="!isMobile" class="settings__card">
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
            <template v-if="integrityTotal === 0">Everything looks intact.</template>
            <template v-else>{{ integrityTotal }} integrity issue(s) found.</template>
          </span>
        </div>
        <button
          v-if="integrityTotal > 0"
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
