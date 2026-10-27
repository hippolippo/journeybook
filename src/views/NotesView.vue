<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Note } from '@/data/types';
import Icon from '@/components/Icon.vue';
import { useNotesStore } from '@/stores/notes';
import NoteEnvelope from '@/notes/NoteEnvelope.vue';
import { docPreview } from '@/notes/richText';
import { notePaperById } from '@/scrapbook/notes';
import { notePaperStyle } from '@/notes/page';
import { relativeTime, shortDate } from '@/notes/format';

type Tab = 'inbox' | 'outbox' | 'drafts';

const route = useRoute();
const router = useRouter();
const notes = useNotesStore();

function tabFromQuery(): Tab {
  const value = route.query.tab;
  return value === 'outbox' || value === 'drafts' ? value : 'inbox';
}

const tab = ref<Tab>(tabFromQuery());
const retrying = ref(false);

const lists = computed(() => ({
  inbox: notes.inbox,
  outbox: notes.outbox,
  drafts: notes.drafts,
}));
const current = computed(() => lists.value[tab.value]);
const titles: Record<Tab, string> = { inbox: 'Letters', outbox: 'Outbox', drafts: 'Drafts' };
const subtitles = computed<Record<Tab, string>>(() => ({
  inbox: `the letters ${notes.partnerName} has sealed for you`,
  outbox: 'letters you have sent into the world',
  drafts: 'letters still being written',
}));

function selectTab(value: Tab): void {
  tab.value = value;
  if (route.query.tab !== value) {
    void router.replace({ query: value === 'inbox' ? {} : { tab: value } });
  }
}

watch(
  () => route.query.tab,
  () => {
    tab.value = tabFromQuery();
  },
);

async function load(): Promise<void> {
  if (notes.loaded) await notes.refresh();
  else await notes.init();
}

async function retry(): Promise<void> {
  retrying.value = true;
  await notes.init(true);
  retrying.value = false;
}

onMounted(() => {
  void load();
});

function open(note: Note): void {
  if (note.status === 'draft') {
    void router.push({ name: 'note-edit', params: { noteId: note.id } });
  } else {
    void router.push({ name: 'note-read', params: { noteId: note.id } });
  }
}

function compose(): void {
  void router.push({ name: 'note-new' });
}

function chip(note: Note): string {
  if (note.status === 'draft') return 'Draft';
  if (note.authorId === notes.meId) return note.openedAt ? 'Opened' : 'Sealed';
  return note.openedAt ? 'Read' : 'Unread';
}

function who(note: Note): string {
  if (note.status === 'draft') return 'Your draft';
  if (note.authorId === notes.meId) return 'You wrote';
  return `From ${notes.partnerName}`;
}

function preview(note: Note): string {
  const sealed = note.status === 'sent' && note.recipientId === notes.meId && !note.openedAt;
  if (sealed) return 'A sealed letter. Break the seal to read it.';
  return docPreview(note.body, 96) || 'A blank page, waiting.';
}

function meta(note: Note): string {
  if (note.status === 'draft') return `Edited ${relativeTime(note.updatedAt)}`;
  if (note.authorId === notes.meId) {
    const to = notes.partnerName;
    if (note.openedAt) return `To ${to} · opened ${relativeTime(note.openedAt)}`;
    return `To ${to} · waiting to be opened`;
  }
  return `From ${notes.partnerName} · ${relativeTime(note.sentAt)}`;
}

function draftStyle(note: Note): Record<string, string> {
  const paper = notePaperById(note.paper);
  return notePaperStyle(paper, note.paperColor);
}

function emptyText(): { title: string; body: string } {
  if (tab.value === 'drafts') {
    return {
      title: 'No drafts on the go',
      body: 'Start a letter and save it here until it feels right.',
    };
  }
  if (tab.value === 'outbox') {
    return {
      title: 'Nothing sent yet',
      body: 'Letters you seal will wait here, with a note when they are opened.',
    };
  }
  return {
    title: 'No letters waiting',
    body: `When ${notes.partnerName} writes, their envelope will appear here.`,
  };
}
</script>

