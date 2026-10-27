import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { NOTE_PAGE_WIDTH } from './page';

/**
 * Fit a fixed-width letter page to the stage width. Height must not affect the
 * scale: a longer letter keeps the same visual column and scrolls vertically.
 */
export function useNoteStage(stage: Ref<HTMLElement | null>) {
  const width = ref(0);
  let observer: ResizeObserver | null = null;

  function measure(): void {
    const element = stage.value;
    if (!element) return;
    const styles = window.getComputedStyle(element);
    const padX =
      (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0);
    width.value = element.clientWidth - padX;
  }

  function attach(): void {
    observer?.disconnect();
    const element = stage.value;
    if (element && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(element);
    }
    measure();
  }

  onMounted(attach);
  watch(stage, attach, { flush: 'post' });
  onBeforeUnmount(() => observer?.disconnect());

  const scale = computed(() => {
    const available = Math.max(0, width.value - 8);
    return Math.max(0.3, Math.min(available / NOTE_PAGE_WIDTH, 1));
  });

  return { scale };
}
