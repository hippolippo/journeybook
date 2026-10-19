<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from '@/components/Icon.vue';
import type { CalendarEvent } from '@/data/types';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import {
  occurrenceTitle,
  occurrencesOnDay,
  sameDay,
  startOfDay,
  togetherStatus,
  upcoming,
  type Occurrence,
} from '@/calendar/events';
import { KIND_META } from '@/calendar/meta';
import { useViewport } from '@/composables/useViewport';
import EventDialog from '@/calendar/EventDialog.vue';
import EventList from '@/calendar/EventList.vue';

const app = useAppStore();
const auth = useAuthStore();
const { isMobile } = useViewport();

const now = ref(new Date());
const cursor = ref(startOfMonth(new Date()));
const selected = ref(startOfDay(new Date()));
const dialogOpen = ref(false);
const editing = ref<CalendarEvent | null>(null);
const dialogDay = ref(new Date());
/** Mobile screen: month grid, a day's details, or the upcoming list. */
const screen = ref<'month' | 'day' | 'upcoming'>('month');
/** Slide direction for month changes (+1 next, -1 previous). */
const monthDir = ref(1);
const monthKey = computed(() => `${cursor.value.getFullYear()}-${cursor.value.getMonth()}`);
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
/** Always referenced from the current day, never from a selected day. */
const upcomingCandidates = computed(() => {
  const withinMonth = upcomingAll.value.filter(
    (occ) => occ.start.getTime() <= now.value.getTime() + ONE_MONTH_MS,
  );
  return withinMonth.length ? withinMonth : upcomingAll.value.slice(0, 1);
});
const visibleUpcoming = computed(() => upcomingCandidates.value.slice(0, maxUpcoming.value));
/** On mobile the pane scrolls, so show them all; desktop fits to the panel. */
const shownUpcoming = computed(() =>
  isMobile.value ? upcomingCandidates.value : visibleUpcoming.value,
);

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
  monthDir.value = delta;
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1);
}
function goToday() {
  const today = startOfDay(new Date());
  monthDir.value = today.getTime() < cursor.value.getTime() ? -1 : 1;
  cursor.value = startOfMonth(today);
  selected.value = today;
}
function selectDay(day: Date) {
  selected.value = startOfDay(day);
  if (day.getMonth() !== cursor.value.getMonth()) {
    monthDir.value = day.getTime() < cursor.value.getTime() ? -1 : 1;
    cursor.value = startOfMonth(day);
  }
}
/** Tapping a day on mobile slides the grid away to show that day. */
function openDay(day: Date) {
  selectDay(day);
  screen.value = 'day';
}
function showView(view: 'month' | 'upcoming') {
  screen.value = view;
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

const banner = computed(() => {
  const state = status.value;
  if (state.state === 'together') {
    return {
      tone: 'together',
      icon: 'heart',
      title: "You're together right now",
      sub: `until ${dateTimeFmt.format(state.until)}`,
    };
  }
  if (state.state === 'apart') {
    const days = state.days;
    const who = auth.partnerName;
    return {
      tone: 'apart',
      icon: 'plane',
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
    icon: 'calendar',
    title: 'No visits planned yet',
    sub: 'Add a trip so the countdown can begin.',
  };
});
</script>

<template>
  <section class="calendar">
    <header class="calendar__head">
      <h1 class="tag calendar__tag">Our Calendar</h1>
      <div class="calendar__switch" role="tablist">
        <button
          class="calendar__switch-btn"
          type="button"
          role="tab"
          :class="{ 'is-active': screen !== 'upcoming' }"
          :aria-selected="screen !== 'upcoming'"
          aria-label="Month calendar"
          title="Calendar"
          @click="showView('month')"
        >
          <Icon name="calendar" />
        </button>
        <button
          class="calendar__switch-btn"
          type="button"
          role="tab"
          :class="{ 'is-active': screen === 'upcoming' }"
          :aria-selected="screen === 'upcoming'"
          aria-label="Upcoming events"
          title="Upcoming"
          @click="showView('upcoming')"
        >
          <Icon name="list" />
        </button>
      </div>
      <button class="btn btn--primary btn--small" type="button" @click="createEvent">
        <Icon name="plus" /> Add
      </button>
    </header>

    <div class="calendar__banner" :class="`calendar__banner--${banner.tone}`">
      <Icon :name="banner.icon" />
      <div>
        <strong>{{ banner.title }}</strong>
        <span class="calendar__banner-sub">{{ banner.sub }}</span>
      </div>
    </div>

    <div class="calendar__body" :class="`screen-${screen}`">
      <div class="calendar__main">
        <div class="cal-view cal-view--grid">
          <div class="cal-nav">
            <button
              class="cal-nav__btn"
              type="button"
              aria-label="Previous month"
              @click="shiftMonth(-1)"
            >
              <Icon name="chev-left" />
            </button>
            <button class="cal-nav__label hand" type="button" @click="goToday">
              {{ monthLabel }}
            </button>
            <button
              class="cal-nav__btn"
              type="button"
              aria-label="Next month"
              @click="shiftMonth(1)"
            >
              <Icon name="chev-right" />
            </button>
          </div>
          <div class="cal-month">
            <Transition :name="monthDir > 0 ? 'cal-next' : 'cal-prev'">
              <div :key="monthKey" class="cal-month__pane">
                <div class="cal-weekdays">
                  <span v-for="label in ['S', 'M', 'T', 'W', 'T', 'F', 'S']" :key="label">{{
                    label
                  }}</span>
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
                    @click="openDay(day)"
                  >
                    <span class="cal-day__num">{{ day.getDate() }}</span>
                    <span class="cal-day__chips">
                      <span
                        v-for="occ in chipsFor(day)"
                        :key="occ.event.id + occ.start.toISOString()"
                        class="cal-chip"
                        :class="{ 'is-recurring': occ.event.recurrence !== 'none' }"
                        :style="{ background: KIND_META[occ.event.kind].color }"
                        :title="occurrenceTitle(occ.event, occ.start)"
                      ></span>
                    </span>
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Day overview lives inside the same card so the box stays put. -->
        <div class="cal-view cal-view--day">
          <div class="calendar__side-head">
            <button
              class="calendar__back cal-nav__btn"
              type="button"
              aria-label="Back to calendar"
              @click="showView('month')"
            >
              <Icon name="chev-left" />
            </button>
            <h2 class="hand">{{ selectedLabel }}</h2>
            <button class="btn btn--small" type="button" @click="createEvent">
              <Icon name="plus" /> Add
            </button>
          </div>
          <EventList
            :occurrences="selectedOccurrences"
            :now="now"
            empty="Nothing on this day yet."
            @select="editEvent"
          />
        </div>
      </div>

      <aside ref="sideRef" class="calendar__side">
        <div class="calendar__side-pane calendar__side-pane--day">
          <div class="calendar__side-head">
            <h2 class="hand">{{ selectedLabel }}</h2>
            <button class="btn btn--small" type="button" @click="createEvent">
              <Icon name="plus" /> Add
            </button>
          </div>
          <EventList
            :occurrences="selectedOccurrences"
            :now="now"
            empty="Nothing on this day yet."
            @select="editEvent"
          />
        </div>

        <div class="calendar__side-pane calendar__side-pane--upcoming">
          <h2 class="hand calendar__side-title">Coming up</h2>
          <EventList
            :occurrences="shownUpcoming"
            :now="now"
            compact
            empty="Add a visit, anniversary or birthday to see it here."
            @select="editEvent"
          />
        </div>
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
