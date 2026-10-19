<script setup lang="ts">
import { computed } from 'vue';
import Icon from '@/components/Icon.vue';
import type { CalendarEvent } from '@/data/types';
import { useAuthStore } from '@/stores/auth';
import { countdownLabel, occurrenceTitle, sameDay, type Occurrence } from '@/calendar/events';
import { KIND_META, directionLabel } from '@/calendar/meta';

const props = defineProps<{
  occurrences: Occurrence[];
  now: Date;
  compact?: boolean;
  empty: string;
}>();
const emit = defineEmits<{ select: [event: CalendarEvent, day: Date] }>();

const auth = useAuthStore();
const directionCtx = computed(() => ({
  myRole: auth.myRole,
  myName: auth.myName,
  partnerName: auth.partnerName,
}));

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function when(occ: Occurrence): string {
  if (occ.event.kind === 'visit' && occ.end && !sameDay(occ.start, occ.end)) {
    return `${dateTimeFmt.format(occ.start)} → ${dateFmt.format(occ.end)} ${timeFmt.format(occ.end)}`;
  }
  if (occ.event.recurrence === 'none') return dateTimeFmt.format(occ.start);
  return dateFmt.format(occ.start);
}
function countdown(occ: Occurrence): string {
  const end = occ.end ?? occ.start;
  if (end.getTime() < props.now.getTime()) return 'done';
  if (occ.start.getTime() <= props.now.getTime() && end.getTime() >= props.now.getTime())
    return 'now';
  return countdownLabel(occ.start, props.now);
}
</script>

<template>
  <ul v-if="occurrences.length" class="event-list">
    <li v-for="occ in occurrences" :key="occ.event.id + occ.start.toISOString()">
      <button
        class="event-card"
        :class="{ 'event-card--compact': compact }"
        type="button"
        @click="emit('select', occ.event, occ.start)"
      >
        <span class="event-card__dot" :style="{ background: KIND_META[occ.event.kind].color }">
          <Icon :name="KIND_META[occ.event.kind].icon" />
        </span>
        <span class="event-card__body">
          <span class="event-card__title">{{ occurrenceTitle(occ.event, occ.start) }}</span>
          <span class="event-card__meta">
            {{ KIND_META[occ.event.kind].label }}
            <template v-if="!compact && occ.event.direction">
              · {{ directionLabel(occ.event.direction, directionCtx) }}</template
            >
            · {{ when(occ) }}
          </span>
          <span v-if="!compact && occ.event.flights?.length" class="event-card__flights">
            <span v-for="leg in occ.event.flights" :key="leg.id" class="event-card__flight">
              <Icon name="plane" />
              {{ leg.airline }}<template v-if="leg.flightNo"> {{ leg.flightNo }}</template>
              {{ leg.from }} → {{ leg.to }}
              {{ timeFmt.format(new Date(leg.depart)) }}
            </span>
          </span>
        </span>
        <span class="event-card__when">{{ countdown(occ) }}</span>
      </button>
    </li>
  </ul>
  <p v-else class="calendar__empty hand">{{ empty }}</p>
</template>
