#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`  ${path.relative(ROOT, src)} → ${path.relative(ROOT, dest)}`);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

console.log("vercel-build: copying static files to public/");
ensureDir(PUBLIC);

copyFile(path.join(ROOT, "src/ui/index.html"), path.join(PUBLIC, "index.html"));
copyFile(path.join(ROOT, "src/ui/app.js"), path.join(PUBLIC, "app.js"));

copyDir(path.join(ROOT, "assets"), path.join(PUBLIC, "assets"));

console.log("vercel-build: done");
