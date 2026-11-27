import fs from "node:fs";

// Paths and ports inside the Playwright container (see
// docker-compose.visual.yml). The base build is `main` (or --base), the
// branch build is the working tree.
export const BASE_DIR = "/builds/base";
export const BRANCH_DIR = "/builds/branch";
export const SNAPSHOT_DIR = "/work/snapshots";
export const REPORT_DIR = "/work/visual-report";
export const BASE_PORT = 6101;
export const BRANCH_PORT = 6102;

// The viewports. #309 (container queries) edits this list for its own PR.
export const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800, tag: "visual-desktop" },
  { name: "mobile", width: 375, height: 812, tag: "visual-mobile" },
] as const;

export type ViewportName = (typeof VIEWPORTS)[number]["name"];

export interface StoryEntry {
  id: string;
  tags: string[];
}

// Stories of one build: `index.json` entries of type story (not docs).
export function readStories(dir: string): Map<string, StoryEntry> {
  const index = JSON.parse(fs.readFileSync(`${dir}/index.json`, "utf8")) as {
    entries: Record<string, { id: string; type: string; tags?: string[] }>;
  };
  const stories = new Map<string, StoryEntry>();
  for (const entry of Object.values(index.entries)) {
    if (entry.type === "story") {
      stories.set(entry.id, { id: entry.id, tags: entry.tags ?? [] });
    }
  }
  return stories;
}

// `visual-mobile` = only the mobile viewport, `visual-desktop` = only the
// desktop one, untagged = both. `index.json` carries tags but not parameters.
export function viewportsFor(tags: string[]): ViewportName[] {
  const limited = VIEWPORTS.filter(v => tags.includes(v.tag));
  return (limited.length ? limited : VIEWPORTS).map(v => v.name);
}

export interface StorySets {
  base: Map<string, StoryEntry>;
  branch: Map<string, StoryEntry>;
  compared: string[];
  added: string[];
  removed: string[];
}

export function loadStorySets(): StorySets {
  const base = readStories(BASE_DIR);
  const branch = readStories(BRANCH_DIR);
  const sorted = (ids: Iterable<string>) => [...ids].sort();
  return {
    base,
    branch,
    compared: sorted([...branch.keys()].filter(id => base.has(id))),
    added: sorted([...branch.keys()].filter(id => !base.has(id))),
    removed: sorted([...base.keys()].filter(id => !branch.has(id))),
  };
}

export const markerPath = (viewport: string, id: string) =>
  `${SNAPSHOT_DIR}/${viewport}/${id}.unstable`;
