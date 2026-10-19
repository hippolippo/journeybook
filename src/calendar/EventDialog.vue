<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import Icon from '@/components/Icon.vue';
import type { CalendarEvent, EventKind, FlightLeg, Recurrence, VisitDirection } from '@/data/types';
import { newId } from '@/utils/id';
import { useAuthStore } from '@/stores/auth';
import { EVENT_KINDS, KIND_META, RECURRENCE_OPTIONS, directionOptions } from './meta';

const props = defineProps<{ event: CalendarEvent | null; day: Date }>();
const emit = defineEmits<{
  save: [event: CalendarEvent];
  remove: [id: string];
  close: [];
}>();

const auth = useAuthStore();
const directions = computed(() =>
  directionOptions({ myRole: auth.myRole, myName: auth.myName, partnerName: auth.partnerName }),
);

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toDateInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
function fromDateInput(value: string): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

interface LegForm {
  id: string;
  label: string;
  airline: string;
  flightNo: string;
  from: string;
  to: string;
  depart: string;
  arrive: string;
  tz: string;
}

const defaultStart = new Date(props.day);
defaultStart.setHours(12, 0, 0, 0);
const initialStart = props.event ? new Date(props.event.startsAt) : defaultStart;

const form = reactive({
  kind: (props.event?.kind ?? 'visit') as EventKind,
  title: props.event?.title ?? '',
  notes: props.event?.notes ?? '',
  direction: (props.event?.direction ?? 'together') as VisitDirection,
  recurrence: (props.event?.recurrence ?? 'none') as Recurrence,
  datetime: toLocalInput(initialStart.toISOString()),
  date: toDateInput(initialStart.toISOString()),
  endsLocal: toLocalInput(props.event?.endsAt),
  showBeforeStart: props.event?.showBeforeStart ?? false,
  flights: (props.event?.flights ?? []).map((leg): LegForm => ({
    id: leg.id,
    label: leg.label ?? '',
    airline: leg.airline ?? '',
    flightNo: leg.flightNo ?? '',
    from: leg.from ?? '',
    to: leg.to ?? '',
    depart: toLocalInput(leg.depart),
    arrive: toLocalInput(leg.arrive),
    tz: leg.tz ?? '',
  })),
});

const isVisit = computed(() => form.kind === 'visit');
const isOneTime = computed(() => form.recurrence === 'none');
const isRecurring = computed(() => !isVisit.value && !isOneTime.value);
const showTitleHelp = ref(false);
const canSave = computed(
  () =>
    form.title.trim().length > 0 &&
    (isVisit.value || isOneTime.value ? !!form.datetime : !!form.date),
);

function addLeg() {
  form.flights.push({
    id: newId(),
    label: '',
    airline: '',
    flightNo: '',
    from: '',
    to: '',
    depart: isVisit.value ? form.datetime : '',
    arrive: '',
    tz: '',
  });
}
function removeLeg(index: number) {
  form.flights.splice(index, 1);
}

function build(): CalendarEvent {
  const base = {
    id: props.event?.id ?? newId(),
    kind: form.kind,
    title: form.title.trim(),
    notes: form.notes.trim() || undefined,
  };
  if (isVisit.value) {
    const flights: FlightLeg[] = form.flights
      .map((leg) => ({
        id: leg.id,
        label: leg.label.trim() || undefined,
        airline: leg.airline.trim() || undefined,
        flightNo: leg.flightNo.trim() || undefined,
        from: leg.from.trim() || undefined,
        to: leg.to.trim() || undefined,
        depart: fromLocalInput(leg.depart) ?? '',
        arrive: fromLocalInput(leg.arrive) ?? '',
        tz: leg.tz.trim() || undefined,
      }))
      .filter((leg) => leg.depart && leg.arrive);
    return {
      ...base,
      recurrence: 'none',
      direction: form.direction,
      startsAt: fromLocalInput(form.datetime) ?? new Date().toISOString(),
      endsAt: fromLocalInput(form.endsLocal),
      flights: flights.length ? flights : undefined,
    };
  }
  const startsAt = isOneTime.value ? fromLocalInput(form.datetime) : fromDateInput(form.date);
  if (isOneTime.value) {
    return { ...base, recurrence: 'none', startsAt: startsAt ?? new Date().toISOString() };
  }
  return {
    ...base,
    recurrence: form.recurrence,
    startsAt: startsAt ?? new Date().toISOString(),
    showBeforeStart: form.showBeforeStart,
  };
}

function save() {
  if (!canSave.value) return;
  emit('save', build());
}
</script>

