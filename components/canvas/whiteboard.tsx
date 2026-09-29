"use client";

import { useRef, useCallback } from "react";
import { CanvasPage } from "./canvas-page";
import { useWhiteboardStore } from "@/store/whiteboard-store";

export function Whiteboard() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pages, addPage, setActivePage } = useWhiteboardStore();

  // ── Scroll-to-add-page ──
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const scrollBottom = scrollHeight - scrollTop - clientHeight;

    // Add a new page when user scrolls near the bottom
    if (scrollBottom < 80) {
      addPage();
    }

    // Determine active page based on which page is most visible
    const children = Array.from(container.children) as HTMLElement[];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childTop = child.offsetTop - container.offsetTop;
      const childBottom = childTop + child.offsetHeight;
      const viewMid = scrollTop + clientHeight / 2;

      if (viewMid >= childTop && viewMid < childBottom) {
        setActivePage(i);
        break;
      }
    }
  }, [addPage, setActivePage]);

  return (
    <div
      ref={scrollRef}
      className="whiteboard-scroll flex flex-col items-center pb-40"
      onScroll={handleScroll}
    >
      {pages.map((page, index) => (
        <CanvasPage key={page.id} pageIndex={index} />
      ))}

      {/* Scroll sentinel / "Add page" hint */}
      <div className="flex items-center justify-center py-12 opacity-30">
        <p className="text-sm text-gray-400">
          ↓ Scroll down to add a new page
        </p>
      </div>
    </div>
  );
}
