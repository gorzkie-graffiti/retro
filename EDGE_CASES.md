# Edge cases

Honest notes from setting up the retro Windows build and the eXPerience Firefox skin. These are the things that broke, and what got around them.

## Known issues

- **Spotify doesn't work on the bundled browser.** Upgrade to **115.0esr** to use the extension. Anything older and Spotamp won't load.
- **The skin breaks after updating to the latest version.** Check `about:policies` and see whether updates are disabled. If they aren't, the browser updates itself out of the version the skin was built for.
- **After uninstalling and reinstalling, the skin is gone.** A plain reinstall doesn't bring the skin back; you have to load the extracted build (below).
- **The extension doesn't work on Firefox.** The current eXPerience extension is broken in Firefox and still needs to be fixed. Loading the extracted build is the only route that works right now.
- **Even the official author's repo ([windows-experience/eXPeriencefox](https://github.com/windows-experience/eXPeriencefox)) doesn't properly work.** Don't change or reinstall Firefox — load the extracted version instead.

## Extracted build

Download the pre-extracted build here:

**[firefox-extract.zip](https://github.com/gorzkie-graffiti/retro/releases/download/firefox-extract/firefox-extract.zip)**

It already has the program folder, the profile, and `profiles.ini` in place, so you don't install Firefox and you don't install the skin separately.

## Where things go on Windows

| what | where on Windows |
|------|-----------------|
| `program/Mozilla Firefox/` | `C:\Program Files\Mozilla Firefox\` |
| `profile/xwq26urm.default-release/` | `C:\Users\<username>\AppData\Roaming\Mozilla\Firefox\Profiles\xwq26urm.default-release\` |
| `profiles.ini` | `C:\Users\<username>\AppData\Roaming\Mozilla\Firefox\profiles.ini` |

`AppData` is hidden by default — paste the path directly into Explorer's address bar if you can't see it~ mrrp

Maybe I'm stupid and that's why it doesn't work for me, idk.

---

Will add more.
