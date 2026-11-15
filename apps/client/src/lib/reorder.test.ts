import { describe, expect, it } from "vitest";
import { dropAnchors } from "./reorder";

const list = ["A", "B", "C", "D"].map((id) => ({ id }));

describe("dropAnchors", () => {
  it("top of another list", () => expect(dropAnchors(list, "X", 0)).toEqual({ beforeId: null, afterId: "A" }));
  it("bottom of another list", () => expect(dropAnchors(list, "X", 4)).toEqual({ beforeId: "D", afterId: null }));
  it("middle of another list", () => expect(dropAnchors(list, "X", 2)).toEqual({ beforeId: "B", afterId: "C" }));
  it("empty list", () => expect(dropAnchors([], "X", 0)).toEqual({ beforeId: null, afterId: null }));
  it("same list, moving down", () => expect(dropAnchors(list, "A", 2)).toEqual({ beforeId: "C", afterId: "D" }));
  it("same list, moving up", () => expect(dropAnchors(list, "D", 0)).toEqual({ beforeId: null, afterId: "A" }));
});
