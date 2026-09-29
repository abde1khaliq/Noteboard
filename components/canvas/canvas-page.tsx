"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { getStroke } from "perfect-freehand";
import {
  useWhiteboardStore,
  type Point,
  type Stroke,
  type ShapeStroke,
  type TextElement,
  type DrawAction,
} from "@/store/whiteboard-store";

interface CanvasPageProps {
  pageIndex: number;
}

export function CanvasPage({ pageIndex }: CanvasPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialScroll = useRef<{ top: number; left: number }>({ top: 0, left: 0 });
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchZoom = useRef<number>(1);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  const currentPoints = useRef<Point[]>([]);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);

  const activeTool = useWhiteboardStore((s) => s.activeTool);
  const strokeColor = useWhiteboardStore((s) => s.strokeColor);
  const strokeWidth = useWhiteboardStore((s) => s.strokeWidth);
  const drawWithTouch = useWhiteboardStore((s) => s.drawWithTouch);
  const zoom = useWhiteboardStore((s) => s.zoom);
  const setZoom = useWhiteboardStore((s) => s.setZoom);
  const pageActions = useWhiteboardStore((s) => s.pages[pageIndex]?.actions ?? []);
  const addAction = useWhiteboardStore((s) => s.addAction);

  // ── Draw a single freehand stroke using perfect-freehand ──
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
      ctx.globalAlpha = stroke.opacity;
      if (stroke.tool === "highlighter") {
        ctx.globalCompositeOperation = "multiply";
      }
      ctx.fillStyle = stroke.color;
      ctx.beginPath();

      const [first, ...rest] = outlinePoints;
      if (!first) { ctx.restore(); return; }
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

  // ── Draw eraser stroke ──
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

  // ── Draw shape ──
  const drawShape = useCallback(
    (ctx: CanvasRenderingContext2D, shape: ShapeStroke) => {
      ctx.save();
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.width * 1.5;
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
      }

      ctx.restore();
    },
    []
  );

  // ── Draw text ──
  const drawText = useCallback(
    (ctx: CanvasRenderingContext2D, text: TextElement) => {
      ctx.save();
      ctx.fillStyle = text.color;
      ctx.font = `${text.fontSize}px var(--font-geist-sans), system-ui, sans-serif`;
      ctx.fillText(text.text, text.x, text.y);
      ctx.restore();
    },
    []
  );

  // ── Draw a single action ──
  const drawAction = useCallback(
    (ctx: CanvasRenderingContext2D, action: DrawAction) => {
      if (
        action.tool === "pen" ||
        action.tool === "highlighter"
      ) {
        drawFreehandStroke(ctx, action as Stroke);
      } else if (action.tool === "eraser") {
        drawEraserStroke(ctx, action as Stroke);
      } else if (
        action.tool === "rectangle" ||
        action.tool === "circle" ||
        action.tool === "line"
      ) {
        drawShape(ctx, action as ShapeStroke);
      } else if (action.tool === "text") {
        drawText(ctx, action as TextElement);
      }
    },
    [drawFreehandStroke, drawEraserStroke, drawShape, drawText]
  );

  // ── Redraw all actions ──
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (displayWidth === 0 || displayHeight === 0) return;

    if (
      canvas.width !== Math.floor(displayWidth * dpr) ||
      canvas.height !== Math.floor(displayHeight * dpr)
    ) {
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
    }

    // Clear canvas (transparent to reveal visible grid background)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Scale to HiDPI Retina
    ctx.save();
    ctx.scale(dpr, dpr);

    // Replay all actions
    for (const action of pageActions) {
      drawAction(ctx, action);
    }

    ctx.restore();
  }, [pageActions, drawAction]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Window resize handler for orientation change / screen resize
  useEffect(() => {
    const handleResize = () => redrawCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [redrawCanvas]);

  // ── Pointer coordinate helpers (scaled by current zoom) ──
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.clientWidth / (rect.width || 1);
    const scaleY = canvas.clientHeight / (rect.height || 1);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure || 0.5,
    };
  };

  // ── Text input ──
  const handleTextInput = (point: Point) => {
    const text = prompt("Enter text:");
    if (text) {
      const textAction: TextElement = {
        id: crypto.randomUUID(),
        tool: "text",
        x: point.x,
        y: point.y,
        text,
        color: strokeColor,
        fontSize: Math.max(strokeWidth * 6, 18),
      };
      addAction(pageIndex, textAction);
    }
  };

  // ── Wheel Zoom & Scroll Handling ──
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (activeTool === "select" || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomDelta = -e.deltaY * 0.0015;
      setZoom(zoom + zoomDelta);
    }
  };

  // ── Pointer handlers ──
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Handle Pinch Zoom gesture (2 fingers)
    if (activePointers.current.size === 2) {
      isDrawing.current = false;
      isPanning.current = false;
      const pts = Array.from(activePointers.current.values());
      initialPinchDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchZoom.current = zoom;
      return;
    }

    // ── SELECT TOOL: Pan & Scroll Canvas ──
    if (activeTool === "select") {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isPanning.current = true;
      setIsGrabbing(true);
      dragStart.current = { x: e.clientX, y: e.clientY };

      const scrollContainer = document.querySelector(".whiteboard-scroll") as HTMLElement;
      if (scrollContainer) {
        initialScroll.current = {
          top: scrollContainer.scrollTop,
          left: scrollContainer.scrollLeft,
        };
      }
      return;
    }

    // If touch drawing is disabled, let finger events pass through for scroll
    if (e.pointerType === "touch" && !drawWithTouch) return;

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
      activeTool === "line"
    ) {
      shapeStart.current = { x: point.x, y: point.y };
    } else if (activeTool === "text") {
      handleTextInput(point);
      isDrawing.current = false;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Handle Pinch Zoom
    if (activePointers.current.size === 2 && initialPinchDist.current) {
      const pts = Array.from(activePointers.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (initialPinchDist.current > 0) {
        const factor = currentDist / initialPinchDist.current;
        setZoom(initialPinchZoom.current * factor);
      }
      return;
    }

    // ── SELECT TOOL: Drag to Pan / Scroll ──
    if (activeTool === "select" && isPanning.current) {
      e.preventDefault();
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      const scrollContainer = document.querySelector(".whiteboard-scroll") as HTMLElement;
      if (scrollContainer) {
        scrollContainer.scrollTop = initialScroll.current.top - dy;
        scrollContainer.scrollLeft = initialScroll.current.left - dx;
      }
      return;
    }

    if (!isDrawing.current) return;
    if (e.pointerType === "touch" && !drawWithTouch) return;
    e.preventDefault();

    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.clientWidth / (rect.width || 1);
    const scaleY = canvas.clientHeight / (rect.height || 1);

    if (
      activeTool === "pen" ||
      activeTool === "eraser" ||
      activeTool === "highlighter"
    ) {
      // Collect coalesced events for smoother lines
      const coalesced =
        (e.nativeEvent as PointerEvent).getCoalescedEvents?.() || [];

      if (coalesced.length > 0) {
        for (const ce of coalesced) {
          currentPoints.current.push({
            x: (ce.clientX - rect.left) * scaleX,
            y: (ce.clientY - rect.top) * scaleY,
            pressure: ce.pressure || 0.5,
          });
        }
      } else {
        currentPoints.current.push(getCanvasPoint(e));
      }

      // Draw live preview
      redrawCanvas();
      const ctx = canvas.getContext("2d")!;
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
          opacity: activeTool === "highlighter" ? 0.4 : 1,
        });
      }
      ctx.restore();
    } else if (
      (activeTool === "rectangle" ||
        activeTool === "circle" ||
        activeTool === "line") &&
      shapeStart.current
    ) {
      const point = getCanvasPoint(e);
      // Preview shape
      redrawCanvas();
      const ctx = canvas.getContext("2d")!;
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

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointers.current.delete(e.pointerId);

    if (activePointers.current.size < 2) {
      initialPinchDist.current = null;
    }

    if (activeTool === "select") {
      isPanning.current = false;
      setIsGrabbing(false);
      return;
    }

    if (!isDrawing.current) return;
    if (e.pointerType === "touch" && !drawWithTouch) return;
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
          opacity: activeTool === "highlighter" ? 0.4 : 1,
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
        activeTool === "line") &&
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
    isPanning.current = false;
    setIsGrabbing(false);
    isDrawing.current = false;
    currentPoints.current = [];
    shapeStart.current = null;
    redrawCanvas();
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      {/* Discreet page number badge */}
      <div className="absolute top-3 left-4 z-10 px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 backdrop-blur-sm text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 pointer-events-none">
        Page {pageIndex + 1}
      </div>

      <canvas
        ref={canvasRef}
        className="canvas-grid-bg w-full h-full rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          transition: isPanning.current ? "none" : "transform 0.15s ease-out",
          touchAction: "none",
          cursor:
            activeTool === "select"
              ? isGrabbing
                ? "grabbing"
                : "grab"
              : activeTool === "text"
              ? "text"
              : activeTool === "eraser"
              ? "cell"
              : "crosshair",
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
    </div>
  );
}
