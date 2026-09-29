import { create } from "zustand";

// ── Types ──
export type Tool =
  | "pen"
  | "eraser"
  | "highlighter"
  | "rectangle"
  | "circle"
  | "line"
  | "text";

export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export interface Stroke {
  id: string;
  tool: "pen" | "eraser" | "highlighter";
  points: Point[];
  color: string;
  width: number;
  opacity: number;
}

export interface ShapeStroke {
  id: string;
  tool: "rectangle" | "circle" | "line";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  width: number;
}

export interface TextElement {
  id: string;
  tool: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export type DrawAction = Stroke | ShapeStroke | TextElement;

export interface Page {
  id: string;
  actions: DrawAction[];
}

// ── Store ──
interface WhiteboardState {
  // Tool state
  activeTool: Tool;
  strokeColor: string;
  strokeWidth: number;
  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;

  // Touch vs Pencil mode
  drawWithTouch: boolean;
  toggleDrawWithTouch: () => void;

  // Pages
  pages: Page[];
  activePageIndex: number;
  addPage: () => void;
  setActivePage: (index: number) => void;

  // Actions on current page
  addAction: (pageIndex: number, action: DrawAction) => void;

  // Undo/Redo (per-page)
  undoStacks: Map<string, DrawAction[]>;
  undo: (pageIndex: number) => void;
  redo: (pageIndex: number) => void;
  canUndo: (pageIndex: number) => boolean;
  canRedo: (pageIndex: number) => boolean;
}

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  activeTool: "pen",
  strokeColor: "#000000",
  strokeWidth: 3,
  drawWithTouch: true,

  setTool: (tool) => set({ activeTool: tool }),
  setColor: (color) => set({ strokeColor: color }),
  setWidth: (width) => set({ strokeWidth: width }),
  toggleDrawWithTouch: () => set((s) => ({ drawWithTouch: !s.drawWithTouch })),

  pages: [{ id: crypto.randomUUID(), actions: [] }],
  activePageIndex: 0,

  addPage: () =>
    set((state) => ({
      pages: [...state.pages, { id: crypto.randomUUID(), actions: [] }],
    })),

  setActivePage: (index) => set({ activePageIndex: index }),

  addAction: (pageIndex, action) =>
    set((state) => {
      const pages = [...state.pages];
      pages[pageIndex] = {
        ...pages[pageIndex],
        actions: [...pages[pageIndex].actions, action],
      };
      // Clear redo stack for this page
      const undoStacks = new Map(state.undoStacks);
      undoStacks.delete(pages[pageIndex].id);
      return { pages, undoStacks };
    }),

  undoStacks: new Map(),

  undo: (pageIndex) =>
    set((state) => {
      const page = state.pages[pageIndex];
      if (!page || page.actions.length === 0) return state;
      const pages = [...state.pages];
      const popped = page.actions[page.actions.length - 1];
      pages[pageIndex] = {
        ...page,
        actions: page.actions.slice(0, -1),
      };
      const undoStacks = new Map(state.undoStacks);
      const stack = undoStacks.get(page.id) || [];
      undoStacks.set(page.id, [...stack, popped]);
      return { pages, undoStacks };
    }),

  redo: (pageIndex) =>
    set((state) => {
      const page = state.pages[pageIndex];
      if (!page) return state;
      const undoStacks = new Map(state.undoStacks);
      const stack = undoStacks.get(page.id) || [];
      if (stack.length === 0) return state;
      const action = stack[stack.length - 1];
      undoStacks.set(page.id, stack.slice(0, -1));
      const pages = [...state.pages];
      pages[pageIndex] = {
        ...page,
        actions: [...page.actions, action],
      };
      return { pages, undoStacks };
    }),

  canUndo: (pageIndex) => {
    const page = get().pages[pageIndex];
    return page ? page.actions.length > 0 : false;
  },

  canRedo: (pageIndex) => {
    const page = get().pages[pageIndex];
    if (!page) return false;
    const stack = get().undoStacks.get(page.id);
    return stack ? stack.length > 0 : false;
  },
}));
