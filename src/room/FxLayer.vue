<script setup lang="ts">
import { computed } from 'vue';
import type { AnimationDef } from '@/catalog/animation';
import type { ParticleDef, ParticleInstance } from '@/catalog/particles';
import { animationClass, animationStyle } from '@/catalog/animation';
import { particleInstances } from '@/catalog/particles';
import { useReducedMotion } from '@/composables/useReducedMotion';
import FxChain from './FxChain.vue';

const props = defineProps<{
  animations?: AnimationDef[];
  particles?: ParticleDef[];
  seed: string;
}>();

const reduced = useReducedMotion();
const active = computed(() => !reduced.value);

const anims = computed(() => (active.value ? (props.animations ?? []) : []));
const animStyles = computed(() => anims.value.map((a) => animationStyle(a)));
const animClasses = computed(() => anims.value.map((a) => animationClass(a)));
const hasBloom = computed(() => anims.value.some((a) => a.bloom));

const bloomStyle = computed(() => {
  const glow = anims.value.find((a) => a.bloom);
  return glow?.vars ? { ...glow.vars } : {};
});

const particles = computed<ParticleInstance[]>(() =>
  active.value ? particleInstances(props.particles ?? [], props.seed) : [],
);
</script>

<template>
  <span class="fx-layer">
    <span v-if="hasBloom" class="fx-glow" :style="bloomStyle" aria-hidden="true"></span>
    <FxChain :styles="animStyles" :classes="animClasses">
      <slot />
    </FxChain>
    <span
      v-for="(p, i) in particles"
      :key="i"
      class="fx-particle"
      :class="p.cls"
      :style="p.style"
      aria-hidden="true"
    >
      <span class="fx-particle__shape" :style="p.shapeStyle"></span>
    </span>
  </span>
</template>
