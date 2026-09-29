"use client";

import { useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { CanvasPage } from "./canvas-page";
import { useWhiteboardStore } from "@/store/whiteboard-store";

export function Whiteboard() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pages, addPage, setActivePage } = useWhiteboardStore();

  // ── Track active page on snap scroll ──
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const { scrollTop, clientHeight } = container;
    if (clientHeight === 0) return;

    const pageIndex = Math.round(scrollTop / clientHeight);
    if (pageIndex >= 0 && pageIndex < pages.length) {
      setActivePage(pageIndex);
    }
  }, [pages.length, setActivePage]);

  return (
    <div
      ref={scrollRef}
      className="whiteboard-scroll w-full h-full overflow-y-auto"
      onScroll={handleScroll}
    >
      {pages.map((page, index) => (
        <div
          key={page.id}
          className="canvas-page w-full h-full p-2 sm:p-3 flex flex-col items-center justify-center shrink-0"
        >
          <CanvasPage pageIndex={index} />
        </div>
      ))}

      {/* ── Add Page Slide ── */}
      <div className="canvas-page w-full h-full flex flex-col items-center justify-center p-4 shrink-0">
        <button
          onClick={addPage}
          className="flex items-center gap-3 px-8 py-4 rounded-3xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200 font-semibold text-base transition-all duration-200 border-2 border-dashed border-black/15 dark:border-white/15 shadow-sm active:scale-95 cursor-pointer"
        >
          <Plus size={22} />
          <span>Add New Page</span>
        </button>
      </div>
    </div>
  );
}
