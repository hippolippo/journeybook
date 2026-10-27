<script setup lang="ts">
import { computed } from 'vue';
import type { RichDoc } from '@/data/types';
import { docToHtml } from '@/notes/richText';

const props = defineProps<{ doc: RichDoc }>();
const html = computed(() => docToHtml(props.doc));
</script>

<template>
  <div class="note-editor note-editor--read" v-html="html" />
</template>
