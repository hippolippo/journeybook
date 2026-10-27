<script setup lang="ts">
import { computed } from 'vue';
import Icon from '@/components/Icon.vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useNotesStore } from '@/stores/notes';
import { togetherStatus } from '@/calendar/events';
import pressedFlower from '@/assets/svg/daisy-stem.svg';

const router = useRouter();
const app = useAppStore();
const auth = useAuthStore();
const notes = useNotesStore();

const status = computed(() => togetherStatus(app.data.events, new Date()));
const togetherText = computed(() => {
  const s = status.value;
  if (s.state === 'together') return "You're together right now";
  if (s.state === 'apart') return `${s.days} ${s.days === 1 ? 'day' : 'days'} until we're together`;
  return 'Plan our next visit';
});
const greeting = computed(() =>
  auth.myName ? `Welcome back, ${auth.myName}` : 'Welcome back, you two',
);
</script>

<template>
  <section class="home">
    <p class="tag">a little home just for two</p>
    <div class="home__heading">
      <h1 class="home__greeting">{{ greeting }}</h1>
      <p class="home__tagline">what shall we remember today?</p>
    </div>
    <div class="shelf shelf--two">
      <button class="hero-book" type="button" @click="router.push({ name: 'organizer' })">
        <span class="hero-book__label">
          <h1>Scrapbooks</h1>
          <p>our memories, tucked in safe</p>
        </span>
        <img class="hero-book__flower" :src="pressedFlower" alt="" aria-hidden="true" />
      </button>
      <button class="hero-book hero-book--notes" type="button" @click="router.push({ name: 'notes' })">
        <span class="hero-book__label">
          <h1>Notes</h1>
          <p>letters for the two of us</p>
        </span>
        <span class="hero-book__paper" aria-hidden="true" />
        <span v-if="notes.unread" class="hero-notes__badge">{{ notes.unread }} unread</span>
      </button>
    </div>
    <button class="together-link" type="button" @click="router.push({ name: 'calendar' })">
      <Icon name="calendar" aria-hidden="true" />
      <span>{{ togetherText }}</span>
    </button>
  </section>
</template>
