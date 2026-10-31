// The vendored UMD build is the official Webamp embedding artifact. esbuild
// inlines it into content.js; no remote script or network-loaded Webamp code
// is used.
import Webamp from "../../vendor/webamp/webamp.bundle.min.cjs";
import type { WebampConstructor } from "./webampTypes";

export function loadWebamp(): WebampConstructor | null {
  const ctor = Webamp as WebampConstructor;
  if (typeof ctor !== "function") return null;
  try {
    if (ctor.browserIsSupported && !ctor.browserIsSupported()) return null;
  } catch {
    return null;
  }
  return ctor;
}
