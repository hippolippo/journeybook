<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { onNotice, onSyncStatus, type Notice, type SyncStatus } from '@/utils/notify';

interface Live extends Notice {
  timer: number;
}

const items = ref<Live[]>([]);
const status = ref<SyncStatus>({ pending: 0, working: false, failed: false });
let stopNotices: (() => void) | null = null;
let stopStatus: (() => void) | null = null;

function dismiss(id: number) {
  const found = items.value.find((item) => item.id === id);
  if (found) window.clearTimeout(found.timer);
  items.value = items.value.filter((item) => item.id !== id);
}

onMounted(() => {
  stopNotices = onNotice((notice) => {
    const ttl = notice.kind === 'error' ? 10_000 : 5_000;
    const timer = window.setTimeout(() => dismiss(notice.id), ttl);
    items.value = [...items.value, { ...notice, timer }];
  });
  stopStatus = onSyncStatus((next) => {
    status.value = next;
  });
});
onBeforeUnmount(() => {
  stopNotices?.();
  stopStatus?.();
});
</script>

<template>
  <div class="toasts">
    <TransitionGroup name="toast">
      <div
        v-for="toast in items"
        :key="toast.id"
        class="toast"
        :class="`toast--${toast.kind}`"
        role="status"
      >
        <span class="toast__body">
          <span class="toast__message">{{ toast.message }}</span>
          <span v-if="toast.detail" class="toast__detail">{{ toast.detail }}</span>
        </span>
        <button class="toast__close" type="button" aria-label="Dismiss" @click="dismiss(toast.id)">
          &times;
        </button>
      </div>
    </TransitionGroup>
    <div v-if="status.pending > 0" class="sync-pill" role="status">
      {{ status.failed ? `Reconnecting… ${status.pending} unsaved` : `Saving… ${status.pending}` }}
    </div>
  </div>
</template>
