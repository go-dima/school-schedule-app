import { defineConfig } from "@playwright/test";
import {
  BASE_DIR,
  BASE_PORT,
  BRANCH_DIR,
  BRANCH_PORT,
  REPORT_DIR,
  SNAPSHOT_DIR,
  VIEWPORTS,
} from "./stories";

// Loaded inside the Playwright container. VISUAL_PASS selects the pass:
// "base" shoots the base build into the snapshot folder (run with
// --update-snapshots), "branch" shoots the branch build and compares.
const pass = process.env.VISUAL_PASS === "base" ? "base" : "branch";

export default defineConfig({
  testDir: "/work/visual",
  testMatch: "shoot.visual.ts",
  outputDir: "/work/test-results",
  // The snapshot folder is keyed by viewport and story id.
  snapshotPathTemplate: `${SNAPSHOT_DIR}/{projectName}/{arg}{ext}`,
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 45_000,
  expect: {
    toHaveScreenshot: {
      // Both sides render in one container: no tolerance.
      threshold: 0,
      maxDiffPixels: 0,
      animations: "disabled",
    },
  },
  reporter:
    pass === "base"
      ? [["line"], ["./summary-reporter.ts"]]
      : [
          ["line"],
          ["html", { outputFolder: REPORT_DIR, open: "never" }],
          ["json", { outputFile: `${REPORT_DIR}/results.json` }],
          ["./summary-reporter.ts"],
        ],
  use: {
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
    // Software rasterisation with fixed text and colour settings: rounded
    // corners and anti-aliasing then come out the same on every shot.
    launchOptions: {
      args: [
        "--disable-gpu",
        "--disable-lcd-text",
        "--font-render-hinting=none",
        "--force-color-profile=srgb",
        "--disable-skia-runtime-opts",
        "--disable-partial-raster",
        "--disable-threaded-animation",
      ],
    },
  },
  projects: VIEWPORTS.map(v => ({
    name: v.name,
    use: { viewport: { width: v.width, height: v.height } },
  })),
  webServer: [
    {
      command: `node /work/visual/serve.mjs ${BASE_DIR} ${BASE_PORT}`,
      port: BASE_PORT,
      reuseExistingServer: false,
    },
    {
      command: `node /work/visual/serve.mjs ${BRANCH_DIR} ${BRANCH_PORT}`,
      port: BRANCH_PORT,
      reuseExistingServer: false,
    },
  ],
});
