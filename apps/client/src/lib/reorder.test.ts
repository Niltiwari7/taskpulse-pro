import { describe, expect, it } from "vitest";
import { applyCardMove, dropAnchors } from "./reorder";

const list = ["A", "B", "C", "D"].map((id) => ({ id }));

describe("dropAnchors", () => {
  it("top of another list", () => expect(dropAnchors(list, "X", 0)).toEqual({ beforeId: null, afterId: "A" }));
  it("bottom of another list", () => expect(dropAnchors(list, "X", 4)).toEqual({ beforeId: "D", afterId: null }));
  it("middle of another list", () => expect(dropAnchors(list, "X", 2)).toEqual({ beforeId: "B", afterId: "C" }));
  it("empty list", () => expect(dropAnchors([], "X", 0)).toEqual({ beforeId: null, afterId: null }));
  it("same list, moving down", () => expect(dropAnchors(list, "A", 2)).toEqual({ beforeId: "C", afterId: "D" }));
  it("same list, moving up", () => expect(dropAnchors(list, "D", 0)).toEqual({ beforeId: null, afterId: "A" }));
});

describe("applyCardMove", ()=> {
  const cards = [
    {id: "a", listId: "L1", position:"h"},
    {id:"b", listId:"L1", position:"p"},
    {id: "c", listId: "L2", position:"h"}
  ];

  it("places the card between its new neighbors",()=> {
    const moved = applyCardMove(cards,"c", {targetListId:"L1", beforeId:"a", afterId:"b"}).find((c)=>c.id==="c")!;
    expect(moved.listId).toBe("L1");
    expect(moved.position > "h" && moved.position < "p").toBe(true)
  })

  it("leaves the input untouched (the snapshot depends on it)", ()=> {
    applyCardMove(cards,"c",{targetListId:"L1", beforeId:null,afterId:"a"});
    expect(cards[2]).toEqual({id:"c",listId:"L2",position:"h"})
  })
})