import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isFirefox = process.argv.includes("--firefox");
const isWatch = process.argv.includes("--watch");
const outDir = path.join(root, isFirefox ? "dist-firefox" : "dist");
const outName = path.relative(root, outDir);

/**
 * Manifest V2 translation for Firefox 113.
 *
 * Firefox only grants Manifest V3 host permissions automatically from version
 * 127, so on 113 an MV3 content script never runs. MV2 keeps the old
 * install-time host permission model and works out of the box. Firefox also
 * requires an explicit add-on ID for temporary installs.
 */
function toFirefoxManifest(mv3) {
  const manifest = {
    manifest_version: 2,
    name: mv3.name,
    short_name: mv3.short_name,
    version: mv3.version,
    description: mv3.description,
    permissions: [...(mv3.permissions ?? []), ...(mv3.host_permissions ?? [])],
    content_scripts: mv3.content_scripts,
    icons: mv3.icons,
    browser_action: {
      ...mv3.action,
      browser_style: false,
    },
    browser_specific_settings: {
      gecko: {
        id: "spotamp@gorzkie-graffiti.github.io",
        strict_min_version: "113.0",
      },
    },
  };
  return manifest;
}

async function copyStatic() {
  await mkdir(outDir, { recursive: true });
  await cp(path.join(root, "public"), outDir, { recursive: true });
  await cp(
    path.join(root, "src/vendor/webamp/LICENSE.txt"),
    path.join(outDir, "WEBAMP-LICENSE.txt"),
  );
  const notices = await readFile(
    path.join(root, "THIRD_PARTY_NOTICES.md"),
    "utf8",
  ).catch(() => "");
  if (notices) {
    await writeFile(path.join(outDir, "THIRD_PARTY_NOTICES.md"), notices);
  }

  // A packaged extension whose manifest version disagrees with the project is
  // rejected by the release script, so fail at build time with a clear message.
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const manifestPath = path.join(outDir, "manifest.json");
  let manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.version !== pkg.version) {
    throw new Error(
      `Version mismatch: package.json is ${pkg.version}, public/manifest.json is ${manifest.version}. Bump both before building.`,
    );
  }

  if (isFirefox) {
    manifest = toFirefoxManifest(manifest);
    await writeFile(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
  }
}

await rm(outDir, { recursive: true, force: true });
await copyStatic();

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: [path.join(root, "src/content/index.ts")],
  bundle: true,
  outfile: path.join(outDir, "content.js"),
  format: "iife",
  platform: "browser",
  target: isFirefox ? ["firefox113"] : ["chrome114"],
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
  console.log(
    `Spotamp: watching src/content (${outName} static files copied once)`,
  );
} else {
  await esbuild.build(options);
  console.log(`Spotamp: built ${outName}/`);
}
