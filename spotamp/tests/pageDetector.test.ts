import { describe, expect, it } from "vitest";
import {
  detectPageKind,
  detectRoute,
  pageLabel,
  pageRootSelector,
} from "../src/content/pageDetector";

function docWith(html: string): Document {
  const doc = document.implementation.createHTMLDocument("Spotify");
  doc.body.innerHTML = html;
  return doc;
}

describe("detectPageKind", () => {
  it("maps Spotify routes to logical pages", () => {
    const doc = docWith("");
    expect(detectPageKind("/", doc)).toBe("home");
    expect(detectPageKind("/search", doc)).toBe("search");
    expect(detectPageKind("/search/foo", doc)).toBe("search");
    expect(detectPageKind("/playlist/abc", doc)).toBe("playlist");
    expect(detectPageKind("/album/abc", doc)).toBe("album");
    expect(detectPageKind("/artist/abc", doc)).toBe("artist");
    expect(detectPageKind("/collection/tracks", doc)).toBe("liked-songs");
    expect(detectPageKind("/section/abc", doc)).toBe("unknown");
  });

  it("detects Daily Mix from the URL id", () => {
    expect(
      detectPageKind("/playlist/37i9dQZF1E360AnQDJHNwZ", docWith("")),
    ).toBe("daily-mix");
  });

  it("detects Daily Mix from the rendered title or data URI", () => {
    const doc = docWith(`
      <section data-testid="playlist-page" data-test-uri="spotify:playlist:abc">
        <span data-testid="entityTitle"><h1>Daily Mix 3</h1></span>
      </section>
    `);
    expect(detectPageKind("/playlist/abc", doc)).toBe("daily-mix");
  });

  it("leaves login routes unstyled", () => {
    expect(detectPageKind("/login", docWith(""))).toBe("unknown");
    expect(detectPageKind("/signup", docWith(""))).toBe("unknown");
  });
});

describe("detectRoute and labels", () => {
  it("returns a route label from the live entity title", () => {
    const doc = docWith(`
      <section data-testid="playlist-page">
        <span data-testid="entityTitle"><h1>Chill</h1></span>
      </section>
    `);
    const route = detectRoute(doc, "https://open.spotify.com/playlist/abc");
    expect(route.kind).toBe("playlist");
    expect(route.label).toBe("Chill");
    expect(route.url).toContain("open.spotify.com");
    expect(pageLabel("liked-songs", doc)).toBe("LIKED SONGS");
  });

  it("maps each kind to its root selector", () => {
    expect(pageRootSelector("home")).toContain("home-page");
    expect(pageRootSelector("playlist")).toContain("playlist-page");
    expect(pageRootSelector("daily-mix")).toContain("playlist-page");
    expect(pageRootSelector("liked-songs")).toContain("playlist-page");
    expect(pageRootSelector("album")).toContain("album-page");
    expect(pageRootSelector("artist")).toContain("artist-page");
    expect(pageRootSelector("search")).toBeNull();
    expect(pageRootSelector("unknown")).toBeNull();
  });
});
