import type { CatalogItem, EffectDef } from './types';

export function effectList(effect: CatalogItem['effect']): EffectDef[] {
  if (!effect) return [];
  return Array.isArray(effect) ? effect : [effect];
}

/** Effects that are active in the current time of day (glow is night-only). */
export function activeEffects(effect: CatalogItem['effect'], night: boolean): EffectDef[] {
  return effectList(effect).filter((e) => e.type !== 'glow' || night);
}

export function effectClasses(effects: EffectDef[]): Record<string, boolean> {
  const classes: Record<string, boolean> = {};
  for (const e of effects) classes[`fx--${e.type}`] = true;
  return classes;
}

export function effectVars(effects: EffectDef[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const e of effects) {
    if (e.amplitude != null) vars['--fx-amp'] = e.type === 'float' ? `${e.amplitude}px` : `${e.amplitude}deg`;
    if (e.duration != null) vars['--fx-dur'] = `${e.duration}s`;
    if (e.delay != null) vars['--fx-delay'] = `${e.delay}s`;
    if (e.color) vars['--fx-color'] = e.color;
    if (e.origin) vars['--fx-origin'] = e.origin;
  }
  if (!vars['--fx-amp']) vars['--fx-amp'] = '2deg';
  if (!vars['--fx-dur']) vars['--fx-dur'] = '4s';
  return vars;
}

export function smokeCount(effects: EffectDef[]): number {
  const smoke = effects.find((e) => e.type === 'smoke');
  return smoke ? Math.max(1, Math.min(8, smoke.count ?? 3)) : 0;
}

export function hasGlow(effects: EffectDef[]): boolean {
  return effects.some((e) => e.type === 'glow');
}
