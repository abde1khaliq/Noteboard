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
          size="sm"
          rounded="xl"
          title="Stroke Width"
        >
          <div className="flex h-5 w-5 items-center justify-center">
            <div
              className="rounded-full"
              style={{
                width: Math.min(strokeWidth * 2, 16),
                height: Math.min(strokeWidth * 2, 16),
                backgroundColor: strokeColor,
              }}
            />
          </div>
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            className="liquid-glass"
            p="3"
            rounded="2xl"
            w="auto"
          >
            <HStack gap="3">
              {WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWidth(w)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                    strokeWidth === w
                      ? "bg-blue-500/15"
                      : "hover:bg-gray-500/10"
                  }`}
                  aria-label={`Width ${w}px`}
                >
                  <div
                    className="rounded-full bg-current"
                    style={{
                      width: Math.max(w * 1.5, 4),
                      height: Math.max(w * 1.5, 4),
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
