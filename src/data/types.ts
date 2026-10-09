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
}

export type PhotoStyle = 'sunset' | 'sea' | 'forest' | 'night' | 'blush' | 'meadow';
export type StickerIcon = 'heart' | 'star' | 'sparkle';

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
}

export interface PhotoElement extends ElementBase {
  kind: 'photo';
  photo: PhotoStyle;
  caption?: string;
}

export interface NoteElement extends ElementBase {
  kind: 'note';
  text: string;
}

export interface StickerElement extends ElementBase {
  kind: 'sticker';
  icon: StickerIcon;
}

export type PageElement = PhotoElement | NoteElement | StickerElement;

export type PageElementInput =
  | Omit<PhotoElement, 'id' | 'pageId' | 'z' | 'opacity'>
  | Omit<NoteElement, 'id' | 'pageId' | 'z' | 'opacity'>
  | Omit<StickerElement, 'id' | 'pageId' | 'z' | 'opacity'>;

export interface ScrapPage {
  id: string;
  bookId: string;
  index: number;
  background?: string;
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
}

export interface AppData {
  version: number;
  content: Content;
  room: Room;
  roomItems: RoomItem[];
}
