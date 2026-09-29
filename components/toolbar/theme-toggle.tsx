"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { IconButton } from "@chakra-ui/react";
import { Sun, Moon } from "lucide-react";

const emptySubscribe = () => () => {};

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isMounted = useIsMounted();

  if (!isMounted) {
    return (
      <IconButton
        aria-label="Toggle theme"
        variant="ghost"
        size="md"
        rounded="xl"
        className="h-10 w-10 p-2 opacity-50"
      >
        <Sun size={19} />
      </IconButton>
    );
  }

  const isDark = (resolvedTheme || theme) === "dark";

  const handleToggle = () => {
    const nextTheme = isDark ? "light" : "dark";

    // Support View Transitions API for smooth morph ripple animation if available
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        setTheme(nextTheme);
      });
    } else {
      setTheme(nextTheme);
    }
  };

  return (
    <IconButton
      aria-label={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
      variant="ghost"
      size="md"
      rounded="xl"
      onClick={handleToggle}
      title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
      className="h-10 w-10 p-2 transition-transform duration-300 active:scale-90"
    >
      <div className="relative flex h-5 w-5 items-center justify-center">
        <Sun
          size={19}
          className={`absolute transform transition-all duration-500 ${
            isDark
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100"
          }`}
        />
        <Moon
          size={19}
          className={`absolute transform transition-all duration-500 ${
            isDark
              ? "rotate-0 scale-100 opacity-100"
              : "-rotate-90 scale-0 opacity-0"
          }`}
        />
      </div>
    </IconButton>
  );
}
