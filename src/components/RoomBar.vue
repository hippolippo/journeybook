<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useEditorStore } from '@/stores/editor';
import { useAuthStore } from '@/stores/auth';
import { togetherStatus } from '@/calendar/events';

const app = useAppStore();
const editor = useEditorStore();
const auth = useAuthStore();
const router = useRouter();
const menuOpen = ref(false);

const initial = (name: string) => name.trim().charAt(0).toUpperCase();
const roleLabel = computed(() => {
  if (auth.myRole === 'him') return 'You are him';
  if (auth.myRole === 'her') return 'You are her';
  return '';
});

function onDocumentClick(event: MouseEvent) {
  if (!(event.target as Element | null)?.closest?.('.account')) menuOpen.value = false;
}
function signOut() {
  menuOpen.value = false;
  auth.logout();
  router.push({ name: 'login' });
}

const now = ref(new Date());
let timer: number | undefined;
onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 30_000);
  document.addEventListener('click', onDocumentClick);
});
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
  document.removeEventListener('click', onDocumentClick);
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
      <div v-if="auth.enabled && auth.user" class="account">
        <button
          class="people"
          type="button"
          :aria-label="auth.myName ? `Account: ${auth.myName}` : 'Account'"
          :aria-expanded="menuOpen"
          :title="auth.myName || 'Account'"
          @click.stop="menuOpen = !menuOpen"
        >
          <span class="avatar avatar--a is-me">
            <template v-if="auth.myName">{{ initial(auth.myName) }}</template>
            <span v-else class="icon icon--heart"></span>
          </span>
          <span class="avatar avatar--b" :title="auth.partnerName || 'Your person'">
            <template v-if="auth.partnerName">{{ initial(auth.partnerName) }}</template>
            <span v-else class="icon icon--star"></span>
          </span>
        </button>
        <div v-if="menuOpen" class="account__menu">
          <p class="account__name">{{ auth.myName || 'Signed in' }}</p>
          <p v-if="roleLabel" class="account__role">{{ roleLabel }}</p>
          <p v-if="auth.partnerName" class="account__partner">with {{ auth.partnerName }}</p>
          <button class="btn btn--small account__signout" type="button" @click="signOut">
            Sign out
          </button>
        </div>
      </div>
      <span v-else class="people" aria-label="you and me">
        <span class="avatar avatar--a"><span class="icon icon--heart"></span></span>
        <span class="avatar avatar--b"><span class="icon icon--star"></span></span>
      </span>
    </div>
  </header>
</template>
