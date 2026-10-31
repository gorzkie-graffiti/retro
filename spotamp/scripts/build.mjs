import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const isWatch = process.argv.includes("--watch");

async function copyStatic() {
  await mkdir(dist, { recursive: true });
  await cp(path.join(root, "public"), dist, { recursive: true });
  await cp(
    path.join(root, "src/vendor/webamp/LICENSE.txt"),
    path.join(dist, "WEBAMP-LICENSE.txt"),
  );
  const notices = await readFile(
    path.join(root, "THIRD_PARTY_NOTICES.md"),
    "utf8",
  ).catch(() => "");
  if (notices) {
    await writeFile(path.join(dist, "THIRD_PARTY_NOTICES.md"), notices);
  }

  // A packaged extension whose manifest version disagrees with the project is
  // rejected by the release script, so fail at build time with a clear message.
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const manifestPath = path.join(dist, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.version !== pkg.version) {
    throw new Error(
      `Version mismatch: package.json is ${pkg.version}, public/manifest.json is ${manifest.version}. Bump both before building.`,
    );
  }
}

await rm(dist, { recursive: true, force: true });
await copyStatic();

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: [path.join(root, "src/content/index.ts")],
  bundle: true,
  outfile: path.join(dist, "content.js"),
  format: "iife",
  platform: "browser",
  target: ["chrome114", "firefox115"],
  loader: {
    ".css": "text",
  },
  minify: !isWatch,
  sourcemap: isWatch ? "inline" : false,
  legalComments: "none",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  logLevel: "info",
};

if (isWatch) {
  const context = await esbuild.context(options);
  await context.watch();
  console.log("Spotamp: watching src/content (static files copied once)");
} else {
  await esbuild.build(options);
  console.log("Spotamp: built dist/");
}
