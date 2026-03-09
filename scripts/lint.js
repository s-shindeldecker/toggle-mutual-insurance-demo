#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) {
    console.log(`  \u2713 ${name}`);
    passed++;
  } else {
    console.log(`  \u2717 ${name}`);
    if (detail) console.log(`    ${detail}`);
    failed++;
  }
}

function readAll(dir, ext) {
  const results = [];
  const abs = path.resolve(ROOT, dir);
  if (!fs.existsSync(abs)) return results;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!ext || entry.name.endsWith(ext)) {
        results.push({ rel: path.relative(ROOT, full), content: fs.readFileSync(full, "utf8") });
      }
    }
  };
  walk(abs);
  return results;
}

// ── Check 1: no metric_ event constants in src/ or docs/ ──────────────────

const srcFiles = readAll("src", ".js");
const docFiles = readAll("docs", ".md");
const allFiles = [...srcFiles, ...docFiles];

const metricHits = [];
for (const f of allFiles) {
  const lines = f.content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/["'`]metric_/.test(line) || /\bMETRIC_/.test(line)) {
      metricHits.push(`${f.rel}:${i + 1}: ${line.trim()}`);
    }
  }
}
check(
  "No metric_ event constants in src/ or docs/",
  metricHits.length === 0,
  metricHits.length > 0 ? `Found:\n      ${metricHits.join("\n      ")}` : undefined
);

// ── Check 2: no modelOutputs in API responses or trackEvent payloads ───────

const serverFile = srcFiles.find((f) => f.rel === path.join("src", "ui", "server.js"));
const trackerFile = srcFiles.find((f) => f.rel === path.join("src", "analytics", "tracker.js"));
const decisionFile = srcFiles.find((f) => f.rel === path.join("src", "quote", "decisionFlow.js"));

const modelOutputHits = [];

function scanForModelOutputsLeak(file, label) {
  if (!file) return;
  const lines = file.content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/modelOutputs/.test(line)) {
      const trimmed = line.trim();
      const isSanitize = /modelOutputs\s*[:=]\s*(undefined|null|void)/.test(trimmed)
        || /delete\b.*modelOutputs/.test(trimmed)
        || /\.modelOutputs\s*==/.test(trimmed)
        || /modelOutputs\s*!=/.test(trimmed)
        || /quote\.modelOutputs/.test(trimmed) && /=\s*(undefined|null)/.test(trimmed);
      const isAssignmentToQuote = /quote\.modelOutputs\s*=/.test(trimmed);
      const isReadFromQuote = /=\s*quote\.modelOutputs/.test(trimmed)
        || /assigned\s*=\s*quote\.modelOutputs/.test(trimmed);
      const isComment = trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
      if (!isSanitize && !isAssignmentToQuote && !isReadFromQuote && !isComment) {
        if (label === "server" || label === "tracker") {
          modelOutputHits.push(`${file.rel}:${i + 1} (${label}): ${trimmed}`);
        }
      }
    }
  }
}

scanForModelOutputsLeak(serverFile, "server");
scanForModelOutputsLeak(trackerFile, "tracker");

const trackEventFiles = [...srcFiles];
for (const f of trackEventFiles) {
  const lines = f.content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/trackEvent\s*\(/.test(lines[i])) {
      const window = lines.slice(i, i + 10).join(" ");
      if (/modelOutputs/.test(window)) {
        modelOutputHits.push(`${f.rel}:${i + 1}: modelOutputs near trackEvent call`);
      }
    }
  }
}

check(
  "No modelOutputs leaking into API responses or trackEvent payloads",
  modelOutputHits.length === 0,
  modelOutputHits.length > 0 ? `Found:\n      ${modelOutputHits.join("\n      ")}` : undefined
);

// ── Check 3: shadow scoring decoupled invariant ────────────────────────────

let shadowCouplingViolation = null;
if (decisionFile) {
  const src = decisionFile.content;
  const fnMatch = src.match(/const computeShadowScoring[\s\S]*?^};/m);
  if (fnMatch) {
    const fnBody = fnMatch[0];
    const pricingShadowCalls = [...fnBody.matchAll(/evaluateFakeModels\s*\([^)]*\)/g)];
    for (const call of pricingShadowCalls) {
      const callText = call[0];
      if (/shadowPricingVariant/.test(callText) && /shadowRiskVariant/.test(callText)) {
        shadowCouplingViolation =
          "Pricing shadow call includes shadowRiskVariant — must use assignedRiskVariant";
      }
    }
    if (/priceShadow.*evaluateFakeModels\([^,]*,\s*shadowRiskVariant/.test(fnBody)) {
      shadowCouplingViolation =
        "priceShadow evaluateFakeModels call passes shadowRiskVariant instead of assignedRiskVariant";
    }
  } else {
    shadowCouplingViolation = "Could not locate computeShadowScoring function body";
  }
}
check(
  "Shadow scoring: pricing shadow uses assignedRiskVariant (decoupled)",
  shadowCouplingViolation === null,
  shadowCouplingViolation
);

// ── Check 4: docs describe shadowResults as optional + diagnostic + decoupled

const analyticsDoc = docFiles.find((f) => f.rel === path.join("docs", "analytics-events.md"));
const docMissing = [];
if (analyticsDoc) {
  const txt = analyticsDoc.content.toLowerCase();
  if (!/shadowresults/.test(txt)) docMissing.push("shadowResults");
  if (!/optional/.test(txt) && !/diagnostic.only/.test(txt)) docMissing.push("optional/diagnostic-only");
  if (!/diagnostic.only/.test(txt)) docMissing.push("diagnostic-only");
  if (!/decoupled/.test(txt)) docMissing.push("decoupled");
} else {
  docMissing.push("docs/analytics-events.md not found");
}
check(
  "docs/analytics-events.md documents shadowResults as optional + diagnostic-only + decoupled",
  docMissing.length === 0,
  docMissing.length > 0 ? `Missing: ${docMissing.join(", ")}` : undefined
);

// ── Results ────────────────────────────────────────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
