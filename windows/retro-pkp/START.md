# Retro PKP — start and maintenance guide

## How to start Retro PKP

Open two terminals. In both, change to the project directory:

```bash
cd windows/retro-pkp
```

In the first terminal, start the PKP HAFAS proxy Worker:

```bash
npx wrangler dev --port 8787
```

In the second terminal, serve the frontend:

```bash
python3 -m http.server 8000
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000) in a browser.

Keep both terminals running while using the app. The frontend on port `8000`
asks the Worker on port `8787` for live PKP timetable data.

## How to use it

1. Open the **Plan podróży** tab.
2. Enter the departure and arrival stations. Pick an autocomplete suggestion
   when one is offered to get the most accurate station match.
3. Choose the date, time, and whether it is a departure or arrival search.
4. Submit the search and select **szczegóły** beside a connection.
5. The details view shows station stops, live times where available, dwell time,
   and platform information in the form `Peron 2, tor 2`.

The **Stacje** tab is for departure/arrival board searches at one station.

## How to maintain it

- `index.html` contains the page structure and visible Polish text.
- `style.css` contains the retro visual styling.
- `app.js` contains browser-side search, result rendering, journey details, and
  platform formatting.
- `worker.js` is the Cloudflare Worker proxy to the PKP HAFAS endpoint. Keep
  requests going through it; browsers should not call the upstream PKP API
  directly.
- After changing JavaScript, check it before testing:

  ```bash
  node --check app.js
  ```

- Test a complete route after changes: station autocomplete, connection search,
  **szczegóły**, stops, live times, and platform display.
- If PKP changes its response format, inspect a real proxy response first and
  update the field handling in `app.js` rather than guessing field names.

## Things NOT to do

- Do **not** run `chmod -R 777` or set files/directories to world-writable.
  Normal project permissions are enough.
- Do **not** put API credentials, personal tokens, `.dev.vars`, or local
  environment files into Git.
- Do **not** bypass `worker.js` and call the PKP HAFAS endpoint directly from
  `app.js`; it can fail because of browser CORS restrictions and exposes the
  upstream integration unnecessarily.
- Do **not** hardcode station IDs, journey IDs, dates, or platform values.
  They are returned dynamically by PKP and change constantly.
- Do **not** replace the detailed journey response with only the search
  pass-list: the pass-list often lacks platforms for intermediate stations.
- Do **not** make destructive Git or file operations (`git reset --hard`,
  mass deletion, recursive permission changes) unless you have confirmed the
  exact files and have a backup or explicit approval.
