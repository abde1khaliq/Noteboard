"use client";

import React, { useRef, useEffect, useCallback, useMemo } from "react";
import {
  useWhiteboardStore,
  type Stroke,
  type ShapeStroke,
  type TextElement,
  type ImageElement,
  getActionBoundingBox,
} from "@/store/whiteboard-store";

interface MinimapProps {
  visible: boolean;
}

const MAP_WIDTH = 200;
const MAP_HEIGHT = 135;

export function Minimap({ visible }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingMap = useRef(false);

  const actions = useWhiteboardStore((s) => s.actions);
  const pan = useWhiteboardStore((s) => s.pan);
  const zoom = useWhiteboardStore((s) => s.zoom);
  const setPan = useWhiteboardStore((s) => s.setPan);

  // Compute total world bounding box containing both drawn actions AND current viewport
  const mapTransform = useMemo(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    const viewportWorldX = -pan.x / zoom;
    const viewportWorldY = -pan.y / zoom;
    const viewportWorldW = vw / zoom;
    const viewportWorldH = vh / zoom;

    let minX = viewportWorldX;
    let minY = viewportWorldY;
    let maxX = viewportWorldX + viewportWorldW;
    let maxY = viewportWorldY + viewportWorldH;

    for (const action of actions) {
      const b = getActionBoundingBox(action);
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }

    // Add 15% breathing room margin
    const rawW = Math.max(100, maxX - minX);
    const rawH = Math.max(100, maxY - minY);
    const padX = rawW * 0.15;
    const padY = rawH * 0.15;

    const totalMinX = minX - padX;
    const totalMinY = minY - padY;
    const totalW = rawW + padX * 2;
    const totalH = rawH + padY * 2;

    const scale = Math.min(MAP_WIDTH / totalW, MAP_HEIGHT / totalH);

    // Center content within the minimap
    const offsetX = (MAP_WIDTH - totalW * scale) / 2;
    const offsetY = (MAP_HEIGHT - totalH * scale) / 2;

    return {
      totalMinX,
      totalMinY,
      totalW,
      totalH,
      scale,
      offsetX,
      offsetY,
      viewportWorldX,
      viewportWorldY,
      viewportWorldW,
      viewportWorldH,
      vw,
      vh,
    };
  }, [actions, pan.x, pan.y, zoom]);

  // World to Minimap Screen mapping
  const worldToMap = useCallback(
    (wx: number, wy: number) => {
      return {
        x: (wx - mapTransform.totalMinX) * mapTransform.scale + mapTransform.offsetX,
        y: (wy - mapTransform.totalMinY) * mapTransform.scale + mapTransform.offsetY,
      };
    },
    [mapTransform]
  );

  // Minimap Screen to World mapping
  const mapToWorld = useCallback(
    (mx: number, my: number) => {
      return {
        x: (mx - mapTransform.offsetX) / mapTransform.scale + mapTransform.totalMinX,
        y: (my - mapTransform.offsetY) / mapTransform.scale + mapTransform.totalMinY,
      };
    },
    [mapTransform]
  );

  // Redraw Minimap Canvas
  const redrawMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    if (canvas.width !== MAP_WIDTH * dpr || canvas.height !== MAP_HEIGHT * dpr) {
      canvas.width = MAP_WIDTH * dpr;
      canvas.height = MAP_HEIGHT * dpr;
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // Subtle background grid inside minimap
    ctx.strokeStyle = "rgba(128, 128, 128, 0.08)";
    ctx.lineWidth = 1;
    const gridStep = 18;
    for (let x = 0; x <= MAP_WIDTH; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, MAP_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= MAP_HEIGHT; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(MAP_WIDTH, y);
      ctx.stroke();
    }

    // Render all elements in miniature
    for (const item of actions) {
      if (item.tool === "pen" || item.tool === "highlighter" || item.tool === "eraser") {
        const stroke = item as Stroke;
        if (stroke.points.length < 2) continue;
        ctx.save();
        ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(180, 180, 180, 0.4)" : stroke.color;
        ctx.lineWidth = Math.max(1, stroke.width * mapTransform.scale * 0.8);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = stroke.tool === "highlighter" ? 0.4 : stroke.tool === "eraser" ? 0.4 : 0.85;

        ctx.beginPath();
        const p0 = worldToMap(stroke.points[0].x, stroke.points[0].y);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < stroke.points.length; i++) {
          const pt = worldToMap(stroke.points[i].x, stroke.points[i].y);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.restore();
      } else if (
        item.tool === "rectangle" ||
        item.tool === "circle" ||
        item.tool === "line" ||
        item.tool === "arrow"
      ) {
        const shape = item as ShapeStroke;
        const p1 = worldToMap(shape.startX, shape.startY);
        const p2 = worldToMap(shape.endX, shape.endY);

        ctx.save();
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = Math.max(1, shape.width * mapTransform.scale * 0.8);
        ctx.globalAlpha = 0.85;

        if (shape.tool === "rectangle") {
          ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        } else if (shape.tool === "circle") {
          const rx = Math.abs(p2.x - p1.x) / 2;
          const ry = Math.abs(p2.y - p1.y) / 2;
          const cx = p1.x + (p2.x - p1.x) / 2;
          const cy = p1.y + (p2.y - p1.y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        ctx.restore();
      } else if (item.tool === "text") {
        const txt = item as TextElement;
        const p = worldToMap(txt.x, txt.y);
        const b = getActionBoundingBox(txt);
        const w = Math.max(6, b.w * mapTransform.scale);
        const h = Math.max(3, b.h * mapTransform.scale);

        ctx.save();
        ctx.fillStyle = txt.color;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(p.x, p.y, w, h);
        ctx.restore();
      } else if (item.tool === "image") {
        const img = item as ImageElement;
        const p = worldToMap(img.x, img.y);
        const w = Math.max(6, img.width * mapTransform.scale);
        const h = Math.max(6, img.height * mapTransform.scale);

        ctx.save();
        ctx.fillStyle = "rgba(59, 130, 246, 0.25)";
        ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
        ctx.lineWidth = 1;
        ctx.fillRect(p.x, p.y, w, h);
        ctx.strokeRect(p.x, p.y, w, h);
        ctx.restore();
      }
    }

    // Render Current Viewport Indicator Box
    const vpTL = worldToMap(
      mapTransform.viewportWorldX,
      mapTransform.viewportWorldY
    );
    const vpW = mapTransform.viewportWorldW * mapTransform.scale;
    const vpH = mapTransform.viewportWorldH * mapTransform.scale;

    ctx.save();
    // Soft illuminated fill
    ctx.fillStyle = "rgba(59, 130, 246, 0.16)";
    ctx.fillRect(vpTL.x, vpTL.y, vpW, vpH);

    // Glowing outline
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.6;
    ctx.strokeRect(vpTL.x, vpTL.y, vpW, vpH);

    // Corner crosshairs on viewport box
    const cornerSize = 4;
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(vpTL.x, vpTL.y + cornerSize);
    ctx.lineTo(vpTL.x, vpTL.y);
    ctx.lineTo(vpTL.x + cornerSize, vpTL.y);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(vpTL.x + vpW - cornerSize, vpTL.y);
    ctx.lineTo(vpTL.x + vpW, vpTL.y);
    ctx.lineTo(vpTL.x + vpW, vpTL.y + cornerSize);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(vpTL.x + vpW, vpTL.y + vpH - cornerSize);
    ctx.lineTo(vpTL.x + vpW, vpTL.y + vpH);
    ctx.lineTo(vpTL.x + vpW - cornerSize, vpTL.y + vpH);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(vpTL.x + cornerSize, vpTL.y + vpH);
    ctx.lineTo(vpTL.x, vpTL.y + vpH);
    ctx.lineTo(vpTL.x, vpTL.y + vpH - cornerSize);
    ctx.stroke();

    ctx.restore();

    ctx.restore();
  }, [actions, mapTransform, worldToMap]);

  useEffect(() => {
    redrawMinimap();
  }, [redrawMinimap]);

  // Navigate to clicked point on minimap
  const handleMapPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingMap.current = true;

    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const world = mapToWorld(mx, my);
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    setPan({
      x: Math.round(vw / 2 - world.x * zoom),
      y: Math.round(vh / 2 - world.y * zoom),
    });
  };

  const handleMapPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingMap.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const world = mapToWorld(mx, my);
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    setPan({
      x: Math.round(vw / 2 - world.x * zoom),
      y: Math.round(vh / 2 - world.y * zoom),
    });
  };

  const handleMapPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingMap.current = false;
    e.stopPropagation();
  };

  return (
    <div
      className="absolute bottom-16 right-4 z-30 transition-all duration-300 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translateY(0) scale(1)"
          : "translateY(12px) scale(0.92)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div className="wb-panel p-2 rounded-2xl shadow-xl flex flex-col gap-1.5 backdrop-blur-xl bg-[var(--wb-panel)] border border-[var(--wb-border)] overflow-hidden">
        <div className="flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--wb-muted)] select-none">
          <span>Minimap</span>
          <span className="text-[9px] font-medium opacity-70">
            {actions.length} {actions.length === 1 ? "item" : "items"}
          </span>
        </div>

        <div className="relative rounded-xl overflow-hidden border border-black/5 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03]">
          <canvas
            ref={canvasRef}
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            className="block cursor-crosshair touch-none"
            style={{ width: `${MAP_WIDTH}px`, height: `${MAP_HEIGHT}px` }}
            onPointerDown={handleMapPointerDown}
            onPointerMove={handleMapPointerMove}
            onPointerUp={handleMapPointerUp}
            onPointerCancel={handleMapPointerUp}
          />
        </div>
      </div>
    </div>
  );
}
