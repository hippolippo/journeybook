import { computed, watchEffect, type ComputedRef } from 'vue';
import { useAppStore } from '@/stores/app';

/**
 * Reactive album-image URL that self-heals: if the URL is missing (e.g. the
 * in-memory blob cache was dropped after a reload/HMR), it re-hydrates it.
 */
export function useAssetUrl(id: () => string | undefined): ComputedRef<string> {
  const app = useAppStore();
  const url = computed(() => {
    const value = id();
    return value ? app.assetUrl(value) : '';
  });
  watchEffect(() => {
    const value = id();
    if (value && !app.assetUrl(value)) void app.ensureAsset(value);
  });
  return url;
}
