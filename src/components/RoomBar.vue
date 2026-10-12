<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { togetherStatus } from '@/calendar/events';

const app = useAppStore();
const auth = useAuthStore();
const router = useRouter();
const menuOpen = ref(false);

const initial = (name: string) => name.trim().charAt(0).toUpperCase();
const authed = computed(() => auth.enabled && !!auth.user);
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
function openSettings() {
  menuOpen.value = false;
  router.push({ name: 'settings' });
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
  if (s.state === 'together') return { num: '', txt: 'together right now' };
  if (s.state === 'apart') {
    return {
      num: String(s.days),
      txt: s.days === 1 ? 'day until we are together' : 'days until we are together',
    };
  }
  return { num: '—', txt: 'set our next visit' };
});

function openCalendar() {
  router.push({ name: 'calendar' });
}
function home() {
  router.push({ name: 'home' });
}
</script>

<template>
  <header class="roombar">
    <button class="roombar__brand" type="button" @click="home">
      <Icon name="home" />
      <span class="roombar__title hand">our little room</span>
    </button>
    <div class="roombar__right">
      <button class="countdown" type="button" title="Our calendar" @click="openCalendar">
        <span class="countdown__num">
          <Icon v-if="status.state === 'together'" name="heart" class="countdown__heart" aria-hidden="true" />
          <template v-else>{{ countdown.num }}</template>
        </span>
        <span class="countdown__txt">{{ countdown.txt }}</span>
        <Icon name="calendar-solid" class="countdown__cal" aria-hidden="true" />
      </button>
      <div class="account">
        <button
          class="people"
          type="button"
          :aria-label="authed && auth.myName ? `Account: ${auth.myName}` : 'Account and settings'"
          :aria-expanded="menuOpen"
          :title="auth.myName || 'Account'"
          @click.stop="menuOpen = !menuOpen"
        >
          <span class="avatar avatar--a" :class="{ 'is-me': authed }">
            <template v-if="auth.myName">{{ initial(auth.myName) }}</template>
            <Icon name="heart" v-else />
          </span>
          <span class="avatar avatar--b" :title="auth.partnerName || 'Your person'">
            <template v-if="auth.partnerName">{{ initial(auth.partnerName) }}</template>
            <Icon name="star" v-else />
          </span>
        </button>
        <div v-if="menuOpen" class="account__menu">
          <template v-if="authed">
            <p class="account__name">{{ auth.myName || 'Signed in' }}</p>
            <p v-if="roleLabel" class="account__role">{{ roleLabel }}</p>
            <p v-if="auth.partnerName" class="account__partner">with {{ auth.partnerName }}</p>
          </template>
          <button class="account__item" type="button" @click="openSettings">
            <Icon name="settings" />
            Settings
          </button>
          <button
            v-if="authed"
            class="btn btn--small account__signout"
            type="button"
            @click="signOut"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
