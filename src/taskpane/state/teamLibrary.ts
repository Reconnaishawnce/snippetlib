/**
 * Team library over a shared bundle URL (opt-in, ADR-006). A curator publishes
 * the ordinary export JSON anywhere HTTPS (GitHub, SharePoint, intranet);
 * teammates paste the URL once and pull updates through the normal import
 * machinery. No backend — the bundle file IS the protocol.
 */
/* global fetch */
import type { ExportBundle } from "../../models/entities";
import { parseBundle } from "../../importexport/importer";

export type TeamFetchResult = { ok: true; bundle: ExportBundle } | { ok: false; error: string };

/** Injectable fetch for tests; defaults to the platform's. */
export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

/** Fetches and validates a team bundle, mapping every failure to a readable message. */
export async function fetchTeamBundle(
  url: string,
  fetchImpl: FetchLike = fetch
): Promise<TeamFetchResult> {
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(url);
  } catch {
    return {
      ok: false,
      error:
        "Couldn't reach the team library URL. Check the address, your connection, and that the server allows cross-origin requests (GitHub raw links and GitHub Pages work well).",
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: `The team library URL responded with HTTP ${response.status}. Check the address (it should point directly at the exported .json file).`,
    };
  }
  const text = await response.text();
  const parsed = parseBundle(text);
  if (!parsed.ok) {
    return { ok: false, error: `The file at the team library URL isn't valid: ${parsed.error}` };
  }
  return { ok: true, bundle: parsed.bundle };
}

/** Whether the fetched bundle is newer than what this machine last pulled. */
export function isBundleNew(bundle: ExportBundle, lastPulledAt: string | null): boolean {
  return lastPulledAt === null || bundle.exportedAt > lastPulledAt;
}
