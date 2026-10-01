"use client";

import { useState } from "react";
import { useWhiteboardStore } from "@/store/whiteboard-store";

const palette = [
  { name: "Charcoal", value: "#202124" },
  { name: "Red", value: "#f0443e" },
  { name: "Orange", value: "#fb920b" },
  { name: "Yellow", value: "#f9c510" },
  { name: "Green", value: "#2ab85d" },
  { name: "Blue", value: "#1674ee" },
  { name: "Purple", value: "#a74ed6" },
  { name: "Gray", value: "#85878c" },
  { name: "White", value: "#ffffff" },
];

export function BottomToolbar() {
  const { strokeColor, setColor, strokeWidth, setWidth } = useWhiteboardStore();
  const [customColor, setCustomColor] = useState(false);

  return (
    <div
      className="wb-bottom wb-panel"
      role="toolbar"
      aria-label="Drawing settings"
    >
      <div className="wb-colors">
        {palette.map((option) => (
          <button
            key={option.name}
            type="button"
            className={`wb-swatch-button ${
              strokeColor.toLowerCase() === option.value.toLowerCase()
                ? "wb-swatch-selected"
                : ""
            }`}
            title={option.name}
            aria-label={`${option.name} color`}
            aria-pressed={strokeColor.toLowerCase() === option.value.toLowerCase()}
            onClick={() => {
              setColor(option.value);
              setCustomColor(false);
            }}
          >
            <span
              className="wb-swatch"
              style={{
                backgroundColor: option.value,
                boxShadow:
                  option.value === "#ffffff"
                    ? "inset 0 0 0 1px rgba(0,0,0,0.15)"
                    : undefined,
              }}
            />
          </button>
        ))}

        <label
          className={`wb-custom-color ${
            customColor ? "wb-swatch-selected" : ""
          }`}
          title="Custom color"
        >
          <span className="wb-color-wheel" />
          <input
            type="color"
            aria-label="Custom color"
            value={strokeColor}
            onChange={(e) => {
              setColor(e.target.value);
              setCustomColor(true);
            }}
          />
        </label>
      </div>

      <span className="wb-divider" />

      <div className="wb-size-control">
        <span
          className="wb-size-dot"
          style={{
            width: Math.min(Math.max(3, strokeWidth * 1.5), 14),
            height: Math.min(Math.max(3, strokeWidth * 1.5), 14),
            backgroundColor: strokeColor,
          }}
        />
        <input
          type="range"
          min="1"
          max="30"
          value={strokeWidth}
          aria-label="Stroke size"
          onChange={(e) => setWidth(Number(e.target.value))}
        />
        <output>{strokeWidth}</output>
      </div>
    </div>
  );
}
