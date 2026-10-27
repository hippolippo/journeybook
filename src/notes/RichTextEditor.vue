<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { RichDoc } from '@/data/types';
import {
  DEFAULT_TEXT_STYLE,
  clampNoteSize,
  docToHtml,
  fontIdFromFamily,
  htmlToDoc,
  toHex,
  type NoteTextStyle,
} from '@/notes/richText';

const props = defineProps<{ modelValue: RichDoc; suppressKeyboard?: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [RichDoc];
  'selection-style': [style: NoteTextStyle];
}>();

const el = ref<HTMLDivElement | null>(null);
let savedRange: Range | null = null;

const TYPING_MARKER = '\u200b';

function sync(): void {
  if (!el.value) return;
  emit('update:modelValue', htmlToDoc(el.value.innerHTML));
}

function setContent(): void {
  const root = el.value;
  if (!root) return;
  const html = docToHtml(props.modelValue);
  if (root.innerHTML !== html) root.innerHTML = html;
}

function onInput(): void {
  sync();
  emitStyle();
}

function onPaste(event: ClipboardEvent): void {
  event.preventDefault();
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (!text) return;
  restoreSelection();
  const inserted = document.execCommand('insertText', false, text);
  if (!inserted) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  sync();
}

function rememberSelection(): void {
  const selection = window.getSelection();
  const root = el.value;
  if (!selection || !root || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (root.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
}

function restoreSelection(): void {
  const root = el.value;
  if (!root) return;
  root.focus();
  if (!savedRange) return;
  try {
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(savedRange);
  } catch {
    /* the saved range can go stale after a re-render */
    savedRange = null;
  }
}

function materializeTypingStyle(): boolean {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount || !selection.getRangeAt(0).collapsed) return false;
  try {
    // The invisible marker materialises execCommand's pending typing style into
    // the DOM so a later style command does not replace it.
    return document.execCommand('insertText', false, TYPING_MARKER);
  } catch {
    return false;
  }
}

function applyCommand(command: string, value?: string): boolean {
  restoreSelection();
  try {
    document.execCommand('styleWithCSS', false, 'true');
  } catch {
    /* older browsers: still try the command */
  }
  let ok = false;
  try {
    ok = document.execCommand(command, false, value);
  } catch {
    ok = false;
  }
  if (ok) materializeTypingStyle();
  sync();
  rememberSelection();
  emitStyle();
  return ok;
}

function findTypingMarker(caret: Range): { node: Text; index: number } | null {
  const root = el.value;
  if (!root) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let best: { node: Text; index: number; range: Range } | null = null;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const index = (node.nodeValue ?? '').lastIndexOf(TYPING_MARKER);
    if (index < 0) continue;
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    if (range.compareBoundaryPoints(Range.END_TO_START, caret) > 0) continue;
    if (!best || range.compareBoundaryPoints(Range.START_TO_START, best.range) > 0) {
      best = { node, index, range };
    }
  }
  return best ? { node: best.node, index: best.index } : null;
}

/**
 * Put the caret inside a size span at an invisible marker. Text typed next
 * inherits the size and any pending browser typing styles.
 */
function wrapSizeMarker(size: string): boolean {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return false;
  const caret = selection.getRangeAt(0);
  if (!caret.collapsed) return false;
  const marker = findTypingMarker(caret);
  if (!marker) return false;
  const parent = marker.node.parentNode;
  if (!parent) return false;
  const value = marker.node.nodeValue ?? '';
  const before = value.slice(0, marker.index);
  const after = value.slice(marker.index + 1);
  const span = document.createElement('span');
  span.style.fontSize = size;
  const text = document.createTextNode(TYPING_MARKER);
  span.appendChild(text);
  const beforeNode = before ? document.createTextNode(before) : null;
  const afterNode = after ? document.createTextNode(after) : null;
  parent.insertBefore(span, marker.node);
  if (beforeNode) parent.insertBefore(beforeNode, span);
  if (afterNode) parent.insertBefore(afterNode, span.nextSibling);
  parent.removeChild(marker.node);
  const next = document.createRange();
  next.setStart(text, 1);
  next.collapse(true);
  selection.removeAllRanges();
  selection.addRange(next);
  savedRange = next.cloneRange();
  return true;
}

