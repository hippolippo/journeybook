<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CalendarEvent } from '@/data/types';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import {
  countdownLabel,
  occurrencesOnDay,
  sameDay,
  startOfDay,
  togetherStatus,
  upcoming,
  type Occurrence,
} from '@/calendar/events';
import { KIND_META, directionLabel } from '@/calendar/meta';
import EventDialog from '@/calendar/EventDialog.vue';

const app = useAppStore();
const auth = useAuthStore();
const directionCtx = computed(() => ({
  myRole: auth.myRole,
  myName: auth.myName,
  partnerName: auth.partnerName,
}));

const now = ref(new Date());
const cursor = ref(startOfMonth(new Date()));
const selected = ref(startOfDay(new Date()));
const dialogOpen = ref(false);
const editing = ref<CalendarEvent | null>(null);
const dialogDay = ref(new Date());
const sideRef = ref<HTMLElement | null>(null);
const maxUpcoming = ref(8);
let timer: number | undefined;
let sideObserver: ResizeObserver | undefined;

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const events = computed(() => app.data.events);

const monthLabel = computed(() =>
  new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(cursor.value),
);
const selectedLabel = computed(() =>
  new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(
    selected.value,
  ),
);

const gridDays = computed(() => {
  const first = startOfMonth(cursor.value);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
});

const dayMap = computed(() => {
  const map = new Map<string, Occurrence[]>();
  for (const day of gridDays.value) map.set(dayKey(day), occurrencesOnDay(events.value, day));
  return map;
});
const selectedOccurrences = computed(() => occurrencesOnDay(events.value, selected.value));
const status = computed(() => togetherStatus(events.value, now.value));

const ONE_MONTH_MS = 30 * 86_400_000;
const upcomingAll = computed(() => upcoming(events.value, now.value, 60));
const upcomingCandidates = computed(() => {
  const dayStart = startOfDay(selected.value).getTime();
  const dayEnd = dayStart + 86_400_000 - 1;
  const future = upcomingAll.value.filter((occ) => {
    const start = occ.start.getTime();
    const end = (occ.end ?? occ.start).getTime();
    return !(start <= dayEnd && end >= dayStart);
  });
  const withinMonth = future.filter(
    (occ) => occ.start.getTime() <= now.value.getTime() + ONE_MONTH_MS,
  );
  return withinMonth.length ? withinMonth : future.slice(0, 1);
});
const visibleUpcoming = computed(() => upcomingCandidates.value.slice(0, maxUpcoming.value));

async function refit() {
  maxUpcoming.value = 8;
  await nextTick();
  const el = sideRef.value;
  if (!el) return;
  let guard = 0;
  while (el.scrollHeight > el.clientHeight + 1 && maxUpcoming.value > 0 && guard++ < 40) {
    maxUpcoming.value -= 1;
    await nextTick();
  }
}

watch([selectedOccurrences, upcomingCandidates], () => void refit());

onMounted(() => {
  timer = window.setInterval(() => (now.value = new Date()), 30_000);
  if (sideRef.value && typeof ResizeObserver !== 'undefined') {
    sideObserver = new ResizeObserver(() => void refit());
    sideObserver.observe(sideRef.value);
  }
  void refit();
});
onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer);
  sideObserver?.disconnect();
});

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function chipsFor(day: Date): Occurrence[] {
  return (dayMap.value.get(dayKey(day)) ?? []).slice(0, 3);
}
function isOutside(day: Date): boolean {
  return day.getMonth() !== cursor.value.getMonth();
}
function shiftMonth(delta: number) {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1);
}
function goToday() {
  const today = startOfDay(new Date());
  cursor.value = startOfMonth(today);
  selected.value = today;
}
function selectDay(day: Date) {
  selected.value = startOfDay(day);
  if (day.getMonth() !== cursor.value.getMonth()) cursor.value = startOfMonth(day);
}
function createEvent() {
  editing.value = null;
  dialogDay.value = selected.value;
  dialogOpen.value = true;
}
function editEvent(event: CalendarEvent, day?: Date) {
  editing.value = event;
  dialogDay.value = day ?? new Date(event.startsAt);
  dialogOpen.value = true;
}
function onSave(event: CalendarEvent) {
  app.saveEvent(event);
  dialogOpen.value = false;
}
function onRemove(id: string) {
  const event = editing.value;
  const label = event ? `"${event.title}"` : 'this event';
  if (window.confirm(`Delete ${label}?`)) {
    app.deleteEvent(id);
    dialogOpen.value = false;
  }
}

function occurrenceWhen(occ: Occurrence): string {
  if (occ.event.kind === 'visit' && occ.end && !sameDay(occ.start, occ.end)) {
    return `${dateTimeFmt.format(occ.start)} → ${dateFmt.format(occ.end)} ${timeFmt.format(occ.end)}`;
  }
  if (occ.event.recurrence === 'none') return dateTimeFmt.format(occ.start);
  return dateFmt.format(occ.start);
}
function occurrenceCountdown(occ: Occurrence): string {
  const end = occ.end ?? occ.start;
  if (end.getTime() < now.value.getTime()) return 'done';
  if (occ.start.getTime() <= now.value.getTime() && end.getTime() >= now.value.getTime())
    return 'now';
  return countdownLabel(occ.start, now.value);
}

