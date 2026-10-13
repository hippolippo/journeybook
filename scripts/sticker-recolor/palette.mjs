// Journeybook sticker master palette.
// Each family is an ordered ramp from light -> dark. Colours are the curated
// swatches the whole sticker set is remapped onto, so every sticker reads as
// one cohesive collection.
export const FAMILIES = {
  cream: ['#FEFBF4', '#F8F0E0', '#EFE1C9', '#E1CDAD'],
  kraft: ['#E7CFA6', '#D2B27F', '#B8935B', '#987444', '#77592F'],
  clay: ['#F2C0A0', '#E5966F', '#D06E45', '#AE5231', '#833C22'],
  poppy: ['#F6B0A2', '#EC7460', '#D9482F', '#AC3220', '#7E2316'],
  rose: ['#FBDDE2', '#F4B8C4', '#E88AA0', '#D05F7E', '#A9405E'],
  berry: ['#F486B0', '#E5518C', '#C22E68', '#962050'],
  mustard: ['#F9EBA6', '#EFD070', '#DCAE4A', '#B8862E', '#8E6420'],
  sage: ['#E0E9CC', '#C3D1A4', '#A3B77E', '#7E9560', '#5C6F44'],
  forest: ['#B9D8C2', '#8FBFA0', '#639B80', '#457764', '#2F5548'],
  sky: ['#DCECF2', '#B6D3DE', '#8FB4C4', '#688FA3', '#4A6C80'],
  teal: ['#D2F0E8', '#A0D8C9', '#6DB7A6', '#4C9184', '#2F6B62'],
  lavender: ['#E7DDF6', '#C9B6EC', '#A78CCF', '#8468AB', '#614E86'],
  stone: ['#EDE9E2', '#D3CCC2', '#B0A89C', '#8A8278', '#655E55'],
  ink: ['#6E6259', '#4E433A', '#332A24', '#1F1915'],
};

// Distinct, cross-hue options offered for every sticker colour slot. Linked
// shades are derived from whichever of these is chosen, so the options are
// genuinely different colours rather than shades of one colour.
export const OPTION_COLORS = [
  '#F6E7C9', // cream
  '#C9A46F', // kraft
  '#D06E45', // clay
  '#D9482F', // poppy
  '#E0607E', // rose
  '#B0285C', // berry
  '#D9A94E', // mustard
  '#7E9560', // sage
  '#3F7A63', // forest
  '#6A97AD', // sky
  '#3F9A88', // teal
  '#8E6FC0', // lavender
  '#8A8278', // stone
  '#3A3128', // ink
];

// Human labels for slots/manifest.
export const FAMILY_LABELS = {
  cream: 'Cream',
  kraft: 'Kraft',
  clay: 'Clay',
  poppy: 'Poppy',
  rose: 'Rose',
  berry: 'Berry',
  mustard: 'Mustard',
  sage: 'Sage',
  forest: 'Forest',
  sky: 'Sky',
  teal: 'Teal',
  lavender: 'Lavender',
  stone: 'Stone',
  ink: 'Ink',
};
