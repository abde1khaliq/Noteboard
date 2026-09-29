import { Toolbar } from "@/components/toolbar/toolbar";
import { Whiteboard } from "@/components/canvas/whiteboard";

export default function Home() {
  return (
    <div className="flex h-dvh flex-col bg-background overflow-hidden">
      {/* ── Fixed Top Header (Excluded from Canvas) ── */}
      <header className="w-full flex justify-center py-2.5 px-4 bg-background/80 backdrop-blur-md z-50 shrink-0 border-b border-black/5 dark:border-white/5 shadow-xs">
        <Toolbar />
      </header>

      {/* ── Scrollable Multi-Page Whiteboard Canvas ── */}
      <main className="flex-1 w-full overflow-hidden flex flex-col">
        <Whiteboard />
      </main>
    </div>
  );
}
