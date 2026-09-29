"use client";

import { HStack, IconButton, Text } from "@chakra-ui/react";
import {
  Pen,
  Eraser,
  Highlighter,
  Square,
  Circle,
  Minus,
  Type,
  Undo2,
  Redo2,
  Hand,
  Plus,
} from "lucide-react";
import { useWhiteboardStore, type Tool } from "@/store/whiteboard-store";
import { ColorPicker } from "./color-picker";
import { StrokeWidthPicker } from "./stroke-width-picker";
import { ThemeToggle } from "./theme-toggle";

const tools: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: "pen", icon: Pen, label: "Pen" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
  { id: "highlighter", icon: Highlighter, label: "Highlighter" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "rectangle", icon: Square, label: "Rectangle" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "text", icon: Type, label: "Text" },
];

export function Toolbar() {
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
    drawWithTouch,
    toggleDrawWithTouch,
  } = useWhiteboardStore();

  return (
    <div className="liquid-glass p-2 sm:p-2.5 px-3.5 sm:px-5 shadow-lg">
      <HStack gap={{ base: "1.5", sm: "2" }} align="center">
        {/* ── Drawing Tools ── */}
        {tools.map(({ id, icon: Icon, label }) => (
          <IconButton
            key={id}
            aria-label={label}
            variant="ghost"
            size="md"
            className={`h-10 w-10 p-2 ${
              activeTool === id ? "tool-btn-active" : ""
            }`}
            onClick={() => setTool(id)}
            rounded="xl"
            title={label}
          >
            <Icon size={19} />
          </IconButton>
        ))}

        <div className="toolbar-separator mx-1" />

        {/* ── Color Picker ── */}
        <ColorPicker />

        {/* ── Stroke Width ── */}
        <StrokeWidthPicker />

        <div className="toolbar-separator mx-1" />

        {/* ── Undo / Redo ── */}
        <IconButton
          aria-label="Undo"
          variant="ghost"
          size="md"
          onClick={() => undo(activePageIndex)}
          disabled={!canUndo(activePageIndex)}
          rounded="xl"
          title="Undo"
          className="h-10 w-10 p-2 disabled:opacity-30"
        >
          <Undo2 size={19} />
        </IconButton>
        <IconButton
          aria-label="Redo"
          variant="ghost"
          size="md"
          onClick={() => redo(activePageIndex)}
          disabled={!canRedo(activePageIndex)}
          rounded="xl"
          title="Redo"
          className="h-10 w-10 p-2 disabled:opacity-30"
        >
          <Redo2 size={19} />
        </IconButton>

        <div className="toolbar-separator mx-1" />

        {/* ── Finger Draw / Pencil-Only Mode Toggle ── */}
        <IconButton
          aria-label={
            drawWithTouch
              ? "Finger Draw Enabled (Tap for Pencil-Only)"
              : "Pencil-Only Mode (Tap to enable Finger Draw)"
          }
          variant="ghost"
          size="md"
          className={`h-10 w-10 p-2 ${drawWithTouch ? "tool-btn-active" : ""}`}
          onClick={toggleDrawWithTouch}
          rounded="xl"
          title={
            drawWithTouch
              ? "Finger Draw: ON (Tap for Pencil-Only / Finger-Scroll)"
              : "Pencil-Only: ON (Finger scrolls only)"
          }
        >
          <Hand size={19} />
        </IconButton>

        {/* ── Add Page Button ── */}
        <IconButton
          aria-label="Add Page"
          variant="ghost"
          size="md"
          onClick={addPage}
          rounded="xl"
          title="Add Page (or scroll down)"
          className="h-10 w-10 p-2"
        >
          <Plus size={19} />
        </IconButton>

        <div className="toolbar-separator mx-1" />

        {/* ── Dark / Light Theme Toggle ── */}
        <ThemeToggle />

        <div className="toolbar-separator mx-1" />

        {/* ── Page Indicator ── */}
        <Text
          fontSize="xs"
          className="px-2.5 font-semibold tracking-wide"
          whiteSpace="nowrap"
        >
          {activePageIndex + 1} / {pages.length}
        </Text>
      </HStack>
    </div>
  );
}
