export interface SurfaceOption {
  id: string;
  label: string;
  swatch: string;
  className: string;
}

export const WALLS: SurfaceOption[] = [
  { id: 'stripes-cream', label: 'Cream stripes', swatch: '#f4e8d2', className: 'wall--stripes-cream' },
  { id: 'plain-blush', label: 'Blush', swatch: '#f3e0da', className: 'wall--plain-blush' },
  { id: 'plain-sage', label: 'Sage', swatch: '#e5ecdc', className: 'wall--plain-sage' },
  { id: 'plain-sky', label: 'Sky', swatch: '#e0edf2', className: 'wall--plain-sky' },
  { id: 'dots-mustard', label: 'Mustard dots', swatch: '#f3e7c9', className: 'wall--dots-mustard' },
];

export const FLOORS: SurfaceOption[] = [
  { id: 'wood-warm', label: 'Warm oak', swatch: '#c39a63', className: 'floor--wood-warm' },
  { id: 'wood-dark', label: 'Walnut', swatch: '#7d5433', className: 'floor--wood-dark' },
  { id: 'tile-check', label: 'Stone', swatch: '#d8cec0', className: 'floor--tile-check' },
  { id: 'carpet-rose', label: 'Rose', swatch: '#d9a3a0', className: 'floor--carpet-rose' },
  { id: 'cream', label: 'Cream', swatch: '#f1e5cd', className: 'floor--cream' },
  { id: 'sand', label: 'Sand', swatch: '#e4cfa6', className: 'floor--sand' },
  { id: 'terracotta', label: 'Terracotta', swatch: '#c07a55', className: 'floor--terracotta' },
  { id: 'clay', label: 'Clay', swatch: '#a8624a', className: 'floor--clay' },
  { id: 'sage', label: 'Sage', swatch: '#a8b491', className: 'floor--sage' },
  { id: 'forest', label: 'Forest', swatch: '#6f8a6a', className: 'floor--forest' },
  { id: 'sky', label: 'Sky', swatch: '#a9c6d1', className: 'floor--sky' },
  { id: 'taupe', label: 'Taupe', swatch: '#b6a894', className: 'floor--taupe' },
  { id: 'charcoal', label: 'Charcoal', swatch: '#4a3f36', className: 'floor--charcoal' },
];

export function wallById(id: string): SurfaceOption {
  return WALLS.find((w) => w.id === id) ?? WALLS[0];
}

export function floorById(id: string): SurfaceOption {
  return FLOORS.find((f) => f.id === id) ?? FLOORS[0];
}
