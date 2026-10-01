"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { getStroke } from "perfect-freehand";
import {
  Trash2,
  BringToFront,
  SendToBack,
  Type,
  X,
} from "lucide-react";
import {
  useWhiteboardStore,
  type Point,
  type Stroke,
  type ShapeStroke,
  type TextElement,
  type ImageElement,
  type DrawAction,
} from "@/store/whiteboard-store";

interface CanvasPageProps {
  pageIndex: number;
}

interface EditingTextState {
  id?: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
}

type ResizeHandle = "nw" | "ne" | "se" | "sw";

function distToSegmentSquared(p: Point, v: Point, w: Point) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
}

export function CanvasPage({ pageIndex }: CanvasPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const isGestureZooming = useRef(false);
  const isDraggingItem = useRef(false);
  const isResizing = useRef(false);
  const isMarqueeSelecting = useRef(false);
  const isMagicErasing = useRef(false);
  const magicErasedIds = useRef<Set<string>>(new Set());
  const activeResizeHandle = useRef<ResizeHandle | null>(null);
  const isCommittingText = useRef(false);
  const rafId = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panInitial = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const marqueeStart = useRef<Point | null>(null);
  const marqueeCurrent = useRef<Point | null>(null);

  const resizeStartBounds = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });
  const resizeStartPoint = useRef<Point>({ x: 0, y: 0, pressure: 0.5 });
  const dragItemsStartPositions = useRef<{ id: string; startX: number; startY: number }[]>([]);
  const dragStartPoint = useRef<Point>({ x: 0, y: 0, pressure: 0.5 });
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchMid = useRef<{ x: number; y: number } | null>(null);
  const initialPinchContentPoint = useRef<{ x: number; y: number } | null>(null);
  const initialPinchZoom = useRef<number>(1);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const currentPoints = useRef<Point[]>([]);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);

  // Granular Store Subscriptions
  const activeTool = useWhiteboardStore((s) => s.activeTool);
  const selectedId = useWhiteboardStore((s) => s.selectedId);
  const selectedIds = useWhiteboardStore((s) => s.selectedIds);
  const setSelectedId = useWhiteboardStore((s) => s.setSelectedId);
  const setSelectedIds = useWhiteboardStore((s) => s.setSelectedIds);
  const updateActionPosition = useWhiteboardStore((s) => s.updateActionPosition);
  const updateActionBounds = useWhiteboardStore((s) => s.updateActionBounds);
  const updateActionText = useWhiteboardStore((s) => s.updateActionText);
  const deleteSelectedAction = useWhiteboardStore((s) => s.deleteSelectedAction);
  const deleteActions = useWhiteboardStore((s) => s.deleteActions);
  const bringForward = useWhiteboardStore((s) => s.bringForward);
  const sendBackward = useWhiteboardStore((s) => s.sendBackward);
  const strokeColor = useWhiteboardStore((s) => s.strokeColor);
  const strokeWidth = useWhiteboardStore((s) => s.strokeWidth);
  const zoom = useWhiteboardStore((s) => s.zoom);
  const setZoom = useWhiteboardStore((s) => s.setZoom);
  const pageActions = useWhiteboardStore((s) => s.pages[pageIndex]?.actions ?? []);
  const addAction = useWhiteboardStore((s) => s.addAction);
  const activePageIndex = useWhiteboardStore((s) => s.activePageIndex);

  // Inline Text Editing State
  const [editingText, setEditingText] = useState<EditingTextState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cache scroll container on mount
  useEffect(() => {
    scrollContainerRef.current = document.querySelector(".whiteboard-scroll");
  }, []);

  // Reset pan when zoom is reset to 100%
  useEffect(() => {
    if (zoom === 1) {
      setPan({ x: 0, y: 0 });
    }
  }, [zoom]);

  // Selected Items calculation (handles single item or multi-cropped items)
  const selectedItems = useMemo(() => {
    if (selectedIds.length > 0) {
      return pageActions.filter((a) => selectedIds.includes(a.id));
    }
    if (selectedId) {
      const itm = pageActions.find((a) => a.id === selectedId);
      return itm ? [itm] : [];
    }
    return [];
  }, [pageActions, selectedId, selectedIds]);

  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : null;

  // Accurate Bounding Box Calculation for ALL items (strokes, shapes, text, images)
  const getItemBounds = useCallback(
    (item: DrawAction): { x: number; y: number; w: number; h: number } => {
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
        const strk = item as Stroke;
        if (strk.points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
        let minX = strk.points[0].x;
        let maxX = strk.points[0].x;
        let minY = strk.points[0].y;
        let maxY = strk.points[0].y;
        for (let i = 1; i < strk.points.length; i++) {
          const p = strk.points[i];
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const pad = Math.max(6, strk.width * 1.5);
        return {
          x: minX - pad,
          y: minY - pad,
          w: Math.max(12, maxX - minX + pad * 2),
          h: Math.max(12, maxY - minY + pad * 2),
        };
      }
      return { x: 0, y: 0, w: 0, h: 0 };
    },
    []
  );

  // Combined Bounds for all active selections
  const selectedBounds = useMemo(() => {
    if (selectedItems.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
    if (selectedItems.length === 1) return getItemBounds(selectedItems[0]);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const item of selectedItems) {
      const b = getItemBounds(item);
      if (b.x < minX) minX = b.x;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y < minY) minY = b.y;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }

    return {
      x: minX,
      y: minY,
      w: Math.max(12, maxX - minX),
      h: Math.max(12, maxY - minY),
    };
  }, [selectedItems, getItemBounds]);

  // ── Text Editing Handlers ──
  const startEditingText = useCallback(
    (target: {
      id?: string;
      x: number;
      y: number;
      text?: string;
      fontSize?: number;
      color?: string;
    }) => {
      setEditingText({
        id: target.id,
        x: target.x,
        y: target.y,
        text: target.text ?? "",
        fontSize: target.fontSize ?? Math.max(strokeWidth * 6, 20),
        color: target.color ?? strokeColor,
      });
    },
    [strokeWidth, strokeColor]
  );

  const commitText = useCallback(() => {
    if (isCommittingText.current || !editingText) return;
    isCommittingText.current = true;

    const trimmed = editingText.text.trim();
    if (trimmed.length > 0) {
      if (editingText.id) {
        updateActionText(pageIndex, editingText.id, trimmed);
        setSelectedId(editingText.id);
      } else {
        const newId = crypto.randomUUID();
        const textAction: TextElement = {
          id: newId,
          tool: "text",
          x: editingText.x,
          y: editingText.y,
          text: trimmed,
          color: editingText.color,
          fontSize: editingText.fontSize,
        };
        addAction(pageIndex, textAction);
        setSelectedId(newId);
      }
    } else if (editingText.id) {
      deleteSelectedAction(pageIndex);
    }
    setEditingText(null);

    requestAnimationFrame(() => {
      isCommittingText.current = false;
    });
  }, [
    editingText,
    pageIndex,
    updateActionText,
    addAction,
    setSelectedId,
    deleteSelectedAction,
  ]);

  const cancelText = useCallback(() => {
    setEditingText(null);
  }, []);

  // Auto-focus textarea and place cursor at end
  useEffect(() => {
    if (editingText && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editingText]);

  // Keyboard shortcut for deleting or deselecting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedItems.length > 0) {
          e.preventDefault();
          deleteSelectedAction(pageIndex);
        }
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItems.length, pageIndex, deleteSelectedAction, setSelectedId]);

  // ── Freehand Stroke Drawing ──
  const drawFreehandStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.points.length < 2) return;

      const outlinePoints = getStroke(
        stroke.points.map((p) => [p.x, p.y, p.pressure]),
        {
          size: stroke.width * 2.5,
          thinning: stroke.tool === "highlighter" ? 0 : 0.5,
          smoothing: 0.5,
          streamline: 0.5,
          simulatePressure: stroke.points[0].pressure === 0.5,
        }
      );

      ctx.save();
      if (stroke.tool === "highlighter") {
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.globalAlpha = stroke.opacity;
      }
      ctx.fillStyle = stroke.color;
      ctx.beginPath();

      const [first, ...rest] = outlinePoints;
      if (!first) {
        ctx.restore();
        return;
      }
      ctx.moveTo(first[0], first[1]);
      for (const [x, y] of rest) {
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    []
  );

  // ── Eraser Stroke Drawing ──
  const drawEraserStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.points.length < 2) return;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = stroke.width * 5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    },
    []
  );

  // ── Shape Drawing ──
  const drawShape = useCallback(
    (ctx: CanvasRenderingContext2D, shape: ShapeStroke) => {
      ctx.save();
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = Math.max(1, shape.width * 1.5);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (shape.tool === "rectangle") {
        const w = shape.endX - shape.startX;
        const h = shape.endY - shape.startY;
        ctx.strokeRect(shape.startX, shape.startY, w, h);
      } else if (shape.tool === "circle") {
        const rx = Math.abs(shape.endX - shape.startX) / 2;
        const ry = Math.abs(shape.endY - shape.startY) / 2;
        const cx = shape.startX + (shape.endX - shape.startX) / 2;
        const cy = shape.startY + (shape.endY - shape.startY) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.tool === "line") {
        ctx.beginPath();
        ctx.moveTo(shape.startX, shape.startY);
        ctx.lineTo(shape.endX, shape.endY);
        ctx.stroke();
      } else if (shape.tool === "arrow") {
        ctx.beginPath();
        ctx.moveTo(shape.startX, shape.startY);
        ctx.lineTo(shape.endX, shape.endY);
        ctx.stroke();

        const dx = shape.endX - shape.startX;
        const dy = shape.endY - shape.startY;
        const angle = Math.atan2(dy, dx);
        const headLength = 12 + shape.width * 1.5;

        ctx.beginPath();
        ctx.moveTo(
          shape.endX - headLength * Math.cos(angle - 0.45),
          shape.endY - headLength * Math.sin(angle - 0.45)
        );
        ctx.lineTo(shape.endX, shape.endY);
        ctx.lineTo(
          shape.endX - headLength * Math.cos(angle + 0.45),
          shape.endY - headLength * Math.sin(angle + 0.45)
        );
        ctx.stroke();
      }

      ctx.restore();
    },
    []
  );

  // ── Text Drawing ──
  const drawText = useCallback(
    (ctx: CanvasRenderingContext2D, text: TextElement) => {
      ctx.save();
      ctx.fillStyle = text.color;
      ctx.font = `${text.fontSize}px var(--font-sans), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textBaseline = "top";
      const lines = (text.text || "").split("\n");
      const lineHeight = text.fontSize * 1.25;
      lines.forEach((line, index) => {
        ctx.fillText(line, text.x, text.y + index * lineHeight);
      });
      ctx.restore();
    },
    []
  );

  // ── Draw a Single Action ──
  const drawAction = useCallback(
    (ctx: CanvasRenderingContext2D, action: DrawAction) => {
      if (action.tool === "pen" || action.tool === "highlighter") {
        drawFreehandStroke(ctx, action as Stroke);
      } else if (action.tool === "eraser") {
        drawEraserStroke(ctx, action as Stroke);
      } else if (
        action.tool === "rectangle" ||
        action.tool === "circle" ||
        action.tool === "line" ||
        action.tool === "arrow"
      ) {
        drawShape(ctx, action as ShapeStroke);
      } else if (action.tool === "text") {
        drawText(ctx, action as TextElement);
      } else if (action.tool === "image") {
        const imgEl = action as ImageElement;
        let cached = imageCache.current.get(imgEl.src);
        if (!cached) {
          cached = new Image();
          cached.src = imgEl.src;
          cached.onload = () => {
            renderOffscreen();
            redrawCanvas();
          };
          imageCache.current.set(imgEl.src, cached);
        }
        if (cached.complete && cached.naturalWidth > 0) {
          ctx.save();
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(cached, imgEl.x, imgEl.y, imgEl.width, imgEl.height);
          ctx.restore();
        }
      }
    },
    [drawFreehandStroke, drawEraserStroke, drawShape, drawText]
  );

  // ── Render Committed Actions to Offscreen Canvas Cache ──
  const renderOffscreen = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (displayWidth === 0 || displayHeight === 0) return;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement("canvas");
    }
    const offscreen = offscreenCanvasRef.current;
    const targetW = Math.floor(displayWidth * dpr);
    const targetH = Math.floor(displayHeight * dpr);

    if (offscreen.width !== targetW || offscreen.height !== targetH) {
      offscreen.width = targetW;
      offscreen.height = targetH;
    }

    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    offCtx.save();
    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
    offCtx.scale(dpr, dpr);
    offCtx.imageSmoothingEnabled = true;
    offCtx.imageSmoothingQuality = "high";

    for (const action of pageActions) {
      if (editingText?.id && action.id === editingText.id) continue;
      drawAction(offCtx, action);
    }

    offCtx.restore();
  }, [pageActions, drawAction, editingText]);

  // ── Redraw Main Screen Canvas from Offscreen Cache + Selection & Marquee ──
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (displayWidth === 0 || displayHeight === 0) return;

    const targetW = Math.floor(displayWidth * dpr);
    const targetH = Math.floor(displayHeight * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      renderOffscreen();
    }

    // Clear main canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Blit from offscreen cache in single O(1) drawImage call
    if (offscreenCanvasRef.current) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
    }
    ctx.restore();

    // Draw live marquee / crop selection box
    if (isMarqueeSelecting.current && marqueeStart.current && marqueeCurrent.current) {
      const mx = Math.min(marqueeStart.current.x, marqueeCurrent.current.x);
      const my = Math.min(marqueeStart.current.y, marqueeCurrent.current.y);
      const mw = Math.abs(marqueeCurrent.current.x - marqueeStart.current.x);
      const mh = Math.abs(marqueeCurrent.current.y - marqueeStart.current.y);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(mx, my, mw, mh);
      ctx.restore();
    }

    // Draw selection outline and corner resize handles if items are selected
    if (selectedItems.length > 0 && (!editingText || editingText.id !== selectedId)) {
      const bounds = selectedBounds;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);

      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2.2;

      const handles = [
        { x: bounds.x - 4, y: bounds.y - 4 },
        { x: bounds.x + bounds.w + 4, y: bounds.y - 4 },
        { x: bounds.x + bounds.w + 4, y: bounds.y + bounds.h + 4 },
        { x: bounds.x - 4, y: bounds.y + bounds.h + 4 },
      ];

      for (const h of handles) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }, [
    selectedItems.length,
    selectedId,
    selectedBounds,
    editingText,
    renderOffscreen,
  ]);

  // RequestAnimationFrame Batching for buttery-smooth 60fps renders
  const scheduleRedraw = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      redrawCanvas();
    });
  }, [redrawCanvas]);

  // Update offscreen buffer whenever page actions change
  useEffect(() => {
    renderOffscreen();
    scheduleRedraw();
  }, [pageActions, editingText, renderOffscreen, scheduleRedraw]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      renderOffscreen();
      scheduleRedraw();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(rafId.current);
    };
  }, [renderOffscreen, scheduleRedraw]);

  // Pointer coordinate calculation
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.clientWidth / (rect.width || 1);
    const scaleY = canvas.clientHeight / (rect.height || 1);
    const pressure = e.pointerType === "mouse" ? 0.5 : e.pressure > 0 ? e.pressure : 0.5;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure,
    };
  };

  // Hit test for resize handles
  const hitTestResizeHandle = (
    point: Point,
    bounds: { x: number; y: number; w: number; h: number }
  ): ResizeHandle | null => {
    const handleRadius = 16;
    const corners: { handle: ResizeHandle; x: number; y: number }[] = [
      { handle: "nw", x: bounds.x - 4, y: bounds.y - 4 },
      { handle: "ne", x: bounds.x + bounds.w + 4, y: bounds.y - 4 },
      { handle: "se", x: bounds.x + bounds.w + 4, y: bounds.y + bounds.h + 4 },
      { handle: "sw", x: bounds.x - 4, y: bounds.y + bounds.h + 4 },
    ];

    for (const c of corners) {
      if (Math.hypot(point.x - c.x, point.y - c.y) <= handleRadius) {
        return c.handle;
      }
    }
    return null;
  };

  // Hit test for item body (Accurately hits drawings, strokes, shapes, text, images)
  const hitTestItem = (point: Point): DrawAction | null => {
    for (let i = pageActions.length - 1; i >= 0; i--) {
      const item = pageActions[i];
      const bounds = getItemBounds(item);
      if (
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.w &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.h
      ) {
        if (item.tool === "pen" || item.tool === "highlighter" || item.tool === "eraser") {
          const strk = item as Stroke;
          const maxDistSq = Math.max(10, strk.width * 2 + 10) ** 2;
          for (let j = 0; j < strk.points.length - 1; j++) {
            if (distToSegmentSquared(point, strk.points[j], strk.points[j + 1]) <= maxDistSq) {
              return item;
            }
          }
        } else {
          return item;
        }
      }
    }
    return null;
  };

  // Wheel Zoom & Page Scroll Handling
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = Math.exp(-e.deltaY * 0.003);
      const newZoom = Math.min(
        Math.max(Number((zoom * zoomFactor).toFixed(2)), 0.4),
        3.0
      );
      if (newZoom === zoom) return;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const rect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;

        const Cx = (e.clientX - rect.left) * (W / (rect.width || 1));
        const Cy = (e.clientY - rect.top) * (H / (rect.height || 1));

        const newPanX = e.clientX - centerX - (Cx - W / 2) * newZoom;
        const newPanY = e.clientY - centerY - (Cy - H / 2) * newZoom;

        setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
      }

      setZoom(newZoom);
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollBy({
        top: e.deltaY,
        left: e.deltaX,
        behavior: "auto",
      });
    }
  };

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingText) {
      commitText();
    }

    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-Finger Gesture (Hand Move + Pinch Zoom at Hand Location)
    if (activePointers.current.size === 2) {
      isDrawing.current = false;
      currentPoints.current = [];
      isDraggingItem.current = false;
      isResizing.current = false;
      isMarqueeSelecting.current = false;
      isMagicErasing.current = false;
      magicErasedIds.current.clear();
      isPanning.current = true;
      isGestureZooming.current = true;
      setIsGrabbing(true);
      redrawCanvas();

      const pts = Array.from(activePointers.current.values());
      const mid = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      initialPinchDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchMid.current = mid;
      initialPinchZoom.current = zoom;

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        initialPinchContentPoint.current = {
          x: (mid.x - rect.left) * (W / (rect.width || 1)),
          y: (mid.y - rect.top) * (H / (rect.height || 1)),
        };
      }
      return;
    }

    // SELECT / CROP TOOL
    if (activeTool === "select") {
      const point = getCanvasPoint(e);

      // 1. Check if clicking on active resize handle
      if (selectedItems.length > 0) {
        const handle = hitTestResizeHandle(point, selectedBounds);
        if (handle) {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          isResizing.current = true;
          activeResizeHandle.current = handle;
          resizeStartBounds.current = selectedBounds;
          resizeStartPoint.current = point;
          return;
        }
      }

      // 2. Check if clicking on any drawn item or stroke
      const hit = hitTestItem(point);
      if (hit) {
        // Double-click on text item to edit directly
        if (hit.tool === "text" && e.detail === 2) {
          const txt = hit as TextElement;
          startEditingText({
            id: txt.id,
            x: txt.x,
            y: txt.y,
            text: txt.text,
            fontSize: txt.fontSize,
            color: txt.color,
          });
          return;
        }

        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        // If clicking on an already selected item in multi-select, keep group; else select single item
        if (!selectedIds.includes(hit.id)) {
          setSelectedId(hit.id);
        }

        isDraggingItem.current = true;
        dragStartPoint.current = point;

        // Store start positions for all currently selected items
        const targetItems = selectedIds.includes(hit.id)
          ? selectedItems
          : [hit];

        dragItemsStartPositions.current = targetItems.map((item) => {
          if (
            item.tool === "rectangle" ||
            item.tool === "circle" ||
            item.tool === "line" ||
            item.tool === "arrow"
          ) {
            const shp = item as ShapeStroke;
            return { id: item.id, startX: shp.startX, startY: shp.startY };
          }
          const b = getItemBounds(item);
          return { id: item.id, startX: b.x, startY: b.y };
        });
        return;
      }

      // 3. Clicked empty canvas: start drag crop / marquee box selection
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isMarqueeSelecting.current = true;
      marqueeStart.current = point;
      marqueeCurrent.current = point;
      setSelectedId(null);
      return;
    }

    // MAGIC ERASER (Delete whole object on touch / drag)
    if (activeTool === "magic-eraser") {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isMagicErasing.current = true;
      magicErasedIds.current = new Set();
      const point = getCanvasPoint(e);
      const hit = hitTestItem(point);
      if (hit) {
        magicErasedIds.current.add(hit.id);
        deleteActions(pageIndex, [hit.id]);
      }
      return;
    }

    // PAN TOOL / Middle Click: Move Canvas
    if (activeTool === "pan" || e.button === 1) {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isPanning.current = true;
      setIsGrabbing(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panInitial.current = { ...pan };
      return;
    }

    // Drawing Tools
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    isDrawing.current = true;

    const point = getCanvasPoint(e);

    if (
      activeTool === "pen" ||
      activeTool === "eraser" ||
      activeTool === "highlighter"
    ) {
      currentPoints.current = [point];
    } else if (
      activeTool === "rectangle" ||
      activeTool === "circle" ||
      activeTool === "line" ||
      activeTool === "arrow"
    ) {
      shapeStart.current = { x: point.x, y: point.y };
    } else if (activeTool === "text") {
      const hit = hitTestItem(point);
      if (hit && hit.tool === "text") {
        const txt = hit as TextElement;
        startEditingText({
          id: txt.id,
          x: txt.x,
          y: txt.y,
          text: txt.text,
          fontSize: txt.fontSize,
          color: txt.color,
        });
      } else {
        startEditingText({
          x: point.x,
          y: point.y,
        });
      }
      isDrawing.current = false;
    }
  };

  // Pointer Move Handler
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const scrollContainer = scrollContainerRef.current;
    const canvas = canvasRef.current;

    // Dynamic Cursor on Hover in Select Mode (direct style update, 0 React re-renders)
    if (
      activeTool === "select" &&
      !isDraggingItem.current &&
      !isResizing.current &&
      !isPanning.current &&
      !isMarqueeSelecting.current &&
      canvas
    ) {
      const point = getCanvasPoint(e);
      if (selectedItems.length > 0) {
        const handle = hitTestResizeHandle(point, selectedBounds);
        if (handle === "nw" || handle === "se") {
          canvas.style.cursor = "nwse-resize";
        } else if (handle === "ne" || handle === "sw") {
          canvas.style.cursor = "nesw-resize";
        } else if (hitTestItem(point)) {
          canvas.style.cursor = "move";
        } else {
          canvas.style.cursor = "default";
        }
      } else if (hitTestItem(point)) {
        canvas.style.cursor = "pointer";
      } else {
        canvas.style.cursor = "crosshair";
      }
    }

    // Two-Finger Hand Pan & Pinch Zoom at Hand Location
    if (
      activePointers.current.size === 2 &&
      initialPinchDist.current &&
      initialPinchDist.current > 5 &&
      initialPinchMid.current &&
      initialPinchContentPoint.current
    ) {
      e.preventDefault();
      const pts = Array.from(activePointers.current.values());
      const currentMid = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const factor = currentDist / initialPinchDist.current;
      const targetZoom = Math.min(
        Math.max(Number((initialPinchZoom.current * factor).toFixed(2)), 0.4),
        3.0
      );

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        const Cx = initialPinchContentPoint.current.x;
        const Cy = initialPinchContentPoint.current.y;

        const newPanX = currentMid.x - centerX - (Cx - W / 2) * targetZoom;
        const newPanY = currentMid.y - centerY - (Cy - H / 2) * targetZoom;

        setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
      }

      setZoom(targetZoom);
      return;
    }

    // Magic Eraser drag deleting
    if (isMagicErasing.current) {
      e.preventDefault();
      const point = getCanvasPoint(e);
      const hit = hitTestItem(point);
      if (hit && !magicErasedIds.current.has(hit.id)) {
        magicErasedIds.current.add(hit.id);
        deleteActions(pageIndex, [hit.id]);
      }
      return;
    }

    // Live Marquee Box / Crop Selection Drag
    if (isMarqueeSelecting.current && marqueeStart.current) {
      e.preventDefault();
      marqueeCurrent.current = getCanvasPoint(e);
      redrawCanvas();
      return;
    }

    // Scaling / Resizing Item(s) via Corner Handle
    if (isResizing.current && activeResizeHandle.current && selectedItem) {
      e.preventDefault();
      const point = getCanvasPoint(e);
      const handle = activeResizeHandle.current;
      const b = resizeStartBounds.current;
      const dx = point.x - resizeStartPoint.current.x;
      const dy = point.y - resizeStartPoint.current.y;

      const isImg = selectedItem.tool === "image";
      const aspect = b.w / Math.max(1, b.h);

      let newX = b.x;
      let newY = b.y;
      let newW = b.w;
      let newH = b.h;

      if (handle === "se") {
        newW = Math.max(20, b.w + dx);
        newH = isImg ? Math.max(20, newW / aspect) : Math.max(20, b.h + dy);
      } else if (handle === "ne") {
        newW = Math.max(20, b.w + dx);
        newH = isImg ? Math.max(20, newW / aspect) : Math.max(20, b.h - dy);
        newY = b.y + (b.h - newH);
      } else if (handle === "sw") {
        newW = Math.max(20, b.w - dx);
        newH = isImg ? Math.max(20, newW / aspect) : Math.max(20, b.h + dy);
        newX = b.x + (b.w - newW);
      } else if (handle === "nw") {
        newW = Math.max(20, b.w - dx);
        newH = isImg ? Math.max(20, newW / aspect) : Math.max(20, b.h - dy);
        newX = b.x + (b.w - newW);
        newY = b.y + (b.h - newH);
      }

      updateActionBounds(
        pageIndex,
        selectedItem.id,
        Math.round(newX),
        Math.round(newY),
        Math.round(newW),
        Math.round(newH)
      );
      return;
    }

    // Drag Moving Selected Item(s) / Drawings
    if (isDraggingItem.current && dragItemsStartPositions.current.length > 0) {
      e.preventDefault();
      const point = getCanvasPoint(e);
      const dx = point.x - dragStartPoint.current.x;
      const dy = point.y - dragStartPoint.current.y;

      for (const itemPos of dragItemsStartPositions.current) {
        updateActionPosition(
          pageIndex,
          itemPos.id,
          Math.round(itemPos.startX + dx),
          Math.round(itemPos.startY + dy)
        );
      }
      return;
    }

    // Single Pointer Canvas Panning
    if (isPanning.current && activePointers.current.size === 1) {
      e.preventDefault();
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({
        x: Math.round(panInitial.current.x + dx),
        y: Math.round(panInitial.current.y + dy),
      });
      return;
    }

    if (!isDrawing.current || !canvas) return;
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.clientWidth / (rect.width || 1);
    const scaleY = canvas.clientHeight / (rect.height || 1);

    if (
      activeTool === "pen" ||
      activeTool === "eraser" ||
      activeTool === "highlighter"
    ) {
      const coalesced =
        (e.nativeEvent as PointerEvent).getCoalescedEvents?.() || [];

      if (coalesced.length > 0) {
        for (const ce of coalesced) {
          currentPoints.current.push({
            x: (ce.clientX - rect.left) * scaleX,
            y: (ce.clientY - rect.top) * scaleY,
            pressure: e.pointerType === "mouse" ? 0.5 : ce.pressure > 0 ? ce.pressure : 0.5,
          });
        }
      } else {
        currentPoints.current.push(getCanvasPoint(e));
      }

      redrawCanvas();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);

      if (activeTool === "eraser") {
        drawEraserStroke(ctx, {
          id: "preview",
          tool: "eraser",
          points: currentPoints.current,
          color: "#ffffff",
          width: strokeWidth,
          opacity: 1,
        });
      } else {
        drawFreehandStroke(ctx, {
          id: "preview",
          tool: activeTool as "pen" | "highlighter",
          points: currentPoints.current,
          color: strokeColor,
          width: strokeWidth,
          opacity: activeTool === "highlighter" ? 0.35 : 1,
        });
      }
      ctx.restore();
    } else if (
      (activeTool === "rectangle" ||
        activeTool === "circle" ||
        activeTool === "line" ||
        activeTool === "arrow") &&
      shapeStart.current
    ) {
      const point = getCanvasPoint(e);
      redrawCanvas();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      drawShape(ctx, {
        id: "preview",
        tool: activeTool,
        startX: shapeStart.current.x,
        startY: shapeStart.current.y,
        endX: point.x,
        endY: point.y,
        color: strokeColor,
        width: strokeWidth,
      });
      ctx.restore();
    }
  };

  // Pointer Up Handler
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.delete(e.pointerId);

    if (activePointers.current.size < 2) {
      initialPinchDist.current = null;
      initialPinchMid.current = null;
      initialPinchContentPoint.current = null;
      isGestureZooming.current = false;
    }

    if (isResizing.current) {
      isResizing.current = false;
      activeResizeHandle.current = null;
      return;
    }

    if (isDraggingItem.current) {
      isDraggingItem.current = false;
      dragItemsStartPositions.current = [];
      return;
    }

    // Finish Marquee Box / Crop Selection
    if (isMarqueeSelecting.current && marqueeStart.current && marqueeCurrent.current) {
      isMarqueeSelecting.current = false;
      const mx = Math.min(marqueeStart.current.x, marqueeCurrent.current.x);
      const my = Math.min(marqueeStart.current.y, marqueeCurrent.current.y);
      const mw = Math.abs(marqueeCurrent.current.x - marqueeStart.current.x);
      const mh = Math.abs(marqueeCurrent.current.y - marqueeStart.current.y);

      if (mw > 6 || mh > 6) {
        const captured: DrawAction[] = [];
        for (const item of pageActions) {
          const b = getItemBounds(item);
          // Check AABB intersection
          if (
            b.x + b.w >= mx &&
            b.x <= mx + mw &&
            b.y + b.h >= my &&
            b.y <= my + mh
          ) {
            captured.push(item);
          }
        }
        if (captured.length === 1) {
          setSelectedId(captured[0].id);
        } else if (captured.length > 1) {
          setSelectedIds(captured.map((c) => c.id));
        } else {
          setSelectedId(null);
        }
      } else {
        setSelectedId(null);
      }

      marqueeStart.current = null;
      marqueeCurrent.current = null;
      redrawCanvas();
      return;
    }

    if (isMagicErasing.current) {
      isMagicErasing.current = false;
      magicErasedIds.current.clear();
      return;
    }

    if (activePointers.current.size === 0 && isPanning.current) {
      isPanning.current = false;
      setIsGrabbing(false);
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    const point = getCanvasPoint(e);

    if (activeTool === "pen" || activeTool === "highlighter") {
      currentPoints.current.push(point);
      if (currentPoints.current.length >= 2) {
        const stroke: Stroke = {
          id: crypto.randomUUID(),
          tool: activeTool,
          points: [...currentPoints.current],
          color: strokeColor,
          width: strokeWidth,
          opacity: activeTool === "highlighter" ? 0.35 : 1,
        };
        addAction(pageIndex, stroke);
      }
    } else if (activeTool === "eraser") {
      currentPoints.current.push(point);
      if (currentPoints.current.length >= 2) {
        const stroke: Stroke = {
          id: crypto.randomUUID(),
          tool: "eraser",
          points: [...currentPoints.current],
          color: "#ffffff",
          width: strokeWidth,
          opacity: 1,
        };
        addAction(pageIndex, stroke);
      }
    } else if (
      (activeTool === "rectangle" ||
        activeTool === "circle" ||
        activeTool === "line" ||
        activeTool === "arrow") &&
      shapeStart.current
    ) {
      const shape: ShapeStroke = {
        id: crypto.randomUUID(),
        tool: activeTool,
        startX: shapeStart.current.x,
        startY: shapeStart.current.y,
        endX: point.x,
        endY: point.y,
        color: strokeColor,
        width: strokeWidth,
      };
      addAction(pageIndex, shape);
      shapeStart.current = null;
    }

    currentPoints.current = [];
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.delete(e.pointerId);
    initialPinchDist.current = null;
    initialPinchMid.current = null;
    initialPinchContentPoint.current = null;
    isGestureZooming.current = false;
    isResizing.current = false;
    isDraggingItem.current = false;
    isMarqueeSelecting.current = false;
    isMagicErasing.current = false;
    magicErasedIds.current.clear();
    isPanning.current = false;
    setIsGrabbing(false);
    isDrawing.current = false;
    currentPoints.current = [];
    shapeStart.current = null;
    marqueeStart.current = null;
    marqueeCurrent.current = null;
    redrawCanvas();
  };

  // Base cursor calculation
  const canvasCursor = useMemo(() => {
    if (activeTool === "select") return "default";
    if (activeTool === "pan") return isGrabbing ? "grabbing" : "grab";
    if (activeTool === "text") return "text";
    if (activeTool === "eraser" || activeTool === "magic-eraser") return "cell";
    return "crosshair";
  }, [activeTool, isGrabbing]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Discreet page number badge */}
      <div className="absolute top-3 left-4 z-10 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 pointer-events-none select-none">
        Page {pageIndex + 1}
      </div>

      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          transition:
            isPanning.current ||
            isDraggingItem.current ||
            isResizing.current ||
            isMarqueeSelecting.current ||
            isGestureZooming.current
              ? "none"
              : "transform 0.12s ease-out",
        }}
      >
        <canvas
          ref={canvasRef}
          className="canvas-grid-bg w-full h-full rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10"
          style={{
            touchAction: "none",
            cursor: canvasCursor,
          }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />

        {/* ── Inline Text Editor on Canvas (Inverse-Scaled to keep readable size) ── */}
        {editingText && (
          <div
            className="absolute z-30 pointer-events-auto"
            style={{
              left: `${editingText.x}px`,
              top: `${editingText.y}px`,
              transform: `scale(${1 / zoom})`,
              transformOrigin: "top left",
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <textarea
              ref={textareaRef}
              value={editingText.text}
              onChange={(e) => {
                const val = e.target.value;
                setEditingText((prev) => (prev ? { ...prev, text: val } : null));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitText();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  if (editingText.text.trim()) {
                    commitText();
                  } else {
                    cancelText();
                  }
                }
              }}
              onBlur={() => {
                commitText();
              }}
              placeholder="Type text..."
              rows={Math.max(1, (editingText.text.match(/\n/g) || []).length + 1)}
              className="wb-inline-text-editor"
              style={{
                color: editingText.color,
                fontSize: `${editingText.fontSize}px`,
                lineHeight: 1.25,
                width: `${Math.max(
                  140,
                  Math.max(...editingText.text.split("\n").map((l) => l.length), 0) *
                    (editingText.fontSize * 0.65) +
                    32
                )}px`,
              }}
              autoFocus
            />
          </div>
        )}

        {/* ── Contextual Pop Menu above Selected Drawing / Crop Object (Inverse-Scaled) ── */}
        {selectedItems.length > 0 && activeTool === "select" && !editingText && (
          <div
            className="wb-tooltip absolute"
            style={{
              left: `${selectedBounds.x + selectedBounds.w / 2}px`,
              top: `${Math.max(35, selectedBounds.y - 12)}px`,
              transform: `translate(-50%, -100%) scale(${1 / zoom})`,
              transformOrigin: "bottom center",
              pointerEvents: "auto",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {selectedItem?.tool === "text" && (
              <>
                <button
                  type="button"
                  className="wb-tool"
                  title="Edit text"
                  aria-label="Edit text"
                  onClick={() => {
                    const txt = selectedItem as TextElement;
                    startEditingText({
                      id: txt.id,
                      x: txt.x,
                      y: txt.y,
                      text: txt.text,
                      fontSize: txt.fontSize,
                      color: txt.color,
                    });
                  }}
                >
                  <Type />
                </button>
                <span
                  className="wb-divider"
                  style={{ height: "16px", margin: "0 2px" }}
                />
              </>
            )}
            <button
              type="button"
              className="wb-tool wb-tool-delete"
              title={selectedItems.length > 1 ? `Delete ${selectedItems.length} items` : "Delete"}
              aria-label="Delete selected items"
              onClick={() => deleteSelectedAction(pageIndex)}
            >
              <Trash2 />
            </button>
            {selectedItem && (
              <>
                <span
                  className="wb-divider"
                  style={{ height: "16px", margin: "0 2px" }}
                />
                <button
                  type="button"
                  className="wb-tool"
                  title="Bring forward"
                  aria-label="Bring forward"
                  onClick={() => bringForward(pageIndex, selectedItem.id)}
                >
                  <BringToFront />
                </button>
                <button
                  type="button"
                  className="wb-tool"
                  title="Send backward"
                  aria-label="Send backward"
                  onClick={() => sendBackward(pageIndex, selectedItem.id)}
                >
                  <SendToBack />
                </button>
              </>
            )}
            <span
              className="wb-divider"
              style={{ height: "16px", margin: "0 2px" }}
            />
            <button
              type="button"
              className="wb-tool"
              title="Deselect"
              aria-label="Deselect"
              onClick={() => setSelectedId(null)}
            >
              <X />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
