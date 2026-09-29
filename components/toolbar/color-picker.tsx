"use client";

import { IconButton, HStack, Popover, Portal } from "@chakra-ui/react";
import { useWhiteboardStore } from "@/store/whiteboard-store";

const COLORS = [
  "#000000",
  "#6b7280",
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
          size="sm"
          rounded="xl"
          title="Color"
        >
          <div
            className="h-4 w-4 rounded-full border border-gray-300"
            style={{ backgroundColor: strokeColor }}
          />
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
            <HStack gap="2" flexWrap="wrap" justify="center">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setColor(color)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    strokeColor === color
                      ? "scale-110 border-blue-500"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </HStack>
            {/* Custom color input */}
            <div className="mt-2 flex justify-center">
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-full cursor-pointer rounded-lg"
              />
            </div>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
