<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit() {
  error.value = '';
  busy.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    router.push({ name: 'home' });
  } catch (e) {
    error.value = 'That email or password did not match.';
    console.error(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="home" style="max-width: 420px; margin: 0 auto">
    <p class="tag">just the two of us</p>
    <h1 class="home__greeting" style="font-size: 2rem">Welcome in</h1>
    <form class="create-form" style="width: 100%; height: auto; margin-top: 1rem" @submit.prevent="submit">
      <label for="login-email">Email</label>
      <input id="login-email" v-model="email" type="email" autocomplete="username" required />
      <label for="login-password">Password</label>
      <input id="login-password" v-model="password" type="password" autocomplete="current-password" required />
      <p v-if="error" style="color: #a4443f; margin: 0">{{ error }}</p>
      <button class="btn btn--primary" type="submit" :disabled="busy">
        {{ busy ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </section>
</template>
