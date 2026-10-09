<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import { togetherStatus } from '@/calendar/events';

const app = useAppStore();
const editor = useEditorStore();
const router = useRouter();

const now = ref(new Date());
let timer: number | undefined;
onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 30_000);
});
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
});

const status = computed(() => togetherStatus(app.data.events, now.value));
const countdown = computed(() => {
  const s = status.value;
  if (s.state === 'together') return { num: '♥', txt: 'together right now' };
  if (s.state === 'apart') {
    return {
      num: String(s.days),
      txt: s.days === 1 ? 'day until we are together' : 'days until we are together',
    };
  }
  return { num: '—', txt: 'set our next visit' };
});
const night = computed(() => app.timeOfDay === 'night');

function openCalendar() {
  router.push({ name: 'calendar' });
}
function toggleNight() {
  app.setDayNightMode(night.value ? 'day' : 'night');
}
function home() {
  router.push({ name: 'home' });
}
</script>

<template>
  <header class="roombar">
    <button class="roombar__brand" type="button" @click="home">
      <span class="icon icon--home"></span>
      <span class="roombar__title hand">our little room</span>
    </button>
    <div class="roombar__right">
      <button class="countdown" type="button" title="Our calendar" @click="openCalendar">
        <span class="countdown__num">{{ countdown.num }}</span>
        <span class="countdown__txt">{{ countdown.txt }}</span>
        <span class="icon icon--heart countdown__heart" aria-hidden="true"></span>
      </button>
      <button
        class="roombar__btn"
        type="button"
        :title="night ? 'Switch to day' : 'Switch to night'"
        @click="toggleNight"
      >
        <span class="icon" :class="night ? 'icon--moon' : 'icon--sun'"></span>
      </button>
      <button
        v-if="!editor.isEditing"
        class="roombar__btn roombar__btn--edit"
        type="button"
        title="Edit room"
        @click="editor.start()"
      >
        <span class="icon icon--pencil"></span>
      </button>
      <button
        v-else
        class="roombar__btn roombar__btn--edit"
        type="button"
        title="Done editing"
        @click="editor.requestExit()"
      >
        <span class="icon icon--check"></span>
      </button>
      <span class="people" aria-label="you and me">
        <span class="avatar avatar--a"><span class="icon icon--heart"></span></span>
        <span class="avatar avatar--b"><span class="icon icon--star"></span></span>
      </span>
    </div>
  </header>
</template>
