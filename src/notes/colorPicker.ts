import { readonly, ref } from 'vue';

/** Native colour-picker visibility, shared by all note colour swatches. */
const open = ref(false);

export const colorPickerOpen = readonly(open);

export function setColorPickerOpen(value: boolean): void {
  open.value = value;
}
