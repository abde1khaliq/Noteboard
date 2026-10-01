"use client";

import React from "react";
import {
  Undo2,
  Redo2,
  MousePointer2,
  Hand,
  PenLine,
  Highlighter,
  Eraser,
  Type,
  Plus,
  Minus,
} from "lucide-react";
import { useWhiteboardStore } from "@/store/whiteboard-store";
import { ShapeMenu } from "./shape-menu";
import { ThemeToggle } from "./theme-toggle";

export function TopToolbar() {
  const {
    activeTool,
    setTool,
    activePageIndex,
    pages,
    addPage,
    undo,
    redo,
    canUndo,
    canRedo,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useWhiteboardStore();

  const iconBtn = (
    label: string,
    icon: React.ReactNode,
    action: () => void,
    active = false,
    disabled = false
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      className={`wb-tool ${active ? "wb-active" : ""}`}
      onClick={action}
    >
      {icon}
    </button>
  );

  return (
    <div className="wb-top wb-panel" role="toolbar" aria-label="Whiteboard tools">
      {/* ── Undo / Redo ── */}
      <div className="wb-group">
        {iconBtn(
          "Undo",
          <Undo2 />,
          () => undo(activePageIndex),
          false,
          !canUndo(activePageIndex)
        )}
        {iconBtn(
          "Redo",
          <Redo2 />,
          () => redo(activePageIndex),
          false,
          !canRedo(activePageIndex)
        )}
      </div>

      <span className="wb-divider" />

      {/* ── Core Tools ── */}
      <div className="wb-group">
        {iconBtn(
          "Select",
          <MousePointer2 />,
          () => setTool("select"),
          activeTool === "select"
        )}
        {iconBtn(
          "Pan",
          <Hand />,
          () => setTool("pan"),
          activeTool === "pan"
        )}
        {iconBtn(
          "Pen",
          <PenLine />,
          () => setTool("pen"),
          activeTool === "pen"
        )}
        {iconBtn(
          "Highlighter",
          <Highlighter />,
          () => setTool("highlighter"),
          activeTool === "highlighter"
        )}
        {iconBtn(
          "Eraser",
          <Eraser />,
          () => setTool("eraser"),
          activeTool === "eraser"
        )}
      </div>

      <span className="wb-divider" />

      {/* ── Shapes & Text ── */}
      <div className="wb-group">
        <ShapeMenu />
        {iconBtn(
          "Text",
          <Type />,
          () => setTool("text"),
          activeTool === "text"
        )}
      </div>

      <span className="wb-divider" />

      {/* ── Zoom Controls ── */}
      <div className="wb-group wb-zoom-group">
        {iconBtn("Zoom out", <Minus />, zoomOut, false, zoom <= 0.4)}
        <button
          type="button"
          title="Reset zoom"
          className="wb-zoom-label"
          onClick={resetZoom}
        >
          {Math.round(zoom * 100)}%
        </button>
        {iconBtn("Zoom in", <Plus />, zoomIn, false, zoom >= 3.0)}
      </div>

      <span className="wb-divider" />

      {/* ── Pages ── */}
      <div className="wb-group">
        {iconBtn("Add Page", <Plus />, addPage)}
      </div>

      <span className="wb-divider" />

      {/* ── Theme Toggle ── */}
      <div className="wb-group">
        <ThemeToggle />
      </div>

      <span className="wb-divider" />

      {/* ── Page Indicator ── */}
      <div className="wb-page-indicator" title="Current Page">
        {activePageIndex + 1} / {pages.length}
      </div>
    </div>
  );
}
