# Vendored Webamp

`webamp.bundle.min.cjs` is the browser UMD build of **Webamp 2.3.1**, produced
from the local checkout in `references/webamp/` (a development reference that
is not committed because it is large and has its own Git history):

```bash
cd references/webamp
pnpm install --frozen-lockfile
pnpm --filter ani-cursor build
pnpm --filter winamp-eqf build
node packages/webamp/scripts/rollup.mjs webamp.bundle.min.js
```

The bundle is MIT-licensed. See `LICENSE.txt` (copied from the Webamp
repository). It is bundled by esbuild into the extension's content script; the
extension never loads remote code.

The build was made with a local `optipng` shim because the optional native
optimizer is unavailable in the build environment. This only skips recompressing
the PNG images embedded in Webamp's default skin; it does not change the skin or
Webamp's behavior.
