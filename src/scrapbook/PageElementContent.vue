<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ImageElement, PageElement } from '@/data/types';
import { useAssetUrl } from '@/composables/useAssetUrl';
import { stickerById, tapeById } from '@/scrapbook/decor';
import { frameById } from '@/scrapbook/frames';
import { noteInnerStyle, noteTextStyle } from '@/scrapbook/notes';
import { effectsFilter } from '@/scrapbook/effects';
import { slotVars } from '@/scrapbook/elementStyle';
import FxLayer from '@/room/FxLayer.vue';
import grainArt from '@/assets/svg/film-grain.svg';

const props = defineProps<{ el: PageElement }>();

const sticker = computed(() => (props.el.kind === 'sticker' ? stickerById(props.el.icon) : null));
const tape = computed(() => (props.el.kind === 'tape' ? tapeById(props.el.style) : null));
const imgEl = ref<HTMLImageElement | null>(null);
const natAspect = ref(1);
const imgUrl = useAssetUrl(() => (props.el.kind === 'image' ? props.el.mediaId : undefined));

function onLoad(e: Event) {
  const img = e.target as HTMLImageElement;
  if (img.naturalWidth && img.naturalHeight) natAspect.value = img.naturalWidth / img.naturalHeight;
}

const frameDef = computed(() => frameById(props.el.kind === 'image' ? (props.el.frame ?? 'polaroid') : undefined));

const hasFrame = computed(() => {
  const f = frameDef.value;
  const i = f.insets;
  return i.l + i.r + i.t + i.b > 0 || !!f.bg || !!f.radius || !!f.tape || !!f.stack || !!f.art;
});

/** Animations/particles for the element's sticker, tape or frame definition. */
const visuals = computed(() => {
  const def = sticker.value ?? tape.value ?? (props.el.kind === 'image' ? frameDef.value : null);
  return { animations: def?.animations ?? [], particles: def?.particles ?? [] };
});

const classes = computed(() => {
  const k = props.el.kind;
  const c: Record<string, boolean> = {
    el__inner: true,
    [`el__inner--${k}`]: true,
  };
  if (k === 'image') {
    c['el__inner--framed'] = hasFrame.value;
    c[`el__inner--frame-${frameDef.value.id}`] = true;
    if (frameDef.value.ring) c['el__inner--ring'] = true;
    if (frameDef.value.art) c['el__inner--frame-art'] = true;
    if (props.el.frameColor === 'transparent') c['el__inner--transparent'] = true;
  }
  return c;
});

const frameVars = computed(() => {
  const f = frameDef.value;
  const fallback = f.bg ?? (f.art ? 'transparent' : '#fdf8ef');
  const color = props.el.kind === 'image' ? (props.el.frameColor ?? fallback) : '#fdf8ef';
  const vars: Record<string, string> = {
    '--f-l': `${f.insets.l * 100}%`,
    '--f-r': `${f.insets.r * 100}%`,
    '--f-t': `${f.insets.t * 100}%`,
    '--f-b': `${f.insets.b * 100}%`,
    '--f-radius': `${f.radius ?? 0}px`,
    '--frame-bg': color,
  };
  if (props.el.kind === 'image' && f.colorSlots?.length) Object.assign(vars, slotVars(f.colorSlots, props.el.frameColors));
  return vars;
});

const windowClasses = computed(() => {
  const clip = frameDef.value.clip;
  return { 'frame__window--circle': clip === 'circle', 'frame__window--arch': clip === 'arch' };
});

/** Rendered image size/offset (in window %) so the crop always covers and pans 1:1 with the mouse. */
const crop = computed(() => {
  if (props.el.kind !== 'image') return { RW: 100, RH: 100, left: 0, top: 0 };
  const Aw = frameDef.value.contentAspect ?? props.el.w / props.el.h;
  const Ai = natAspect.value || Aw;
  const zoom = props.el.zoom ?? 1;
  const RW = Math.max(100, (Ai / Aw) * 100) * zoom;
  const RH = Math.max(100, (Aw / Ai) * 100) * zoom;
  const fx = props.el.focusX ?? 0.5;
  const fy = props.el.focusY ?? 0.5;
  const left = Math.min(0, Math.max(100 - RW, 50 - fx * RW));
  const top = Math.min(0, Math.max(100 - RH, 50 - fy * RH));
  return { RW, RH, left, top };
});

