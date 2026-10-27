<script setup lang="ts">
import { computed } from 'vue';
import {
  NOTE_FONTS,
  NOTE_HIGHLIGHTS,
  NOTE_INKS,
  NOTE_SIZES,
  fontById,
  type NoteTextStyle,
} from '@/notes/richText';
import ColorSwatchInput from './ColorSwatchInput.vue';

const props = defineProps<{ current?: NoteTextStyle }>();

const emit = defineEmits<{
  exec: [command: string, value?: string];
  wrap: [styles: Record<string, string>];
}>();

const fontValue = computed(() => fontById(props.current?.font).family);
const sizeValue = computed(() => props.current?.size ?? 22);
const sizeOptions = computed(() => {
  const size = props.current?.size;
  if (!size || (NOTE_SIZES as readonly number[]).includes(size)) return NOTE_SIZES;
  return [...NOTE_SIZES, size].sort((a, b) => a - b);
});
const inkValue = computed(() => props.current?.color ?? '#4a3b2e');
const highlightValue = computed(() => props.current?.highlight ?? '#f5e6a8');
const highlightDisplay = computed(() => props.current?.highlight ?? 'transparent');

function font(event: Event): void {
  const family = (event.target as HTMLSelectElement).value;
  emit('wrap', { 'font-family': family });
}

function size(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  emit('wrap', { 'font-size': `${value}px` });
}

function align(command: 'left' | 'center' | 'right'): void {
  emit(
    'exec',
    command === 'left' ? 'justifyLeft' : command === 'center' ? 'justifyCenter' : 'justifyRight',
  );
}

function setInk(value: string): void {
  emit('exec', 'foreColor', value);
}

function setHighlight(value: string): void {
  emit('exec', 'hiliteColor', value);
}
</script>

<template>
  <div class="note-toolbar">
    <div class="note-toolbar__fields">
      <label class="note-field">
        <span>Font</span>
        <select aria-label="Font" :value="fontValue" @change="font">
          <option v-for="item in NOTE_FONTS" :key="item.id" :value="item.family">
            {{ item.label }}
          </option>
        </select>
      </label>
      <label class="note-field note-field--size">
        <span>Size</span>
        <select aria-label="Font size" :value="sizeValue" @change="size">
          <option v-for="value in sizeOptions" :key="value" :value="value">
            {{ value }}
          </option>
        </select>
      </label>
    </div>

    <div class="note-toolbar__row">
      <button
        class="note-tool"
        :class="{ 'is-on': current?.bold }"
        type="button"
        title="Bold"
        aria-label="Bold"
        :aria-pressed="current?.bold ?? false"
        @mousedown.prevent
        @click="emit('exec', 'bold')"
      >
        <b>B</b>
      </button>
      <button
        class="note-tool"
        :class="{ 'is-on': current?.italic }"
        type="button"
        title="Italic"
        aria-label="Italic"
        :aria-pressed="current?.italic ?? false"
        @mousedown.prevent
        @click="emit('exec', 'italic')"
      >
        <i>I</i>
      </button>
      <button
        class="note-tool"
        :class="{ 'is-on': current?.underline }"
        type="button"
        title="Underline"
        aria-label="Underline"
        :aria-pressed="current?.underline ?? false"
        @mousedown.prevent
        @click="emit('exec', 'underline')"
      >
        <u>U</u>
      </button>
      <button
        class="note-tool"
        :class="{ 'is-on': current?.strike }"
        type="button"
        title="Strikethrough"
        aria-label="Strikethrough"
        :aria-pressed="current?.strike ?? false"
        @mousedown.prevent
        @click="emit('exec', 'strikeThrough')"
      >
        <s>S</s>
      </button>
      <span class="note-toolbar__sep" aria-hidden="true" />
      <button
        class="note-tool"
        :class="{ 'is-on': current?.align === 'left' }"
        type="button"
        title="Align left"
        aria-label="Align left"
        :aria-pressed="current?.align === 'left'"
        @mousedown.prevent
        @click="align('left')"
      >
        <span class="note-align note-align--left" aria-hidden="true"><i /><i /><i /></span>
      </button>
      <button
        class="note-tool"
        :class="{ 'is-on': current?.align === 'center' }"
        type="button"
        title="Align centre"
        aria-label="Align centre"
        :aria-pressed="current?.align === 'center'"
        @mousedown.prevent
        @click="align('center')"
      >
        <span class="note-align note-align--center" aria-hidden="true"><i /><i /><i /></span>
      </button>
      <button
        class="note-tool"
        :class="{ 'is-on': current?.align === 'right' }"
        type="button"
        title="Align right"
        aria-label="Align right"
        :aria-pressed="current?.align === 'right'"
        @mousedown.prevent
        @click="align('right')"
      >
        <span class="note-align note-align--right" aria-hidden="true"><i /><i /><i /></span>
      </button>
    </div>

    <div class="note-toolbar__row">
      <span class="note-toolbar__label">Ink</span>
      <button
        v-for="color in NOTE_INKS"
        :key="color"
        class="note-swatch note-swatch--ink"
        :class="{ 'is-on': current?.color === color }"
        type="button"
        :style="{ '--sw': color }"
        :aria-label="`Ink ${color}`"
        :aria-pressed="current?.color === color"
        @mousedown.prevent
        @click="emit('exec', 'foreColor', color)"
      />
      <ColorSwatchInput
        :model-value="inkValue"
        label="Custom ink colour"
        @update:model-value="setInk"
      />
    </div>

    <div class="note-toolbar__row">
      <span class="note-toolbar__label">Highlight</span>
      <button
        v-for="color in NOTE_HIGHLIGHTS"
        :key="color"
        class="note-swatch"
        :class="{ 'is-on': current?.highlight === color }"
        type="button"
        :style="{ '--sw': color }"
        :aria-label="`Highlight ${color}`"
        :aria-pressed="current?.highlight === color"
        @mousedown.prevent
        @click="emit('exec', 'hiliteColor', color)"
      />
      <ColorSwatchInput
        :model-value="highlightValue"
        :display-color="highlightDisplay"
        label="Custom highlight colour"
        @update:model-value="setHighlight"
      />
      <button
        class="note-swatch note-swatch--none"
        :class="{ 'is-on': !!current && !current.highlight }"
        type="button"
        aria-label="No highlight"
        :aria-pressed="!!current && !current.highlight"
        @mousedown.prevent
        @click="emit('exec', 'hiliteColor', 'transparent')"
      >
        ✕
      </button>
    </div>
  </div>
</template>
