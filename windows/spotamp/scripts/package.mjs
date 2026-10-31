import { spawnSync } from "node:child_process";
import { access, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const release = path.join(root, "release");

const required = [
  "manifest.json",
  "content.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
  "WEBAMP-LICENSE.txt",
  "THIRD_PARTY_NOTICES.md",
];

const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(
  await readFile(path.join(dist, "manifest.json"), "utf8").catch(() => {
    throw new Error("dist/manifest.json is missing. Run `npm run build` first.");
  }),
);

for (const file of required) {
  await access(path.join(dist, file)).catch(() => {
    throw new Error(`Missing dist/${file}. Run \`npm run build\` first.`);
  });
}

if (manifest.manifest_version !== 3) {
  throw new Error("Expected a Manifest V3 build.");
}
if (manifest.version !== pkg.version) {
  throw new Error(
    `Version mismatch: package.json is ${pkg.version}, manifest is ${manifest.version}.`,
  );
}

const probe = spawnSync("zip", ["-v"], { stdio: "ignore" });
if (probe.status !== 0) {
  throw new Error(
    "The `zip` command is required to package Spotamp. Install zip or run the build and archive dist/ manually.",
  );
}

await mkdir(release, { recursive: true });
const archive = path.join(release, `spotamp-${pkg.version}.zip`);
await rm(archive, { force: true });

const zip = spawnSync("zip", ["-q", "-r", "-X", archive, "."], {
  cwd: dist,
  stdio: "inherit",
});
if (zip.status !== 0) {
  throw new Error(`zip failed with exit code ${zip.status ?? "unknown"}.`);
}

const size = (await stat(archive)).size;
console.log(
  `Spotamp: packaged release/spotamp-${pkg.version}.zip (${(size / 1024).toFixed(0)} KiB)`,
);
