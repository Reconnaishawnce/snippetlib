import { beforeEach, describe, expect, it, vi } from "vitest";

// documentIO touches Office globals — replace it with an in-memory settings bag.
const settings = new Map<string, string>();
vi.mock("../../src/office/documentIO", () => ({
  readDocSettings: (
    key: string,
    schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } }
  ) => {
    const raw = settings.get(key);
    if (raw === undefined) {
      return undefined;
    }
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  },
  writeDocSettings: (key: string, value: unknown) => {
    settings.set(key, JSON.stringify(value));
  },
}));

import { usePlaceholderStore } from "../../src/taskpane/state/placeholderStore";

beforeEach(() => {
  settings.clear();
  usePlaceholderStore.setState({ values: {}, displays: {} });
});

describe("placeholderStore", () => {
  it("stores values under normalized keys with first-seen display casing", () => {
    usePlaceholderStore.getState().setValue("Building Name", "HQ Tower");
    usePlaceholderStore.getState().setValue("building name", "HQ Tower West");
    const state = usePlaceholderStore.getState();
    expect(state.values).toEqual({ "building name": "HQ Tower West" });
    expect(state.displays).toEqual({ "building name": "Building Name" });
  });

  it("persists across a reload (the auto-fill exit criterion)", () => {
    usePlaceholderStore.getState().setValue("Client", "Acme");
    usePlaceholderStore.setState({ values: {}, displays: {} }); // simulate pane reload
    usePlaceholderStore.getState().load();
    expect(usePlaceholderStore.getState().values).toEqual({ client: "Acme" });
    expect(usePlaceholderStore.getState().displays).toEqual({ client: "Client" });
  });

  it("removes values and displays together", () => {
    usePlaceholderStore.getState().setValue("Client", "Acme");
    usePlaceholderStore.getState().removeValue("client");
    expect(usePlaceholderStore.getState().values).toEqual({});
    usePlaceholderStore.getState().load();
    expect(usePlaceholderStore.getState().values).toEqual({});
  });

  it("survives garbage in doc settings (trust boundary)", () => {
    settings.set("reportsnips.placeholderValues", JSON.stringify({ k: 42 })); // invalid shape
    usePlaceholderStore.getState().load();
    expect(usePlaceholderStore.getState().values).toEqual({});
  });

  it("registerDisplays pre-lists placeholders without values (scan feature)", () => {
    const added = usePlaceholderStore.getState().registerDisplays([
      { key: "building name", display: "Building Name" },
      { key: "client", display: "Client" },
    ]);
    expect(added).toBe(2);
    const state = usePlaceholderStore.getState();
    expect(state.displays).toEqual({ "building name": "Building Name", client: "Client" });
    expect(state.values).toEqual({}); // no values — inserts still prompt

    // Idempotent, keeps first-seen display, and persists across reload.
    expect(
      usePlaceholderStore.getState().registerDisplays([{ key: "client", display: "CLIENT" }])
    ).toBe(0);
    usePlaceholderStore.setState({ values: {}, displays: {} });
    usePlaceholderStore.getState().load();
    expect(usePlaceholderStore.getState().displays.client).toBe("Client");
  });

  it("setting an empty value un-sets it but keeps the display row", () => {
    usePlaceholderStore.getState().setValue("Client", "Acme");
    usePlaceholderStore.getState().setValue("Client", "");
    const state = usePlaceholderStore.getState();
    expect(state.values).toEqual({});
    expect(state.displays).toEqual({ client: "Client" });
  });
});
