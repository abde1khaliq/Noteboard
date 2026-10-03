import { create } from "zustand";

// ── Types ──
export type Tool =
  | "select"
  | "pan"
  | "pen"
  | "eraser"
  | "magic-eraser"
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

const MAX_HISTORY = 50;

export function getStrokeBoundingBox(stroke: Stroke): { x: number; y: number; w: number; h: number } {
  if (stroke.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = stroke.points[0].x;
  let maxX = stroke.points[0].x;
  let minY = stroke.points[0].y;
  let maxY = stroke.points[0].y;
  for (let i = 1; i < stroke.points.length; i++) {
    const p = stroke.points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = Math.max(4, stroke.width * 1.5);
  return {
    x: minX - pad,
    y: minY - pad,
    w: Math.max(1, maxX - minX + pad * 2),
    h: Math.max(1, maxY - minY + pad * 2),
  };
}

export function getActionBoundingBox(item: DrawAction): { x: number; y: number; w: number; h: number } {
  if (item.tool === "image") {
    const img = item as ImageElement;
    return { x: img.x, y: img.y, w: img.width, h: img.height };
  }
  if (item.tool === "text") {
    const txt = item as TextElement;
    const lines = (txt.text || "").split("\n");
    const maxLineLen = Math.max(...lines.map((l) => l.length), 1);
    const w = Math.max(24, maxLineLen * (txt.fontSize * 0.62));
    const lineHeight = txt.fontSize * 1.25;
    const h = Math.max(txt.fontSize, lines.length * lineHeight);
    return { x: txt.x, y: txt.y, w, h: h + 4 };
  }
  if (
    item.tool === "rectangle" ||
    item.tool === "circle" ||
    item.tool === "line" ||
    item.tool === "arrow"
  ) {
    const shp = item as ShapeStroke;
    const minX = Math.min(shp.startX, shp.endX);
    const maxX = Math.max(shp.startX, shp.endX);
    const minY = Math.min(shp.startY, shp.endY);
    const maxY = Math.max(shp.startY, shp.endY);
    return {
      x: minX,
      y: minY,
      w: Math.max(10, maxX - minX),
      h: Math.max(10, maxY - minY),
    };
  }
  if (item.tool === "pen" || item.tool === "highlighter" || item.tool === "eraser") {
    return getStrokeBoundingBox(item as Stroke);
  }
  return { x: 0, y: 0, w: 0, h: 0 };
}

export function getContentBounds(actions: DrawAction[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} | null {
  if (actions.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of actions) {
    const b = getActionBoundingBox(item);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.w > maxX) maxX = b.x + b.w;
    if (b.y + b.h > maxY) maxY = b.y + b.h;
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return null;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

// ── Store Interface ──
interface WhiteboardState {
  // Tool state
  activeTool: Tool;
  selectedShape: ShapeType;
  selectedId: string | null;
  selectedIds: string[];
  strokeColor: string;
  strokeWidth: number;
  setTool: (tool: Tool) => void;
  setSelectedShape: (shape: ShapeType) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  setColor: (color: string) => void;
  setWidth: (width: number) => void;

  // Viewport / Camera state (Infinite Canvas)
  pan: { x: number; y: number };
  zoom: number;
  setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
  setViewport: (pan: { x: number; y: number }, zoom: number) => void;
  setZoom: (zoom: number, anchor?: { x: number; y: number }) => void;
  zoomByFactor: (factor: number, anchor?: { x: number; y: number }) => void;
  zoomIn: (anchor?: { x: number; y: number }) => void;
  zoomOut: (anchor?: { x: number; y: number }) => void;
  resetZoom: (viewport?: { width: number; height: number }) => void;
  fitToContent: (viewport?: { width: number; height: number }) => void;

  // Unified Infinite Canvas Actions
  actions: DrawAction[];
  addAction: (action: DrawAction) => void;
  updateActionPosition: (actionId: string, x: number, y: number) => void;
  updateActionBounds: (
    actionId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => void;
  updateActionText: (actionId: string, text: string) => void;
  bringForward: (actionId: string) => void;
  sendBackward: (actionId: string) => void;
  deleteSelectedAction: () => void;
  deleteActions: (actionIds: string[]) => void;
  selectAll: () => void;
  clearBoard: () => void;

  // History (Undo / Redo)
  undoHistory: DrawAction[][];
  redoHistory: DrawAction[][];
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Toast / Notices
  notice: string;
  showNotice: (text: string) => void;
}

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  activeTool: "pen",
  selectedShape: "rectangle",
  selectedId: null,
  selectedIds: [],
  strokeColor: "#202124",
  strokeWidth: 4,

  setTool: (tool) =>
    set((state) => ({
      activeTool: tool,
      selectedId: tool === "select" ? state.selectedId : null,
      selectedIds: tool === "select" ? state.selectedIds : [],
    })),
  setSelectedShape: (shape) => set({ selectedShape: shape }),
  setSelectedId: (id) =>
    set({
      selectedId: id,
      selectedIds: id ? [id] : [],
    }),
  setSelectedIds: (ids) =>
    set({
      selectedIds: ids,
      selectedId: ids.length > 0 ? ids[0] : null,
    }),
  setColor: (color) => set({ strokeColor: color }),
  setWidth: (width) => set({ strokeWidth: width }),

  // Viewport State
  pan: { x: 0, y: 0 },
  zoom: 1,

  setPan: (panOrUpdater) =>
    set((state) => ({
      pan: typeof panOrUpdater === "function" ? panOrUpdater(state.pan) : panOrUpdater,
    })),

  setViewport: (pan, zoom) =>
    set({
      pan,
      zoom: Math.min(Math.max(Number(zoom.toFixed(3)), 0.1), 5.0),
    }),

  setZoom: (newZoom, anchor) =>
    set((state) => {
      const clampedZoom = Math.min(Math.max(Number(newZoom.toFixed(3)), 0.1), 5.0);
      if (clampedZoom === state.zoom) return state;

      const effectiveAnchor = anchor ?? {
        x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
        y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
      };

      const k = clampedZoom / state.zoom;
      const newPanX = effectiveAnchor.x - (effectiveAnchor.x - state.pan.x) * k;
      const newPanY = effectiveAnchor.y - (effectiveAnchor.y - state.pan.y) * k;
      return {
        zoom: clampedZoom,
        pan: { x: Math.round(newPanX), y: Math.round(newPanY) },
      };
    }),

  zoomByFactor: (factor, anchor) =>
    set((state) => {
      const targetZoom = Math.min(
        Math.max(Number((state.zoom * factor).toFixed(3)), 0.1),
        5.0
      );
      if (targetZoom === state.zoom) return state;

      const effectiveAnchor = anchor ?? {
        x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
        y: typeof window !== "undefined" ? window.innerHeight / 2 : 0,
      };

      const k = targetZoom / state.zoom;
      const newPanX = effectiveAnchor.x - (effectiveAnchor.x - state.pan.x) * k;
      const newPanY = effectiveAnchor.y - (effectiveAnchor.y - state.pan.y) * k;

      return {
        zoom: targetZoom,
        pan: { x: Math.round(newPanX), y: Math.round(newPanY) },
      };
    }),

  zoomIn: (anchor) => {
    const current = get().zoom;
    const factor = current < 0.5 ? 1.25 : 1.2;
    get().zoomByFactor(factor, anchor);
  },

  zoomOut: (anchor) => {
    const current = get().zoom;
    const factor = current < 0.5 ? 1.25 : 1.2;
    get().zoomByFactor(1 / factor, anchor);
  },

  resetZoom: (viewport) => {
    if (viewport && viewport.width > 0 && viewport.height > 0) {
      const content = getContentBounds(get().actions);
      if (content) {
        // Center the content at 100% zoom
        const panX = viewport.width / 2 - content.centerX;
        const panY = viewport.height / 2 - content.centerY;
        set({ zoom: 1, pan: { x: Math.round(panX), y: Math.round(panY) } });
        return;
      }
    }
    set({ zoom: 1, pan: { x: 0, y: 0 } });
  },

  fitToContent: (viewport) => {
    const content = getContentBounds(get().actions);
    const vw = viewport?.width || (typeof window !== "undefined" ? window.innerWidth : 1200);
    const vh = viewport?.height || (typeof window !== "undefined" ? window.innerHeight : 800);

    if (!content || content.width === 0 || content.height === 0) {
      set({ zoom: 1, pan: { x: 0, y: 0 } });
      return;
    }

    const padding = 80;
    const availableW = Math.max(100, vw - padding * 2);
    const availableH = Math.max(100, vh - padding * 2);

    const fitZoom = Math.min(
      Math.max(
        Number(Math.min(availableW / content.width, availableH / content.height).toFixed(2)),
        0.1
      ),
      2.0
    );

    const panX = vw / 2 - content.centerX * fitZoom;
    const panY = vh / 2 - content.centerY * fitZoom;

    set({
      zoom: fitZoom,
      pan: { x: Math.round(panX), y: Math.round(panY) },
    });
  },

  // Actions
  actions: [],

  addAction: (action) =>
    set((state) => ({
      undoHistory: [...state.undoHistory, state.actions].slice(-MAX_HISTORY),
      redoHistory: [],
      actions: [...state.actions, action],
    })),

  updateActionPosition: (actionId, x, y) =>
    set((state) => {
      let changed = false;
      const newActions = state.actions.map((act) => {
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
        if (act.tool === "pen" || act.tool === "highlighter" || act.tool === "eraser") {
          const b = getStrokeBoundingBox(act as Stroke);
          const dx = x - b.x;
          const dy = y - b.y;
          return {
            ...act,
            points: (act as Stroke).points.map((p) => ({
              ...p,
              x: p.x + dx,
              y: p.y + dy,
            })),
          };
        }
        return act;
      });

      if (!changed) return state;
      return { actions: newActions };
    }),

  updateActionBounds: (actionId, x, y, width, height) =>
    set((state) => {
      let changed = false;
      const newActions = state.actions.map((act) => {
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
        if (act.tool === "pen" || act.tool === "highlighter" || act.tool === "eraser") {
          const b = getStrokeBoundingBox(act as Stroke);
          const scaleX = b.w > 0 ? width / b.w : 1;
          const scaleY = b.h > 0 ? height / b.h : 1;
          return {
            ...act,
            points: (act as Stroke).points.map((p) => ({
              ...p,
              x: x + (p.x - b.x) * scaleX,
              y: y + (p.y - b.y) * scaleY,
            })),
          };
        }
        return act;
      });

      if (!changed) return state;
      return { actions: newActions };
    }),

  updateActionText: (actionId, text) =>
    set((state) => {
      let changed = false;
      const newActions = state.actions.map((act) => {
        if (act.id !== actionId || act.tool !== "text") return act;
        changed = true;
        return { ...act, text };
      });

      if (!changed) return state;
      return { actions: newActions };
    }),

  bringForward: (actionId) =>
    set((state) => {
      const idx = state.actions.findIndex((a) => a.id === actionId);
      if (idx === -1 || idx === state.actions.length - 1) return state;

      const actions = [...state.actions];
      const [item] = actions.splice(idx, 1);
      actions.splice(idx + 1, 0, item);

      return {
        undoHistory: [...state.undoHistory, state.actions].slice(-MAX_HISTORY),
        redoHistory: [],
        actions,
      };
    }),

  sendBackward: (actionId) =>
    set((state) => {
      const idx = state.actions.findIndex((a) => a.id === actionId);
      if (idx <= 0) return state;

      const actions = [...state.actions];
      const [item] = actions.splice(idx, 1);
      actions.splice(idx - 1, 0, item);

      return {
        undoHistory: [...state.undoHistory, state.actions].slice(-MAX_HISTORY),
        redoHistory: [],
        actions,
      };
    }),

  deleteSelectedAction: () =>
    set((state) => {
      const targetIds =
        state.selectedIds.length > 0
          ? state.selectedIds
          : state.selectedId
          ? [state.selectedId]
          : [];
      if (targetIds.length === 0) return state;

      const idSet = new Set(targetIds);
      return {
        undoHistory: [...state.undoHistory, state.actions].slice(-MAX_HISTORY),
        redoHistory: [],
        actions: state.actions.filter((a) => !idSet.has(a.id)),
        selectedId: null,
        selectedIds: [],
      };
    }),

  deleteActions: (actionIds) =>
    set((state) => {
      if (actionIds.length === 0) return state;
      const idSet = new Set(actionIds);
      return {
        undoHistory: [...state.undoHistory, state.actions].slice(-MAX_HISTORY),
        redoHistory: [],
        actions: state.actions.filter((a) => !idSet.has(a.id)),
        selectedId: null,
        selectedIds: [],
      };
    }),

  selectAll: () =>
    set((state) => ({
      selectedIds: state.actions.map((a) => a.id),
      selectedId: state.actions.length > 0 ? state.actions[0].id : null,
      activeTool: "select",
    })),

  clearBoard: () =>
    set((state) => {
      if (state.actions.length === 0) return state;
      return {
        undoHistory: [...state.undoHistory, state.actions].slice(-MAX_HISTORY),
        redoHistory: [],
        actions: [],
        selectedId: null,
        selectedIds: [],
      };
    }),

  // Undo / Redo
  undoHistory: [],
  redoHistory: [],

  undo: () =>
    set((state) => {
      if (state.undoHistory.length === 0) return state;
      const previousActions = state.undoHistory[state.undoHistory.length - 1];
      const newUndoHistory = state.undoHistory.slice(0, -1);

      return {
        undoHistory: newUndoHistory,
        redoHistory: [...state.redoHistory, state.actions].slice(-MAX_HISTORY),
        actions: previousActions,
        selectedId: null,
        selectedIds: [],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.redoHistory.length === 0) return state;
      const nextActions = state.redoHistory[state.redoHistory.length - 1];
      const newRedoHistory = state.redoHistory.slice(0, -1);

      return {
        undoHistory: [...state.undoHistory, state.actions].slice(-MAX_HISTORY),
        redoHistory: newRedoHistory,
        actions: nextActions,
        selectedId: null,
        selectedIds: [],
      };
    }),

  canUndo: () => get().undoHistory.length > 0,
  canRedo: () => get().redoHistory.length > 0,

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
