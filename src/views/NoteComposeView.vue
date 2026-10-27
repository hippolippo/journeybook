<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { Note } from '@/data/types';
import Icon from '@/components/Icon.vue';
import { useNotesStore } from '@/stores/notes';
import { useAuthStore } from '@/stores/auth';
import NotePage from '@/notes/NotePage.vue';
import NoteEnvelope from '@/notes/NoteEnvelope.vue';
import RichTextEditor from '@/notes/RichTextEditor.vue';
import NoteToolbar from '@/notes/NoteToolbar.vue';
import ColorSwatchInput from '@/notes/ColorSwatchInput.vue';
import { colorPickerOpen, setColorPickerOpen } from '@/notes/colorPicker';
import { NOTE_PAPERS, notePaperById } from '@/scrapbook/notes';
import { NOTE_DEFAULT_HEIGHT, clampPageHeight, notePaperStyle } from '@/notes/page';
import { DEFAULT_TEXT_STYLE, docToHtml, type NoteTextStyle } from '@/notes/richText';
import {
  ENVELOPE_TINTS,
  SEAL_COLORS,
  STAMP_PRESETS,
  STAMP_STICKER,
  stampPresetById,
  stampVars,
} from '@/notes/envelope';
import { useNoteStage } from '@/notes/useNoteStage';
import { useViewport } from '@/composables/useViewport';
import { notify } from '@/utils/notify';

const props = defineProps<{ noteId?: string }>();
const router = useRouter();
const notes = useNotesStore();
const auth = useAuthStore();
const { isMobile } = useViewport();

const note = ref<Note | null>(null);
const mode = ref<'letter' | 'envelope'>('letter');
const panelOpen = ref(false);
const confirmSend = ref(false);
const overflow = ref(0);
const missing = ref(false);
const editorRef = ref<InstanceType<typeof RichTextEditor> | null>(null);
const stageRef = ref<HTMLElement | null>(null);
const currentStyle = ref<NoteTextStyle>({ ...DEFAULT_TEXT_STYLE });
const keyboardInset = ref(0);
const panelRef = ref<HTMLElement | null>(null);
const panelHeight = ref(0);
let panelObserver: ResizeObserver | undefined;
const controlsOpen = computed(
  () => panelOpen.value || (isMobile.value && mode.value === 'envelope'),
);
const panelPad = computed(() =>
  isMobile.value && controlsOpen.value && !colorPickerOpen.value ? panelHeight.value + 8 : 0,
);
const STYLE_TAB_KEY = 'journeybook:notes:style-tab';
const styleTab = ref<'paper' | 'pen'>(readStyleTab());

function readStyleTab(): 'paper' | 'pen' {
  try {
    return localStorage.getItem(STYLE_TAB_KEY) === 'pen' ? 'pen' : 'paper';
  } catch {
    return 'paper';
  }
}

watch(styleTab, (value) => {
  try {
    localStorage.setItem(STYLE_TAB_KEY, value);
  } catch {
    /* localStorage can be unavailable in private mode */
  }
});

const height = computed(() => note.value?.pageHeight ?? NOTE_DEFAULT_HEIGHT);
const { scale } = useNoteStage(stageRef);
const paper = computed(() => notePaperById(note.value?.paper));
const mirrorHtml = computed(() => (note.value ? docToHtml(note.value.body) : ''));
const palette = computed(() => (paper.value.colorable ? (paper.value.palette ?? []) : []));
const papers = computed(() => NOTE_PAPERS.filter((item) => item.id !== 'none'));
const stampPreset = computed(() => stampPresetById(note.value?.envelope.stamp));
const stampPaperColor = computed(() => note.value?.envelope.stampPaper ?? stampPreset.value.paper);
const stampWavesColor = computed(() => note.value?.envelope.stampWaves ?? stampPreset.value.waves);
const stampCustom = computed(() =>
  Boolean(note.value?.envelope.stampPaper || note.value?.envelope.stampWaves),
);
const statusLabel = computed(() => {
  if (!note.value) return '';
  if (note.value.status === 'draft') return 'Draft';
  return note.value.openedAt ? 'Sent · opened' : 'Sent · unopened';
});
const primaryLabel = computed(() =>
  note.value?.status === 'sent' ? 'Save changes' : 'Seal & send',
);

