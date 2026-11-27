import fs from "node:fs";
import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { REPORT_DIR, loadStorySets, markerPath, viewportsFor } from "./stories";

// Writes summary.json for scripts/test-visual.sh. The script derives its exit
// code from this file only: Playwright itself exits 1 on any failure and
// cannot tell a changed image from an infrastructure error.
const pass = process.env.VISUAL_PASS === "base" ? "base" : "branch";

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, "");

interface Item {
  id: string;
  viewport: string;
}

export default class SummaryReporter implements Reporter {
  private compared = 0;
  private changed: Item[] = [];
  private errors: (Item & { message: string })[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    const item = { id: test.title, viewport: test.parent.project()!.name };
    const types = test.annotations.map(a => a.type);
    if (result.status === "skipped") return;
    if (result.status === "passed") {
      if (!types.includes("new") && !types.includes("no-baseline")) {
        this.compared++;
      }
      return;
    }
    const message = stripAnsi(
      result.errors.map(e => e.message ?? "").join("\n")
    );
    if (
      pass === "branch" &&
      !message.includes("VISUAL_INFRA") &&
      /Screenshot comparison failed|toHaveScreenshot\(expected\) failed/.test(
        message
      )
    ) {
      this.compared++;
      this.changed.push(item);
    } else {
      this.errors.push({ ...item, message: message.split("\n")[0] });
    }
  }

  onEnd(_result: FullResult) {
    const sets = loadStorySets();
    const unstable: Item[] = [];
    for (const id of sets.compared) {
      const tags = (pass === "base" ? sets.base : sets.branch).get(id)!.tags;
      for (const viewport of viewportsFor(tags)) {
        if (fs.existsSync(markerPath(viewport, id))) {
          unstable.push({ id, viewport });
        }
      }
    }
    const summary = {
      pass,
      compared: this.compared,
      stories: sets.compared.length,
      changed: this.changed,
      added: sets.added,
      removed: sets.removed,
      unstable,
      errors: this.errors,
    };
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(
      `${REPORT_DIR}/${pass === "base" ? "summary-base.json" : "summary.json"}`,
      JSON.stringify(summary, null, 2)
    );
  }
}
