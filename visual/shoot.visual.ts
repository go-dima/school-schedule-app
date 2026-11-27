import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  BASE_PORT,
  BRANCH_PORT,
  loadStorySets,
  markerPath,
  viewportsFor,
} from "./stories";

// One test per story and viewport (the suffix `.visual.ts` keeps vitest's
// default glob away from this file). VISUAL_PASS selects the pass:
//  - "base":   shoot the base build twice per story, write the images into the
//              snapshot folder (--update-snapshots) and mark a story whose two
//              shots differ as unstable;
//  - "branch": shoot the branch build and compare with the base images. Stories
//              only on the branch are rendered (to catch errors and external
//              requests) but not compared.
const pass = process.env.VISUAL_PASS === "base" ? "base" : "branch";
const port = pass === "base" ? BASE_PORT : BRANCH_PORT;
const sets = loadStorySets();

// One constant instant for the browser clock (Tuesday, Asia/Jerusalem).
const FIXED_TIME = new Date("2026-10-06T06:00:00Z");

// Marks a failure that is not a visual difference (story error, external
// request). The summary reporter turns it into exit code 2.
const INFRA = "VISUAL_INFRA: ";

const SHOT = { fullPage: true, animations: "disabled", caret: "hide" } as const;

const MOTION_OFF = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
`;

// Runs in the page before any script: a seeded Math.random, and a trap on
// Storybook's channel that records how the story render ended.
const initScript = () => {
  let seed = 1234567;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const w = window as any;
  const attach = (channel: any) => {
    const done = (state: string) => () => {
      w.__visualState = w.__visualState ?? state;
    };
    channel.on("storyRendered", done("rendered"));
    channel.on("storyErrored", done("errored"));
    channel.on("storyThrewException", done("errored"));
    channel.on("storyMissing", done("missing"));
  };
  let channel: any;
  Object.defineProperty(window, "__STORYBOOK_ADDONS_CHANNEL__", {
    configurable: true,
    get: () => channel,
    set: value => {
      channel = value;
      if (value) attach(value);
    },
  });
};

async function openStory(page: Page, id: string, externals: string[]) {
  await page.goto(
    `http://localhost:${port}/iframe.html?id=${id}&viewMode=story`
  );
  await page.waitForFunction(() => (window as any).__visualState, null, {
    timeout: 30_000,
  });
  const state = await page.evaluate(() => (window as any).__visualState);
  const errorScreen = await page.evaluate(() =>
    document.body.classList.contains("sb-show-errordisplay")
  );
  if (state !== "rendered" || errorScreen) {
    throw new Error(`${INFRA}story ${id} shows an error (${state})`);
  }
  await page.evaluate(() => document.fonts.ready);
  // A story that shows a loading spinner on purpose keeps it: give the
  // spinner a moment, then shoot whatever is there.
  await page
    .waitForFunction(() => !document.querySelector(".ant-spin"), null, {
      timeout: 3_000,
    })
    .catch(() => {});
  await page.addStyleTag({ content: MOTION_OFF });
  await page.evaluate(
    () =>
      new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  if (externals.length) {
    throw new Error(
      `${INFRA}story ${id} requested external URLs: ${[...new Set(externals)].join(", ")}`
    );
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(initScript);
  await page.clock.setFixedTime(FIXED_TIME);
});

const ids = pass === "base" ? sets.compared : [...sets.compared, ...sets.added];

for (const id of ids) {
  const tags = (pass === "base" ? sets.base : sets.branch).get(id)!.tags;
  const allowed = viewportsFor(tags);
  const isNew = sets.added.includes(id);

  test(id, async ({ page }, testInfo) => {
    const viewport = testInfo.project.name;
    test.skip(
      !allowed.includes(viewport as never),
      "viewport opted out by tag"
    );

    // Count every request that leaves localhost, and block it.
    const externals: string[] = [];
    await page.route("**/*", route => {
      const { hostname } = new URL(route.request().url());
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return route.continue();
      }
      externals.push(route.request().url());
      return route.abort();
    });

    const name = `${id}.png`;
    const snapshot = testInfo.snapshotPath(name);

    if (pass === "base") {
      await openStory(page, id, externals);
      const first = await page.screenshot(SHOT);
      await openStory(page, id, externals);
      await expect(page).toHaveScreenshot(name, SHOT);
      // Two shots of the same build differ: the story is unstable.
      if (!first.equals(fs.readFileSync(snapshot))) {
        fs.mkdirSync(path.dirname(markerPath(viewport, id)), {
          recursive: true,
        });
        fs.writeFileSync(markerPath(viewport, id), "");
        testInfo.annotations.push({ type: "unstable" });
      }
      return;
    }

    await openStory(page, id, externals);
    if (isNew) {
      testInfo.annotations.push({ type: "new" });
      return;
    }
    if (!fs.existsSync(snapshot)) {
      // The base opted this viewport out by tag.
      testInfo.annotations.push({ type: "no-baseline" });
      return;
    }
    try {
      await expect(page).toHaveScreenshot(name, SHOT);
    } catch (error) {
      if (fs.existsSync(markerPath(viewport, id))) {
        // An unstable story cannot fail the run.
        testInfo.annotations.push({ type: "unstable" });
        return;
      }
      throw error;
    }
  });
}
