import { TopToolbar } from "@/components/toolbar/top-toolbar";
import { BottomToolbar } from "@/components/toolbar/bottom-toolbar";
import { Whiteboard } from "@/components/canvas/whiteboard";

export default function Home() {
  return (
    <main className="wb">
      <div className="wb-board">
        <Whiteboard />
      </div>
      <TopToolbar />
      <BottomToolbar />
    </main>
  );
}
