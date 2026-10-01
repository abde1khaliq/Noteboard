import { create } from "zustand";

// ── Types ──
export type Tool =
  | "select"
  | "pan"
  | "pen"
  | "eraser"
  | "highlighter"
  | "rectangle"
  | "circle"
  | "line"
  | "arrow"
  | "text";

export type ShapeType = "rectangle" | "circle" | "line" | "arrow";

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
  tool: ShapeType;
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

export interface ImageElement {
  id: string;
  tool: "image";
  x: number;
  y: number;
  src: string;
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
}

export type DrawAction = Stroke | ShapeStroke | TextElement | ImageElement;

export interface Page {
  id: string;
  actions: DrawAction[];
}

// Maximum history snapshots to keep per page to prevent memory growth
const MAX_HISTORY = 40;

// ── Store ──
interface WhiteboardState {
  // Tool state
  activeTool: Tool;
  selectedShape: ShapeType;
  selectedId: string | null;
  strokeColor: string;
  strokeWidth: number;
  setTool: (tool: Tool) => void;
  setSelectedShape: (shape: ShapeType) => void;
  setSelectedId: (id: string | null) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;

  // Zoom state
  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  // Pages
  pages: Page[];
  activePageIndex: number;
  addPage: () => void;
  setActivePage: (index: number) => void;
  clearPage: (pageIndex: number) => void;

  // Actions on current page
  addAction: (pageIndex: number, action: DrawAction) => void;
  updateActionPosition: (
    pageIndex: number,
    actionId: string,
    x: number,
    y: number
  ) => void;
  updateActionBounds: (
    pageIndex: number,
    actionId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => void;
  updateActionText: (
    pageIndex: number,
    actionId: string,
    text: string
  ) => void;
  bringForward: (pageIndex: number, actionId: string) => void;
  sendBackward: (pageIndex: number, actionId: string) => void;
  deleteSelectedAction: (pageIndex: number) => void;

  // Snapshot-based Undo / Redo per page
  undoHistory: Map<string, DrawAction[][]>;
  redoHistory: Map<string, DrawAction[][]>;
  undo: (pageIndex: number) => void;
  redo: (pageIndex: number) => void;
  canUndo: (pageIndex: number) => boolean;
  canRedo: (pageIndex: number) => boolean;

  // Toast / Notices
  notice: string;
  showNotice: (text: string) => void;
}

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  activeTool: "pen",
  selectedShape: "rectangle",
  selectedId: null,
  strokeColor: "#202124",
  strokeWidth: 4,
  zoom: 1,

  setTool: (tool) =>
    set((state) => ({
      activeTool: tool,
      selectedId: tool === "select" ? state.selectedId : null,
    })),
  setSelectedShape: (shape) => set({ selectedShape: shape }),
  setSelectedId: (id) => set({ selectedId: id }),
  setColor: (color) => set({ strokeColor: color }),
  setWidth: (width) => set({ strokeWidth: width }),

  setZoom: (zoom) =>
    set({
      zoom: Math.min(Math.max(Number(zoom.toFixed(2)), 0.4), 3.0),
    }),
  zoomIn: () =>
    set((s) => ({
      zoom: Math.min(Number((s.zoom + 0.15).toFixed(2)), 3.0),
    })),
  zoomOut: () =>
    set((s) => ({
      zoom: Math.max(Number((s.zoom - 0.15).toFixed(2)), 0.4),
    })),
  resetZoom: () => set({ zoom: 1 }),

  pages: [{ id: crypto.randomUUID(), actions: [] }],
  activePageIndex: 0,

  addPage: () =>
    set((state) => ({
      pages: [...state.pages, { id: crypto.randomUUID(), actions: [] }],
    })),

  setActivePage: (index) => set({ activePageIndex: index, selectedId: null }),

  clearPage: (pageIndex) =>
    set((state) => {
      const page = state.pages[pageIndex];
      if (!page || page.actions.length === 0) return state;

      const pages = [...state.pages];
      const undoHistory = new Map(state.undoHistory);
      const redoHistory = new Map(state.redoHistory);

      const pastSnapshots = undoHistory.get(page.id) || [];
      undoHistory.set(
        page.id,
        [...pastSnapshots, page.actions].slice(-MAX_HISTORY)
      );
      redoHistory.delete(page.id);

      pages[pageIndex] = { ...page, actions: [] };
      return { pages, undoHistory, redoHistory, selectedId: null };
    }),

