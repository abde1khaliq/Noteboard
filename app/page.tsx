import { Toolbar } from "@/components/toolbar/toolbar";
import { Whiteboard } from "@/components/canvas/whiteboard";

export default function Home() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <Toolbar />
      <Whiteboard />
    </div>
  );
}
