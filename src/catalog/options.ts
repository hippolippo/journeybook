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
  { id: 'wood-warm', label: 'Warm wood', swatch: '#b2885a', className: 'floor--wood-warm' },
  { id: 'wood-dark', label: 'Dark wood', swatch: '#8a5f3c', className: 'floor--wood-dark' },
  { id: 'tile-check', label: 'Checkered tile', swatch: '#d8cec0', className: 'floor--tile-check' },
  { id: 'carpet-rose', label: 'Rose carpet', swatch: '#d9a3a0', className: 'floor--carpet-rose' },
];

export function wallById(id: string): SurfaceOption {
  return WALLS.find((w) => w.id === id) ?? WALLS[0];
}

export function floorById(id: string): SurfaceOption {
  return FLOORS.find((f) => f.id === id) ?? FLOORS[0];
}
