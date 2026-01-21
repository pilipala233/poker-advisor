const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const assets = [
  "index.html",
  "original.html",
  "styles.css",
  "app.js",
  "chat.css",
  "chat.js",
  "manifest.json",
  "sw.js",
  "icon.svg",
  "icon-192.png",
  "icon-512.png"
];

const dirs = ["avatars"];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

assets.forEach((asset) => {
  const src = path.join(root, asset);
  const dest = path.join(dist, asset);
  fs.copyFileSync(src, dest);
});

// 复制目录
dirs.forEach((dir) => {
  const srcDir = path.join(root, dir);
  const destDir = path.join(dist, dir);
  fs.mkdirSync(destDir, { recursive: true });
  const files = fs.readdirSync(srcDir);
  files.forEach((file) => {
    fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
  });
});