async function load(): Promise<void> {
  if (props.noteId) {
    if (!notes.loaded) await notes.init();
    const found = notes.noteById(props.noteId);
    if (!found) {
      missing.value = true;
      return;
    }
    if (!notes.canEdit(found)) {
      await router.replace({ name: 'note-read', params: { noteId: found.id } });
      return;
    }
    note.value = found;
    notes.pauseSync();
    return;
  }
  if (!notes.loaded) await notes.init();
  const draft = notes.createDraft();
  note.value = draft;
  notes.pauseSync();
  await router.replace({ name: 'note-edit', params: { noteId: draft.id } });
}

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (note.value && notes.hasPendingSave(note.value.id)) {
    event.preventDefault();
    event.returnValue = '';
  }
}

onMounted(() => {
  void load();
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('beforeunload', onBeforeUnload);
  window.addEventListener('resize', onViewportChange);
  window.visualViewport?.addEventListener('resize', onViewportChange);
  window.visualViewport?.addEventListener('scroll', onViewportChange);
  onViewportChange();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('beforeunload', onBeforeUnload);
  window.removeEventListener('resize', onViewportChange);
  window.visualViewport?.removeEventListener('resize', onViewportChange);
  window.visualViewport?.removeEventListener('scroll', onViewportChange);
  panelObserver?.disconnect();
  document.body.classList.remove('note-color-picker');
  if (note.value) notes.flushSave(note.value.id);
  notes.resumeSync();
});

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  if (confirmSend.value) {
    confirmSend.value = false;
    return;
  }
  if (panelOpen.value) {
    panelOpen.value = false;
    return;
  }
  close();
}

function touch(): void {
  if (note.value) notes.autosave(note.value.id);
}

function onDoc(doc: Note['body']): void {
  if (!note.value) return;
  note.value.body = doc;
  touch();
}

function onSelectionStyle(style: NoteTextStyle): void {
  currentStyle.value = style;
  requestAnimationFrame(revealCaret);
}

function onPageClick(event: MouseEvent): void {
  if (mode.value !== 'letter' || !editorRef.value) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (!target.closest('.note-page')) return;
  if (target.closest('.note-editor') || target.closest('.note-page__grip')) return;
  event.preventDefault();
  editorRef.value.placeCaretAtPoint(event.clientX, event.clientY);
}

function updateKeyboardInset(): void {
  const viewport = window.visualViewport;
  const stage = stageRef.value;
  if (!viewport || !stage) {
    keyboardInset.value = 0;
    return;
  }
  const visibleBottom = viewport.height + viewport.offsetTop;
  const overlap = stage.getBoundingClientRect().bottom - visibleBottom;
  keyboardInset.value = Math.max(0, Math.min(overlap, stage.clientHeight * 0.65));
}

function revealCaret(): void {
  const stage = stageRef.value;
  const caret = editorRef.value?.caretRect();
  if (!stage || !caret) return;
  const viewport = window.visualViewport;
  const visibleTop = (viewport?.offsetTop ?? 0) + 12;
  const visibleBottom = (viewport ? viewport.height + viewport.offsetTop : window.innerHeight) - 16;
  const stageTop = stage.getBoundingClientRect().top;
  if (caret.bottom > visibleBottom) {
    stage.scrollTop += caret.bottom - visibleBottom + 8;
  } else if (caret.top < Math.max(stageTop, visibleTop)) {
    stage.scrollTop -= Math.max(stageTop, visibleTop) - caret.top + 8;
  }
}

