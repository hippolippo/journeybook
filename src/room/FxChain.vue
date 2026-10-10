<script setup lang="ts">
defineProps<{ styles: Record<string, string>[]; classes: string[] }>();
</script>

<template>
  <span v-if="styles.length === 0" class="fx-chain__inner"><slot /></span>
  <span v-else class="fx-anim" :class="classes[0]" :style="styles[0]">
    <FxChain :styles="styles.slice(1)" :classes="classes.slice(1)">
      <slot />
    </FxChain>
  </span>
</template>
