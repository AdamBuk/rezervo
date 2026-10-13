import { describe, expect, it } from "vitest";
import { layoutLanes } from "./calendar-layout";

const block = (id: string, start: number, end: number) => ({ id, startMin: start, endMin: end });
const summary = (blocks: ReturnType<typeof layoutLanes>) =>
  Object.fromEntries(blocks.map((b) => [b.id, `${b.lane}/${b.lanes}`]));

describe("layoutLanes", () => {
  it("keeps non-overlapping blocks full width", () => {
    expect(summary(layoutLanes([block("a", 540, 600), block("b", 600, 660)]))).toEqual({ a: "0/1", b: "0/1" });
  });

  it("puts overlapping blocks side by side", () => {
    expect(summary(layoutLanes([block("a", 540, 600), block("b", 570, 630)]))).toEqual({ a: "0/2", b: "1/2" });
  });

  it("reuses a lane once it frees up and shares the group's lane count", () => {
    // a 9–11, b 9–10, c 10–11 → a | b,c in the second lane
    expect(summary(layoutLanes([block("a", 540, 660), block("b", 540, 600), block("c", 600, 660)]))).toEqual({
      a: "0/2",
      b: "1/2",
      c: "1/2",
    });
  });

  it("separates independent groups", () => {
    const out = layoutLanes([block("a", 540, 600), block("b", 550, 600), block("c", 700, 760)]);
    expect(summary(out)).toEqual({ a: "0/2", b: "1/2", c: "0/1" });
  });

  it("handles empty input", () => {
    expect(layoutLanes([])).toEqual([]);
  });
});