function onViewportChange(): void {
  updateKeyboardInset();
  requestAnimationFrame(revealCaret);
}

function measurePanel(): void {
  panelHeight.value = panelRef.value?.offsetHeight ?? 0;
}

function attachPanel(): void {
  panelObserver?.disconnect();
  const element = panelRef.value;
  if (element && typeof ResizeObserver !== 'undefined') {
    panelObserver = new ResizeObserver(measurePanel);
    panelObserver.observe(element);
  }
  measurePanel();
}

function revealColorTarget(): void {
  if (!isMobile.value || !colorPickerOpen.value || mode.value !== 'letter') return;
  const stage = stageRef.value;
  const rect = editorRef.value?.selectionRect();
  if (!stage || !rect) return;
  const stageTop = stage.getBoundingClientRect().top;
  stage.scrollTop += rect.top - stageTop - 12;
}

watch(panelRef, attachPanel, { flush: 'post' });
watch(panelOpen, (open) => {
  if (open && isMobile.value) editorRef.value?.blur();
});
watch(colorPickerOpen, (open) => {
  if (!isMobile.value) {
    document.body.classList.remove('note-color-picker');
    return;
  }
  document.body.classList.toggle('note-color-picker', open);
  if (open) {
    void nextTick(() => requestAnimationFrame(revealColorTarget));
  }
});
watch([mode, panelOpen], () => {
  if (colorPickerOpen.value) setColorPickerOpen(false);
});

function onHeight(value: number): void {
  if (!note.value) return;
  note.value.pageHeight = clampPageHeight(value);
  touch();
}

function setPaper(id: string): void {
  if (!note.value) return;
  const next = notePaperById(id);
  note.value.paper = next.id === 'none' ? 'lined' : next.id;
  note.value.paperColor = next.bg;
  touch();
}

function setPaperColor(color: string): void {
  if (!note.value) return;
  note.value.paperColor = color;
  touch();
}

function setTint(color: string): void {
  if (!note.value) return;
  note.value.envelope.tint = color;
  touch();
}

function setSeal(color: string): void {
  if (!note.value) return;
  note.value.envelope.seal = color;
  touch();
}

function setStamp(id: string): void {
  if (!note.value) return;
  note.value.envelope.stamp = id;
  delete note.value.envelope.stampPaper;
  delete note.value.envelope.stampWaves;
  touch();
}

function setStampPaper(color: string): void {
  if (!note.value) return;
  note.value.envelope.stampPaper = color;
  touch();
}

function setStampWaves(color: string): void {
  if (!note.value) return;
  note.value.envelope.stampWaves = color;
  touch();
}

function paperPreview(item: (typeof NOTE_PAPERS)[number]): Record<string, string> {
  return notePaperStyle(item, item.bg, item.texture, 0.25);
}

function applyCommand(command: string, value?: string): void {
  editorRef.value?.applyCommand(command, value);
}

function applyWrap(styles: Record<string, string>): void {
  editorRef.value?.wrapSelection(styles);
}

function flush(): void {
  if (note.value) notes.flushSave(note.value.id);
}

function saveDraft(): void {
  if (!note.value) return;
  flush();
  void router.push({ name: 'notes', query: { tab: 'drafts' } });
  notify('info', 'Saved in drafts');
}

function saveChanges(): void {
  if (!note.value) return;
  flush();
  void router.push({ name: 'notes', query: { tab: 'outbox' } });
  notify('info', 'Saved. It stays editable until they open it.');
}

function primary(): void {
  if (!note.value) return;
  if (note.value.status === 'sent') {
    saveChanges();
    return;
  }
  confirmSend.value = true;
}

function close(): void {
  if (!note.value) {
    void router.push({ name: 'notes' });
    return;
  }
  const draft = note.value.status === 'draft';
  flush();
  void router.push({ name: 'notes', query: draft ? { tab: 'drafts' } : { tab: 'outbox' } });
  if (draft) notify('info', 'Draft saved');
}

