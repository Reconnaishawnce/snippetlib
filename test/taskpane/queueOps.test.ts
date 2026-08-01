import { describe, expect, it } from "vitest";
import type { QueueState } from "../../src/models/entities";
import {
  addSection,
  addToQueue,
  clearInserted,
  deleteSection,
  displaySections,
  emptyQueue,
  markInserted,
  moveItem,
  removeItem,
  renameSection,
  unInsertedCount,
} from "../../src/taskpane/state/queueOps";

function build(): {
  state: QueueState;
  high: string;
  low: string;
  a: string;
  b: string;
  c: string;
} {
  let state = addSection(emptyQueue(), "High");
  state = addSection(state, "Low");
  const high = state.sections[0]!.id;
  const low = state.sections[1]!.id;
  let result = addToQueue(state, "snip-a", high);
  state = result.state;
  result = addToQueue(state, "snip-b", high);
  state = result.state;
  result = addToQueue(state, "snip-c", low);
  state = result.state;
  const [a, b] = state.sections[0]!.items.map((i) => i.id);
  const c = state.sections[1]!.items[0]!.id;
  return { state, high, low, a: a!, b: b!, c };
}

describe("addToQueue", () => {
  it("creates a default section when the queue is empty", () => {
    const { state, sectionId } = addToQueue(emptyQueue(), "snip-1");
    expect(state.sections).toHaveLength(1);
    expect(state.sections[0]!.name).toBe("Queue");
    expect(state.sections[0]!.id).toBe(sectionId);
    expect(state.sections[0]!.items[0]!.snippetId).toBe("snip-1");
  });

  it("appends to the requested section", () => {
    const { state, high } = build();
    expect(state.sections[0]!.items.map((i) => i.snippetId)).toEqual(["snip-a", "snip-b"]);
    const next = addToQueue(state, "snip-d", high).state;
    expect(next.sections[0]!.items.map((i) => i.snippetId)).toEqual(["snip-a", "snip-b", "snip-d"]);
  });

  it("allows the same snippet queued twice", () => {
    const { state, high } = build();
    const next = addToQueue(state, "snip-a", high).state;
    expect(next.sections[0]!.items.filter((i) => i.snippetId === "snip-a")).toHaveLength(2);
  });
});

describe("sections", () => {
  it("renames", () => {
    const { state, high } = build();
    expect(renameSection(state, high, "Critical").sections[0]!.name).toBe("Critical");
  });

  it("delete moves items to the first remaining section", () => {
    const { state, low } = build();
    const next = deleteSection(state, low);
    expect(next.sections).toHaveLength(1);
    expect(next.sections[0]!.items.map((i) => i.snippetId)).toEqual(["snip-a", "snip-b", "snip-c"]);
  });

  it("deleting the last section keeps items in a fresh default", () => {
    let { state } = addToQueue(emptyQueue(), "snip-1");
    const only = state.sections[0]!.id;
    state = deleteSection(state, only);
    expect(state.sections).toHaveLength(1);
    expect(state.sections[0]!.name).toBe("Queue");
    expect(state.sections[0]!.id).not.toBe(only);
    expect(state.sections[0]!.items.map((i) => i.snippetId)).toEqual(["snip-1"]);
  });
});

describe("inserted lifecycle", () => {
  it("marks, sinks to bottom in display order, counts, and clears", () => {
    const { state, a, high } = build();
    const marked = markInserted(state, [a]);
    expect(unInsertedCount(marked)).toBe(2);

    const display = displaySections(marked);
    expect(display[0]!.items.map((i) => i.id)).toEqual([
      marked.sections[0]!.items.find((i) => !i.inserted)!.id,
      a,
    ]);

    const cleared = clearInserted(marked, high);
    expect(cleared.sections[0]!.items).toHaveLength(1);
    expect(cleared.sections[0]!.items[0]!.inserted).toBe(false);
  });
});

describe("moveItem", () => {
  it("reorders within a section", () => {
    const { state, high, a, b } = build();
    const next = moveItem(state, a, high, 1);
    expect(next.sections[0]!.items.map((i) => i.id)).toEqual([b, a]);
    expect(next.sections[0]!.items.map((i) => i.sortOrder)).toEqual([0, 1]);
  });

  it("moves between sections at a position", () => {
    const { state, low, a, c } = build();
    const next = moveItem(state, a, low, 0);
    expect(next.sections[0]!.items.map((i) => i.id)).toEqual([expect.any(String)]);
    expect(next.sections[1]!.items.map((i) => i.id)).toEqual([a, c]);
  });

  it("clamps out-of-range indices and ignores unknown items", () => {
    const { state, low, a } = build();
    const next = moveItem(state, a, low, 99);
    expect(next.sections[1]!.items.map((i) => i.snippetId)).toEqual(["snip-c", "snip-a"]);
    expect(moveItem(state, "nope", low, 0)).toEqual(state);
  });
});

describe("removeItem", () => {
  it("removes and resequences", () => {
    const { state, a, b } = build();
    const next = removeItem(state, a);
    expect(next.sections[0]!.items.map((i) => i.id)).toEqual([b]);
    expect(next.sections[0]!.items[0]!.sortOrder).toBe(0);
  });
});