const imgStyle = computed(() => {
  const c = crop.value;
  const el = props.el as ImageElement;
  return {
    left: `${c.left}%`,
    top: `${c.top}%`,
    width: `${c.RW}%`,
    height: `${c.RH}%`,
    filter: props.el.kind === 'image' ? effectsFilter(el.effects) : '',
  };
});

const noteInner = computed(() => (props.el.kind === 'note' ? noteInnerStyle(props.el) : null));
const noteText = computed(() => (props.el.kind === 'note' ? noteTextStyle(props.el) : null));
const innerStyle = computed(() => noteInner.value ?? frameVars.value);

const fade = computed(() => (props.el.kind === 'image' ? (props.el.effects?.fade ?? 0) : 0));
const vignette = computed(() => (props.el.kind === 'image' ? (props.el.effects?.vignette ?? 0) : 0));
const grain = computed(() => (props.el.kind === 'image' ? (props.el.effects?.grain ?? 0) : 0));
const grainUri = computed(() => `url("${grainArt}")`);
</script>

<template>
  <div :class="classes" :style="innerStyle">
    <template v-if="el.kind === 'photo'">
      <span class="el__photo" :class="`el__photo--${el.photo}`"></span>
      <span class="cap">{{ el.caption }}</span>
    </template>

    <FxLayer
      v-else-if="el.kind === 'image'"
      :animations="visuals.animations"
      :particles="visuals.particles"
      :seed="el.id"
    >
      <span v-if="frameDef.stack" class="frame__stack frame__stack--a"></span>
      <span v-if="frameDef.stack" class="frame__stack frame__stack--b"></span>
      <div class="frame__window" :class="windowClasses">
        <img v-if="imgUrl" ref="imgEl" class="frame__img" :src="imgUrl" :style="imgStyle" alt="" draggable="false" @load="onLoad" />
        <span v-if="fade" class="frame__fade" :style="{ opacity: fade * 0.4 }"></span>
        <span v-if="vignette" class="frame__vignette" :style="{ opacity: vignette * 0.6 }"></span>
        <span v-if="grain" class="frame__grain" :style="{ opacity: grain * 0.5, backgroundImage: grainUri }"></span>
      </div>
      <span v-if="frameDef.sprockets" class="frame__sprockets"></span>
      <template v-if="frameDef.tape === 'corners'">
        <span class="frame__tape frame__tape--tl"></span>
        <span class="frame__tape frame__tape--tr"></span>
        <span class="frame__tape frame__tape--bl"></span>
        <span class="frame__tape frame__tape--br"></span>
      </template>
      <template v-else-if="frameDef.tape === 'tabs'">
        <span class="frame__tape frame__tape--top"></span>
        <span class="frame__tape frame__tape--bottom"></span>
      </template>
      <template v-else-if="frameDef.tape === 'mounts'">
        <span class="frame__mount frame__mount--tl"></span>
        <span class="frame__mount frame__mount--tr"></span>
        <span class="frame__mount frame__mount--bl"></span>
        <span class="frame__mount frame__mount--br"></span>
      </template>
      <span v-if="frameDef.raw" class="frame__overlay" v-html="frameDef.raw"></span>
      <img v-else-if="frameDef.art" class="frame__overlay" :src="frameDef.art" alt="" draggable="false" />
      <span v-if="frameDef.caption" class="cap">{{ el.caption }}</span>
    </FxLayer>

    <template v-else-if="el.kind === 'note'">
      <span class="note__text" :style="noteText ?? {}">{{ el.text }}</span>
    </template>

    <FxLayer
      v-else-if="el.kind === 'sticker' && sticker"
      :animations="visuals.animations"
      :particles="visuals.particles"
      :seed="el.id"
    >
      <span v-if="sticker.raw" class="el__sticker-svg" v-html="sticker.raw"></span>
      <span v-else-if="sticker.tint" class="el__tint"></span>
      <img v-else class="el__sticker-img" :src="sticker.art" alt="" draggable="false" />
    </FxLayer>

    <FxLayer
      v-else-if="el.kind === 'tape' && tape"
      :animations="visuals.animations"
      :particles="visuals.particles"
      :seed="el.id"
    >
      <span v-if="tape.raw" class="el__tape-svg" v-html="tape.raw"></span>
      <span v-else class="el__tape-fill"></span>
    </FxLayer>
  </div>
</template>
