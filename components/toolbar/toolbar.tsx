"use client";

import { HStack, IconButton, Separator, Text } from "@chakra-ui/react";
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
} from "lucide-react";
import { useWhiteboardStore, type Tool } from "@/store/whiteboard-store";
import { ColorPicker } from "./color-picker";
import { StrokeWidthPicker } from "./stroke-width-picker";

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
    undo,
    redo,
    canUndo,
    canRedo,
  } = useWhiteboardStore();

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-50 -translate-x-1/2">
      <div className="pointer-events-auto liquid-glass px-3 py-2">
        <HStack gap="1" align="center">
          {/* ── Drawing Tools ── */}
          {tools.map(({ id, icon: Icon, label }) => (
            <IconButton
              key={id}
              aria-label={label}
              variant="ghost"
              size="sm"
              className={activeTool === id ? "tool-btn-active" : ""}
              onClick={() => setTool(id)}
              rounded="xl"
              title={label}
            >
              <Icon size={18} />
            </IconButton>
          ))}

          <Separator orientation="vertical" height="6" />

          {/* ── Color Picker ── */}
          <ColorPicker />

          {/* ── Stroke Width ── */}
          <StrokeWidthPicker />

          <Separator orientation="vertical" height="6" />

          {/* ── Undo / Redo ── */}
          <IconButton
            aria-label="Undo"
            variant="ghost"
            size="sm"
            onClick={() => undo(activePageIndex)}
            disabled={!canUndo(activePageIndex)}
            rounded="xl"
            title="Undo"
          >
            <Undo2 size={18} />
          </IconButton>
          <IconButton
            aria-label="Redo"
            variant="ghost"
            size="sm"
            onClick={() => redo(activePageIndex)}
            disabled={!canRedo(activePageIndex)}
            rounded="xl"
            title="Redo"
          >
            <Redo2 size={18} />
          </IconButton>

          <Separator orientation="vertical" height="6" />

          {/* ── Page Indicator ── */}
          <Text fontSize="xs" color="gray.500" px="2" whiteSpace="nowrap">
            {activePageIndex + 1} / {pages.length}
          </Text>
        </HStack>
      </div>
    </div>
  );
}
