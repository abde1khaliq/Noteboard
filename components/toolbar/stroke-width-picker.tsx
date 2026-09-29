"use client";

import { IconButton, Popover, Portal, HStack } from "@chakra-ui/react";
import { useWhiteboardStore } from "@/store/whiteboard-store";

const WIDTHS = [1, 2, 3, 5, 8, 12];

export function StrokeWidthPicker() {
  const { strokeWidth, setWidth, strokeColor } = useWhiteboardStore();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton
          aria-label="Stroke Width"
          variant="ghost"
          size="md"
          rounded="xl"
          title="Stroke Width"
          className="h-10 w-10 p-2"
        >
          <div className="flex h-5 w-5 items-center justify-center">
            <div
              className="rounded-full shadow-md"
              style={{
                width: Math.min(Math.max(strokeWidth * 1.8, 4), 16),
                height: Math.min(Math.max(strokeWidth * 1.8, 4), 16),
                backgroundColor: strokeColor,
              }}
            />
          </div>
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            className="liquid-glass z-[100] p-3 shadow-2xl !rounded-2xl"
            w="auto"
          >
            <HStack gap="3">
              {WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWidth(w)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                    strokeWidth === w
                      ? "bg-white/25 dark:bg-black/20 scale-110 shadow-sm ring-1 ring-blue-500/40"
                      : "hover:bg-white/15 dark:hover:bg-black/10"
                  }`}
                  aria-label={`Width ${w}px`}
                >
                  <div
                    className="rounded-full bg-current shadow-xs"
                    style={{
                      width: Math.max(w * 1.6, 4),
                      height: Math.max(w * 1.6, 4),
                    }}
                  />
                </button>
              ))}
            </HStack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
