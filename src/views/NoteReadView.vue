<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { Note } from '@/data/types';
import Icon from '@/components/Icon.vue';
import { useNotesStore } from '@/stores/notes';
import { useAuthStore } from '@/stores/auth';
import NotePage from '@/notes/NotePage.vue';
import NoteEnvelope from '@/notes/NoteEnvelope.vue';
import RichTextView from '@/notes/RichTextView.vue';
import { docToHtml } from '@/notes/richText';
import { NOTE_PAGE_WIDTH } from '@/notes/page';
import { useNoteStage } from '@/notes/useNoteStage';
import { relativeTime } from '@/notes/format';

const props = defineProps<{ noteId: string }>();
const router = useRouter();
const notes = useNotesStore();
const auth = useAuthStore();

const note = computed<Note | undefined>(() => notes.noteById(props.noteId));
const stageRef = ref<HTMLElement | null>(null);
const overflow = ref(0);
const breaking = ref(false);
const missing = ref(false);
const loadedOnce = ref(false);

const height = computed(() => note.value?.pageHeight ?? 620);
const { scale } = useNoteStage(stageRef);
const mirrorHtml = computed(() => (note.value ? docToHtml(note.value.body) : ''));

const zoomOpen = ref(false);
const zoomRef = ref<HTMLElement | null>(null);
const viewWidth = ref(0);
const zoomScale = computed(() => {
  const width = viewWidth.value || (typeof window !== 'undefined' ? window.innerWidth : 390);
  const pageWidth = width <= 760 ? Math.max(180, width - 24) : Math.min(width * 0.72, 760);
  return pageWidth / NOTE_PAGE_WIDTH;
});

async function openZoom(): Promise<void> {
  if (zoomOpen.value) return;
  zoomOpen.value = true;
  await nextTick();
  zoomRef.value?.scrollTo({ top: 0 });
}

function closeZoom(): void {
  zoomOpen.value = false;
}

function onResize(): void {
  viewWidth.value = window.innerWidth;
}

function onZoomKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeZoom();
}

let lastTap = { time: 0, x: 0, y: 0 };
function onReadTap(event: PointerEvent): void {
  if (zoomOpen.value) return;
  const now = Date.now();
  if (
    now - lastTap.time < 350 &&
    Math.abs(event.clientX - lastTap.x) < 28 &&
    Math.abs(event.clientY - lastTap.y) < 28
  ) {
    lastTap = { time: 0, x: 0, y: 0 };
    void openZoom();
    return;
  }
  lastTap = { time: now, x: event.clientX, y: event.clientY };
}

const isAuthor = computed(() => !!note.value && note.value.authorId === notes.meId);
const isRecipient = computed(() => !!note.value && note.value.recipientId === notes.meId);
const sealed = computed(
  () => !!note.value && isRecipient.value && note.value.status === 'sent' && !note.value.openedAt,
);
const canChange = computed(() => isAuthor.value && !!note.value && !note.value.openedAt);

const timeLine = computed(() => {
  if (!note.value) return '';
  const author = isAuthor.value ? auth.myName || 'you' : notes.partnerName;
  if (note.value.status === 'draft') return 'A draft';
  if (note.value.openedAt) {
    if (isAuthor.value)
      return `${notes.partnerName} opened this ${relativeTime(note.value.openedAt)}.`;
    return `Sealed with love. From ${notes.partnerName}, ${relativeTime(note.value.sentAt)}.`;
  }
  if (isAuthor.value) return `Still sealed — ${notes.partnerName} has not opened it yet.`;
  return `A letter from ${author} · ${relativeTime(note.value.sentAt)}`;
});

let timer: number | undefined;

async function load(): Promise<void> {
  if (!notes.loaded) await notes.init();
  loadedOnce.value = true;
  const found = note.value;
  if (!found || found.deletedAt) {
    missing.value = true;
    return;
  }
  if (found.status === 'draft') {
    if (found.authorId === notes.meId) {
      await router.replace({ name: 'note-edit', params: { noteId: found.id } });
    } else {
      await router.replace({ name: 'notes' });
    }
  }
}

watch(note, (value) => {
  if (!value && loadedOnce.value) missing.value = true;
  else if (value) missing.value = false;
});

watch(
  () => props.noteId,
  () => {
    breaking.value = false;
    missing.value = false;
    void load();
  },
);

onMounted(() => {
  void load();
  onResize();
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onZoomKey);
});

onBeforeUnmount(() => {
  if (timer) window.clearTimeout(timer);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('keydown', onZoomKey);
});

function breakSeal(): void {
  if (breaking.value || !note.value) return;
  breaking.value = true;
  timer = window.setTimeout(() => {
    timer = undefined;
    if (note.value) notes.markOpened(note.value.id);
    breaking.value = false;
  }, 1700);
}

function back(): void {
  void router.push({ name: 'notes' });
}

function edit(): void {
  if (!note.value) return;
  void router.push({ name: 'note-edit', params: { noteId: note.value.id } });
}

