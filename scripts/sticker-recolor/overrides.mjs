// Per-sticker semantic recolours. Keys are source file names; values map an
// original hex to an explicit target colour chosen to read as the object should.
// Everything not listed is remapped automatically onto the master palette.
export const OVERRIDES = {
  // Leather-and-brass camera: tan leather body, dark glass lens, brass shutter.
  'camera.svg': {
    '#C7EBDB': '#D2B27F',
    '#AFDCCB': '#B8935B',
    '#A1D8C2': '#987444',
    '#91C9C2': '#77592F',
    '#89CFCC': '#4E433A',
    '#C2EDE7': '#EFE1C9',
    '#509997': '#332A24',
    '#335B59': '#1F1915',
    '#FCAA88': '#D06E45',
    '#FDDA89': '#DCAE4A',
    '#FDE9C1': '#F8F0E0',
  },
  // Retro two-tone camper van: cream body, terracotta lower, dark tyres.
  'camper-van.svg': {
    '#F3E9D3': '#F8F0E0',
    '#ABCAB2': '#D06E45',
    '#535557': '#332A24',
    '#5B5E5F': '#4E433A',
    '#FAF7F2': '#EFE1C9',
  },
  // Minivan: sky-blue body, glassy windows, dark tyres.
  'minivan.svg': {
    '#ABE0B9': '#8FB4C4',
    '#9CD4AD': '#688FA3',
    '#625A79': '#332A24',
    '#978FC6': '#B6D3DE',
    '#FAEB9C': '#EFE1C9',
  },
  // Game controller: charcoal body, gray rings, red buttons.
  'controller.svg': {
    '#C3B2F4': '#332A24',
    '#B0DDB9': '#1F1915',
    '#BCE8CE': '#8A8278',
    '#AD9FEB': '#4E433A',
    '#FFCEBF': '#D9482F',
  },
  // Arcade joystick: red ball, charcoal base, cream socket.
  'arcade-joystick.svg': {
    '#7DC7B9': '#4E433A',
    '#A2DDD0': '#332A24',
    '#CBEFE3': '#EFE1C9',
    '#94D5C9': '#1F1915',
    '#B1E4CB': '#D9482F',
    '#E4F6F0': '#F8F0E0',
  },
  // Airplane: cream body with sky-blue accents.
  'airplane.svg': {
    '#C6B7EB': '#688FA3',
    '#B1D5FE': '#F8F0E0',
  },
};
