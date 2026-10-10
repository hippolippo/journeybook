import type { Placement, Room, RoomItem } from '@/data/types';

const p = (x: number, y: number, scale: number, rotation = 0, flip = false): Placement => ({
  x,
  y,
  scale,
  rotation,
  flip,
});

/** Host-relative placement for a surface item resting on furniture/shelf. */
const ap = (ax: number, ay: number, scale: number, rotation = 0): Placement => ({
  x: 0.5,
  y: 0.5,
  scale,
  rotation,
  flip: false,
  ax,
  ay,
});

export const DEFAULT_ROOM: Room = {
  wallId: 'stripes-cream',
  floorId: 'wood-warm',
  dayNightMode: 'auto',
  referenceTz: 'America/Chicago',
};

interface ItemOpts {
  rotation?: number;
  flip?: boolean;
  hiddenMobile?: boolean;
  attachTo?: string;
  color?: Record<string, string>;
}

export function createDefaultRoomItems(): RoomItem[] {
  let n = 0;
  const mk = (
    catalogId: string,
    layer: RoomItem['layer'],
    z: number,
    placement: Placement,
    opts: ItemOpts = {},
  ): RoomItem => ({
    id: `${catalogId}-${++n}`,
    catalogId,
    layer,
    z,
    attachTo: opts.attachTo,
    color: opts.color ?? {},
    desktop: placement,
    mobile: undefined,
    hideMobile: opts.hiddenMobile ?? false,
  });

  const desk = mk('desk', 'floor', 20, p(0.185, 1, 1));
  const beanbag = mk('beanbag', 'floor', 20, p(0.86, 1, 0.92));
  const shelf = mk('wall-shelf', 'wall', 16, p(0.12, 0.9, 0.22), { hiddenMobile: true });

  return [
    // --- wall decor ---
    mk('string-lights', 'wall', 10, p(0.17, 0.3, 0.22)),
    mk('string-lights', 'wall', 10, p(0.83, 0.3, 0.22), { flip: true, hiddenMobile: true }),
    mk('window', 'wall', 12, p(0.115, 0.583, 0.4), { hiddenMobile: true }),
    mk('curtain', 'wall', 14, p(0.05, 0.6, 0.46), { hiddenMobile: true }),
    mk('curtain', 'wall', 14, p(0.18, 0.6, 0.46), { flip: true, hiddenMobile: true }),
    shelf,
    mk('corkboard', 'wall', 12, p(0.9, 0.97, 0.38), { hiddenMobile: true }),
    mk('wall-clock', 'wall', 12, p(0.925, 0.573, 0.22), { hiddenMobile: true }),

    // --- floor ---
    mk('rug', 'floor', 5, p(0.5, 1, 0.5)),
    desk,
    beanbag,
    // A trinket on the wall shelf: the same asset works on a floor desk too.
    mk('plant', 'surface', 30, ap(0.5, 0.05, 0.18), { attachTo: shelf.id, hiddenMobile: true }),
    mk('raccoon', 'surface', 30, ap(0.5, 0.18, 0.4), { attachTo: beanbag.id }),

    // --- things on the desk ---
    mk('pencil-cup', 'surface', 35, ap(0.1, 0.02, 0.17, 4), { attachTo: desk.id }),
    mk('coffee-cup', 'surface', 36, ap(0.22, 0.03, 0.14, -4), { attachTo: desk.id }),
    mk('laptop', 'surface', 37, ap(0.35, 0, 0.22, -2), { attachTo: desk.id }),
    mk('scissors', 'surface', 38, ap(0.5, 0.05, 0.12, 12), { attachTo: desk.id }),
    mk('owala', 'surface', 39, ap(0.62, 0.02, 0.2, -3), { attachTo: desk.id }),
    mk('plant', 'surface', 40, ap(0.74, 0.02, 0.18, 3), { attachTo: desk.id }),
  ];
}
