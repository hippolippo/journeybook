import { computed, onMounted, onUnmounted, ref } from 'vue';

export const MOBILE_BREAKPOINT = 760;
/** Shortest edge at or below this is treated as a phone (not a tablet). */
export const PHONE_MIN_EDGE = 500;

function matchMedia(query: string): MediaQueryList | null {
  return typeof window === 'undefined' || !window.matchMedia ? null : window.matchMedia(query);
}

export function useViewport() {
  const width = ref(typeof window === 'undefined' ? 1200 : window.innerWidth);
  const height = ref(typeof window === 'undefined' ? 800 : window.innerHeight);
  const isTouch = ref(matchMedia('(pointer: coarse)')?.matches ?? false);
  const coarse = matchMedia('(pointer: coarse)');
  const onResize = () => {
    width.value = window.innerWidth;
    height.value = window.innerHeight;
  };
  const onPointer = () => (isTouch.value = coarse?.matches ?? false);
  onMounted(() => {
    window.addEventListener('resize', onResize);
    coarse?.addEventListener('change', onPointer);
  });
  onUnmounted(() => {
    window.removeEventListener('resize', onResize);
    coarse?.removeEventListener('change', onPointer);
  });
  const isMobile = computed(() => width.value <= MOBILE_BREAKPOINT);
  /** A phone lying on its side: the whole site asks to be rotated upright. */
  const rotate = computed(
    () => isTouch.value && width.value > height.value && height.value <= PHONE_MIN_EDGE,
  );
  return { width, height, isMobile, rotate };
}
