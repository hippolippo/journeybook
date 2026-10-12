<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ name: string }>();

const FILES: Record<string, string> = {
  folder: 'icon-folder',
  book: 'icon-book',
  back: 'icon-back',
  plus: 'icon-plus',
  menu: 'icon-menu',
  'chev-left': 'icon-chevron-left',
  'chev-right': 'icon-chevron-right',
  home: 'icon-home',
  pencil: 'icon-pencil',
  trash: 'icon-trash',
  tape: 'icon-tape',
  grip: 'icon-grip',
  lock: 'icon-lock',
  unlock: 'icon-unlock',
  sun: 'icon-sun',
  moon: 'icon-moon',
  check: 'icon-check',
  close: 'icon-close',
  undo: 'icon-undo',
  redo: 'icon-redo',
  camera: 'icon-camera',
  star: 'doodle-star',
  heart: 'doodle-heart',
  calendar: 'icon-calendar',
  'calendar-solid': 'icon-calendar-solid',
  list: 'icon-list',
  plane: 'icon-plane',
  gift: 'icon-gift',
  settings: 'icon-settings',
};

const modules = import.meta.glob('../assets/svg/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const markup = computed(() => {
  const file = FILES[props.name];
  const key = file ? Object.keys(modules).find((path) => path.endsWith(`/${file}.svg`)) : undefined;
  if (!key) return '';
  return modules[key]
    .replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(?:width|height)="[^"]*"/g, ''))
    .replace(/\b(fill|stroke)="#[0-9a-fA-F]{3,8}"/g, '$1="currentColor"');
});
</script>

<template>
  <span class="icon" v-html="markup" />
</template>
