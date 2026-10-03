import { getStroke } from "perfect-freehand";
import {
  type DrawAction,
  type Stroke,
  type ShapeStroke,
  type TextElement,
  type ImageElement,
  getContentBounds,
} from "@/store/whiteboard-store";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawFreehand(ctx: CanvasRenderingContext2D, stroke: Stroke) {
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
}

function drawEraser(ctx: CanvasRenderingContext2D, stroke: Stroke, bgColor: string) {
  if (stroke.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = bgColor;
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
}

function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeStroke) {
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
}

function drawText(ctx: CanvasRenderingContext2D, text: TextElement) {
  ctx.save();
  ctx.fillStyle = text.color;
  ctx.font = `${text.fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = "top";
  const lines = (text.text || "").split("\n");
  const lineHeight = text.fontSize * 1.25;
  lines.forEach((line, index) => {
    ctx.fillText(line, text.x, text.y + index * lineHeight);
  });
  ctx.restore();
}

/**
 * Render all content bounding-box tightly cropped with padding to a high-DPI canvas
 */
export async function renderInfiniteCanvasToBlob(
  actions: DrawAction[],
  isDark = false
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const content = getContentBounds(actions);

  const padding = 60;
  const rawWidth = content ? Math.max(200, content.width + padding * 2) : 1200;
  const rawHeight = content ? Math.max(200, content.height + padding * 2) : 800;
  const offsetX = content ? -content.minX + padding : 0;
  const offsetY = content ? -content.minY + padding : 0;

  const scale = 2; // HiDPI 2x Retina Export
  canvas.width = Math.round(rawWidth * scale);
  canvas.height = Math.round(rawHeight * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const bgColor = isDark ? "#18181b" : "#ffffff";

  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, rawWidth, rawHeight);

  // Subtle export grid pattern
  ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)";
  ctx.lineWidth = 1;
  const gridSize = 24;
  ctx.beginPath();
  for (let x = 0; x <= rawWidth; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, rawHeight);
  }
  for (let y = 0; y <= rawHeight; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(rawWidth, y);
  }
  ctx.stroke();

  // Apply world offset
  ctx.translate(offsetX, offsetY);

  // Render all actions
  for (const action of actions) {
    if (action.tool === "pen" || action.tool === "highlighter") {
      drawFreehand(ctx, action as Stroke);
    } else if (action.tool === "eraser") {
      drawEraser(ctx, action as Stroke, bgColor);
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
      try {
        const img = await loadImage(imgEl.src);
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, imgEl.x, imgEl.y, imgEl.width, imgEl.height);
        ctx.restore();
      } catch {
        // Skip failed image
      }
    }
  }

  ctx.restore();
  return canvas;
}

/**
 * Render exact current viewport to canvas
 */
export async function renderViewportToCanvas(
  actions: DrawAction[],
  pan: { x: number; y: number },
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
  isDark = false
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const scale = 2; // HiDPI 2x
  canvas.width = Math.round(viewportWidth * scale);
  canvas.height = Math.round(viewportHeight * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const bgColor = isDark ? "#18181b" : "#ffffff";

  ctx.save();
  ctx.scale(scale, scale);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  // Camera transform
  ctx.translate(pan.x, pan.y);
  ctx.scale(zoom, zoom);

  for (const action of actions) {
    if (action.tool === "pen" || action.tool === "highlighter") {
      drawFreehand(ctx, action as Stroke);
    } else if (action.tool === "eraser") {
      drawEraser(ctx, action as Stroke, bgColor);
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
      try {
        const img = await loadImage(imgEl.src);
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, imgEl.x, imgEl.y, imgEl.width, imgEl.height);
        ctx.restore();
      } catch {
        // Skip
      }
    }
  }

  ctx.restore();
  return canvas;
}

export async function exportCanvasAsImage(
  actions: DrawAction[],
  format: "png" | "jpeg" = "png",
  isDark = false
) {
  const canvas = await renderInfiniteCanvasToBlob(actions, isDark);
  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  const extension = format === "jpeg" ? "jpg" : "png";

  return new Promise<void>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `noteboard-infinite-canvas.${extension}`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      },
      mimeType,
      0.95
    );
  });
}

export async function exportViewportAsImage(
  actions: DrawAction[],
  pan: { x: number; y: number },
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
  format: "png" | "jpeg" = "png",
  isDark = false
) {
  const canvas = await renderViewportToCanvas(
    actions,
    pan,
    zoom,
    viewportWidth,
    viewportHeight,
    isDark
  );
  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  const extension = format === "jpeg" ? "jpg" : "png";

  return new Promise<void>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `noteboard-view.${extension}`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      },
      mimeType,
      0.95
    );
  });
}
