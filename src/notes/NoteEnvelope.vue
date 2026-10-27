<script setup lang="ts">
import { computed } from 'vue';
import type { Note } from '@/data/types';
import { useAuthStore } from '@/stores/auth';
import { useNotesStore } from '@/stores/notes';
import {
  SEAL_STICKER,
  STAMP_STICKER,
  envelopeInk,
  sealVars,
  stampPresetById,
} from '@/notes/envelope';

const props = withDefaults(defineProps<{ note: Note; size?: 'card' | 'large' }>(), {
  size: 'card',
});

const auth = useAuthStore();
const notes = useNotesStore();

const stamp = computed(() => stampPresetById(props.note.envelope.stamp));
const stampStyle = computed(() => ({
  '--c-paper': props.note.envelope.stampPaper ?? stamp.value.paper,
  '--c-waves': props.note.envelope.stampWaves ?? stamp.value.waves,
}));
const ink = computed(() => envelopeInk(props.note.envelope.tint));
const isMine = computed(() => props.note.authorId === notes.meId);
const toName = computed(() => (isMine.value ? notes.partnerName : auth.myName || 'you'));
const fromName = computed(() => (isMine.value ? auth.myName || 'you' : notes.partnerName));
const initial = computed(() => {
  const stored = props.note.envelope.initial?.trim();
  if (stored) return Array.from(stored)[0]?.toUpperCase() ?? '';
  if (!auth.enabled) return 'G';
  const name = isMine.value ? auth.myName : notes.partnerName;
  return (Array.from(name.trim())[0] ?? 'G').toUpperCase();
});
</script>

<template>
  <span
    class="note-env"
    :class="`note-env--${size}`"
    :style="{ '--env': note.envelope.tint, '--env-ink': ink }"
  >
    <span class="note-env__body">
      <span class="note-env__stamp" :style="stampStyle" aria-hidden="true">
        <span class="note-env__art" v-html="STAMP_STICKER.raw" />
      </span>
      <span class="note-env__address">
        <span class="note-env__to">To {{ toName }}</span>
        <span class="note-env__from">from {{ fromName }}</span>
      </span>
      <span class="note-env__fold note-env__fold--left" aria-hidden="true" />
      <span class="note-env__fold note-env__fold--right" aria-hidden="true" />
    </span>
    <span class="note-env__flap" aria-hidden="true" />
    <span class="note-env__seal" :style="sealVars(note.envelope.seal)" aria-hidden="true">
      <span class="note-env__art" v-html="SEAL_STICKER.raw" />
      <span class="note-env__seal-letter">{{ initial }}</span>
    </span>
  </span>
</template>
