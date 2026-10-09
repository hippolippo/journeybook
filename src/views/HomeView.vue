<script setup lang="ts">
import { useRouter } from 'vue-router';
import pressedFlower from '@/assets/svg/pressed-flower.svg';

const router = useRouter();
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
    <div class="soon" aria-label="Coming soon">
      <span class="soon__item">Notes <span class="icon icon--pencil"></span></span>
      <span class="soon__item">Games <span class="icon icon--star"></span></span>
      <span class="soon__item">Camera <span class="icon icon--camera"></span></span>
    </div>
  </section>
</template>