  addAction: (pageIndex, action) =>
    set((state) => {
      const page = state.pages[pageIndex];
      if (!page) return state;

      const pages = [...state.pages];
      const undoHistory = new Map(state.undoHistory);
      const redoHistory = new Map(state.redoHistory);

      const pastSnapshots = undoHistory.get(page.id) || [];
      undoHistory.set(
        page.id,
        [...pastSnapshots, page.actions].slice(-MAX_HISTORY)
      );
      redoHistory.delete(page.id);

      pages[pageIndex] = {
        ...page,
        actions: [...page.actions, action],
      };
      return { pages, undoHistory, redoHistory };
    }),

  updateActionPosition: (pageIndex, actionId, x, y) =>
    set((state) => {
      const page = state.pages[pageIndex];
      if (!page) return state;

      let changed = false;
      const newActions = page.actions.map((act) => {
        if (act.id !== actionId) return act;
        changed = true;
        if (act.tool === "image" || act.tool === "text") {
          return { ...act, x, y };
        }
        if (
          act.tool === "rectangle" ||
          act.tool === "circle" ||
          act.tool === "line" ||
          act.tool === "arrow"
        ) {
          const dx = x - act.startX;
          const dy = y - act.startY;
          return {
            ...act,
            startX: x,
            startY: y,
            endX: act.endX + dx,
            endY: act.endY + dy,
          };
        }
        return act;
      });

      if (!changed) return state;
      const pages = [...state.pages];
      pages[pageIndex] = { ...page, actions: newActions };
      return { pages };
    }),

  updateActionBounds: (pageIndex, actionId, x, y, width, height) =>
    set((state) => {
      const page = state.pages[pageIndex];
      if (!page) return state;

      let changed = false;
      const newActions = page.actions.map((act) => {
        if (act.id !== actionId) return act;
        changed = true;
        if (act.tool === "image") {
          return { ...act, x, y, width, height };
        }
        if (act.tool === "text") {
          const lines = (act.text || "").split("\n").length || 1;
          const newFontSize = Math.max(12, Math.round(height / (lines * 1.25)));
          return { ...act, x, y, fontSize: newFontSize };
        }
        if (act.tool === "rectangle" || act.tool === "circle") {
          return {
            ...act,
            startX: x,
            startY: y,
            endX: x + width,
            endY: y + height,
          };
        }
        if (act.tool === "line" || act.tool === "arrow") {
          const isXReversed = act.startX > act.endX;
          const isYReversed = act.startY > act.endY;
          return {
            ...act,
            startX: isXReversed ? x + width : x,
            startY: isYReversed ? y + height : y,
            endX: isXReversed ? x : x + width,
            endY: isYReversed ? y : y + height,
          };
        }
        return act;
      });

      if (!changed) return state;
      const pages = [...state.pages];
      pages[pageIndex] = { ...page, actions: newActions };
      return { pages };
    }),

  updateActionText: (pageIndex, actionId, text) =>
    set((state) => {
      const page = state.pages[pageIndex];
      if (!page) return state;

      let changed = false;
      const newActions = page.actions.map((act) => {
        if (act.id !== actionId || act.tool !== "text") return act;
        changed = true;
        return { ...act, text };
      });

      if (!changed) return state;
      const pages = [...state.pages];
      pages[pageIndex] = { ...page, actions: newActions };
      return { pages };
    }),

  bringForward: (pageIndex, actionId) =>
    set((state) => {
      const pages = [...state.pages];
      const page = pages[pageIndex];
      if (!page) return state;
      const idx = page.actions.findIndex((a) => a.id === actionId);
      if (idx === -1 || idx === page.actions.length - 1) return state;

      const undoHistory = new Map(state.undoHistory);
      const redoHistory = new Map(state.redoHistory);
      const pastSnapshots = undoHistory.get(page.id) || [];
      undoHistory.set(
        page.id,
        [...pastSnapshots, page.actions].slice(-MAX_HISTORY)
      );
      redoHistory.delete(page.id);

      const actions = [...page.actions];
      const [item] = actions.splice(idx, 1);
      actions.splice(idx + 1, 0, item);
      pages[pageIndex] = { ...page, actions };
      return { pages, undoHistory, redoHistory };
    }),