<template>
  <section class="notes-view">
    <div v-if="notes.loading && !notes.loaded" class="notes-gate hand">Opening your letters…</div>
    <div v-else-if="notes.error && !notes.loaded" class="notes-gate">
      <p class="notes-gate__title">We couldn't open your notes</p>
      <p class="hand">Your letters are safe. Check your connection and try again.</p>
      <button class="btn btn--primary" type="button" :disabled="retrying" @click="retry">
        {{ retrying ? 'Trying…' : 'Try again' }}
      </button>
    </div>

    <template v-else>
      <header class="notes-view__head">
        <div class="notes-view__heading">
          <p class="tag tag--tape">our notes</p>
          <h1 class="notes-view__title">{{ titles[tab] }}</h1>
          <p class="notes-view__sub">{{ subtitles[tab] }}</p>
        </div>
        <button class="btn btn--primary" type="button" @click="compose">
          <Icon name="plus" aria-hidden="true" />
          New letter
        </button>
      </header>

      <div class="notes-tabs" role="tablist" aria-label="Note lists">
        <button
          class="notes-tab"
          :class="{ 'is-on': tab === 'inbox' }"
          type="button"
          role="tab"
          :aria-selected="tab === 'inbox'"
          @click="selectTab('inbox')"
        >
          Letters
          <span v-if="notes.unread" class="notes-tab__count">{{ notes.unread }}</span>
        </button>
        <button
          class="notes-tab"
          :class="{ 'is-on': tab === 'outbox' }"
          type="button"
          role="tab"
          :aria-selected="tab === 'outbox'"
          @click="selectTab('outbox')"
        >
          Outbox
          <span v-if="lists.outbox.length" class="notes-tab__count">{{ lists.outbox.length }}</span>
        </button>
        <button
          class="notes-tab"
          :class="{ 'is-on': tab === 'drafts' }"
          type="button"
          role="tab"
          :aria-selected="tab === 'drafts'"
          @click="selectTab('drafts')"
        >
          Drafts
          <span v-if="lists.drafts.length" class="notes-tab__count">{{ lists.drafts.length }}</span>
        </button>
      </div>

      <div v-if="current.length" class="notes-grid">
        <button
          v-for="note in current"
          :key="note.id"
          class="note-card"
          type="button"
          @click="open(note)"
        >
          <NoteEnvelope v-if="note.status === 'sent'" :note="note" class="note-card__env" />
          <span v-else class="note-card__paper" :style="draftStyle(note)">
            <span class="note-card__paper-head hand">{{
              docPreview(note.body, 24) || 'Untitled letter'
            }}</span>
          </span>
          <span v-if="note.status === 'sent'" class="note-card__body">
            <span class="note-card__top">
              <span class="note-card__who">{{ who(note) }}</span>
              <span class="note-chip" :class="`note-chip--${chip(note).toLowerCase()}`">{{
                chip(note)
              }}</span>
            </span>
            <span class="note-card__preview">{{ preview(note) }}</span>
            <span class="note-card__meta">{{ meta(note) }} · {{ shortDate(note.sentAt) }}</span>
          </span>
          <span v-else class="note-card__body note-card__body--draft">
            <span class="note-card__meta">{{ meta(note) }} · {{ shortDate(note.updatedAt) }}</span>
          </span>
        </button>
      </div>

      <div v-else class="notes-empty">
        <p class="hand">nothing here yet</p>
        <h2>{{ emptyText().title }}</h2>
        <p>{{ emptyText().body }}</p>
        <button v-if="tab === 'drafts'" class="btn btn--primary" type="button" @click="compose">
          <Icon name="plus" aria-hidden="true" />
          New letter
        </button>
      </div>
    </template>
  </section>
</template>
