<script setup lang="ts">
import { computed } from 'vue';
import type { Paper } from './paper';

const props = defineProps<{ paper: Paper }>();

const corners = computed(() => props.paper.corners);

const placements = [
  { key: 'tl', sx: 1, sy: 1 },
  { key: 'tr', sx: -1, sy: 1 },
  { key: 'bl', sx: 1, sy: -1 },
  { key: 'br', sx: -1, sy: -1 },
] as const;
</script>

<template>
  <div class="paper-surface" aria-hidden="true">
    <span v-if="paper.border" class="paper-surface__border" :style="{ opacity: String(paper.border.opacity ?? 1) }">
      <span v-if="paper.border.raw" v-html="paper.border.raw"></span>
      <img v-else :src="paper.border.art" alt="" draggable="false" />
    </span>
    <template v-if="corners">
      <span
        v-for="c in placements"
        :key="c.key"
        class="paper-surface__corner"
        :class="`paper-surface__corner--${c.key}`"
        :style="{ opacity: String(corners.opacity ?? 1) }"
      >
        <span class="paper-surface__corner-flip" :style="{ transform: `scale(${c.sx}, ${c.sy})` }">
          <span v-if="corners.raw" v-html="corners.raw"></span>
          <img v-else :src="corners.art" alt="" draggable="false" />
        </span>
      </span>
    </template>
  </div>
</template>
