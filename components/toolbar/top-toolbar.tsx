"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Undo2,
  Redo2,
  MousePointer2,
  Hand,
  PenLine,
  Highlighter,
  Eraser,
  Type,
  ImagePlus,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  Download,
  FileImage,
  Sparkles,
  Maximize2,
  Monitor,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useWhiteboardStore } from "@/store/whiteboard-store";
import { ShapeMenu } from "./shape-menu";
import { ThemeToggle } from "./theme-toggle";
import {
  exportCanvasAsImage,
  exportViewportAsImage,
} from "@/lib/export-canvas";

const PALETTE = [
  { name: "Charcoal", value: "#202124" },
  { name: "Red", value: "#f0443e" },
  { name: "Orange", value: "#fb920b" },
  { name: "Yellow", value: "#f9c510" },
  { name: "Green", value: "#2ab85d" },
  { name: "Blue", value: "#1674ee" },
  { name: "Purple", value: "#a74ed6" },
  { name: "Gray", value: "#85878c" },
  { name: "White", value: "#ffffff" },
];

const SIZE_PRESETS = [
  { label: "Fine", value: 2 },
  { label: "Med", value: 4 },
  { label: "Bold", value: 8 },
  { label: "Thick", value: 16 },
  { label: "Jumbo", value: 28 },
];

