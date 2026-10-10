#!/usr/bin/env tsx
/**
 * App flow chart generator: draws how routes, pages, components, hooks,
 * contexts, services and the API layer import each other, as a Mermaid
 * flowchart built from the real imports under src/.
 *
 * Usage:
 *   npm run docs:app-flow                        rewrite the chart in docs/app-flow.md
 *   npm run docs:app-flow:check                  exit 1 if docs/app-flow.md is stale
 *   npm run docs:app-flow -- --html <out.html>   also write the interactive page
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = path.join(ROOT, "src");
const DOC = path.join(ROOT, "docs", "app-flow.md");
const API_FILE = "services/api.ts";
const START_MARKER = "<!-- app-flow:start -->";
const END_MARKER = "<!-- app-flow:end -->";

type Kind =
  | "route"
  | "page"
  | "element"
  | "hook"
  | "context"
  | "service"
  | "api";

// All paths below are relative to src/.

// Files that are one concept split in two: the owner takes over both their
// imports and their importers.
const MERGE: [RegExp, string][] = [
  [/^main\.tsx$/, "App.tsx"],
  [/^routes\/resolveGate\.ts$/, "routes/guards.tsx"],
  [/^contexts\/(\w+)ContextObject\.ts$/, "contexts/$1Context.tsx"],
];

// Small helpers owned by one component: the owner takes over their imports,
// and files that import a helper get no edge (like a utils/ import).
const ABSORB: [RegExp, string][] = [
  [/^components\/textSearchOptions\.ts$/, "components/TextSearch.tsx"],
  [
    /^components\/childAccountLink\.ts$/,
    "components/ChildAccountLinkPicker.tsx",
  ],
  [/^components\/childDuplicateWarning\.ts$/, "components/ChildForm.tsx"],
  [
    /^components\/lessonCard\/lessonCardModel\.ts$/,
    "components/lessonCard/ClassCard.tsx",
  ],
  [
    /^components\/toggleOptionClassName\.ts$/,
    "components/ToggleFilterGroup.tsx",
  ],
];

// First match wins. A file that matches nothing (utils/, constants/, types/,
// routes/paths) is left out of the chart. services/api.ts is not a node: it
// is split into its exported `xxxApi` namespaces.
const CLASSIFY: [RegExp, Kind][] = [
  [/^services\/supabase\.ts$/, "api"],
  [/^App\.tsx$/, "route"],
  [/^routes\/(router|guards|ByUiMode)\.tsx$/, "route"],
  [/^layouts\/use\w+\.tsx?$/, "hook"],
  [/^layouts\//, "route"],
  [/^pages\/(\w+\/)?\w+Page\.tsx$/, "page"],
  [/^pages\/\w+\/use\w+\.tsx?$/, "hook"],
  [/^pages\/\w+\/[A-Z]\w*\.tsx$/, "element"],
  [/^pages\/\w+\/[a-z]\w*\.ts$/, "service"],
  [/^components\/(\w+\/)*use\w+\.tsx?$/, "hook"],
  [/^(components|elements)\/.*\.tsx$/, "element"],
  [/^hooks\//, "hook"],
  [/^contexts\/\w+Context\.tsx$/, "context"],
  [/^services\//, "service"],
];

// Chart columns, left to right; the first match wins.
const COLUMNS: [string, string, (file: string, kind: Kind) => boolean][] = [
  ["routing", "Routing & Layouts", (_, kind) => kind === "route"],
  [
    "pages",
    "Pages",
    (file, kind) =>
      file.startsWith("pages/") && (kind === "page" || kind === "element"),
  ],
  [
    "components",
    "Components",
    (file, kind) => kind === "element" && file.startsWith("components/"),
  ],
  [
    "elements",
    "Elements",
    (file, kind) => kind === "element" && file.startsWith("elements/"),
  ],
  ["hooks", "Hooks", (_, kind) => kind === "hook"],
  ["contexts", "Contexts", (_, kind) => kind === "context"],
  ["services", "Services", (_, kind) => kind === "service"],
  ["api", "API", (_, kind) => kind === "api"],
];

const KINDS: { kind: Kind; label: string; fill: string; stroke: string }[] = [
  {
    kind: "route",
    label: "Routing / layout",
    fill: "#c4b5fd",
    stroke: "#6d28d9",
  },
  { kind: "page", label: "Page", fill: "#93c5fd", stroke: "#1d4ed8" },
  {
    kind: "element",
    label: "Component / element",
    fill: "#86efac",
    stroke: "#15803d",
  },
  { kind: "hook", label: "Hook", fill: "#fde68a", stroke: "#b45309" },
  { kind: "context", label: "Context", fill: "#f9a8d4", stroke: "#be185d" },
  { kind: "service", label: "Service", fill: "#fdba74", stroke: "#c2410c" },
  { kind: "api", label: "API", fill: "#67e8f9", stroke: "#0e7490" },
];

const SKIP = [
  /\.test\.tsx?$/,
  /\.stories\.tsx?$/,
  /\.d\.ts$/,
  /^stories\//,
  /^testUtils\//,
];

const MERMAID_RESERVED = new Set([
  "end",
  "graph",
  "flowchart",
  "subgraph",
  "direction",
  "style",
  "class",
  "classDef",
  "click",
  "linkStyle",
]);

interface GraphNode {
  id: string;
  label: string;
  kind: Kind;
  file: string;
  column: string;
  group: string;
}

interface Graph {
  nodes: GraphNode[];
  edges: [string, string][];
  leftOut: string[];
}

interface Import {
  target: string;
  names: string[];
}

function listSourceFiles(dir: string, base = ""): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory())
        return listSourceFiles(path.join(dir, entry.name), rel);
      return /\.tsx?$/.test(entry.name) ? [rel] : [];
    })
    .filter(rel => !SKIP.some(re => re.test(rel)));
}

function parse(file: string): ts.SourceFile {
  const text = fs.readFileSync(path.join(SRC, file), "utf8");
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
}

function resolveSpecifier(
  from: string,
  spec: string,
  files: Set<string>
): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) {
    base = path.posix.join(path.posix.dirname(from), spec);
  } else return null;
  const candidates = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
  return candidates.map(ext => base + ext).find(c => files.has(c)) ?? null;
}

// Value imports of a file: static imports, re-exports and dynamic import().
// Type-only imports are dropped.
function readImports(
  file: string,
  sf: ts.SourceFile,
  files: Set<string>
): Import[] {
  const imports: Import[] = [];
  const add = (spec: string, names: string[]) => {
    const target = resolveSpecifier(file, spec, files);
    if (target) imports.push({ target, names });
  };

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const clause = stmt.importClause;
      const spec = (stmt.moduleSpecifier as ts.StringLiteral).text;
      if (!clause) {
        add(spec, []);
        continue;
      }
      if (clause.isTypeOnly) continue;
      const names: string[] = [];
      if (clause.name) names.push("default");
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) names.push("*");
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          if (!el.isTypeOnly) names.push((el.propertyName ?? el.name).text);
        }
      }
      if (names.length > 0) add(spec, names);
    } else if (
      ts.isExportDeclaration(stmt) &&
      stmt.moduleSpecifier &&
      !stmt.isTypeOnly
    ) {
      add((stmt.moduleSpecifier as ts.StringLiteral).text, ["*"]);
    }
  }

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      add(node.arguments[0].text, ["default"]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return imports;
}

// The `export const xxxApi = {...}` namespaces of api.ts, each with the
// files its body uses.
function readApiNamespaces(
  sf: ts.SourceFile,
  files: Set<string>
): Map<string, Set<string>> {
  const localToFile = new Map<string, string>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    if (stmt.importClause.isTypeOnly) continue;
    const spec = (stmt.moduleSpecifier as ts.StringLiteral).text;
    const target = resolveSpecifier(API_FILE, spec, files);
    if (!target) continue;
    const { name, namedBindings } = stmt.importClause;
    if (name) localToFile.set(name.text, target);
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      localToFile.set(namedBindings.name.text, target);
    }
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const el of namedBindings.elements) {
        if (!el.isTypeOnly) localToFile.set(el.name.text, target);
      }
    }
  }

  const namespaces = new Map<string, Set<string>>();
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const exported = stmt.modifiers?.some(
      m => m.kind === ts.SyntaxKind.ExportKeyword
    );
    if (!exported) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      if (!decl.name.text.endsWith("Api")) continue;
      const used = new Set<string>();
      const visit = (node: ts.Node) => {
        if (ts.isIdentifier(node) && localToFile.has(node.text)) {
          used.add(localToFile.get(node.text)!);
        }
        ts.forEachChild(node, visit);
      };
      visit(decl.initializer);
      namespaces.set(decl.name.text, used);
    }
  }
  return namespaces;
}

function applyRules(file: string, rules: [RegExp, string][]): string | null {
  for (const [re, owner] of rules) {
    if (re.test(file)) return file.replace(re, owner);
  }
  return null;
}

function classify(file: string): Kind | null {
  if (file === API_FILE) return null;
  return CLASSIFY.find(([re]) => re.test(file))?.[1] ?? null;
}

function makeNode(file: string, kind: Kind, id: string): GraphNode {
  const column = COLUMNS.find(([, , match]) => match(file, kind))?.[0];
  if (!column) throw new Error(`No chart column for ${file} (${kind})`);
  const folder = file.match(/^pages\/(\w+)\//)?.[1];
  const group = column === "pages" ? (folder ?? "") : "";
  const label = id.startsWith("Mobile") ? `📱 ${id}` : id;
  return { id, label, kind, file: `src/${file}`, column, group };
}

export function buildGraph(): Graph {
  const fileList = listSourceFiles(SRC).sort();
  const files = new Set(fileList);
  const nodes = new Map<string, GraphNode>();
  const fileNode = new Map<string, GraphNode>();
  const leftOut: string[] = [];

  const addNode = (node: GraphNode) => {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(node.id))
      throw new Error(`Node id "${node.id}" is not a plain identifier`);
    if (MERMAID_RESERVED.has(node.id))
      throw new Error(`Node id "${node.id}" is a Mermaid keyword`);
    const existing = nodes.get(node.id);
    if (existing && existing.file !== node.file)
      throw new Error(
        `Two files map to "${node.id}": ${existing.file}, ${node.file}`
      );
    nodes.set(node.id, node);
  };

  // MERGE renames a file to its owner; ABSORB hides a helper from importers.
  const canonical = (file: string) => applyRules(file, MERGE) ?? file;
  const absorbedInto = (file: string) => applyRules(file, ABSORB);

  for (const file of fileList) {
    if (file === API_FILE || absorbedInto(file)) continue;
    const owner = canonical(file);
    const kind = classify(owner);
    if (!kind) {
      leftOut.push(file);
      continue;
    }
    const id = path.posix.basename(owner).replace(/\.tsx?$/, "");
    const node = makeNode(owner, kind, id);
    addNode(node);
    fileNode.set(file, node);
  }
  for (const file of fileList) {
    const owner = absorbedInto(file);
    if (owner) {
      const node = fileNode.get(owner);
      if (!node) throw new Error(`ABSORB owner ${owner} is not in the chart`);
      fileNode.set(file, node);
    }
  }

  const namespaces = readApiNamespaces(parse(API_FILE), files);
  for (const name of namespaces.keys()) {
    addNode({
      id: name,
      label: name,
      kind: "api",
      file: `src/${API_FILE}`,
      column: "api",
      group: "",
    });
  }

  const edges = new Set<string>();
  const addEdge = (from: GraphNode | undefined, to: GraphNode | undefined) => {
    if (from && to && from.id !== to.id) edges.add(`${from.id} ${to.id}`);
  };

  for (const [name, used] of namespaces) {
    for (const target of used) {
      if (!absorbedInto(target)) addEdge(nodes.get(name), fileNode.get(target));
    }
  }

  for (const file of fileList) {
    if (file === API_FILE) continue;
    const from = fileNode.get(file);
    if (!from) continue;
    for (const imp of readImports(file, parse(file), files)) {
      if (imp.target === API_FILE) {
        for (const name of imp.names) {
          if (namespaces.has(name)) addEdge(from, nodes.get(name));
        }
      } else if (!absorbedInto(imp.target)) {
        addEdge(from, fileNode.get(imp.target));
      }
    }
  }

  return {
    nodes: [...nodes.values()].sort((a, b) => compare(a.id, b.id)),
    edges: [...edges].sort(compare).map(e => e.split(" ") as [string, string]),
    leftOut,
  };
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function renderMermaid(graph: Graph): string {
  const lines = ["flowchart LR"];
  const nodeLine = (n: GraphNode, indent: string) =>
    `${indent}${n.id}["${n.label}"]:::${n.kind}`;

  lines.push('  subgraph legend["Legend"]', "    direction TB");
  for (const k of KINDS) {
    const id = `legend${k.kind[0].toUpperCase()}${k.kind.slice(1)}`;
    lines.push(`    ${id}["${k.label}"]:::${k.kind}`);
  }
  lines.push("  end");

  for (const [column, title] of COLUMNS) {
    const members = graph.nodes.filter(n => n.column === column);
    if (members.length === 0) continue;
    lines.push(`  subgraph ${column}Column["${title}"]`);
    const groups = [...new Set(members.map(n => n.group))].sort(compare);
    for (const group of groups) {
      const inGroup = members.filter(n => n.group === group);
      if (!group) {
        inGroup.forEach(n => lines.push(nodeLine(n, "    ")));
        continue;
      }
      lines.push(`    subgraph ${group}Folder["pages/${group}/"]`);
      inGroup.forEach(n => lines.push(nodeLine(n, "      ")));
      lines.push("    end");
    }
    lines.push("  end");
  }

  for (const [from, to] of graph.edges) lines.push(`  ${from} --> ${to}`);

  for (const k of KINDS) {
    lines.push(
      `  classDef ${k.kind} fill:${k.fill},stroke:${k.stroke},color:#111827`
    );
  }
  return lines.join("\n");
}

function renderDocRegion(mermaid: string): string {
  return [
    START_MARKER,
    "<!-- Generated by scripts/gen-app-flow.ts. Run `npm run docs:app-flow` instead of editing. -->",
    "",
    "```mermaid",
    mermaid,
    "```",
    "",
    END_MARKER,
  ].join("\n");
}

function replaceRegion(doc: string, region: string): string {
  const start = doc.indexOf(START_MARKER);
  const end = doc.indexOf(END_MARKER);
  if (start < 0 || end < start) {
    throw new Error(`${DOC} needs ${START_MARKER} and ${END_MARKER} markers`);
  }
  return doc.slice(0, start) + region + doc.slice(end + END_MARKER.length);
}

function renderHtml(graph: Graph, mermaid: string): string {
  const data = JSON.stringify({
    source: mermaid,
    nodes: graph.nodes.map(({ id, label, kind, file }) => ({
      id,
      label,
      kind,
      file,
    })),
    edges: graph.edges,
    kinds: KINDS,
  }).replace(/</g, "\\u003c");
  return HTML_TEMPLATE.replace(/%NODE_COUNT%/g, String(graph.nodes.length))
    .replace(/%EDGE_COUNT%/g, String(graph.edges.length))
    .replace("%DATA%", () => data);
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const htmlIndex = args.indexOf("--html");
  const htmlPath = htmlIndex >= 0 ? args[htmlIndex + 1] : undefined;
  if (htmlIndex >= 0 && !htmlPath) throw new Error("--html needs a file path");

  const graph = buildGraph();
  const mermaid = renderMermaid(graph);
  const current = fs.readFileSync(DOC, "utf8");
  const next = replaceRegion(current, renderDocRegion(mermaid));

  if (check) {
    if (next !== current) {
      console.error("docs/app-flow.md is stale. Run `npm run docs:app-flow`.");
      process.exit(1);
    }
    console.log("docs/app-flow.md is up to date.");
    return;
  }

  if (next !== current) fs.writeFileSync(DOC, next);
  console.log(
    `docs/app-flow.md: ${graph.nodes.length} nodes, ${graph.edges.length} edges` +
      (next === current ? " (unchanged)" : " (updated)")
  );
  console.log(`Left out (no CLASSIFY rule): ${graph.leftOut.join(", ")}`);

  if (htmlPath) {
    fs.writeFileSync(path.resolve(htmlPath), renderHtml(graph, mermaid));
    console.log(`Wrote ${htmlPath}`);
  }
}

// The interactive page for --html. It loads Mermaid from a CDN and renders
// the same source as the doc, with search, click-to-focus and pan/zoom.
const HTML_TEMPLATE = String.raw`<title>School Schedule App Flow</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  /* Layout: a full-bleed drafting canvas for the import graph, a control strip
     above it, and an inspector rail that lists what the selected module uses
     and what uses it. */
  :root {
    --bg: #f2f4f7;
    --surface: #ffffff;
    --fg: #17202b;
    --muted: #5b6676;
    --line: #d6dce4;
    --edge: #a2acba;
    --cluster: #e8ecf1;
    --out: #2453c9;
    --in: #b9400b;
    --ring: #17202b;
    --font-ui: "Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #0e1319;
      --surface: #151c25;
      --fg: #e3e8ee;
      --muted: #8e9aab;
      --line: #27313e;
      --edge: #4b5767;
      --cluster: #131a22;
      --out: #7fa3ff;
      --in: #fb9a52;
      --ring: #ffffff;
      color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --bg: #0e1319;
    --surface: #151c25;
    --fg: #e3e8ee;
    --muted: #8e9aab;
    --line: #27313e;
    --edge: #4b5767;
    --cluster: #131a22;
    --out: #7fa3ff;
    --in: #fb9a52;
    --ring: #ffffff;
    color-scheme: dark;
  }

  html, body { height: 100%; }
  body {
    background: var(--bg);
    color: var(--fg);
    font: 14px/1.45 var(--font-ui);
  }
  button, input { font: inherit; color: inherit; }
  code, .mono { font-family: var(--font-mono); font-size: 12px; }

  .app { height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr); }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px 28px;
    padding: 14px 16px 12px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .brand { min-width: 0; }
  .brand h1 {
    margin: 0;
    font-size: 19px;
    font-weight: 650;
    letter-spacing: -0.012em;
    text-wrap: balance;
  }
  .brand p { margin: 2px 0 0; color: var(--muted); font-size: 13px; max-width: 64ch; }
  .brand .stat { font-variant-numeric: tabular-nums; color: var(--fg); font-weight: 600; }

  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; min-width: 0; }

  .search { position: relative; display: flex; align-items: center; }
  .search input {
    width: 220px;
    max-width: 100%;
    padding: 6px 70px 6px 10px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
  }
  .search input:focus-visible { outline: 2px solid var(--out); outline-offset: 1px; }
  .search .count {
    position: absolute;
    right: 9px;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }

  .layers { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; border: 0; }
  .layers legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px 3px 5px;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 12.5px;
    cursor: pointer;
    user-select: none;
    background: var(--surface);
  }
  .chip input { position: absolute; opacity: 0; pointer-events: none; }
  .chip:has(input:focus-visible) { outline: 2px solid var(--out); outline-offset: 1px; }
  .chip .sw { width: 12px; height: 12px; border-radius: 3px; border: 1.5px solid; }
  .chip .n { color: var(--muted); font-variant-numeric: tabular-nums; }
  .chip:has(input:not(:checked)) { color: var(--muted); border-style: dashed; }
  .chip:has(input:not(:checked)) .sw { background: transparent !important; }

  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .seg button {
    padding: 4px 10px;
    border: 0;
    background: transparent;
    font-size: 12.5px;
    cursor: pointer;
  }
  .seg button + button { border-left: 1px solid var(--line); }
  .seg button[aria-pressed="true"] { background: var(--fg); color: var(--surface); }
  .seg button:disabled { color: var(--muted); cursor: not-allowed; }
  .seg button:focus-visible, .tool:focus-visible, .link:focus-visible, .go:focus-visible {
    outline: 2px solid var(--out);
    outline-offset: -2px;
  }
  .seg-label { font-size: 12px; color: var(--muted); margin-right: 6px; }

  .stage { display: grid; grid-template-columns: minmax(0, 1fr) 300px; min-height: 0; }
  .canvas { position: relative; overflow: hidden; min-height: 0; touch-action: none; }
  .chart, .chart svg { width: 100%; height: 100%; }
  .chart svg { display: block; cursor: grab; }
  .chart svg:active { cursor: grabbing; }

  .status {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding-inline: 24px;
    color: var(--muted);
    text-align: center;
  }
  .status.is-error { color: var(--in); }

  .tools { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 4px; }
  .tool {
    min-width: 32px;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    cursor: pointer;
    font-size: 14px;
  }

  .inspector {
    overflow: auto;
    padding: 16px;
    background: var(--surface);
    border-left: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .inspector h2 { margin: 0; font-size: 17px; font-weight: 650; word-break: break-word; }
  .inspector p { margin: 0; color: var(--muted); }
  .kind {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .kind .sw { width: 10px; height: 10px; border-radius: 2px; border: 1.5px solid; }
  .path { color: var(--muted); word-break: break-all; }
  .rel h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .rel h3 .line { width: 18px; height: 3px; border-radius: 2px; }
  .rel h3 .n { color: var(--muted); font-variant-numeric: tabular-nums; }
  .rel ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .go {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 6px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: 13px;
  }
  .go:hover { background: var(--bg); }
  .go .sw { flex: none; width: 10px; height: 10px; border-radius: 2px; border: 1.5px solid; }
  .none { color: var(--muted); font-size: 13px; }
  .link {
    align-self: flex-start;
    padding: 5px 10px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    font-size: 12.5px;
  }
  .keys { display: grid; gap: 6px; font-size: 13px; color: var(--muted); }
  .keys div { display: flex; align-items: center; gap: 8px; }
  .keys .line { width: 18px; height: 3px; border-radius: 2px; flex: none; }

  /* Mermaid output, restyled from the page tokens so it follows the theme. */
  .chart .cluster rect { fill: var(--cluster) !important; stroke: var(--line) !important; }
  .chart .cluster-label, .chart .cluster-label * { color: var(--muted) !important; fill: var(--muted) !important; font-weight: 600; }
  .chart .flowchart-link { stroke: var(--edge) !important; transition: opacity 0.15s; }
  .chart marker path { fill: var(--edge) !important; stroke: var(--edge) !important; }
  .chart g.node { transition: opacity 0.15s; }
  .chart g.node[data-node] { cursor: pointer; }
  .chart.has-query g.node[data-node]:not(.is-match) { opacity: 0.14; }
  .chart.has-query .flowchart-link { opacity: 0.08; }
  .chart.has-focus g.node[data-node]:not(.is-focus):not(.is-near) { opacity: 0.14; }
  .chart.has-focus .flowchart-link:not(.is-out):not(.is-in) { opacity: 0.05; }
  .chart .flowchart-link.is-out { stroke: var(--out) !important; stroke-width: 2.5px !important; opacity: 1 !important; }
  .chart .flowchart-link.is-in { stroke: var(--in) !important; stroke-width: 2.5px !important; opacity: 1 !important; }
  .chart g.node.is-focus, .chart g.node.is-near, .chart g.node.is-match { opacity: 1 !important; }
  .chart g.node.is-focus > rect, .chart g.node.is-match > rect { stroke: var(--ring) !important; stroke-width: 3px !important; }
  .chart .is-off { display: none; }

  @media (prefers-reduced-motion: reduce) {
    .chart .flowchart-link, .chart g.node { transition: none; }
  }

  @media (max-width: 760px) {
    .app { height: auto; min-height: 100%; }
    .stage { grid-template-columns: minmax(0, 1fr); }
    .canvas { height: 64vh; }
    .inspector { border-left: 0; border-top: 1px solid var(--line); }
    .search, .search input { width: 100%; }
    .controls { width: 100%; }
  }
</style>

<div class="app">
  <header class="bar">
    <div class="brand">
      <h1>School Schedule app flow</h1>
      <p>Every route, page, component, hook, context, service and API namespace in <code>src/</code>, joined by its real imports: <span class="stat">%NODE_COUNT%</span> modules, <span class="stat">%EDGE_COUNT%</span> import arrows.</p>
    </div>
    <div class="controls">
      <label class="search" for="q">
        <input id="q" type="search" placeholder="Find a file, e.g. useAuth" autocomplete="off" spellcheck="false" aria-label="Find a module">
        <span class="count" id="q-count" aria-live="polite"></span>
      </label>
      <fieldset class="layers" id="layers"><legend>Show kinds</legend></fieldset>
      <div>
        <span class="seg-label">Layout</span>
        <div class="seg" role="group" aria-label="Layout engine">
          <button type="button" id="layout-elk" data-layout="elk">ELK</button>
          <button type="button" id="layout-dagre" data-layout="dagre">Dagre</button>
        </div>
      </div>
    </div>
  </header>

  <main class="stage">
    <div class="canvas" id="canvas">
      <div class="chart" id="chart"></div>
      <div class="status" id="status">Drawing %NODE_COUNT% modules…</div>
      <div class="tools">
        <button type="button" class="tool" id="zoom-in" aria-label="Zoom in">+</button>
        <button type="button" class="tool" id="zoom-out" aria-label="Zoom out">−</button>
        <button type="button" class="tool" id="zoom-fit">Fit</button>
      </div>
    </div>
    <aside class="inspector" id="inspector" aria-live="polite"></aside>
  </main>
</div>

<script type="application/json" id="graph-data">%DATA%</script>
<script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
<script>
(function () {
  "use strict";
  var MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";
  var ELK_URL = "https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.1.7/dist/mermaid-layout-elk.esm.min.mjs";

  var data = JSON.parse(document.getElementById("graph-data").textContent);
  var nodes = {};
  var outs = {};
  var ins = {};
  var kindInfo = {};
  var kindOrder = {};
  data.kinds.forEach(function (k, i) { kindInfo[k.kind] = k; kindOrder[k.kind] = i; });
  data.nodes.forEach(function (n) { nodes[n.id] = n; outs[n.id] = []; ins[n.id] = []; });
  data.edges.forEach(function (e) { outs[e[0]].push(e[1]); ins[e[1]].push(e[0]); });

  var canvas = document.getElementById("canvas");
  var chart = document.getElementById("chart");
  var statusEl = document.getElementById("status");
  var inspector = document.getElementById("inspector");
  var queryEl = document.getElementById("q");
  var countEl = document.getElementById("q-count");

  var state = {
    focus: null,
    query: "",
    hidden: readStore("app-flow-hidden", {}),
    layout: readStore("app-flow-layout", "elk")
  };
  var nodeEls = {};
  var edgeEls = [];
  var panZoom = null;
  var mermaid = null;
  var elkLoaded = false;
  var renders = 0;

  function readStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
  }

  function swatch(kind) {
    var span = document.createElement("span");
    span.className = "sw";
    span.style.background = kindInfo[kind].fill;
    span.style.borderColor = kindInfo[kind].stroke;
    return span;
  }

  // Kind chips: the legend and the layer toggles in one control.
  var layers = document.getElementById("layers");
  data.kinds.forEach(function (k) {
    var label = document.createElement("label");
    label.className = "chip";
    var input = document.createElement("input");
    input.type = "checkbox";
    input.id = "layer-" + k.kind;
    input.checked = !state.hidden[k.kind];
    input.addEventListener("change", function () {
      state.hidden[k.kind] = !input.checked;
      if (!input.checked && state.focus && nodes[state.focus].kind === k.kind) state.focus = null;
      writeStore("app-flow-hidden", state.hidden);
      applyState();
      renderInspector();
    });
    var count = data.nodes.filter(function (n) { return n.kind === k.kind; }).length;
    var n = document.createElement("span");
    n.className = "n";
    n.textContent = String(count);
    label.append(input, swatch(k.kind), document.createTextNode(k.label), n);
    layers.append(label);
  });

  function showStatus(text, isError) {
    statusEl.hidden = false;
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", !!isError);
  }

  async function loadMermaid() {
    if (mermaid) return mermaid;
    mermaid = (await import(MERMAID_URL)).default;
    try {
      var elk = (await import(ELK_URL)).default;
      mermaid.registerLayoutLoaders(elk);
      elkLoaded = true;
    } catch (e) {
      elkLoaded = false;
    }
    return mermaid;
  }

  function nodeIdOf(el) {
    var id = el.getAttribute("data-id");
    if (id && nodes[id]) return id;
    var m = /flowchart-([A-Za-z0-9]+)-\d+$/.exec(el.id || "");
    return m && nodes[m[1]] ? m[1] : null;
  }

  function edgeEndsOf(el) {
    var key = el.getAttribute("data-id") || el.id || "";
    var m = /L[-_]([A-Za-z0-9]+)[-_]([A-Za-z0-9]+)(?:[-_]\d+)+$/.exec(key);
    return m && nodes[m[1]] && nodes[m[2]] ? [m[1], m[2]] : null;
  }

  function indexSvg(svg) {
    nodeEls = {};
    edgeEls = [];
    svg.querySelectorAll("g.node").forEach(function (g) {
      var id = nodeIdOf(g);
      if (!id) return;
      g.setAttribute("data-node", id);
      nodeEls[id] = g;
    });
    svg.querySelectorAll("path.flowchart-link").forEach(function (path) {
      var ends = edgeEndsOf(path);
      if (ends) edgeEls.push({ el: path, from: ends[0], to: ends[1] });
    });
  }

  function setupPanZoom(svg) {
    if (panZoom) { panZoom.destroy(); panZoom = null; }
    svg.removeAttribute("style");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    if (typeof window.svgPanZoom !== "function") return;
    panZoom = window.svgPanZoom(svg, {
      zoomScaleSensitivity: 0.25,
      minZoom: 0.3,
      maxZoom: 40,
      dblClickZoomEnabled: false,
      fit: true,
      center: true
    });
  }

  async function draw() {
    showStatus("Drawing " + data.nodes.length + " modules…");
    try {
      var m = await loadMermaid();
      try { await document.fonts.load('14px "Instrument Sans"'); } catch (e) { /* fallback font */ }
      var layout = state.layout === "elk" && elkLoaded ? "elk" : "dagre";
      m.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        layout: layout,
        maxEdges: 5000,
        maxTextSize: 500000,
        fontFamily: '"Instrument Sans", system-ui, sans-serif',
        themeVariables: { fontFamily: '"Instrument Sans", system-ui, sans-serif', fontSize: "14px" },
        flowchart: { curve: "basis", nodeSpacing: 16, rankSpacing: 80, padding: 10 }
      });
      renders += 1;
      var result = await m.render("app-flow-" + renders, data.source);
      chart.innerHTML = result.svg;
      var svg = chart.querySelector("svg");
      indexSvg(svg);
      setupPanZoom(svg);
      statusEl.hidden = true;
      syncLayoutButtons(layout);
      applyState();
      if (state.focus) centerOn(state.focus);
    } catch (err) {
      showStatus("The chart could not be drawn (" + (err && err.message ? err.message : err) +
        "). The page loads Mermaid from cdn.jsdelivr.net, so check that it is reachable and reload.", true);
    }
  }

  function syncLayoutButtons(active) {
    document.querySelectorAll(".seg button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.layout === active));
      if (b.dataset.layout === "elk" && !elkLoaded) {
        b.disabled = true;
        b.title = "The ELK layout could not be loaded";
      }
    });
  }
  document.querySelectorAll(".seg button").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.getAttribute("aria-pressed") === "true") return;
      state.layout = b.dataset.layout;
      writeStore("app-flow-layout", state.layout);
      draw();
    });
  });

  function matchesQuery(n, q) {
    return n.label.toLowerCase().indexOf(q) >= 0 || n.file.toLowerCase().indexOf(q) >= 0;
  }

  function applyState() {
    var f = state.focus;
    var near = {};
    if (f) {
      outs[f].forEach(function (id) { near[id] = true; });
      ins[f].forEach(function (id) { near[id] = true; });
    }
    var q = state.query.trim().toLowerCase();
    var matches = [];
    data.nodes.forEach(function (n) {
      var off = !!state.hidden[n.kind];
      var match = !!q && !off && matchesQuery(n, q);
      if (match) matches.push(n.id);
      var el = nodeEls[n.id];
      if (!el) return;
      el.classList.toggle("is-off", off);
      el.classList.toggle("is-focus", n.id === f);
      el.classList.toggle("is-near", !!near[n.id]);
      el.classList.toggle("is-match", match);
    });
    edgeEls.forEach(function (e) {
      var off = !!state.hidden[nodes[e.from].kind] || !!state.hidden[nodes[e.to].kind];
      e.el.classList.toggle("is-off", off);
      e.el.classList.toggle("is-out", !off && e.from === f);
      e.el.classList.toggle("is-in", !off && e.to === f);
    });
    chart.classList.toggle("has-focus", !!f);
    chart.classList.toggle("has-query", !!q && !f);
    countEl.textContent = q ? matches.length + (matches.length === 1 ? " match" : " matches") : "";
    return matches;
  }

  // Reads the node's position before zooming: svg-pan-zoom applies zoom on
  // the next frame, so a rect read after zoom() is stale.
  function centerOn(id) {
    var el = nodeEls[id];
    if (!el || !panZoom) return;
    var sizes = panZoom.getSizes();
    var pan = panZoom.getPan();
    var r = el.getBoundingClientRect();
    var c = canvas.getBoundingClientRect();
    var x = (r.left + r.width / 2 - c.left - pan.x) / sizes.realZoom;
    var y = (r.top + r.height / 2 - c.top - pan.y) / sizes.realZoom;
    var real = Math.max(sizes.realZoom, 0.9);
    if (real !== sizes.realZoom) panZoom.zoom(panZoom.getZoom() * (real / sizes.realZoom));
    panZoom.pan({ x: c.width / 2 - x * real, y: c.height / 2 - y * real });
  }

  function select(id, center) {
    state.focus = id;
    applyState();
    renderInspector();
    if (id && center) centerOn(id);
  }

  function relList(title, ids, color) {
    var section = document.createElement("section");
    section.className = "rel";
    var h = document.createElement("h3");
    var line = document.createElement("span");
    line.className = "line";
    line.style.background = color;
    var n = document.createElement("span");
    n.className = "n";
    var visible = ids.filter(function (id) { return !state.hidden[nodes[id].kind]; });
    visible.sort(function (a, b) {
      return kindOrder[nodes[a].kind] - kindOrder[nodes[b].kind] || (a < b ? -1 : a > b ? 1 : 0);
    });
    n.textContent = String(visible.length);
    h.append(line, document.createTextNode(title), n);
    section.append(h);
    if (visible.length === 0) {
      var none = document.createElement("p");
      none.className = "none";
      none.textContent = "Nothing in the shown kinds.";
      section.append(none);
      return section;
    }
    var ul = document.createElement("ul");
    visible.forEach(function (id) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "go";
      b.append(swatch(nodes[id].kind), document.createTextNode(nodes[id].label));
      b.addEventListener("click", function () { select(id, true); });
      li.append(b);
      ul.append(li);
    });
    section.append(ul);
    return section;
  }

  function renderInspector() {
    inspector.textContent = "";
    var f = state.focus;
    if (!f) {
      var h = document.createElement("h2");
      h.textContent = "Pick a module";
      var p = document.createElement("p");
      p.textContent = "Click a box, or search and press Enter, to see what that file uses and what uses it. Drag to pan; scroll to zoom.";
      var keys = document.createElement("div");
      keys.className = "keys";
      [["var(--out)", "Uses: arrows out of the selected file"], ["var(--in)", "Used by: arrows into it"]].forEach(function (k) {
        var row = document.createElement("div");
        var line = document.createElement("span");
        line.className = "line";
        line.style.background = k[0];
        row.append(line, document.createTextNode(k[1]));
        keys.append(row);
      });
      var copy = document.createElement("button");
      copy.type = "button";
      copy.className = "link";
      copy.textContent = "Copy Mermaid source";
      copy.addEventListener("click", function () {
        var done = function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy Mermaid source"; }, 1600); };
        try {
          navigator.clipboard.writeText(data.source).then(done, function () { copy.textContent = "Copy is blocked here"; });
        } catch (e) { copy.textContent = "Copy is blocked here"; }
      });
      inspector.append(h, p, keys, copy);
      return;
    }
    var n = nodes[f];
    var kind = document.createElement("span");
    kind.className = "kind";
    kind.append(swatch(n.kind), document.createTextNode(kindInfo[n.kind].label));
    var title = document.createElement("h2");
    title.textContent = n.label;
    var path = document.createElement("code");
    path.className = "path";
    path.textContent = n.file;
    var clear = document.createElement("button");
    clear.type = "button";
    clear.className = "link";
    clear.textContent = "Clear selection";
    clear.addEventListener("click", function () { select(null); });
    inspector.append(kind, title, path, relList("Uses", outs[f], "var(--out)"), relList("Used by", ins[f], "var(--in)"), clear);
  }

  // A click selects; a drag (pan) does not.
  var down = null;
  canvas.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY }; });
  chart.addEventListener("click", function (e) {
    if (down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 6) return;
    var g = e.target.closest ? e.target.closest("g.node[data-node]") : null;
    select(g ? g.getAttribute("data-node") : null);
  });

  queryEl.addEventListener("input", function () {
    state.query = queryEl.value;
    if (state.focus) { state.focus = null; renderInspector(); }
    applyState();
  });
  queryEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var matches = applyState();
      if (matches.length) select(matches[0], true);
    } else if (e.key === "Escape") {
      queryEl.value = "";
      state.query = "";
      select(null);
    }
  });

  document.getElementById("zoom-in").addEventListener("click", function () { if (panZoom) panZoom.zoomIn(); });
  document.getElementById("zoom-out").addEventListener("click", function () { if (panZoom) panZoom.zoomOut(); });
  document.getElementById("zoom-fit").addEventListener("click", function () {
    if (panZoom) { panZoom.resize(); panZoom.fit(); panZoom.center(); }
  });
  window.addEventListener("resize", function () { if (panZoom) panZoom.resize(); });

  renderInspector();
  draw();
})();
</script>
`;

main();
