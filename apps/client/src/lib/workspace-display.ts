// Display helpers for workspaces. The API has no colour field, so the colour is
// derived from the id: stable across reloads and devices, no extra column needed.

const GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-400 to-teal-600",
  "from-rose-400 to-red-500",
  "from-orange-400 to-amber-500",
  "from-zinc-600 to-zinc-900",
] as const;

export function workspaceGradient(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

// "Product Engineering" -> "PE", "design" -> "D"
export function workspaceInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}
