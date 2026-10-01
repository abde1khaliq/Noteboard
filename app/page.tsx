"use client";

import { TopToolbar } from "@/components/toolbar/top-toolbar";
import { Whiteboard } from "@/components/canvas/whiteboard";
import { useWhiteboardStore } from "@/store/whiteboard-store";

export default function Home() {
  const notice = useWhiteboardStore((s) => s.notice);

  return (
    <main className="wb">
      <div className="wb-board">
        <Whiteboard />
      </div>
      <TopToolbar />

      {/* ── Toast Notification Banner ── */}
      {notice && (
        <div className="wb-toast" role="status" aria-live="polite">
          {notice}
        </div>
      )}
    </main>
  );
}