function applyCursorSize(size: string): boolean {
  restoreSelection();
  const selection = window.getSelection();
  const root = el.value;
  if (!selection || !root || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer) || !range.collapsed) return false;

  // This materialises any pending execCommand styles (font, ink, highlight,
  // bold, …) into the DOM without changing the visible text.
  if (materializeTypingStyle()) {
    const applied = wrapSizeMarker(size);
    emitStyle();
    return applied;
  }

  const span = document.createElement('span');
  span.style.fontSize = size;
  const text = document.createTextNode(TYPING_MARKER);
  span.appendChild(text);
  range.insertNode(span);
  const next = document.createRange();
  next.setStart(text, 1);
  next.collapse(true);
  selection.removeAllRanges();
  selection.addRange(next);
  savedRange = next.cloneRange();
  emitStyle();
  return true;
}

/**
 * Apply an inline style to the current selection, or to the typing style at a
 * collapsed caret. Fonts use execCommand's pending style; sizes need a marker
 * because execCommand only exposes the legacy 1–7 size scale.
 */
function wrapSelection(styles: Record<string, string>): boolean {
  restoreSelection();
  const selection = window.getSelection();
  const root = el.value;
  if (!selection || !root || !selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return false;

  if (selection.isCollapsed) {
    let applied = false;
    if (styles['font-family']) {
      applied = applyCommand('fontName', styles['font-family']) || applied;
    }
    if (styles['font-size']) {
      applied = applyCursorSize(styles['font-size']) || applied;
    }
    return applied;
  }

  const span = document.createElement('span');
  for (const [key, value] of Object.entries(styles)) {
    span.style.setProperty(key, value);
  }
  try {
    range.surroundContents(span);
  } catch {
    span.appendChild(range.extractContents());
    range.insertNode(span);
  }
  const next = document.createRange();
  next.selectNodeContents(span);
  selection.removeAllRanges();
  selection.addRange(next);
  savedRange = next.cloneRange();
  sync();
  emitStyle();
  return true;
}

function textPositionIn(
  container: Node,
  edge: 'start' | 'end',
): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let first: Text | null = null;
  let last: Text | null = null;
  let firstVisible: Text | null = null;
  let lastVisible: Text | null = null;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    first ??= node;
    last = node;
    if ((node.nodeValue ?? '').replace(/\u200b/g, '').length) {
      firstVisible ??= node;
      lastVisible = node;
    }
  }
  const text = edge === 'start' ? (firstVisible ?? first) : (lastVisible ?? last);
  if (!text) return null;
  return { node: text, offset: edge === 'start' ? 0 : (text.nodeValue ?? '').length };
}

function textPositionAtEdge(edge: 'start' | 'end'): { node: Node; offset: number } | null {
  const root = el.value;
  if (!root) return null;
  const block = edge === 'start' ? root.firstElementChild : root.lastElementChild;
  if (block) {
    return textPositionIn(block, edge) ?? { node: block, offset: 0 };
  }
  return textPositionIn(root, edge) ?? { node: root, offset: 0 };
}

function rangeAtPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null;
  };
  if (typeof doc.caretRangeFromPoint === 'function') {
    try {
      return doc.caretRangeFromPoint(x, y);
    } catch {
      /* fall through to the standard API */
    }
  }
  if (typeof doc.caretPositionFromPoint !== 'function') return null;
  try {
    const position = doc.caretPositionFromPoint(x, y);
    if (!position) return null;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  } catch {
    return null;
  }
}

function setCaret(node: Node, offset: number): boolean {
  const root = el.value;
  if (!root) return false;
  const range = document.createRange();
  try {
    range.setStart(node, offset);
    range.collapse(true);
  } catch {
    return false;
  }
  root.focus({ preventScroll: true });
  const selection = window.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  selection.addRange(range);
  savedRange = range.cloneRange();
  emitStyle();
  return true;
}

/**
 * Clicking the paper outside the text should still move the caret. Use the
 * native caret hit-test inside the text block, and the start/end of the letter
 * when the click is above or below every line.
 */
