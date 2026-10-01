"use client";

import React, { useRef, useState, useEffect } from "react";
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
  Layers,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useWhiteboardStore, type ShapeType } from "@/store/whiteboard-store";
import { ShapeMenu } from "./shape-menu";
import { ThemeToggle } from "./theme-toggle";
import { exportPageAsImage } from "@/lib/export-canvas";

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
  const pages = useWhiteboardStore((s) => s.pages);
  const activePageIndex = useWhiteboardStore((s) => s.activePageIndex);
  const totalPages = pages.length;
  const addPage = useWhiteboardStore((s) => s.addPage);
  const clearPage = useWhiteboardStore((s) => s.clearPage);
  const addAction = useWhiteboardStore((s) => s.addAction);
  const undo = useWhiteboardStore((s) => s.undo);
  const redo = useWhiteboardStore((s) => s.redo);
  const canUndo = useWhiteboardStore((s) => s.canUndo);
  const canRedo = useWhiteboardStore((s) => s.canRedo);
  const zoom = useWhiteboardStore((s) => s.zoom);
  const zoomIn = useWhiteboardStore((s) => s.zoomIn);
  const zoomOut = useWhiteboardStore((s) => s.zoomOut);
  const resetZoom = useWhiteboardStore((s) => s.resetZoom);
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

  // Close menus when clicking outside
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

  // Keyboard Shortcuts
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
            redo(activePageIndex);
          } else {
            undo(activePageIndex);
          }
        } else if (key === "y") {
          e.preventDefault();
          redo(activePageIndex);
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
          resetZoom();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activePageIndex,
    setTool,
    selectedShape,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetZoom,
  ]);

  const iconBtn = (
    label: string,
    icon: React.ReactNode,
    action: () => void,
    active = false,
    disabled = false,
    tintWithColor = false,
    extraClass = ""
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`wb-tool ${active ? "wb-active" : ""} ${
        tintWithColor && active ? "wb-active-tinted" : ""
      } ${extraClass}`}
      style={
        tintWithColor && active
          ? ({ "--tool-color": strokeColor } as React.CSSProperties)
          : undefined
      }
      onClick={action}
    >
      {icon}
    </button>
  );

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

        const center = { x: 420 - w / 2, y: 350 - h / 2 };
        const imageId = crypto.randomUUID();

        addAction(activePageIndex, {
          id: imageId,
          tool: "image",
          x: Math.max(30, Math.round(center.x)),
          y: Math.max(30, Math.round(center.y)),
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

  const handleClearPageConfirm = () => {
    clearPage(activePageIndex);
    setClearConfirmOpen(false);
    showNotice(`Page ${activePageIndex + 1} cleared`);
  };

  const handleExportPage = async (format: "png" | "jpeg") => {
    try {
      setIsExporting(true);
      setExportOpen(false);
      const curPage = pages[activePageIndex];
      if (!curPage) return;
      await exportPageAsImage(curPage, activePageIndex + 1, format, isDark);
      showNotice(`Page ${activePageIndex + 1} exported as ${format.toUpperCase()}`);
    } catch {
      showNotice("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAllPages = async () => {
    try {
      setIsExporting(true);
      setExportOpen(false);
      for (let i = 0; i < pages.length; i++) {
        await exportPageAsImage(pages[i], i + 1, "png", isDark);
        // Small stagger for multi-file download
        await new Promise((r) => setTimeout(r, 200));
      }
      showNotice(`Exported all ${pages.length} pages as PNG`);
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
        {iconBtn(
          "Undo (⌘Z)",
          <Undo2 />,
          () => undo(activePageIndex),
          false,
          !canUndo(activePageIndex)
        )}
        {iconBtn(
          "Redo (⌘⇧Z)",
          <Redo2 />,
          () => redo(activePageIndex),
          false,
          !canRedo(activePageIndex)
        )}
      </div>

      <span className="wb-divider" />

      {/* ── Core Drawing Tools ── */}
      <div className="wb-group">
        {iconBtn(
          "Select (V)",
          <MousePointer2 />,
          () => setTool("select"),
          activeTool === "select"
        )}
        {iconBtn(
          "Pan canvas (H)",
          <Hand />,
          () => setTool("pan"),
          activeTool === "pan"
        )}
        {iconBtn(
          "Pen (P)",
          <PenLine />,
          () => setTool("pen"),
          activeTool === "pen",
          false,
          true
        )}
        {iconBtn(
          "Highlighter (M)",
          <Highlighter />,
          () => setTool("highlighter"),
          activeTool === "highlighter",
          false,
          true
        )}
        {iconBtn(
          "Eraser (E)",
          <Eraser />,
          () => setTool("eraser"),
          activeTool === "eraser"
        )}
      </div>

      <span className="wb-divider" />

      {/* ── Shapes, Text & Image ── */}
      <div className="wb-group">
        <ShapeMenu />
        {iconBtn(
          "Text (T)",
          <Type />,
          () => setTool("text"),
          activeTool === "text",
          false,
          true
        )}
        {iconBtn(
          "Add image",
          <ImagePlus />,
          () => fileRef.current?.click()
        )}
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

      {/* ── Zoom Controls ── */}
      <div className="wb-group wb-zoom-group">
        {iconBtn("Zoom out (-)", <Minus />, zoomOut, false, zoom <= 0.4)}
        <button
          type="button"
          title="Reset zoom (0)"
          className="wb-zoom-label"
          onClick={resetZoom}
        >
          {Math.round(zoom * 100)}%
        </button>
        {iconBtn("Zoom in (+)", <Plus />, zoomIn, false, zoom >= 3.0)}
      </div>

      <span className="wb-divider" />

      {/* ── Export Canvas as Images ── */}
      <div className="relative flex items-center" ref={exportMenuRef}>
        {iconBtn(
          "Export image",
          <Download />,
          () => {
            setExportOpen((prev) => !prev);
            setColorOpen(false);
            setSizeOpen(false);
            setClearConfirmOpen(false);
          },
          exportOpen,
          isExporting
        )}

        {exportOpen && (
          <div
            className="wb-export-popover wb-panel"
            role="menu"
            aria-label="Export canvas options"
          >
            <div className="wb-popover-title">Export as Image</div>
            <button
              type="button"
              className="wb-export-option"
              onClick={() => handleExportPage("png")}
            >
              <FileImage className="wb-export-icon" />
              <div className="wb-export-text">
                <span className="wb-export-name">Page {activePageIndex + 1} (PNG)</span>
                <span className="wb-export-desc">High resolution lossless</span>
              </div>
            </button>
            <button
              type="button"
              className="wb-export-option"
              onClick={() => handleExportPage("jpeg")}
            >
              <FileImage className="wb-export-icon" />
              <div className="wb-export-text">
                <span className="wb-export-name">Page {activePageIndex + 1} (JPG)</span>
                <span className="wb-export-desc">Compressed image</span>
              </div>
            </button>
            {totalPages > 1 && (
              <>
                <div className="wb-popover-divider" />
                <button
                  type="button"
                  className="wb-export-option"
                  onClick={handleExportAllPages}
                >
                  <Layers className="wb-export-icon" />
                  <div className="wb-export-text">
                    <span className="wb-export-name">All Pages ({totalPages})</span>
                    <span className="wb-export-desc">Download each as PNG</span>
                  </div>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Clear Page with Confirmation ── */}
      <div className="relative flex items-center" ref={clearMenuRef}>
        {iconBtn(
          "Clear page",
          <Trash2 />,
          () => setClearConfirmOpen((prev) => !prev),
          clearConfirmOpen,
          false,
          false,
          "wb-tool-delete"
        )}

        {clearConfirmOpen && (
          <div
            className="wb-confirm-popover wb-panel"
            role="alertdialog"
            aria-label="Confirm Clear Page"
          >
            <div className="wb-confirm-header">
              <AlertTriangle className="wb-confirm-warn-icon" />
              <span>Clear page {activePageIndex + 1}?</span>
            </div>
            <p className="wb-confirm-desc">
              All drawings and items on this page will be removed.
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
                onClick={handleClearPageConfirm}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <span className="wb-divider" />

      {/* ── Add Page ── */}
      <div className="wb-group">
        {iconBtn("Add page", <Plus />, addPage)}
      </div>

      <span className="wb-divider" />

      {/* ── Theme Toggle ── */}
      <div className="wb-group">
        <ThemeToggle />
      </div>

      <span className="wb-divider" />

      {/* ── Page Indicator ── */}
      <div className="wb-page-indicator" title="Current Page / Total Pages">
        {activePageIndex + 1} / {totalPages}
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
