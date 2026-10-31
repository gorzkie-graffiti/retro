export const PLAYER_HTML = `
<aside data-testid="now-playing-bar" aria-label="Now playing bar">
  <div data-testid="now-playing-widget-v2" role="region" aria-label="Now playing: Song One by Artist A">
    <img data-testid="cover-art-image" src="https://img.example/cover.jpg" alt="" />
    <a href="/album/album-one">Song One</a>
    <span data-testid="now-playing-widget-v2-byline"><a href="/artist/artist-a">Artist A</a></span>
    <button aria-label="Add to playlist"></button>
  </div>
  <div data-testid="player-controls" aria-label="Player controls">
    <button aria-label="Shuffle"></button>
    <button data-testid="control-button-skip-back" aria-disabled="true" aria-label="Previous"></button>
    <button data-testid="control-button-playpause" aria-label="Play"></button>
    <button data-testid="control-button-skip-forward" aria-label="Next"></button>
    <button data-testid="control-button-repeat" role="checkbox" aria-checked="false" aria-label="Enable repeat"></button>
  </div>
  <div>
    <div data-testid="playback-position">0:03</div>
    <div data-testid="playback-progressbar"><input type="range" min="0" max="210000" step="1000" value="3000" /></div>
    <div data-testid="playback-duration">3:30</div>
  </div>
  <div data-testid="volume-bar">
    <input type="range" min="0" max="1" step="0.1" value="0.7" />
  </div>
  <button data-testid="control-button-queue" aria-label="Queue"></button>
  <button data-testid="lyrics-button" aria-label="Lyrics"></button>
  <button aria-label="Connect to a device"></button>
  <button data-testid="pip-toggle-button"></button>
  <button data-testid="fullscreen-mode-button"></button>
</aside>`;

export const TRACK_ROW_HTML = `
<div data-testid="tracklist-row">
  <div role="gridcell">
    <span>1</span>
    <button data-testid="play-button" aria-label="Play Other Song by Artist B"></button>
  </div>
  <div role="gridcell">
    <img src="https://img.example/other.jpg" alt="" />
    <a data-testid="internal-track-link" href="/track/track-bbb">Other Song</a>
    <a href="/artist/artist-b">Artist B</a>
  </div>
  <div role="gridcell"><a href="/album/album-two">Another Album</a></div>
  <div role="gridcell"><span>4:12</span></div>
</div>`;

export function pageFixture(kind: string): string {
  const roots: Record<string, string> = {
    home: '<section data-testid="home-page"></section>',
    playlist: '<section data-testid="playlist-page"></section>',
    "daily-mix": '<section data-testid="playlist-page"></section>',
    "liked-songs": '<section data-testid="playlist-page"></section>',
    album: '<section data-testid="album-page"></section>',
    artist: '<section data-testid="artist-page"></section>',
    search: "<main></main>",
    unknown: "<div></div>",
  };
  return `
    <nav aria-label="Main">
      <div role="row"><a href="/playlist/abc">Playlist</a></div>
      <a href="/collection/tracks">Liked Songs</a>
    </nav>
    <main>
      ${roots[kind] ?? "<div></div>"}
      <div data-testid="entity-header">
        <div data-testid="entityTitle"><h1>Test ${kind}</h1></div>
      </div>
      <div data-testid="action-bar">
        <button data-testid="play-button"></button>
      </div>
      <div data-testid="track-list">
        ${TRACK_ROW_HTML}
      </div>
      <section data-testid="component-shelf"></section>
    </main>
    ${PLAYER_HTML}
    <aside aria-label="Now playing view"><div data-testid="lyrics-npv-section"></div></aside>
  `;
}
