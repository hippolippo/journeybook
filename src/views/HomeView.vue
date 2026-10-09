<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { togetherStatus } from '@/calendar/events';
import pressedFlower from '@/assets/svg/pressed-flower.svg';

const router = useRouter();
const app = useAppStore();

const status = computed(() => togetherStatus(app.data.events, new Date()));
const togetherText = computed(() => {
  const s = status.value;
  if (s.state === 'together') return "You're together right now";
  if (s.state === 'apart') return `${s.days} ${s.days === 1 ? 'day' : 'days'} until we're together`;
  return 'Plan our next visit';
});
</script>

<template>
  <section class="home">
    <p class="tag">a little home just for two</p>
    <h1 class="home__greeting">Welcome back, you two</h1>
    <p class="home__tagline">what shall we remember today?</p>
    <div class="shelf">
      <button class="hero-book" type="button" @click="router.push({ name: 'organizer' })">
        <span class="hero-book__label">
          <h1>Scrapbooks</h1>
          <p>our memories, tucked in safe</p>
        </span>
        <img class="hero-book__flower" :src="pressedFlower" alt="" aria-hidden="true" />
      </button>
    </div>
    <button class="together-link" type="button" @click="router.push({ name: 'calendar' })">
      <span class="icon icon--calendar" aria-hidden="true"></span>
      <span>{{ togetherText }}</span>
    </button>
  </section>
</template>