function pullBack(): void {
  if (!note.value) return;
  const ok = notes.unsendNote(note.value.id);
  if (ok) void router.push({ name: 'note-edit', params: { noteId: note.value.id } });
}

function trash(): void {
  if (!note.value) return;
  if (!window.confirm('Move this letter to the trash?')) return;
  const draft = note.value.status === 'draft';
  const ok = notes.trashNote(note.value.id);
  if (ok) void router.push({ name: 'notes', query: draft ? { tab: 'drafts' } : { tab: 'outbox' } });
}

function lineCount(value: number): string {
  const lines = Math.max(1, Math.round(value / 32));
  return `${lines} ${lines === 1 ? 'line' : 'lines'}`;
}
</script>

<template>
  <section v-if="note" class="note-read" :class="{ 'note-read--sealed': sealed }">
    <div class="note-read__bar">
      <button class="note-backlink" type="button" @click="back">
        <Icon name="back" aria-hidden="true" />
        All notes
      </button>
      <div class="note-read__meta">
        <span class="note-read__from">
          {{ isAuthor ? `To ${notes.partnerName}` : `From ${notes.partnerName}` }}
        </span>
        <span class="note-read__dot" aria-hidden="true">·</span>
        <span>{{ relativeTime(note.sentAt) }}</span>
        <span class="note-chip" :class="note.openedAt ? 'note-chip--opened' : 'note-chip--sealed'">
          {{ note.openedAt ? `Opened ${relativeTime(note.openedAt)}` : 'Sealed' }}
        </span>
      </div>
      <div v-if="isAuthor" class="note-read__actions">
        <button v-if="canChange" class="btn btn--small" type="button" @click="edit">
          <Icon name="pencil" aria-hidden="true" />
          Edit
        </button>
        <button v-if="canChange" class="btn btn--small btn--ghost" type="button" @click="pullBack">
          Pull back
        </button>
        <button class="btn btn--small btn--ghost" type="button" @click="trash">
          <Icon name="trash" aria-hidden="true" />
          Trash
        </button>
      </div>
    </div>

    <template v-if="sealed">
      <div class="note-sealed" :class="{ 'is-breaking': breaking }">
        <div ref="stageRef" class="note-read__stage note-sealed__stage" aria-hidden="true">
          <NotePage
            :paper="note.paper"
            :paper-color="note.paperColor"
            :height="note.pageHeight"
            :scale="scale"
            :mirror-html="mirrorHtml"
            :editable="false"
          >
            <RichTextView :doc="note.body" />
          </NotePage>
        </div>
        <p class="note-read__line note-sealed__spacer" aria-hidden="true">Sealed with love.</p>
        <div class="note-sealed__overlay">
          <div class="note-sealed__envelope"><NoteEnvelope :note="note" size="large" /></div>
          <div class="note-sealed__controls">
            <p class="note-sealed__line">
              A letter for {{ auth.myName || 'you' }}, from {{ notes.partnerName }} ·
              {{ relativeTime(note.sentAt) }}
            </p>
            <button class="btn btn--primary" type="button" :disabled="breaking" @click="breakSeal">
              Break the seal
            </button>
            <p class="note-sealed__hint">
              {{ notes.partnerName }} will see that you have opened it.
            </p>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        ref="stageRef"
        class="note-read__stage"
        @pointerup="onReadTap"
        @dblclick.prevent="openZoom"
      >
        <NotePage
          :paper="note.paper"
          :paper-color="note.paperColor"
          :height="note.pageHeight"
          :scale="scale"
          :mirror-html="mirrorHtml"
          :editable="false"
          @overflow="overflow = $event"
        >
          <RichTextView :doc="note.body" />
        </NotePage>
      </div>
      <p v-if="overflow > 0" class="note-read__warn">
        This letter runs about {{ lineCount(overflow) }} past its page. The extra words are in red
        below the paper.
      </p>
      <p v-else class="note-read__line">{{ timeLine }}</p>
    </template>

    <Teleport to="body">
      <div
        v-if="zoomOpen"
        ref="zoomRef"
        class="note-zoom"
        role="dialog"
        aria-modal="true"
        aria-label="Letter zoom"
        @click.self="closeZoom"
      >
        <div class="note-zoom__page">
          <NotePage
            :paper="note.paper"
            :paper-color="note.paperColor"
            :height="note.pageHeight"
            :scale="zoomScale"
            :mirror-html="mirrorHtml"
            :editable="false"
          >
            <RichTextView :doc="note.body" />
          </NotePage>
        </div>
        <button class="page-zoom__close" type="button" aria-label="Close" @click="closeZoom">
          <Icon name="close" />
        </button>
      </div>
    </Teleport>
  </section>

  <section v-else-if="missing" class="notes-empty">
    <h2>That letter is gone</h2>
    <p>It may have been moved to the trash.</p>
    <button class="btn btn--primary" type="button" @click="back">Back to notes</button>
  </section>
  <section v-else class="notes-gate hand">Opening your letter…</section>
</template>
