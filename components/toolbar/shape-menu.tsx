"use client";

import { useState, useRef, useEffect } from "react";
import { Square, Circle, Minus, ArrowUpRight, ChevronDown, Check } from "lucide-react";
import { useWhiteboardStore, type ShapeType } from "@/store/whiteboard-store";

const shapes: { id: ShapeType; icon: React.ElementType; label: string }[] = [
  { id: "rectangle", icon: Square, label: "Rectangle" },
  { id: "circle", icon: Circle, label: "Circle" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "arrow", icon: ArrowUpRight, label: "Arrow" },
];

export function ShapeMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { activeTool, setTool, selectedShape, setSelectedShape } = useWhiteboardStore();

  const ActiveIcon = shapes.find((s) => s.id === selectedShape)?.icon ?? Square;
  const isShapeTool = (["rectangle", "circle", "line", "arrow"] as const).includes(
    activeTool as ShapeType
  );

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("pointerdown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, [open]);

  return (
    <div className="wb-shape-wrap" ref={menuRef}>
      <button
        type="button"
        className={`wb-tool ${isShapeTool ? "wb-active" : ""}`}
        title={`Shape: ${selectedShape}`}
        aria-label={`Shape: ${selectedShape}`}
        aria-pressed={isShapeTool}
        onClick={() => {
          setTool(selectedShape);
          setOpen((prev) => !prev);
        }}
      >
        <ActiveIcon />
      </button>
      <button
        type="button"
        className="wb-shape-caret"
        aria-label="Choose shape"
        title="Choose shape"
        onClick={() => setOpen((prev) => !prev)}
      >
        <ChevronDown />
      </button>

      {open && (
        <div className="wb-shape-menu wb-panel" role="menu">
          {shapes.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className="wb-shape-option"
              onClick={() => {
                setSelectedShape(id);
                setTool(id);
                setOpen(false);
              }}
            >
              <Icon />
              <span>{label}</span>
              {selectedShape === id && <Check className="wb-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