export function TopToolbar() {
  const activeTool = useWhiteboardStore((s) => s.activeTool);
  const setTool = useWhiteboardStore((s) => s.setTool);
  const selectedShape = useWhiteboardStore((s) => s.selectedShape);
  const setSelectedId = useWhiteboardStore((s) => s.setSelectedId);
  const actions = useWhiteboardStore((s) => s.actions);
  const clearBoard = useWhiteboardStore((s) => s.clearBoard);
  const addAction = useWhiteboardStore((s) => s.addAction);
  const undo = useWhiteboardStore((s) => s.undo);
  const redo = useWhiteboardStore((s) => s.redo);
  const canUndo = useWhiteboardStore((s) => s.canUndo);
  const canRedo = useWhiteboardStore((s) => s.canRedo);
  const zoom = useWhiteboardStore((s) => s.zoom);
  const pan = useWhiteboardStore((s) => s.pan);
  const zoomIn = useWhiteboardStore((s) => s.zoomIn);
  const zoomOut = useWhiteboardStore((s) => s.zoomOut);
  const resetZoom = useWhiteboardStore((s) => s.resetZoom);
  const fitToContent = useWhiteboardStore((s) => s.fitToContent);
  const strokeColor = useWhiteboardStore((s) => s.strokeColor);
  const setColor = useWhiteboardStore((s) => s.setColor);
  const strokeWidth = useWhiteboardStore((s) => s.strokeWidth);
  const setWidth = useWhiteboardStore((s) => s.setWidth);
  const showNotice = useWhiteboardStore((s) => s.showNotice);

  const { resolvedTheme, theme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";

  const fileRef = useRef<HTMLInputElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const clearMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [colorOpen, setColorOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Close popovers on outside click
  useEffect(() => {
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (
        colorMenuRef.current &&
        !colorMenuRef.current.contains(e.target as Node)
      ) {
        setColorOpen(false);
      }
      if (
        sizeMenuRef.current &&
        !sizeMenuRef.current.contains(e.target as Node)
      ) {
        setSizeOpen(false);
      }
      if (
        clearMenuRef.current &&
        !clearMenuRef.current.contains(e.target as Node)
      ) {
        setClearConfirmOpen(false);
      }
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setExportOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDownOutside);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDownOutside);
  }, []);

  // Global Keyboard Shortcuts for Tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (e.metaKey || e.ctrlKey) {
        if (key === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (key === "y") {
          e.preventDefault();
          redo();
        } else if (key === "0") {
          e.preventDefault();
          resetZoom({ width: window.innerWidth, height: window.innerHeight });
          showNotice("Zoom reset to 100%");
        }
        return;
      }

      switch (key) {
        case "v":
          setTool("select");
          break;
        case "h":
          setTool("pan");
          break;
        case "p":
          setTool("pen");
          break;
        case "m":
          setTool("highlighter");
          break;
        case "e":
          setTool("eraser");
          break;
        case "x":
          setTool("magic-eraser");
          break;
        case "t":
          setTool("text");
          break;
        case "s":
          setTool(selectedShape);
          break;
        case "-":
        case "_":
          zoomOut();
          break;
        case "=":
        case "+":
          zoomIn();
          break;
        case "0":
          resetZoom({ width: window.innerWidth, height: window.innerHeight });
          showNotice("Zoom reset to 100%");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    setTool,
    selectedShape,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetZoom,
    showNotice,
  ]);

  const handleImageButtonClick = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const uploadImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const dataUrl = reader.result;
      const image = new Image();
      image.onload = async () => {
        if ("decode" in image) {
          try {
            await image.decode();
          } catch {
            // ignore
          }
        }
        const maxWidth = 550;
        const maxHeight = 450;
        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const w = Math.round(image.width * scale);
        const h = Math.round(image.height * scale);

        // Place at center of current viewport in world coordinates
        const centerWorldX = (window.innerWidth / 2 - pan.x) / zoom;
        const centerWorldY = (window.innerHeight / 2 - pan.y) / zoom;
        const imageId = crypto.randomUUID();

        addAction({
          id: imageId,
          tool: "image",
          x: Math.round(centerWorldX - w / 2),
          y: Math.round(centerWorldY - h / 2),
          src: dataUrl,
          width: w,
          height: h,
          originalWidth: image.naturalWidth || image.width,
          originalHeight: image.naturalHeight || image.height,
        });

        setTool("select");
        setSelectedId(imageId);
        showNotice("Image added");
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleClearCanvasConfirm = () => {
    clearBoard();
    setClearConfirmOpen(false);
    showNotice("Whiteboard cleared");
  };

  const handleExportCanvas = async (format: "png" | "jpeg") => {
    try {
      setIsExporting(true);
      setExportOpen(false);
      await exportCanvasAsImage(actions, format, isDark);
      showNotice(`Canvas exported as ${format.toUpperCase()}`);
    } catch {
      showNotice("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportViewport = async () => {
    try {
      setIsExporting(true);
      setExportOpen(false);
      await exportViewportAsImage(
        actions,
        pan,
        zoom,
        window.innerWidth,
        window.innerHeight,
        "png",
        isDark
      );
      showNotice("Current view exported as PNG");
    } catch {
      showNotice("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const isCustomColor = !PALETTE.some(
    (p) => p.value.toLowerCase() === strokeColor.toLowerCase()
  );

  return (
    <div className="wb-top wb-panel" role="toolbar" aria-label="Whiteboard tools">
      {/* ── Undo / Redo ── */}
      <div className="wb-group">
        <button
          type="button"
          title="Undo (⌘Z)"
          aria-label="Undo"
          disabled={!canUndo()}
          className="wb-tool"
          onClick={() => undo()}
        >
          <Undo2 />
        </button>
        <button
          type="button"
          title="Redo (⌘⇧Z / ⌘Y)"
          aria-label="Redo"
          disabled={!canRedo()}
          className="wb-tool"
          onClick={() => redo()}
        >
          <Redo2 />
        </button>
      </div>

      <span className="wb-divider" />

      {/* ── Core Drawing Tools ── */}
      <div className="wb-group">
        <button
          type="button"
          title="Select (V)"
          aria-label="Select"
          aria-pressed={activeTool === "select"}
          className={`wb-tool ${activeTool === "select" ? "wb-active" : ""}`}
          onClick={() => setTool("select")}
        >
          <MousePointer2 />
        </button>
        <button
          type="button"
          title="Pan canvas (H / Space)"
          aria-label="Pan canvas"
          aria-pressed={activeTool === "pan"}
          className={`wb-tool ${activeTool === "pan" ? "wb-active" : ""}`}
          onClick={() => setTool("pan")}
        >
          <Hand />
        </button>
        <button
          type="button"
          title="Pen (P)"
          aria-label="Pen"
          aria-pressed={activeTool === "pen"}
          className={`wb-tool ${activeTool === "pen" ? "wb-active wb-active-tinted" : ""}`}
          style={
            activeTool === "pen"
              ? ({ "--tool-color": strokeColor } as React.CSSProperties)
              : undefined
          }
          onClick={() => setTool("pen")}
        >
          <PenLine />
        </button>
        <button
          type="button"
          title="Highlighter (M)"
          aria-label="Highlighter"
          aria-pressed={activeTool === "highlighter"}
          className={`wb-tool ${activeTool === "highlighter" ? "wb-active wb-active-tinted" : ""}`}
          style={
            activeTool === "highlighter"
              ? ({ "--tool-color": strokeColor } as React.CSSProperties)
              : undefined
          }
          onClick={() => setTool("highlighter")}
        >
          <Highlighter />
        </button>
        <button
          type="button"
          title="Pixel Eraser (E)"
          aria-label="Pixel Eraser"
          aria-pressed={activeTool === "eraser"}
          className={`wb-tool ${activeTool === "eraser" ? "wb-active" : ""}`}
          onClick={() => setTool("eraser")}
        >
          <Eraser />
        </button>
        <button
          type="button"
          title="Magic Eraser (X)"
          aria-label="Magic Eraser"
          aria-pressed={activeTool === "magic-eraser"}
          className={`wb-tool ${activeTool === "magic-eraser" ? "wb-active" : ""}`}
          onClick={() => setTool("magic-eraser")}
        >
          <Sparkles />
        </button>
      </div>

      <span className="wb-divider" />

      {/* ── Shapes, Text & Image ── */}
      <div className="wb-group">
        <ShapeMenu />
        <button
          type="button"
          title="Text (T)"
          aria-label="Text"
          aria-pressed={activeTool === "text"}
          className={`wb-tool ${activeTool === "text" ? "wb-active wb-active-tinted" : ""}`}
          style={
            activeTool === "text"
              ? ({ "--tool-color": strokeColor } as React.CSSProperties)
              : undefined
          }
          onClick={() => setTool("text")}
        >
          <Type />
        </button>
        <button
          type="button"
          title="Add image"
          aria-label="Add image"
          className="wb-tool"
          onClick={handleImageButtonClick}
        >
          <ImagePlus />
        </button>
      </div>

      <span className="wb-divider" />

      {/* ── Stroke Color Popover Button ── */}
      <div className="relative flex items-center" ref={colorMenuRef}>
        <button
          type="button"
          className={`wb-tool wb-color-picker-btn ${
            colorOpen ? "wb-active" : ""
          }`}
          title="Stroke color"
          aria-label="Stroke color"
          onClick={() => {
            setColorOpen((prev) => !prev);
            setSizeOpen(false);
            setExportOpen(false);
          }}
        >
          <span
            className="wb-color-dot"
            style={{
              backgroundColor: strokeColor,
              boxShadow:
                strokeColor.toLowerCase() === "#ffffff"
                  ? "inset 0 0 0 1px rgba(0,0,0,0.25)"
                  : undefined,
            }}
          />
        </button>

        {/* ── Floating Color Palette Panel ── */}
        {colorOpen && (
          <div
            className="wb-color-popover wb-panel"
            role="dialog"
            aria-label="Color Palette"
          >
            <div className="wb-popover-title">Palette</div>
            <div className="wb-popover-colors">
              {PALETTE.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  className={`wb-swatch-button ${
                    strokeColor.toLowerCase() === option.value.toLowerCase()
                      ? "wb-swatch-selected"
                      : ""
                  }`}
                  title={option.name}
                  aria-label={`${option.name} color`}
                  onClick={() => {
                    setColor(option.value);
                  }}
                >
                  <span
                    className="wb-swatch"
                    style={{
                      backgroundColor: option.value,
                      boxShadow:
                        option.value === "#ffffff"
                          ? "inset 0 0 0 1px rgba(0,0,0,0.2)"
                          : undefined,
                    }}
                  />
                </button>
              ))}

              <label
                className={`wb-custom-color ${
                  isCustomColor ? "wb-swatch-selected" : ""
                }`}
                title="Custom color wheel"
              >
                <span className="wb-color-wheel" />
                <input
                  type="color"
                  aria-label="Custom color picker"
                  value={strokeColor}
                  onChange={(e) => {
                    setColor(e.target.value);
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ── Stroke & Eraser Size Popover Button ── */}
      <div className="relative flex items-center" ref={sizeMenuRef}>
        <button
          type="button"
          className={`wb-tool wb-size-picker-btn ${
            sizeOpen ? "wb-active" : ""
          }`}
          title="Stroke & eraser thickness"
          aria-label="Stroke and eraser thickness"
          onClick={() => {
            setSizeOpen((prev) => !prev);
            setColorOpen(false);
            setExportOpen(false);
          }}
        >
          <span className="wb-size-num-label">{strokeWidth}</span>
        </button>

        {/* ── Floating Stroke Size Panel ── */}
        {sizeOpen && (
          <div
            className="wb-size-popover wb-panel"
            role="dialog"
            aria-label="Stroke & Eraser Size"
          >
            <div className="wb-popover-title">Thickness</div>

            {/* Quick Size Presets */}
            <div className="wb-size-presets">
              {SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={`wb-size-preset-btn ${
                    strokeWidth === preset.value ? "wb-size-preset-active" : ""
                  }`}
                  onClick={() => setWidth(preset.value)}
                >
                  <span
                    className="wb-preset-dot"
                    style={{
                      width: `${Math.min(Math.max(3, preset.value * 0.35 + 2), 11)}px`,
                      height: `${Math.min(Math.max(3, preset.value * 0.35 + 2), 11)}px`,
                      backgroundColor: strokeColor,
                    }}
                  />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            <div className="wb-popover-divider" />

            {/* Continuous Range Slider */}
            <div className="wb-popover-size-row">
              <div className="wb-popover-dot-container">
                <span
                  className="wb-popover-size-dot"
                  style={{
                    width: `${Math.min(Math.max(3, strokeWidth * 0.45 + 2), 18)}px`,
                    height: `${Math.min(Math.max(3, strokeWidth * 0.45 + 2), 18)}px`,
                    backgroundColor: strokeColor,
                  }}
                />
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={strokeWidth}
                aria-label="Stroke width slider"
                className="wb-popover-slider"
                onChange={(e) => setWidth(Number(e.target.value))}
              />
              <span className="wb-popover-size-num">{strokeWidth}px</span>
            </div>
          </div>
        )}
      </div>

      <span className="wb-divider" />

      {/* ── Zoom & Fit Controls ── */}
      <div className="wb-group wb-zoom-group">
        <button
          type="button"
          title="Zoom out (-)"
          aria-label="Zoom out"
          disabled={zoom <= 0.1}
          className="wb-tool"
          onClick={() => zoomOut()}
        >
          <Minus />
        </button>
        <button
          type="button"
          title="Reset zoom to 100% (0)"
          aria-label="Reset zoom"
          className="wb-zoom-label"
          onClick={() => {
            resetZoom({ width: window.innerWidth, height: window.innerHeight });
            showNotice("Zoom 100%");
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          title="Zoom in (+)"
          aria-label="Zoom in"
          disabled={zoom >= 5.0}
          className="wb-tool"
          onClick={() => zoomIn()}
        >
          <Plus />
        </button>
        <button
          type="button"
          title="Fit all content to view (Shift + 1)"
          aria-label="Fit to content"
          className="wb-tool"
          onClick={() => {
            fitToContent({ width: window.innerWidth, height: window.innerHeight });
            showNotice("Fitted to content");
          }}
        >
          <Maximize2 />
        </button>
      </div>

      <span className="wb-divider" />

      {/* ── Export Canvas Popover ── */}
      <div className="relative flex items-center" ref={exportMenuRef}>
        <button
          type="button"
          title="Export canvas"
          aria-label="Export canvas"
          aria-pressed={exportOpen}
          disabled={isExporting}
          className={`wb-tool ${exportOpen ? "wb-active" : ""}`}
          onClick={() => {
            setExportOpen((prev) => !prev);
            setColorOpen(false);
            setSizeOpen(false);
            setClearConfirmOpen(false);
          }}
        >
          <Download />
        </button>

        {exportOpen && (
          <div
            className="wb-export-popover wb-panel"
            role="menu"
            aria-label="Export canvas options"
          >
            <div className="wb-popover-title">Export Canvas</div>
            <button
              type="button"
              className="wb-export-option"
              onClick={() => handleExportCanvas("png")}
            >
              <FileImage className="wb-export-icon" />
              <div className="wb-export-text">
                <span className="wb-export-name">Canvas Content (PNG)</span>
                <span className="wb-export-desc">Auto-cropped high-res 2x</span>
              </div>
            </button>
            <button
              type="button"
              className="wb-export-option"
              onClick={() => handleExportCanvas("jpeg")}
            >
              <FileImage className="wb-export-icon" />
              <div className="wb-export-text">
                <span className="wb-export-name">Canvas Content (JPG)</span>
                <span className="wb-export-desc">Compressed image</span>
              </div>
            </button>
            <div className="wb-popover-divider" />
            <button
              type="button"
              className="wb-export-option"
              onClick={handleExportViewport}
            >
              <Monitor className="wb-export-icon" />
              <div className="wb-export-text">
                <span className="wb-export-name">Current Viewport (PNG)</span>
                <span className="wb-export-desc">Exact screen view</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── Clear Canvas with Confirmation ── */}
      <div className="relative flex items-center" ref={clearMenuRef}>
        <button
          type="button"
          title="Clear whiteboard"
          aria-label="Clear whiteboard"
          aria-pressed={clearConfirmOpen}
          disabled={actions.length === 0}
          className={`wb-tool wb-tool-delete ${clearConfirmOpen ? "wb-active" : ""}`}
          onClick={() => setClearConfirmOpen((prev) => !prev)}
        >
          <Trash2 />
        </button>

        {clearConfirmOpen && (
          <div
            className="wb-confirm-popover wb-panel"
            role="alertdialog"
            aria-label="Confirm Clear Canvas"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wb-confirm-header">
              <AlertTriangle className="wb-confirm-warn-icon" />
              <span>Clear Whiteboard?</span>
            </div>
            <p className="wb-confirm-desc">
              All drawings and items on the infinite canvas will be removed.
            </p>
            <div className="wb-confirm-actions">
              <button
                type="button"
                className="wb-confirm-btn wb-confirm-cancel"
                onClick={() => setClearConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wb-confirm-btn wb-confirm-danger"
                onClick={handleClearCanvasConfirm}
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      <span className="wb-divider" />

      {/* ── Theme Toggle ── */}
      <div className="wb-group">
        <ThemeToggle />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={uploadImage}
        className="hidden"
        aria-label="Upload image"
      />
    </div>
  );
}
