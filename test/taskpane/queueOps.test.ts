import { describe, expect, it } from "vitest";
import type { QueueState } from "../../src/models/entities";
import {
  addSection,
  addToQueue,
  appendTemplate,
  replaceFromBuilder,
  toTemplateSections,
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

describe("queue templates ops", () => {
  it("toTemplateSections captures section names and snippet ids in order", () => {
    let state = emptyQueue();
    state = addSection(state, "Findings");
    const sectionId = state.sections[0]!.id;
    state = addToQueue(state, "snip-b", sectionId).state;
    state = addToQueue(state, "snip-a", sectionId).state;
    expect(toTemplateSections(state)).toEqual([
      { name: "Findings", snippetIds: ["snip-b", "snip-a"] },
    ]);
  });

  it("appendTemplate appends fresh sections with nothing inserted", () => {
    let state = emptyQueue();
    state = addSection(state, "Existing");
    const next = appendTemplate(state, [
      { name: "Intro", snippetIds: ["s1"] },
      { name: "Wrap-up", snippetIds: ["s2", "s3"] },
    ]);
    expect(next.sections.map((s) => s.name)).toEqual(["Existing", "Intro", "Wrap-up"]);
    const intro = next.sections[1]!;
    expect(intro.items.map((i) => i.snippetId)).toEqual(["s1"]);
    expect(intro.items.every((i) => !i.inserted)).toBe(true);
    // Fresh ids — loading the same template twice must not collide.
    const again = appendTemplate(next, [{ name: "Intro", snippetIds: ["s1"] }]);
    const ids = again.sections.flatMap((s) => [s.id, ...s.items.map((i) => i.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("replaceFromBuilder", () => {
  it("replaces the queue, preserving inserted flags by surviving item id", () => {
    let state = emptyQueue();
    state = addSection(state, "High");
    const sectionId = state.sections[0]!.id;
    state = addToQueue(state, "s1", sectionId).state;
    state = addToQueue(state, "s2", sectionId).state;
    const [i1, i2] = state.sections[0]!.items;
    state = {
      sections: state.sections.map((s) => ({
        ...s,
        items: s.items.map((i) => (i.id === i1!.id ? { ...i, inserted: true } : i)),
      })),
    };

    const next = replaceFromBuilder(state, [
      {
        id: sectionId,
        name: "High (renamed)",
        layout: "paragraphs",
        // i1 survives (keeps inserted), i2 dropped, s3 is new
        items: [{ id: i1!.id, snippetId: "s1" }, { snippetId: "s3" }],
      },
      { name: "Brand new", items: [{ snippetId: "s4" }] },
    ]);

    expect(next.sections.map((s) => s.name)).toEqual(["High (renamed)", "Brand new"]);
    expect(next.sections[0]!.layout).toBe("paragraphs");
    const [k1, k3] = next.sections[0]!.items;
    expect(k1!.id).toBe(i1!.id);
    expect(k1!.inserted).toBe(true);
    expect(k3!.inserted).toBe(false);
    expect(k3!.id).not.toBe(i2!.id);
    expect(next.sections[1]!.items[0]!.snippetId).toBe("s4");
    expect(next.sections.map((s) => s.sortOrder)).toEqual([0, 1]);
  });
});
