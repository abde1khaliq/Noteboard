"use client";

import { IconButton, HStack, Popover, Portal } from "@chakra-ui/react";
import { useWhiteboardStore } from "@/store/whiteboard-store";

const COLORS = [
  "#000000",
  "#ffffff",
  "#64748b",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
];

export function ColorPicker() {
  const { strokeColor, setColor } = useWhiteboardStore();

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton
          aria-label="Color"
          variant="ghost"
          size="md"
          rounded="xl"
          title="Color"
          className="h-10 w-10 p-2"
        >
          <div
            className="h-5 w-5 rounded-full border-2 border-white/70 shadow-md transition-transform hover:scale-110"
            style={{ backgroundColor: strokeColor }}
          />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            className="liquid-glass z-[100] p-3 shadow-2xl !rounded-2xl"
            w="auto"
          >
            <HStack gap="2" flexWrap="wrap" justify="center" maxW="200px">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setColor(color)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 shadow-sm ${
                    strokeColor === color
                      ? "scale-110 border-blue-500 ring-2 ring-blue-400/50"
                      : "border-black/20 dark:border-white/20"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </HStack>
            {/* Custom color input */}
            <div className="mt-3 flex justify-center border-t border-white/10 dark:border-black/10 pt-2">
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent"
              />
            </div>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
