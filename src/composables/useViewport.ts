import { computed, onMounted, onUnmounted, ref } from 'vue';

export const MOBILE_BREAKPOINT = 760;

export function useViewport() {
  const width = ref(typeof window === 'undefined' ? 1200 : window.innerWidth);
  const onResize = () => {
    width.value = window.innerWidth;
  };
  onMounted(() => window.addEventListener('resize', onResize));
  onUnmounted(() => window.removeEventListener('resize', onResize));
  const isMobile = computed(() => width.value <= MOBILE_BREAKPOINT);
  return { width, isMobile };
}
