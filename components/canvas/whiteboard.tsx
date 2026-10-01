"use client";

import { useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { CanvasPage } from "./canvas-page";
import { useWhiteboardStore } from "@/store/whiteboard-store";

export function Whiteboard() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pages = useWhiteboardStore((s) => s.pages);
  const activePageIndex = useWhiteboardStore((s) => s.activePageIndex);
  const addPage = useWhiteboardStore((s) => s.addPage);
  const setActivePage = useWhiteboardStore((s) => s.setActivePage);

  // ── Track active page on snap scroll ──
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const { scrollTop, clientHeight } = container;
    if (clientHeight === 0) return;

    const pageIndex = Math.round(scrollTop / clientHeight);
    if (pageIndex >= 0 && pageIndex < pages.length && pageIndex !== activePageIndex) {
      setActivePage(pageIndex);
    }
  }, [pages.length, activePageIndex, setActivePage]);

  const handleAddPage = () => {
    addPage();
    setTimeout(() => {
      const container = scrollRef.current;
      if (container) {
        container.scrollTo({
          top: pages.length * container.clientHeight,
          behavior: "smooth",
        });
      }
    }, 60);
  };

  return (
    <div
      ref={scrollRef}
      className="whiteboard-scroll w-full h-full overflow-y-auto"
      onScroll={handleScroll}
    >
      {pages.map((page, index) => {
        // Virtualize: only mount active page and direct neighbors
        const isMounted = Math.abs(index - activePageIndex) <= 1;

        return (
          <div
            key={page.id}
            className="canvas-page w-full h-full p-3 sm:p-5 flex flex-col items-center justify-center shrink-0"
          >
            {isMounted ? (
              <CanvasPage pageIndex={index} />
            ) : (
              <div className="canvas-grid-bg w-full h-full rounded-2xl opacity-60 shadow-md ring-1 ring-black/5 dark:ring-white/10" />
            )}
          </div>
        );
      })}

      {/* ── Add Page Slide ── */}
      <div className="canvas-page w-full h-full flex flex-col items-center justify-center p-6 shrink-0">
        <button
          onClick={handleAddPage}
          className="flex items-center gap-3 px-8 py-4 rounded-3xl bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-200 font-semibold text-base transition-all duration-200 border-2 border-dashed border-black/15 dark:border-white/15 shadow-sm active:scale-95 cursor-pointer"
        >
          <Plus size={22} />
          <span>Add New Page</span>
        </button>
      </div>
    </div>
  );
}
