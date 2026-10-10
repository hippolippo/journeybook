<script setup lang="ts">
import { computed } from 'vue';
import type { PageElement } from '@/data/types';
import { paperById, paperCss } from '@/scrapbook/paper';
import { elementStyle } from '@/scrapbook/elementStyle';
import PageElementContent from '@/scrapbook/PageElementContent.vue';
import PaperSurface from '@/scrapbook/PaperSurface.vue';

const props = defineProps<{
  elements: PageElement[];
  num: number;
  paper?: string;
  paperColors?: Record<string, string>;
}>();

const paper = computed(() => paperById(props.paper));
const pageStyle = computed(() => paperCss(paper.value, props.paperColors));

function isBare(el: PageElement): boolean {
  return el.kind === 'note' && (el.paper ?? 'sticky') === 'none';
}
</script>

<template>
  <div class="square-page" :style="pageStyle">
    <PaperSurface :paper="paper" />
    <div v-for="el in elements" :key="el.id" class="el" :class="{ 'el--note-bare': isBare(el) }" :style="elementStyle(el)">
      <PageElementContent :el="el" />
    </div>
    <span class="square-page__num">{{ num }}</span>
  </div>
</template>