  sendBackward: (pageIndex, actionId) =>
    set((state) => {
      const pages = [...state.pages];
      const page = pages[pageIndex];
      if (!page) return state;
      const idx = page.actions.findIndex((a) => a.id === actionId);
      if (idx <= 0) return state;

      const undoHistory = new Map(state.undoHistory);
      const redoHistory = new Map(state.redoHistory);
      const pastSnapshots = undoHistory.get(page.id) || [];
      undoHistory.set(
        page.id,
        [...pastSnapshots, page.actions].slice(-MAX_HISTORY)
      );
      redoHistory.delete(page.id);

      const actions = [...page.actions];
      const [item] = actions.splice(idx, 1);
      actions.splice(idx - 1, 0, item);
      pages[pageIndex] = { ...page, actions };
      return { pages, undoHistory, redoHistory };
    }),

  deleteSelectedAction: (pageIndex) =>
    set((state) => {
      if (!state.selectedId) return state;
      const pages = [...state.pages];
      const page = pages[pageIndex];
      if (!page) return state;
      const itemToDelete = page.actions.find((a) => a.id === state.selectedId);
      if (!itemToDelete) return state;

      const undoHistory = new Map(state.undoHistory);
      const redoHistory = new Map(state.redoHistory);
      const pastSnapshots = undoHistory.get(page.id) || [];
      undoHistory.set(
        page.id,
        [...pastSnapshots, page.actions].slice(-MAX_HISTORY)
      );
      redoHistory.delete(page.id);

      pages[pageIndex] = {
        ...page,
        actions: page.actions.filter((a) => a.id !== state.selectedId),
      };
      return { pages, undoHistory, redoHistory, selectedId: null };
    }),

  undoHistory: new Map(),
  redoHistory: new Map(),

  undo: (pageIndex) =>
    set((state) => {
      const page = state.pages[pageIndex];
      if (!page) return state;

      const pastSnapshots = state.undoHistory.get(page.id) || [];
      if (pastSnapshots.length === 0) return state;

      const previousActions = pastSnapshots[pastSnapshots.length - 1];
      const newUndoHistory = new Map(state.undoHistory);
      newUndoHistory.set(page.id, pastSnapshots.slice(0, -1));

      const futureSnapshots = state.redoHistory.get(page.id) || [];
      const newRedoHistory = new Map(state.redoHistory);
      newRedoHistory.set(
        page.id,
        [...futureSnapshots, page.actions].slice(-MAX_HISTORY)
      );

      const pages = [...state.pages];
      pages[pageIndex] = { ...page, actions: previousActions };
      return {
        pages,
        undoHistory: newUndoHistory,
        redoHistory: newRedoHistory,
        selectedId: null,
      };
    }),

  redo: (pageIndex) =>
    set((state) => {
      const page = state.pages[pageIndex];
      if (!page) return state;

      const futureSnapshots = state.redoHistory.get(page.id) || [];
      if (futureSnapshots.length === 0) return state;

      const nextActions = futureSnapshots[futureSnapshots.length - 1];
      const newRedoHistory = new Map(state.redoHistory);
      newRedoHistory.set(page.id, futureSnapshots.slice(0, -1));

      const pastSnapshots = state.undoHistory.get(page.id) || [];
      const newUndoHistory = new Map(state.undoHistory);
      newUndoHistory.set(
        page.id,
        [...pastSnapshots, page.actions].slice(-MAX_HISTORY)
      );

      const pages = [...state.pages];
      pages[pageIndex] = { ...page, actions: nextActions };
      return {
        pages,
        undoHistory: newUndoHistory,
        redoHistory: newRedoHistory,
        selectedId: null,
      };
    }),

  canUndo: (pageIndex) => {
    const page = get().pages[pageIndex];
    if (!page) return false;
    const history = get().undoHistory.get(page.id);
    return history ? history.length > 0 : false;
  },

  canRedo: (pageIndex) => {
    const page = get().pages[pageIndex];
    if (!page) return false;
    const future = get().redoHistory.get(page.id);
    return future ? future.length > 0 : false;
  },

  notice: "",
  showNotice: (text) => {
    set({ notice: text });
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (get().notice === text) {
          set({ notice: "" });
        }
      }, 2400);
    }
  },
}));
