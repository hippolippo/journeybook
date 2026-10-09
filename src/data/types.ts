export type CoverColor = 'rose' | 'sage' | 'mustard' | 'terracotta' | 'sky' | 'kraft';

export type NodeType = 'folder' | 'scrapbook';

export interface ScrapNode {
  id: string;
  type: NodeType;
  title: string;
  parentId: string | null;
  tags: string[];
  order: number;
  cover?: CoverColor;
  /** Published books are read-only until unpublished. */
  published?: boolean;
}

export type PhotoStyle = 'sunset' | 'sea' | 'forest' | 'night' | 'blush' | 'meadow';
export type StickerIcon = 'heart' | 'star' | 'sparkle';
/** Built-in tapes are 'washi' | 'masking'; artist-defined tapes add more ids. */
export type TapeStyle = 'washi' | 'masking' | (string & {});

interface ElementBase {
  id: string;
  pageId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: number;
  opacity: number;
  /** Finished items: selectable but not movable/resizable/deletable. */
  locked?: boolean;
  /** Keep the aspect ratio when resizing (default true). */
  aspectLocked?: boolean;
  /** Layer group this element belongs to (see PageGroup). */
  groupId?: string;
  /** Optional custom name shown in the layers pane. */
  name?: string;
  /** Overall visual zoom of the element (1 = default). */
  scale?: number;
}

export interface PhotoElement extends ElementBase {
  kind: 'photo';
  photo: PhotoStyle;
  caption?: string;
}

export interface NoteElement extends ElementBase {
  kind: 'note';
  text: string;
  /** Paper tint/color (Sticky/Kraft). */
  color?: string;
  /** Ink (text) color. */
  ink?: string;
  /** Pen id (handwriting font). */
  font?: string;
  /** Font size in page-reference px. */
  size?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  /** Paper style id; 'none' writes directly on the page. */
  paper?: string;
  uppercase?: boolean;
  shadow?: boolean;
}

export interface StickerElement extends ElementBase {
  kind: 'sticker';
  icon: string;
  color?: string;
}

export interface ImageEffects {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  warmth?: number;
  fade?: number;
  vignette?: number;
  grain?: number;
}

export interface ImageElement extends ElementBase {
  kind: 'image';
  mediaId: string;
  caption?: string;
  frame?: string;
  frameColor?: string;
  zoom?: number;
  focusX?: number;
  focusY?: number;
  preset?: string;
  effects?: ImageEffects;
}

export interface TapeElement extends ElementBase {
  kind: 'tape';
  style: TapeStyle;
  color?: string;
}

export type PageElement = PhotoElement | NoteElement | StickerElement | ImageElement | TapeElement;

export type PageElementInput =
  | Omit<PhotoElement, 'id' | 'pageId' | 'z' | 'opacity'>
  | Omit<NoteElement, 'id' | 'pageId' | 'z' | 'opacity'>
  | Omit<StickerElement, 'id' | 'pageId' | 'z' | 'opacity'>
  | Omit<ImageElement, 'id' | 'pageId' | 'z' | 'opacity'>
  | Omit<TapeElement, 'id' | 'pageId' | 'z' | 'opacity'>;

/** A user-arrangeable folder in the page's layers pane. */
export interface PageGroup {
  id: string;
  name: string;
  collapsed?: boolean;
}

export interface ScrapPage {
  id: string;
  bookId: string;
  index: number;
  /** Paper style id (see src/scrapbook/paper.ts). */
  background?: string;
  /** Layer groups; ordered front-to-back. */
  groups?: PageGroup[];
}

/** A saved, named image effects preset (shared via the backend). */
export interface ImagePreset {
  id: string;
  name: string;
  effects: ImageEffects;
}

/** An uploaded image in a book's album. Bytes live in IndexedDB (local) or PocketBase files. */
export interface MediaAsset {
  id: string;
  bookId: string;
  name: string;
  /** PocketBase file name when the backend stores the bytes. */
  fileName?: string;
  created: number;
}

export type Layer = 'wall' | 'floor' | 'surface';

export interface Placement {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flip: boolean;
}

export interface RoomItem {
  id: string;
  catalogId: string;
  layer: Layer;
  z: number;
  attachTo?: string;
  color: Record<string, string>;
  desktop: Placement;
  mobile?: Placement;
  hideMobile?: boolean;
  locked?: boolean;
}

/** A saved, named snapshot of the room, loadable from the editor. */
export interface StoredLayout {
  id: string;
  name: string;
  room: Room;
  items: RoomItem[];
}

export type DayNightMode = 'auto' | 'day' | 'night';

export interface Room {
  wallId: string;
  floorId: string;
  dayNightMode: DayNightMode;
  referenceTz: string;
}

export interface Content {
  nodes: ScrapNode[];
  pages: ScrapPage[];
  elements: PageElement[];
  media: MediaAsset[];
}

export interface AppData {
  version: number;
  content: Content;
  room: Room;
  roomItems: RoomItem[];
}
