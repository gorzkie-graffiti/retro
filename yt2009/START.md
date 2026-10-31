# Starting and using yt2009

This instance is configured for the local network at `http://192.168.0.25:8080`.
It runs in production mode, so every browser must be authorized before it can
use the site.

## Start yt2009

From this project directory, run:

```bash
npm start
```

Wait for the message saying that yt2009 is running on port `8080`, then open
`http://192.168.0.25:8080` from a device on the same LAN.

To stop it, focus the terminal running yt2009 and press `Ctrl+C`. Do not close
the terminal without stopping it first if you want a clean shutdown.

If the server's LAN address changes (for example, after changing networks),
update the `ip` value in `back/config.json`, restart yt2009, and use the new
address in the URLs above.

## API keys

The YouTube innertube and player-token keys are not stored in this repo. Add
them to `back/config.json`:

```json
{
  "innertube_api_key": "YOUR_INNERTUBE_KEY",
  "pot_api_key": "YOUR_POT_KEY"
}
```

or set `YT2009_INNERTUBE_API_KEY` and `YT2009_POT_API_KEY` in the environment.
The upstream [ftde0/yt2009](https://github.com/ftde0/yt2009) project publishes
the same public defaults if you need values. `back/config.json` is git-ignored;
do not commit it.

## Authorize a browser

Production mode protects the instance with access tokens. They are stored only
in `back/config.json`; that file is intentionally restricted to its owner.

1. Open `back/config.json` locally and copy one value from the `tokens` list.
2. In the browser that will use yt2009, open:

   ```text
   http://192.168.0.25:8080/yt2009_nonjs_auth?key=YOUR_TOKEN
   ```

3. Select **return to yt2009**.

The browser now has a persistent authorization cookie. Repeat these steps for
each browser or profile. Treat tokens like passwords: do not put them in a
public repository, screenshot, or chat message.

## Play videos

1. Authorize the browser first.
2. Go to the homepage and search, or open a video by adding its ID to:

   ```text
   http://192.168.0.25:8080/watch?v=VIDEO_ID
   ```

3. Use the HTML5 player by default. The Flash option is only for deliberately
supported legacy-browser setups; modern browsers should not need it.

The first request for a video can take longer because yt2009 fetches metadata
and may cache or prepare media. Some metadata can be less complete without a
Google Data API v3 key, but normal playback still works.

### Access from a NAT virtual machine

Try the host's LAN address above first. For a common VirtualBox NAT setup, the
host is also usually available to the guest at `http://10.0.2.2:8080`.
Port-forwarding is only needed when the host needs to initiate a connection to
the guest; it is not normally needed for the guest to open yt2009 on the host.

## Maintenance

Automatic cleanup is enabled. It keeps the `assets` cache at roughly 10 GB
maximum and limits individual cache files to 15 MB.

- Leave yt2009 running normally; cleanup is automatic.
- Watch free disk space occasionally, especially after heavy video use.
- To reclaim space manually, stop yt2009 first, then remove only unneeded
  cached files inside `assets/`. Needed files are downloaded again later.
- Keep Node.js, ffmpeg, and ImageMagick installed and available in `PATH`.
- Update carefully with `git pull --no-commit`, review changes, then run
  `npm install --allow-git=root` if dependencies changed. Re-run
  `node post_config_setup.js` only when an update specifically requires it;
  it refreshes runtime data and assets.

## Things not to do

- Do not run `chmod -R 777` on this project, `assets`, or `back`. In particular,
  keep `back/config.json` private (`chmod 600 back/config.json` is correct).
- Do not share or commit `back/config.json`: it contains access tokens and may
  contain runtime data tied to this installation.
- Do not expose port `8080` directly to the public internet. This setup has no
  TLS and is intended for your private network.
- Do not delete the entire `back` directory, `node_modules`, or cache structure
  while yt2009 is running.
- Do not use `sudo npm install`; it can leave root-owned files that prevent
  normal maintenance.
- Do not edit generated cache files or `back/yt2009constants.json` by hand
  unless you know why. Back up `back/config.json` before reconfiguring.
