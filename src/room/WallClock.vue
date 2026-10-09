<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import clockFace from '@/assets/svg/wall-clock.svg';

function zoned(tz: string, date: Date): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 12;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { h, m };
}

const ct = ref(0);
const et = ref(0);
const minute = ref(0);

function tick() {
  const now = new Date();
  const c = zoned('America/Chicago', now);
  const e = zoned('America/New_York', now);
  ct.value = c.h * 30 + c.m * 0.5;
  et.value = e.h * 30 + e.m * 0.5;
  minute.value = e.m * 6;
}

let timer: number | undefined;
onMounted(() => {
  tick();
  timer = window.setInterval(tick, 30000);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
</script>

<template>
  <span class="clock" role="img" aria-label="Wall clock: pink is Central, blue is Eastern">
    <img class="clock__face" :src="clockFace" alt="" />
    <span class="clock__hand clock__hand--min" :style="{ transform: `rotate(${minute}deg)` }"></span>
    <span class="clock__hand clock__hand--ct" :style="{ transform: `rotate(${ct}deg)` }"></span>
    <span class="clock__hand clock__hand--et" :style="{ transform: `rotate(${et}deg)` }"></span>
    <span class="clock__pivot"></span>
  </span>
</template>