const banner = computed(() => {
  const state = status.value;
  if (state.state === 'together') {
    return {
      tone: 'together',
      icon: 'icon--heart',
      title: "You're together right now",
      sub: `until ${dateTimeFmt.format(state.until)}`,
    };
  }
  if (state.state === 'apart') {
    const days = state.days;
    const who = auth.partnerName;
    return {
      tone: 'apart',
      icon: 'icon--plane',
      title:
        days === 0
          ? "You're together today"
          : who
            ? `${days} ${days === 1 ? 'day' : 'days'} until you see ${who}`
            : `${days} ${days === 1 ? 'day' : 'days'} until you're together`,
      sub: `${state.event.title} · ${dateFmt.format(state.start)} at ${timeFmt.format(state.start)}`,
    };
  }
  return {
    tone: 'none',
    icon: 'icon--calendar',
    title: 'No visits planned yet',
    sub: 'Add a trip so the countdown can begin.',
  };
});
</script>

<template>
  <section class="calendar">
    <header class="calendar__head">
      <h1 class="tag calendar__tag">Our Calendar</h1>
      <button class="btn btn--primary btn--small" type="button" @click="createEvent">
        <span class="icon icon--plus"></span> Add
      </button>
    </header>

    <div class="calendar__banner" :class="`calendar__banner--${banner.tone}`">
      <span class="icon" :class="banner.icon"></span>
      <div>
        <strong>{{ banner.title }}</strong>
        <span class="calendar__banner-sub">{{ banner.sub }}</span>
      </div>
    </div>

    <div class="calendar__body">
      <div class="calendar__main">
        <div class="cal-nav">
          <button
            class="cal-nav__btn"
            type="button"
            aria-label="Previous month"
            @click="shiftMonth(-1)"
          >
            <span class="icon icon--chev-left"></span>
          </button>
          <button class="cal-nav__label hand" type="button" @click="goToday">
            {{ monthLabel }}
          </button>
          <button class="cal-nav__btn" type="button" aria-label="Next month" @click="shiftMonth(1)">
            <span class="icon icon--chev-right"></span>
          </button>
        </div>
        <div class="cal-weekdays">
          <span v-for="label in ['S', 'M', 'T', 'W', 'T', 'F', 'S']" :key="label">{{ label }}</span>
        </div>
        <div class="cal-grid">
          <button
            v-for="day in gridDays"
            :key="day.toISOString()"
            type="button"
            class="cal-day"
            :class="{
              'is-outside': isOutside(day),
              'is-today': sameDay(day, now),
              'is-selected': sameDay(day, selected),
            }"
            @click="selectDay(day)"
          >
            <span class="cal-day__num">{{ day.getDate() }}</span>
            <span class="cal-day__chips">
              <span
                v-for="occ in chipsFor(day)"
                :key="occ.event.id + occ.start.toISOString()"
                class="cal-chip"
                :class="{ 'is-recurring': occ.event.recurrence !== 'none' }"
                :style="{ background: KIND_META[occ.event.kind].color }"
                :title="occ.event.title"
              ></span>
            </span>
          </button>
        </div>
      </div>

      <aside ref="sideRef" class="calendar__side">
        <div class="calendar__side-head">
          <h2 class="hand">{{ selectedLabel }}</h2>
          <button class="btn btn--small" type="button" @click="createEvent">
            <span class="icon icon--plus"></span> Add
          </button>
        </div>

        <ul v-if="selectedOccurrences.length" class="event-list">
          <li v-for="occ in selectedOccurrences" :key="occ.event.id + occ.start.toISOString()">
            <button class="event-card" type="button" @click="editEvent(occ.event, occ.start)">
              <span
                class="event-card__dot"
                :style="{ background: KIND_META[occ.event.kind].color }"
              >
                <span class="icon" :class="KIND_META[occ.event.kind].icon"></span>
              </span>
              <span class="event-card__body">
                <span class="event-card__title">{{ occ.event.title }}</span>
                <span class="event-card__meta">
                  {{ KIND_META[occ.event.kind].label }}
                  <template v-if="occ.event.direction">
                    · {{ directionLabel(occ.event.direction, directionCtx) }}</template
                  >
                  · {{ occurrenceWhen(occ) }}
                </span>
                <span v-if="occ.event.flights?.length" class="event-card__flights">
                  <span v-for="leg in occ.event.flights" :key="leg.id" class="event-card__flight">
                    <span class="icon icon--plane"></span>
                    {{ leg.airline }}<template v-if="leg.flightNo"> {{ leg.flightNo }}</template>
                    {{ leg.from }} → {{ leg.to }}
                    {{ timeFmt.format(new Date(leg.depart)) }}
                  </span>
                </span>
              </span>
              <span class="event-card__when">{{ occurrenceCountdown(occ) }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="calendar__empty hand">Nothing on this day yet.</p>

        <h2 class="hand calendar__side-title">Coming up</h2>
        <ul v-if="visibleUpcoming.length" class="event-list">
          <li v-for="occ in visibleUpcoming" :key="occ.event.id + occ.start.toISOString()">
            <button
              class="event-card event-card--compact"
              type="button"
              @click="editEvent(occ.event, occ.start)"
            >
              <span
                class="event-card__dot"
                :style="{ background: KIND_META[occ.event.kind].color }"
              >
                <span class="icon" :class="KIND_META[occ.event.kind].icon"></span>
              </span>
              <span class="event-card__body">
                <span class="event-card__title">{{ occ.event.title }}</span>
                <span class="event-card__meta"
                  >{{ KIND_META[occ.event.kind].label }} · {{ occurrenceWhen(occ) }}</span
                >
              </span>
              <span class="event-card__when">{{ occurrenceCountdown(occ) }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="calendar__empty hand">
          Add a visit, anniversary or birthday to see it here.
        </p>
      </aside>
    </div>

    <EventDialog
      v-if="dialogOpen"
      :event="editing"
      :day="dialogDay"
      @save="onSave"
      @remove="onRemove"
      @close="dialogOpen = false"
    />
  </section>
</template>
