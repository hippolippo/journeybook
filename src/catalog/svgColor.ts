export interface ColorSlotLike {
  id: string;
  default: string;
}

/** Substitute `var(--c-slot, fallback)` colours in an inlined SVG string. */
export function colorizeSvg(raw: string, colors: Record<string, string>, slots: ColorSlotLike[]): string {
  let svg = raw;
  for (const slot of slots) {
    const color = colors[slot.id] ?? slot.default;
    svg = svg
      .replace(new RegExp(`var\\(\\s*--c-${slot.id}\\s*,\\s*[^)]*\\)`, 'g'), color)
      .replace(new RegExp(`var\\(\\s*--c-${slot.id}\\s*\\)`, 'g'), color);
  }
  return svg;
}

export function svgToDataUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
