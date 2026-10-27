<script setup lang="ts">
import { setColorPickerOpen } from './colorPicker';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    displayColor?: string;
    label: string;
    fallback?: string;
    big?: boolean;
  }>(),
  { fallback: '#ffffff', big: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

function onInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  if (value) emit('update:modelValue', value);
}
</script>

<template>
  <label
    class="note-swatch note-swatch--custom"
    :class="{ 'note-swatch--big': props.big }"
    :style="{ '--sw': props.displayColor ?? props.modelValue ?? props.fallback }"
    :title="props.label"
  >
    <input
      class="note-swatch__input"
      type="color"
      :value="props.modelValue || props.fallback"
      :aria-label="props.label"
      @pointerdown="setColorPickerOpen(true)"
      @focus="setColorPickerOpen(true)"
      @blur="setColorPickerOpen(false)"
      @input="onInput"
    />
  </label>
</template>