function doSend(): void {
  if (!note.value) return;
  flush();
  const sent = notes.sendNote(note.value.id);
  confirmSend.value = false;
  if (sent) void router.push({ name: 'notes', query: { tab: 'outbox' } });
}

function stampStyle(preset: (typeof STAMP_PRESETS)[number]): Record<string, string> {
  return stampVars(preset);
}

function lineCount(value: number): string {
  const lines = Math.max(1, Math.round(value / 32));
  return `${lines} ${lines === 1 ? 'line' : 'lines'}`;
}
</script>

<template>
  <section
    v-if="note"
    class="note-compose"
    :class="{
      'note-compose--panel-open': controlsOpen,
      'note-compose--color-picker': colorPickerOpen,
      'note-compose--color-picker-letter': colorPickerOpen && mode === 'letter',
    }"
    :style="{ '--note-keyboard': `${keyboardInset}px`, '--note-panel-pad': `${panelPad}px` }"
  >
    <div class="note-compose__bar">
      <button
        class="note-backlink"
        type="button"
        aria-label="All notes"
        title="All notes"
        @click="close"
      >
        <Icon name="back" aria-hidden="true" />
        <span class="note-backlink__label">All notes</span>
      </button>
      <div class="note-compose__who">
        <span class="note-compose__to"
          >To <strong>{{ notes.partnerName }}</strong></span
        >
        <span class="note-compose__from hand">from {{ auth.myName || 'you' }}</span>
        <span
          class="note-chip"
          :class="note.status === 'sent' ? 'note-chip--sealed' : 'note-chip--draft'"
          :title="statusLabel"
          >{{ statusLabel }}</span
        >
      </div>
      <button
        v-if="mode === 'letter'"
        class="btn btn--small btn--ghost note-compose__style"
        type="button"
        aria-label="Style"
        title="Style"
        :aria-expanded="controlsOpen"
        @click="panelOpen = !panelOpen"
      >
        <Icon name="pencil" aria-hidden="true" />
        <span class="note-style__label">Style</span>
      </button>
      <div class="note-segmented" role="tablist" aria-label="Compose mode">
        <button
          class="note-segmented__btn"
          :class="{ 'is-on': mode === 'letter' }"
          type="button"
          role="tab"
          :aria-selected="mode === 'letter'"
          @click="mode = 'letter'"
        >
          Letter
        </button>
        <button
          class="note-segmented__btn"
          :class="{ 'is-on': mode === 'envelope' }"
          type="button"
          role="tab"
          :aria-selected="mode === 'envelope'"
          @click="mode = 'envelope'"
        >
          Envelope
        </button>
      </div>
      <div class="note-compose__actions">
        <button
          v-if="note.status === 'draft'"
          class="btn btn--small btn--ghost note-compose__save"
          type="button"
          @click="saveDraft"
        >
          Save draft
        </button>
        <button
          class="btn btn--primary btn--small note-compose__primary"
          type="button"
          @click="primary"
        >
          <span class="note-primary-long">{{ primaryLabel }}</span>
          <span class="note-primary-short">{{ note.status === 'sent' ? 'Save' : 'Send' }}</span>
        </button>
      </div>
    </div>

    <div class="note-compose__body">
      <div ref="stageRef" class="note-compose__stage" @click="onPageClick">
        <NotePage
          v-if="mode === 'letter'"
          :paper="note.paper"
          :paper-color="note.paperColor"
          :height="note.pageHeight"
          :scale="scale"
          :mirror-html="mirrorHtml"
          editable
          @update:height="onHeight"
          @overflow="overflow = $event"
        >
          <RichTextEditor
            :key="note.id"
            ref="editorRef"
            :model-value="note.body"
            :suppress-keyboard="isMobile && panelOpen"
            @update:model-value="onDoc"
            @selection-style="onSelectionStyle"
          />
        </NotePage>
        <div v-else class="note-env-stage">
          <div class="note-env-stage__frame"><NoteEnvelope :note="note" size="large" /></div>
        </div>
      </div>

      <aside
        ref="panelRef"
        class="note-panel"
        :class="{ 'note-panel--envelope': mode === 'envelope' }"
        aria-label="Letter settings"
      >
        <div v-if="!isMobile || mode === 'letter'" class="note-panel__sheet">
          <div
            v-if="isMobile && mode === 'letter'"
            class="note-panel__tabs"
            role="tablist"
            aria-label="Paper and pen settings"
          >
            <button
              class="note-panel__tab"
              :class="{ 'is-on': styleTab === 'paper' }"
              type="button"
              role="tab"
              :aria-selected="styleTab === 'paper'"
              @click="styleTab = 'paper'"
            >
              Paper
            </button>
            <button
              class="note-panel__tab"
              :class="{ 'is-on': styleTab === 'pen' }"
              type="button"
              role="tab"
              :aria-selected="styleTab === 'pen'"
              @click="styleTab = 'pen'"
            >
              Pen
            </button>
          </div>
          <button class="btn btn--small note-panel__done" type="button" @click="panelOpen = false">
            Done
          </button>
        </div>

        <template v-if="mode === 'letter'">
          <div class="note-panel__panes">
            <section
              class="note-panel__section note-panel__pane"
              :class="{ 'note-panel__pane--hidden': isMobile && styleTab !== 'paper' }"
            >
              <div class="note-panel__head">
                <h2>Paper</h2>
                <span class="hand">one page, your height</span>
              </div>
              <div class="note-paper-grid" role="group" aria-label="Letter paper">
                <button
                  v-for="item in papers"
                  :key="item.id"
                  class="note-paper-swatch"
                  :class="{ 'is-on': note.paper === item.id }"
                  type="button"
                  :title="item.label"
                  :aria-label="item.label"
                  :aria-pressed="note.paper === item.id"
                  @click="setPaper(item.id)"
                >
                  <span class="note-paper-swatch__sheet" :style="paperPreview(item)" />
                  <span class="note-paper-swatch__label">{{ item.label }}</span>
                </button>
              </div>
              <div v-if="palette.length" class="note-swatches" role="group" aria-label="Paper tint">
                <span class="note-swatches__label">Tint</span>
                <button
                  v-for="color in palette"
                  :key="color"
                  class="note-swatch"
                  :class="{ 'is-on': note.paperColor === color }"
                  type="button"
                  :style="{ '--sw': color }"
                  :aria-label="`Paper colour ${color}`"
                  :aria-pressed="note.paperColor === color"
                  @click="setPaperColor(color)"
                />
                <ColorSwatchInput
                  :model-value="note.paperColor || paper.bg"
                  label="Custom paper tint"
                  @update:model-value="setPaperColor"
                />
              </div>
            </section>

            <section
              class="note-panel__section note-panel__pane"
              :class="{ 'note-panel__pane--hidden': isMobile && styleTab !== 'pen' }"
            >
              <div class="note-panel__head">
                <h2>Writing</h2>
                <span class="hand">select words or the cursor</span>
              </div>
              <NoteToolbar :current="currentStyle" @exec="applyCommand" @wrap="applyWrap" />
            </section>
          </div>
        </template>

        <template v-else>
          <section class="note-panel__section">
            <div class="note-panel__head"><h2>Envelope</h2></div>
            <div class="note-swatches note-swatches--wrap" role="group" aria-label="Envelope tint">
              <button
                v-for="tint in ENVELOPE_TINTS"
                :key="tint.id"
                class="note-swatch note-swatch--big"
                :class="{ 'is-on': note.envelope.tint === tint.color }"
                type="button"
                :style="{ '--sw': tint.color }"
                :title="tint.label"
                :aria-label="`${tint.label} envelope`"
                :aria-pressed="note.envelope.tint === tint.color"
                @click="setTint(tint.color)"
              />
              <ColorSwatchInput
                big
                :model-value="note.envelope.tint"
                label="Custom envelope tint"
                @update:model-value="setTint"
              />
            </div>
          </section>

          <section class="note-panel__section">
            <div class="note-panel__head"><h2>Wax seal</h2></div>
            <div class="note-swatches" role="group" aria-label="Seal colour">
              <button
                v-for="seal in SEAL_COLORS"
                :key="seal.id"
                class="note-swatch"
                :class="{ 'is-on': note.envelope.seal === seal.color }"
                type="button"
                :style="{ '--sw': seal.color }"
                :aria-label="`${seal.label} wax seal`"
                :aria-pressed="note.envelope.seal === seal.color"
                @click="setSeal(seal.color)"
              />
              <ColorSwatchInput
                :model-value="note.envelope.seal"
                label="Custom wax seal colour"
                @update:model-value="setSeal"
              />
            </div>
          </section>

          <section class="note-panel__section">
            <div class="note-panel__head note-panel__head--stamp">
              <h2>Stamp</h2>
              <div class="note-stamp-colors">
                <ColorSwatchInput
                  :model-value="stampPaperColor"
                  label="Custom stamp colour"
                  @update:model-value="setStampPaper"
                />
                <span>Stamp</span>
                <ColorSwatchInput
                  :model-value="stampWavesColor"
                  label="Custom postmark colour"
                  @update:model-value="setStampWaves"
                />
                <span>Postmark</span>
              </div>
            </div>
            <div class="note-stamp-row" role="group" aria-label="Stamp">
              <button
                v-for="preset in STAMP_PRESETS"
                :key="preset.id"
                class="note-stamp-option"
                :class="{ 'is-on': note.envelope.stamp === preset.id && !stampCustom }"
                type="button"
                :aria-label="`${preset.label} stamp`"
                :aria-pressed="note.envelope.stamp === preset.id"
                @click="setStamp(preset.id)"
              >
                <span class="note-stamp-option__art" :style="stampStyle(preset)" aria-hidden="true">
                  <span class="note-stamp-option__svg" v-html="STAMP_STICKER.raw" />
                </span>
                <span class="note-stamp-option__label">{{ preset.label }}</span>
              </button>
            </div>
          </section>
        </template>
      </aside>
    </div>

    <div v-if="confirmSend" class="note-scrim" @click.self="confirmSend = false">
      <div class="note-dialog" role="dialog" aria-modal="true" aria-labelledby="send-title">
        <p class="hand">ready to seal it</p>
        <h2 id="send-title">Send this letter to {{ notes.partnerName }}?</h2>
        <div class="note-dialog__env"><NoteEnvelope :note="note" size="card" /></div>
        <p>
          {{ notes.partnerName }} will get a little email, and the letter will wait in their inbox
          until they break the seal.
        </p>
        <p v-if="overflow > 0" class="note-dialog__warn">
          The letter runs about {{ lineCount(overflow) }} past the page. Those words will be in red
          below the paper.
        </p>
        <p v-else class="note-dialog__ok">The letter fits its page.</p>
        <p class="hand">
          You can still edit or pull it back until {{ notes.partnerName }} opens it.
        </p>
        <div class="note-dialog__actions">
          <button class="btn btn--ghost" type="button" @click="confirmSend = false">
            Keep writing
          </button>
          <button class="btn btn--primary" type="button" @click="doSend">Seal &amp; send</button>
        </div>
      </div>
    </div>
  </section>

  <section v-else-if="missing" class="notes-empty">
    <h2>That letter is gone</h2>
    <p>It may have been moved to the trash.</p>
    <button class="btn btn--primary" type="button" @click="router.push({ name: 'notes' })">
      Back to notes
    </button>
  </section>
  <section v-else class="notes-gate hand">Opening a blank page…</section>
</template>
