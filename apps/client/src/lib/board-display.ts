import type { Board } from "@taskpulse/shared-types";
import { Globe, Lock, Users } from "@lucide/vue";

// Shared by the create-board modal and the board card/page so the wording never drifts.
export const BOARD_VISIBILITY = {
  WORKSPACE: { label: "Workspace", hint: "All workspace members", icon: Users },
  PRIVATE: { label: "Private", hint: "Only board members", icon: Lock },
  PUBLIC: { label: "Public", hint: "Anyone with the link", icon: Globe },
} as const satisfies Record<Board["visibility"], { label: string; hint: string; icon: unknown }>;

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

// Board header background. Uses the board's own colour/image when it has one;
// otherwise builds a gradient from the id, so each board gets its own hues and
// glow position instead of one of a handful of presets. Stable across reloads.
export function boardBackground(board: Pick<Board, "id" | "backgroundColorOrUrl">): Record<string, string> {
  const custom = board.backgroundColorOrUrl;
  if (custom) {
    return /^(https?:|\/)/.test(custom)
      ? { backgroundImage: `url("${custom}")`, backgroundSize: "cover", backgroundPosition: "center" }
      : { backgroundColor: custom };
  }

  const hash = hashString(board.id);
  const hue = hash % 360;
  const spread = 30 + (hash % 50); // how far apart the hues sit: 30°–80°
  const angle = (hash >> 3) % 360;
  const glowX = 15 + ((hash >> 5) % 70);
  const glowY = 10 + ((hash >> 7) % 50);

  return {
    backgroundImage: [
      `radial-gradient(circle at ${glowX}% ${glowY}%, hsl(0 0% 100% / 0.35), transparent 55%)`,
      `linear-gradient(${angle}deg, hsl(${hue} 80% 60%), hsl(${(hue + spread) % 360} 75% 52%), hsl(${(hue + spread * 2) % 360} 70% 45%))`,
    ].join(", "),
    backgroundSize: "100% 100%, 200% 200%",
  };
}
