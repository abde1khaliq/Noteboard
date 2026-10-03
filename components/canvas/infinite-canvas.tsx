"use client";

import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { getStroke } from "perfect-freehand";
import {
  Trash2,
  BringToFront,
  SendToBack,
  Type,
  X,
  Maximize2,
  Compass,
  Map as MapIcon,
} from "lucide-react";
import {
  useWhiteboardStore,
  type Point,
  type Stroke,
  type ShapeStroke,
  type TextElement,
  type ImageElement,
  type DrawAction,
  getActionBoundingBox,
} from "@/store/whiteboard-store";
import { Minimap } from "./minimap";

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

export function InfiniteCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Gesture and interaction tracking refs
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const isSpacePanning = useRef(false);
  const isGestureZooming = useRef(false);
  const isDraggingItem = useRef(false);
  const isResizing = useRef(false);
  const isMarqueeSelecting = useRef(false);
  const isMagicErasing = useRef(false);
  const magicErasedIds = useRef<Set<string>>(new Set());
  const activeResizeHandle = useRef<ResizeHandle | null>(null);
  const isCommittingText = useRef(false);
  const rafId = useRef<number>(0);

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

  // Gesture tracking & multi-pointer guard
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchMid = useRef<{ x: number; y: number } | null>(null);
  const initialPinchZoom = useRef<number>(1);
  const initialPinchPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isGestureActive = useRef(false);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const currentPoints = useRef<Point[]>([]);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);

  // Minimap Visibility State (Controlled strictly by user command)
  const [showMinimap, setShowMinimap] = useState(false);

  // Store Subscriptions
  const activeTool = useWhiteboardStore((s) => s.activeTool);
  const setTool = useWhiteboardStore((s) => s.setTool);
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
  const actions = useWhiteboardStore((s) => s.actions);
  const addAction = useWhiteboardStore((s) => s.addAction);
  const selectAll = useWhiteboardStore((s) => s.selectAll);
  const pan = useWhiteboardStore((s) => s.pan);
  const zoom = useWhiteboardStore((s) => s.zoom);
  const setPan = useWhiteboardStore((s) => s.setPan);
  const setViewport = useWhiteboardStore((s) => s.setViewport);
  const zoomByFactor = useWhiteboardStore((s) => s.zoomByFactor);
  const fitToContent = useWhiteboardStore((s) => s.fitToContent);
  const resetZoom = useWhiteboardStore((s) => s.resetZoom);
  const showNotice = useWhiteboardStore((s) => s.showNotice);

  // Inline Text Editing State
  const [editingText, setEditingText] = useState<EditingTextState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper: World <-> Screen Coordinate conversion
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      return {
        x: (screenX - pan.x) / zoom,
        y: (screenY - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom]
  );

  const worldToScreen = useCallback(
    (worldX: number, worldY: number): { x: number; y: number } => {
      return {
        x: worldX * zoom + pan.x,
        y: worldY * zoom + pan.y,
      };
    },
    [pan.x, pan.y, zoom]
  );

  // Selected Items calculation
  const selectedItems = useMemo(() => {
    if (selectedIds.length > 0) {
      return actions.filter((a) => selectedIds.includes(a.id));
    }
    if (selectedId) {
      const itm = actions.find((a) => a.id === selectedId);
      return itm ? [itm] : [];
    }
    return [];
  }, [actions, selectedId, selectedIds]);

  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : null;

  // Combined Bounds for all selected items (in World Coordinates)
  const selectedBounds = useMemo(() => {
    if (selectedItems.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
    if (selectedItems.length === 1) return getActionBoundingBox(selectedItems[0]);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const item of selectedItems) {
      const b = getActionBoundingBox(item);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }

    return {
      x: minX,
      y: minY,
      w: Math.max(12, maxX - minX),
      h: Math.max(12, maxY - minY),
    };
  }, [selectedItems]);

  // Screen Position for Selection Menu & Handles
  const selectionScreenBox = useMemo(() => {
    if (selectedItems.length === 0) return null;
    const tl = worldToScreen(selectedBounds.x, selectedBounds.y);
    const w = selectedBounds.w * zoom;
    const h = selectedBounds.h * zoom;
    return {
      x: tl.x,
      y: tl.y,
      w,
      h,
      centerX: tl.x + w / 2,
      topY: tl.y,
    };
  }, [selectedItems.length, selectedBounds, worldToScreen, zoom]);

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
        updateActionText(editingText.id, trimmed);
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
        addAction(textAction);
        setSelectedId(newId);
      }
    } else if (editingText.id) {
      deleteSelectedAction();
    }
    setEditingText(null);

    requestAnimationFrame(() => {
      isCommittingText.current = false;
    });
  }, [
    editingText,
    updateActionText,
    addAction,
    setSelectedId,
    deleteSelectedAction,
  ]);

  const cancelText = useCallback(() => {
    setEditingText(null);
  }, []);

  // Focus textarea when editing starts
  useEffect(() => {
    if (editingText && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editingText]);

  // Spacebar Pan & Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Spacebar for temporary Pan
      if (e.code === "Space" && !e.repeat && !spacePressed) {
        setSpacePressed(true);
      }

      // Select All (Cmd/Ctrl + A)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAll();
        return;
      }

      // Fit to content (Shift + 1)
      if (e.key === "!" || (e.shiftKey && e.key === "1")) {
        e.preventDefault();
        fitToContent({ width: window.innerWidth, height: window.innerHeight });
        showNotice("Fitted to content");
        return;
      }

      // Minimap toggle shortcut (M key in select mode)
      if (e.key.toLowerCase() === "m" && activeTool === "select") {
        setShowMinimap((prev) => !prev);
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedItems.length > 0) {
          e.preventDefault();
          deleteSelectedAction();
        }
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setSelectedIds([]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpacePressed(false);
        isSpacePanning.current = false;
        if (!isPanning.current) {
          setIsGrabbing(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    spacePressed,
    selectedItems.length,
    activeTool,
    deleteSelectedAction,
    setSelectedId,
    setSelectedIds,
    selectAll,
    fitToContent,
    showNotice,
  ]);

  // Clipboard Paste for Images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result !== "string") return;
            const dataUrl = reader.result;
            const image = new Image();
            image.onload = () => {
              const maxWidth = 550;
              const maxHeight = 450;
              const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
              const w = Math.round(image.width * scale);
              const h = Math.round(image.height * scale);

              // Center in current screen view in World Coordinates
              const centerWorld = screenToWorld(
                window.innerWidth / 2,
                window.innerHeight / 2
              );
              const imageId = crypto.randomUUID();

              addAction({
                id: imageId,
                tool: "image",
                x: Math.round(centerWorld.x - w / 2),
                y: Math.round(centerWorld.y - h / 2),
                src: dataUrl,
                width: w,
                height: h,
                originalWidth: image.naturalWidth || image.width,
                originalHeight: image.naturalHeight || image.height,
              });

              setTool("select");
              setSelectedId(imageId);
              showNotice("Image pasted from clipboard");
            };
            image.src = dataUrl;
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [screenToWorld, addAction, setTool, setSelectedId, showNotice]);

  // ── Freehand Stroke Drawing in World Space ──
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

  // Forward ref for scheduling redraw from image onload
  const scheduleRedrawRef = useRef<() => void>(() => {});

  // ── Draw Single Action in World Coordinates ──
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
            scheduleRedrawRef.current();
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

  // ── Main Canvas Render Loop (Infinite Canvas) ──
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
    }

    // Clear whole viewport
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply DPR scale + World Viewport Camera Transform
    ctx.scale(dpr, dpr);
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw origin indicator (discreet subtle crosshair at 0, 0 world origin)
    ctx.save();
    ctx.strokeStyle = "rgba(128, 128, 128, 0.15)";
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 12);
    ctx.stroke();
    ctx.restore();

    // Render committed actions in world coordinates
    for (const action of actions) {
      if (editingText?.id && action.id === editingText.id) continue;
      drawAction(ctx, action);
    }

    // Render live marquee selection box (in world coordinates)
    if (isMarqueeSelecting.current && marqueeStart.current && marqueeCurrent.current) {
      const mx = Math.min(marqueeStart.current.x, marqueeCurrent.current.x);
      const my = Math.min(marqueeStart.current.y, marqueeCurrent.current.y);
      const mw = Math.abs(marqueeCurrent.current.x - marqueeStart.current.x);
      const mh = Math.abs(marqueeCurrent.current.y - marqueeStart.current.y);

      ctx.save();
      ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.6 / zoom;
      ctx.setLineDash([5 / zoom, 4 / zoom]);
      ctx.strokeRect(mx, my, mw, mh);
      ctx.restore();
    }

    // Render selection outline and corner resize handles (in world coordinates)
    if (selectedItems.length > 0 && (!editingText || editingText.id !== selectedId)) {
      const bounds = selectedBounds;

      ctx.save();
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.8 / zoom;
      ctx.setLineDash([5 / zoom, 4 / zoom]);
      ctx.strokeRect(
        bounds.x - 4 / zoom,
        bounds.y - 4 / zoom,
        bounds.w + 8 / zoom,
        bounds.h + 8 / zoom
      );

      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2.2 / zoom;

      const handleRadius = 5.5 / zoom;
      const handles = [
        { x: bounds.x - 4 / zoom, y: bounds.y - 4 / zoom },
        { x: bounds.x + bounds.w + 4 / zoom, y: bounds.y - 4 / zoom },
        { x: bounds.x + bounds.w + 4 / zoom, y: bounds.y + bounds.h + 4 / zoom },
        { x: bounds.x - 4 / zoom, y: bounds.y + bounds.h + 4 / zoom },
      ];

      for (const h of handles) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, handleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }, [
    actions,
    pan.x,
    pan.y,
    zoom,
    selectedItems.length,
    selectedId,
    selectedBounds,
    editingText,
    drawAction,
  ]);

  const scheduleRedraw = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      redrawCanvas();
    });
  }, [redrawCanvas]);

  useEffect(() => {
    scheduleRedrawRef.current = scheduleRedraw;
  }, [scheduleRedraw]);

  useEffect(() => {
    scheduleRedraw();
  }, [actions, pan, zoom, editingText, scheduleRedraw]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      scheduleRedraw();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(rafId.current);
    };
  }, [scheduleRedraw]);

  // Hit test for resize handles in World Coordinates
  const hitTestResizeHandle = (
    worldPoint: Point,
    bounds: { x: number; y: number; w: number; h: number }
  ): ResizeHandle | null => {
    const handleRadius = 18 / zoom; // Screen-invariant hit radius
    const corners: { handle: ResizeHandle; x: number; y: number }[] = [
      { handle: "nw", x: bounds.x - 4 / zoom, y: bounds.y - 4 / zoom },
      { handle: "ne", x: bounds.x + bounds.w + 4 / zoom, y: bounds.y - 4 / zoom },
      { handle: "se", x: bounds.x + bounds.w + 4 / zoom, y: bounds.y + bounds.h + 4 / zoom },
      { handle: "sw", x: bounds.x - 4 / zoom, y: bounds.y + bounds.h + 4 / zoom },
    ];

    for (const c of corners) {
      if (Math.hypot(worldPoint.x - c.x, worldPoint.y - c.y) <= handleRadius) {
        return c.handle;
      }
    }
    return null;
  };

  // Hit test for item in World Coordinates
  const hitTestItem = (worldPoint: Point): DrawAction | null => {
    for (let i = actions.length - 1; i >= 0; i--) {
      const item = actions[i];
      const bounds = getActionBoundingBox(item);
      if (
        worldPoint.x >= bounds.x &&
        worldPoint.x <= bounds.x + bounds.w &&
        worldPoint.y >= bounds.y &&
        worldPoint.y <= bounds.y + bounds.h
      ) {
        if (item.tool === "pen" || item.tool === "highlighter" || item.tool === "eraser") {
          const strk = item as Stroke;
          const maxDistSq = Math.max(10, strk.width * 2 + 10) ** 2;
          for (let j = 0; j < strk.points.length - 1; j++) {
            if (distToSegmentSquared(worldPoint, strk.points[j], strk.points[j + 1]) <= maxDistSq) {
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

  // Wheel Zoom & Infinite Pan Navigation
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom into pointer anchor using fresh store state
      const zoomFactor = Math.exp(-e.deltaY * 0.003);
      zoomByFactor(zoomFactor, { x: e.clientX, y: e.clientY });
      return;
    }

    // Natural 2-finger Pan across infinite plane
    setPan((prev) => ({
      x: Math.round(prev.x - e.deltaX),
      y: Math.round(prev.y - e.deltaY),
    }));
  };

  // Pointer Down Handler
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingText) {
      commitText();
    }

    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-Finger Gesture (Pinch Zoom & Hand Pan at finger centroid)
    if (activePointers.current.size === 2) {
      isDrawing.current = false;
      currentPoints.current = [];
      isDraggingItem.current = false;
      isResizing.current = false;
      isMarqueeSelecting.current = false;
      isMagicErasing.current = false;
      magicErasedIds.current.clear();
      isGestureActive.current = true;
      isGestureZooming.current = true;
      isPanning.current = false;
      setIsGrabbing(true);
      redrawCanvas();

      const pts = Array.from(activePointers.current.values());
      const mid = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      initialPinchDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchMid.current = mid;
      initialPinchZoom.current = useWhiteboardStore.getState().zoom;
      initialPinchPan.current = { ...useWhiteboardStore.getState().pan };
      return;
    }

    const worldPoint: Point = {
      ...screenToWorld(e.clientX, e.clientY),
      pressure: e.pointerType === "mouse" ? 0.5 : e.pressure > 0 ? e.pressure : 0.5,
    };

    // PAN MODE (Tool is Pan, Spacebar is pressed, or Middle Mouse button)
    if (activeTool === "pan" || spacePressed || e.button === 1) {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isPanning.current = true;
      isSpacePanning.current = spacePressed;
      setIsGrabbing(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panInitial.current = { ...useWhiteboardStore.getState().pan };
      return;
    }

    // SELECT TOOL
    if (activeTool === "select") {
      // 1. Check if clicking on active resize handle
      if (selectedItems.length > 0) {
        const handle = hitTestResizeHandle(worldPoint, selectedBounds);
        if (handle) {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          isResizing.current = true;
          activeResizeHandle.current = handle;
          resizeStartBounds.current = selectedBounds;
          resizeStartPoint.current = worldPoint;
          return;
        }
      }

      // 2. Check if clicking on any drawn item or stroke
      const hit = hitTestItem(worldPoint);
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

        // Keep multi-selection or select single
        if (!selectedIds.includes(hit.id)) {
          setSelectedId(hit.id);
        }

        isDraggingItem.current = true;
        dragStartPoint.current = worldPoint;

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
          const b = getActionBoundingBox(item);
          return { id: item.id, startX: b.x, startY: b.y };
        });
        return;
      }

      // 3. Clicked empty canvas: start drag marquee selection in world coordinates
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isMarqueeSelecting.current = true;
      marqueeStart.current = worldPoint;
      marqueeCurrent.current = worldPoint;
      setSelectedId(null);
      setSelectedIds([]);
      return;
    }

    // MAGIC ERASER (Delete whole object on touch / drag)
    if (activeTool === "magic-eraser") {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isMagicErasing.current = true;
      magicErasedIds.current = new Set();
      const hit = hitTestItem(worldPoint);
      if (hit) {
        magicErasedIds.current.add(hit.id);
        deleteActions([hit.id]);
      }
      return;
    }

    // TEXT TOOL
    if (activeTool === "text") {
      const hit = hitTestItem(worldPoint);
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
          x: worldPoint.x,
          y: worldPoint.y,
        });
      }
      isDrawing.current = false;
      return;
    }

    // DRAWING TOOLS (Pen, Highlighter, Pixel Eraser, Shapes)
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    isDrawing.current = true;

    if (
      activeTool === "pen" ||
      activeTool === "eraser" ||
      activeTool === "highlighter"
    ) {
      currentPoints.current = [worldPoint];
    } else if (
      activeTool === "rectangle" ||
      activeTool === "circle" ||
      activeTool === "line" ||
      activeTool === "arrow"
    ) {
      shapeStart.current = { x: worldPoint.x, y: worldPoint.y };
    }
  };

  // Pointer Move Handler
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const canvas = canvasRef.current;

    const worldPoint: Point = {
      ...screenToWorld(e.clientX, e.clientY),
      pressure: e.pointerType === "mouse" ? 0.5 : e.pressure > 0 ? e.pressure : 0.5,
    };

    // Dynamic Cursor on Hover in Select Mode
    if (
      activeTool === "select" &&
      !isDraggingItem.current &&
      !isResizing.current &&
      !isPanning.current &&
      !isMarqueeSelecting.current &&
      !spacePressed &&
      canvas
    ) {
      if (selectedItems.length > 0) {
        const handle = hitTestResizeHandle(worldPoint, selectedBounds);
        if (handle === "nw" || handle === "se") {
          canvas.style.cursor = "nwse-resize";
        } else if (handle === "ne" || handle === "sw") {
          canvas.style.cursor = "nesw-resize";
        } else if (hitTestItem(worldPoint)) {
          canvas.style.cursor = "move";
        } else {
          canvas.style.cursor = "default";
        }
      } else if (hitTestItem(worldPoint)) {
        canvas.style.cursor = "pointer";
      } else {
        canvas.style.cursor = "crosshair";
      }
    }

    // If a multi-touch gesture was active, ignore any single-pointer moves until all fingers lift
    if (isGestureActive.current && activePointers.current.size < 2) {
      e.preventDefault();
      return;
    }

    // Two-Finger Pinch Zoom & Pan at finger centroid
    if (
      activePointers.current.size === 2 &&
      initialPinchDist.current &&
      initialPinchDist.current > 5 &&
      initialPinchMid.current
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
        Math.max(Number((initialPinchZoom.current * factor).toFixed(3)), 0.1),
        5.0
      );

      // Pivot around initial mid
      const k = targetZoom / initialPinchZoom.current;
      const newPanX = currentMid.x - (initialPinchMid.current.x - initialPinchPan.current.x) * k;
      const newPanY = currentMid.y - (initialPinchMid.current.y - initialPinchPan.current.y) * k;

      setViewport({ x: Math.round(newPanX), y: Math.round(newPanY) }, targetZoom);
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

    // Magic Eraser drag deleting
    if (isMagicErasing.current) {
      e.preventDefault();
      const hit = hitTestItem(worldPoint);
      if (hit && !magicErasedIds.current.has(hit.id)) {
        magicErasedIds.current.add(hit.id);
        deleteActions([hit.id]);
      }
      return;
    }

    // Live Marquee Selection Drag
    if (isMarqueeSelecting.current && marqueeStart.current) {
      e.preventDefault();
      marqueeCurrent.current = worldPoint;
      scheduleRedraw();
      return;
    }

    // Resizing Item(s) via Corner Handle
    if (isResizing.current && activeResizeHandle.current && selectedItem) {
      e.preventDefault();
      const handle = activeResizeHandle.current;
      const b = resizeStartBounds.current;
      const dx = worldPoint.x - resizeStartPoint.current.x;
      const dy = worldPoint.y - resizeStartPoint.current.y;

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
        selectedItem.id,
        Math.round(newX),
        Math.round(newY),
        Math.round(newW),
        Math.round(newH)
      );
      return;
    }

    // Drag Moving Selected Item(s)
    if (isDraggingItem.current && dragItemsStartPositions.current.length > 0) {
      e.preventDefault();
      const dx = worldPoint.x - dragStartPoint.current.x;
      const dy = worldPoint.y - dragStartPoint.current.y;

      for (const itemPos of dragItemsStartPositions.current) {
        updateActionPosition(
          itemPos.id,
          Math.round(itemPos.startX + dx),
          Math.round(itemPos.startY + dy)
        );
      }
      return;
    }

    if (!isDrawing.current || !canvas) return;
    e.preventDefault();

    if (
      activeTool === "pen" ||
      activeTool === "eraser" ||
      activeTool === "highlighter"
    ) {
      const coalesced =
        (e.nativeEvent as PointerEvent).getCoalescedEvents?.() || [];

      if (coalesced.length > 0) {
        for (const ce of coalesced) {
          const wp = screenToWorld(ce.clientX, ce.clientY);
          currentPoints.current.push({
            x: wp.x,
            y: wp.y,
            pressure: e.pointerType === "mouse" ? 0.5 : ce.pressure > 0 ? ce.pressure : 0.5,
          });
        }
      } else {
        currentPoints.current.push(worldPoint);
      }

      // Redraw scene + live stroke preview
      redrawCanvas();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

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
      redrawCanvas();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      drawShape(ctx, {
        id: "preview",
        tool: activeTool,
        startX: shapeStart.current.x,
        startY: shapeStart.current.y,
        endX: worldPoint.x,
        endY: worldPoint.y,
        color: strokeColor,
        width: strokeWidth,
      });
      ctx.restore();
    }
  };

  // Pointer Up Handler
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.delete(e.pointerId);

    // If a multi-finger gesture was active, cleanly reset gesture state and prevent single-pointer jump
    if (isGestureActive.current) {
      initialPinchDist.current = null;
      initialPinchMid.current = null;
      isGestureZooming.current = false;
      isPanning.current = false;
      if (activePointers.current.size === 0) {
        isGestureActive.current = false;
        setIsGrabbing(false);
      }
      return;
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

    // Finish Marquee Box Selection
    if (isMarqueeSelecting.current && marqueeStart.current && marqueeCurrent.current) {
      isMarqueeSelecting.current = false;
      const mx = Math.min(marqueeStart.current.x, marqueeCurrent.current.x);
      const my = Math.min(marqueeStart.current.y, marqueeCurrent.current.y);
      const mw = Math.abs(marqueeCurrent.current.x - marqueeStart.current.x);
      const mh = Math.abs(marqueeCurrent.current.y - marqueeStart.current.y);

      if (mw > 4 / zoom || mh > 4 / zoom) {
        const captured: DrawAction[] = [];
        for (const item of actions) {
          const b = getActionBoundingBox(item);
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
          setSelectedIds([]);
        }
      } else {
        setSelectedId(null);
        setSelectedIds([]);
      }

      marqueeStart.current = null;
      marqueeCurrent.current = null;
      scheduleRedraw();
      return;
    }

    if (isMagicErasing.current) {
      isMagicErasing.current = false;
      magicErasedIds.current.clear();
      return;
    }

    if (isPanning.current) {
      isPanning.current = false;
      setIsGrabbing(false);
      return;
    }

    if (!isDrawing.current) return;
    isDrawing.current = false;

    const worldPoint: Point = {
      ...screenToWorld(e.clientX, e.clientY),
      pressure: e.pointerType === "mouse" ? 0.5 : e.pressure > 0 ? e.pressure : 0.5,
    };

    if (activeTool === "pen" || activeTool === "highlighter") {
      currentPoints.current.push(worldPoint);
      if (currentPoints.current.length >= 2) {
        const stroke: Stroke = {
          id: crypto.randomUUID(),
          tool: activeTool,
          points: [...currentPoints.current],
          color: strokeColor,
          width: strokeWidth,
          opacity: activeTool === "highlighter" ? 0.35 : 1,
        };
        addAction(stroke);
      }
    } else if (activeTool === "eraser") {
      currentPoints.current.push(worldPoint);
      if (currentPoints.current.length >= 2) {
        const stroke: Stroke = {
          id: crypto.randomUUID(),
          tool: "eraser",
          points: [...currentPoints.current],
          color: "#ffffff",
          width: strokeWidth,
          opacity: 1,
        };
        addAction(stroke);
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
        endX: worldPoint.x,
        endY: worldPoint.y,
        color: strokeColor,
        width: strokeWidth,
      };
      addAction(shape);
      shapeStart.current = null;
    }

    currentPoints.current = [];
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.delete(e.pointerId);
    initialPinchDist.current = null;
    initialPinchMid.current = null;
    isGestureActive.current = false;
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
    scheduleRedraw();
  };

  // Base cursor calculation
  const canvasCursor = useMemo(() => {
    if (spacePressed || activeTool === "pan") return isGrabbing ? "grabbing" : "grab";
    if (activeTool === "select") return "default";
    if (activeTool === "text") return "text";
    if (activeTool === "eraser" || activeTool === "magic-eraser") return "cell";
    return "crosshair";
  }, [activeTool, spacePressed, isGrabbing]);

  // Screen Coordinates for Inline Text Editor
  const editingTextScreenPos = useMemo(() => {
    if (!editingText) return null;
    return worldToScreen(editingText.x, editingText.y);
  }, [editingText, worldToScreen]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none bg-[var(--wb-bg)]"
    >
      {/* ── Main Infinite Canvas with Hardware Grid Background ── */}
      <canvas
        ref={canvasRef}
        className="canvas-grid-bg absolute inset-0 w-full h-full"
        style={{
          touchAction: "none",
          cursor: canvasCursor,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {/* ── Interactive Minimap (Opened strictly by user command from button) ── */}
      <Minimap visible={showMinimap} onClose={() => setShowMinimap(false)} />

      {/* ── Inline Text Editor Overlay (Positioned in Screen Space) ── */}
      {editingText && editingTextScreenPos && (
        <div
          className="absolute z-30 pointer-events-auto"
          style={{
            left: `${editingTextScreenPos.x}px`,
            top: `${editingTextScreenPos.y}px`,
            transform: `scale(${zoom})`,
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

      {/* ── Contextual Floating Menu above Selected Item(s) ── */}
      {selectedItems.length > 0 && activeTool === "select" && !editingText && selectionScreenBox && (
        <div
          className="wb-tooltip absolute"
          style={{
            left: `${selectionScreenBox.centerX}px`,
            top: `${Math.max(45, selectionScreenBox.topY - 10)}px`,
            transform: `translate(-50%, -100%)`,
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
            onClick={deleteSelectedAction}
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
                onClick={() => bringForward(selectedItem.id)}
              >
                <BringToFront />
              </button>
              <button
                type="button"
                className="wb-tool"
                title="Send backward"
                aria-label="Send backward"
                onClick={() => sendBackward(selectedItem.id)}
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
            title="Deselect (Esc)"
            aria-label="Deselect"
            onClick={() => {
              setSelectedId(null);
              setSelectedIds([]);
            }}
          >
            <X />
          </button>
        </div>
      )}

      {/* ── Bottom-Right Infinite Canvas Navigation Bar (Quick Fit, Center & Minimap Toggle) ── */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 p-1.5 rounded-xl bg-[var(--wb-panel)] border border-[var(--wb-border)] shadow-md backdrop-blur-md">
        <button
          type="button"
          title={showMinimap ? "Hide minimap (M)" : "Show minimap (M)"}
          aria-label={showMinimap ? "Hide minimap" : "Show minimap"}
          aria-pressed={showMinimap}
          className={`wb-tool ${showMinimap ? "wb-active" : ""}`}
          onClick={() => setShowMinimap((prev) => !prev)}
        >
          <MapIcon />
        </button>
        <button
          type="button"
          title="Fit to content (Shift + 1)"
          aria-label="Fit to content"
          className="wb-tool"
          onClick={() => {
            fitToContent({ width: window.innerWidth, height: window.innerHeight });
            showNotice("Fitted to content");
          }}
        >
          <Maximize2 />
        </button>
        <button
          type="button"
          title="Reset view (0)"
          aria-label="Reset view"
          className="wb-tool"
          onClick={() => {
            resetZoom({ width: window.innerWidth, height: window.innerHeight });
            showNotice("View centered at 100%");
          }}
        >
          <Compass />
        </button>
      </div>
    </div>
  );
}