function placeCaretAtPoint(x: number, y: number): boolean {
  const root = el.value;
  if (!root) return false;
  const rect = root.getBoundingClientRect();
  if (y < rect.top) {
    const first = textPositionAtEdge('start');
    return first ? setCaret(first.node, first.offset) : false;
  }
  if (y > rect.bottom) {
    const last = textPositionAtEdge('end');
    return last ? setCaret(last.node, last.offset) : false;
  }
  const inset = 1;
  const px = Math.min(
    Math.max(x, rect.left + inset),
    Math.max(rect.left + inset, rect.right - inset),
  );
  const py = Math.min(
    Math.max(y, rect.top + inset),
    Math.max(rect.top + inset, rect.bottom - inset),
  );
  const range = rangeAtPoint(px, py);
  if (range && root.contains(range.commonAncestorContainer)) {
    range.collapse(true);
    root.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
      savedRange = range.cloneRange();
      emitStyle();
      return true;
    }
  }
  const edge = y < rect.top + rect.height / 2 ? 'start' : 'end';
  const fallback = textPositionAtEdge(edge);
  return fallback ? setCaret(fallback.node, fallback.offset) : false;
}

function focus(): void {
  el.value?.focus();
}

function blur(): void {
  el.value?.blur();
}

function isFocused(): boolean {
  return !!el.value && document.activeElement === el.value;
}

function caretRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0).cloneRange();
  const rects = range.getClientRects();
  const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
  if (rect && (rect.width || rect.height || rect.top)) return rect;
  const anchor = selection.anchorNode;
  const element =
    anchor?.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor?.parentElement;
  const fallback = element?.getBoundingClientRect();
  return fallback && fallback.height ? fallback : null;
}

function selectionRect(): DOMRect | null {
  const root = el.value;
  if (!root) return null;
  const selection = window.getSelection();
  let range: Range | null = null;
  if (selection?.rangeCount && root.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    range = selection.getRangeAt(0);
  } else {
    range = savedRange;
  }
  if (!range) return null;
  if (range.collapsed) return caretRect();
  const rect = range.getBoundingClientRect();
  if (rect && (rect.width || rect.height || rect.top)) return rect;
  const rects = range.getClientRects();
  return rects.length ? (rects[0] ?? null) : null;
}

function commandState(command: string): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

function effectiveHighlight(element: Element | null, root: HTMLElement): string | undefined {
  let node = element instanceof HTMLElement ? element : null;
  while (node && root.contains(node)) {
    const color = toHex(window.getComputedStyle(node).backgroundColor);
    if (color) return color;
    if (node === root) break;
    node = node.parentElement;
  }
  return undefined;
}

function readCurrentStyle(): NoteTextStyle | null {
  const root = el.value;
  const selection = window.getSelection();
  if (!root || !selection || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const anchor = selection.anchorNode;
  const element =
    anchor?.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor?.parentElement;
  if (!element || !root.contains(element)) return null;
  const style = window.getComputedStyle(element);
  const size = Number.parseFloat(style.fontSize);
  const highlight = effectiveHighlight(element, root);
  return {
    font: fontIdFromFamily(style.fontFamily) ?? DEFAULT_TEXT_STYLE.font,
    size: Number.isFinite(size) ? clampNoteSize(size) : DEFAULT_TEXT_STYLE.size,
    color: toHex(style.color) ?? DEFAULT_TEXT_STYLE.color,
    ...(highlight ? { highlight } : {}),
    bold: commandState('bold'),
    italic: commandState('italic'),
    underline: commandState('underline'),
    strike: commandState('strikeThrough'),
    align: commandState('justifyCenter')
      ? 'center'
      : commandState('justifyRight')
        ? 'right'
        : 'left',
  };
}

function emitStyle(): void {
  const style = readCurrentStyle();
  if (style) emit('selection-style', style);
}

function onSelectionChange(): void {
  rememberSelection();
  emitStyle();
}

onMounted(() => {
  setContent();
  document.addEventListener('selectionchange', onSelectionChange);
});

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange);
});

watch(
  () => props.modelValue,
  () => {
    if (!isFocused()) setContent();
  },
  { deep: true },
);

defineExpose({
  applyCommand,
  wrapSelection,
  focus,
  blur,
  isFocused,
  caretRect,
  selectionRect,
  placeCaretAtPoint,
  sync,
});
</script>

<template>
  <div
    ref="el"
    class="note-editor"
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    aria-label="Letter text"
    spellcheck="false"
    :inputmode="props.suppressKeyboard ? 'none' : 'text'"
    :virtualkeyboardpolicy="props.suppressKeyboard ? 'manual' : 'auto'"
    @input="onInput"
    @paste="onPaste"
    @focus="emitStyle"
    @keyup="rememberSelection"
    @mouseup="rememberSelection"
    @blur="rememberSelection"
  />
</template>
