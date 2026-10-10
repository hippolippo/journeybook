<script setup lang="ts">
import type { ColorPreset, ColorSlot } from '@/catalog/types';

const props = defineProps<{
  slots: ColorSlot[];
  presets?: ColorPreset[];
  values: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'update', slotId: string, color: string): void;
  (e: 'preset', colors: Record<string, string>): void;
}>();

function value(slot: ColorSlot): string {
  return props.values[slot.id] ?? slot.default;
}
</script>

<template>
  <div class="color-slots">
    <div v-if="presets && presets.length" class="chip-row">
      <button
        v-for="p in presets"
        :key="p.id"
        class="chip chip--wide"
        type="button"
        :title="`Preset: ${p.label}`"
        @click="emit('preset', p.colors)"
      >
        {{ p.label }}
      </button>
    </div>
    <div v-for="slot in slots" :key="slot.id" class="slot">
      <span class="slot__label">{{ slot.label }}</span>
      <div class="swatches">
        <button
          v-for="c in slot.palette"
          :key="c"
          class="swatch"
          :class="{ 'swatch--active': value(slot) === c }"
          :style="{ background: c }"
          type="button"
          @click="emit('update', slot.id, c)"
        ></button>
        <input v-if="slot.allowCustom" type="color" :value="value(slot)" @input="emit('update', slot.id, ($event.target as HTMLInputElement).value)" />
      </div>
    </div>
  </div>
</template>
