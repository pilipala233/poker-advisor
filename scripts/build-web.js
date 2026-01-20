const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const assets = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "sw.js",
  "icon.svg",
  "icon-192.png",
  "icon-512.png"
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

assets.forEach((asset) => {
  const src = path.join(root, asset);
  const dest = path.join(dist, asset);
  fs.copyFileSync(src, dest);
});