<template>
  <div class="dialog-backdrop" @pointerdown.self="emit('close')">
    <form class="dialog event-dialog" @submit.prevent="save">
      <h2>{{ props.event ? 'Edit event' : 'Add to our calendar' }}</h2>

      <div class="event-dialog__row">
        <label>
          Kind
          <select v-model="form.kind">
            <option v-for="kind in EVENT_KINDS" :key="kind" :value="kind">
              {{ KIND_META[kind].label }}
            </option>
          </select>
        </label>
        <label>
          Title
          <input v-model="form.title" type="text" placeholder="What is it?" required />
          <span v-if="isRecurring" class="event-dialog__title-hint">
            Use % for the number or %% for the number + suffix
            <button
              class="event-dialog__info"
              type="button"
              aria-label="Numbering help"
              :aria-expanded="showTitleHelp"
              @click="showTitleHelp = !showTitleHelp"
            >
              i
            </button>
          </span>
        </label>
      </div>
      <div v-if="isRecurring && showTitleHelp" class="event-dialog__title-help">
        <ul>
          <li><code>%</code> shows the number (e.g. <code>21</code>).</li>
          <li><code>%%</code> shows the number with its suffix (e.g. <code>21st</code>).</li>
          <li>
            The first event starts at 0 unless digits follow the sign immediately:
            <code>%%21 Birthday</code> → <code>21st Birthday</code>, then <code>22nd</code>.
          </li>
          <li><code>\%</code> shows a literal %, and <code>\\</code> shows a backslash.</li>
          <li>With early occurrences enabled, numbers continue backward from the first date.</li>
        </ul>
      </div>

      <template v-if="isVisit">
        <label>
          Direction
          <select v-model="form.direction">
            <option v-for="opt in directions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
        <div class="event-dialog__row">
          <label>
            Arrive / meet
            <input v-model="form.datetime" type="datetime-local" required />
          </label>
          <label>
            Until
            <input v-model="form.endsLocal" type="datetime-local" />
          </label>
        </div>

        <fieldset class="event-dialog__flights">
          <legend>Flights (optional)</legend>
          <div v-for="(leg, index) in form.flights" :key="leg.id" class="leg">
            <div class="event-dialog__row">
              <label>
                Airline
                <input v-model="leg.airline" type="text" placeholder="e.g. Delta" />
              </label>
              <label>
                Flight #
                <input v-model="leg.flightNo" type="text" placeholder="DL 123" />
              </label>
            </div>
            <div class="event-dialog__row">
              <label>
                From
                <input v-model="leg.from" type="text" placeholder="JFK" />
              </label>
              <label>
                To
                <input v-model="leg.to" type="text" placeholder="LAX" />
              </label>
            </div>
            <div class="event-dialog__row">
              <label>
                Departs
                <input v-model="leg.depart" type="datetime-local" />
              </label>
              <label>
                Arrives
                <input v-model="leg.arrive" type="datetime-local" />
              </label>
            </div>
            <div class="event-dialog__row">
              <label>
                Timezone label (optional)
                <input v-model="leg.tz" type="text" placeholder="e.g. America/New_York" />
              </label>
              <button class="btn btn--small" type="button" @click="removeLeg(index)">
                <Icon name="trash" /> Remove leg
              </button>
            </div>
          </div>
          <button class="btn btn--small" type="button" @click="addLeg">
            <Icon name="plus" /> Add flight leg
          </button>
        </fieldset>
      </template>

      <template v-else>
        <div class="event-dialog__row">
          <label>
            Repeats
            <select v-model="form.recurrence">
              <option
                v-for="option in RECURRENCE_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <label v-if="isOneTime">
            When
            <input v-model="form.datetime" type="datetime-local" required />
          </label>
          <label v-else>
            Date
            <input v-model="form.date" type="date" required />
          </label>
        </div>
        <template v-if="!isOneTime">
          <label class="event-dialog__check">
            <input v-model="form.showBeforeStart" type="checkbox" />
            Show occurrences before the initial date
          </label>
        </template>
      </template>

      <label>
        Notes
        <textarea v-model="form.notes" rows="3" placeholder="Anything to remember"></textarea>
      </label>

      <div class="dialog__actions">
        <button class="btn btn--primary" type="submit" :disabled="!canSave">
          {{ props.event ? 'Save' : 'Add' }}
        </button>
        <button class="btn" type="button" @click="emit('close')">Cancel</button>
        <button
          v-if="props.event"
          class="btn event-dialog__delete"
          type="button"
          @click="emit('remove', props.event.id)"
        >
          <Icon name="trash" /> Delete
        </button>
      </div>
    </form>
  </div>
</template>
