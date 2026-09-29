"use client";

import { useRef, useEffect, useCallback } from "react";
import { getStroke } from "perfect-freehand";
import {
  useWhiteboardStore,
  type Point,
  type Stroke,
  type ShapeStroke,
  type TextElement,
  type DrawAction,
} from "@/store/whiteboard-store";

// ── Constants ──
export const PAGE_WIDTH = 768;
export const PAGE_HEIGHT = 1024;

interface CanvasPageProps {
  pageIndex: number;
}

export function CanvasPage({ pageIndex }: CanvasPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const currentPoints = useRef<Point[]>([]);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);

  const activeTool = useWhiteboardStore((s) => s.activeTool);
  const strokeColor = useWhiteboardStore((s) => s.strokeColor);
  const strokeWidth = useWhiteboardStore((s) => s.strokeWidth);
  const pageActions = useWhiteboardStore((s) => s.pages[pageIndex]?.actions ?? []);
  const addAction = useWhiteboardStore((s) => s.addAction);

  // ── Draw a single freehand stroke using perfect-freehand ──
  const drawFreehandStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.points.length < 2) return;

      const outlinePoints = getStroke(
        stroke.points.map((p) => [p.x, p.y, p.pressure]),
        {
          size: stroke.width * 2,
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
      ctx.lineWidth = stroke.width * 4;
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
      ctx.lineWidth = shape.width;
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

    // Set up for Retina/HiDPI
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    const needsResize =
      canvas.width !== Math.floor(displayWidth * dpr) ||
      canvas.height !== Math.floor(displayHeight * dpr);

    if (needsResize) {
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
      ctx.scale(dpr, dpr);
    }

    // Clear to white
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Scale context to map logical coords to display
    ctx.save();
    const scaleX = displayWidth / PAGE_WIDTH;
    const scaleY = displayHeight / PAGE_HEIGHT;
    ctx.scale(scaleX, scaleY);

    // Replay all actions
    for (const action of pageActions) {
      drawAction(ctx, action);
    }

    ctx.restore();
  }, [pageActions, drawAction]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // ── Pointer coordinate helpers ──
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * PAGE_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * PAGE_HEIGHT,
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
        fontSize: Math.max(strokeWidth * 6, 16),
      };
      addAction(pageIndex, textAction);
    }
  };

  // ── Pointer handlers ──
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Only draw with pen/mouse — let finger events pass through for scroll
    if (e.pointerType === "touch") return;

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
    if (!isDrawing.current) return;
    if (e.pointerType === "touch") return;
    e.preventDefault();

    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();

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
            x: ((ce.clientX - rect.left) / rect.width) * PAGE_WIDTH,
            y: ((ce.clientY - rect.top) / rect.height) * PAGE_HEIGHT,
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
      const scaleX = canvas.clientWidth / PAGE_WIDTH;
      const scaleY = canvas.clientHeight / PAGE_HEIGHT;
      ctx.scale(scaleX * dpr, scaleY * dpr);

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
      const scaleX = canvas.clientWidth / PAGE_WIDTH;
      const scaleY = canvas.clientHeight / PAGE_HEIGHT;
      ctx.scale(scaleX * dpr, scaleY * dpr);
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
    if (!isDrawing.current) return;
    if (e.pointerType === "touch") return;
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

  const handlePointerCancel = () => {
    // iPadOS system gestures trigger pointercancel — clean up gracefully
    isDrawing.current = false;
    currentPoints.current = [];
    shapeStart.current = null;
    redrawCanvas();
  };

  return (
    <div className="canvas-page flex justify-center py-3 first:pt-20">
      <canvas
        ref={canvasRef}
        className="rounded-lg bg-white shadow-lg"
        style={{
          width: "min(calc(100vw - 48px), 768px)",
          aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}`,
          touchAction: "none",
          cursor:
            activeTool === "text"
              ? "text"
              : activeTool === "eraser"
              ? "cell"
              : "crosshair",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
    </div>
  );
}
