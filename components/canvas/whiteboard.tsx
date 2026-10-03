"use client";

import { InfiniteCanvas } from "./infinite-canvas";

export function Whiteboard() {
  return (
    <div className="w-full h-full relative overflow-hidden">
      <InfiniteCanvas />
    </div>
  );
}
