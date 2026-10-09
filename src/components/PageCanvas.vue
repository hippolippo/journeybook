<script setup lang="ts">
import { computed } from 'vue';
import type { PageElement } from '@/data/types';
import { paperById, paperCss } from '@/scrapbook/paper';
import { elementStyle } from '@/scrapbook/elementStyle';
import PageElementContent from '@/scrapbook/PageElementContent.vue';

const props = defineProps<{ elements: PageElement[]; num: number; paper?: string }>();
const pageStyle = computed(() => paperCss(paperById(props.paper)));

function isBare(el: PageElement): boolean {
  return el.kind === 'note' && (el.paper ?? 'sticky') === 'none';
}
</script>

<template>
  <div class="square-page" :style="pageStyle">
    <div v-for="el in elements" :key="el.id" class="el" :class="{ 'el--note-bare': isBare(el) }" :style="elementStyle(el)">
      <PageElementContent :el="el" />
    </div>
    <span class="square-page__num">{{ num }}</span>
  </div>
</template>
