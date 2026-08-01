# Sideloading ReportSnips

ReportSnips is distributed by **sideloading** an XML manifest — no store, no installer. There are two manifests:

- **Dev manifest** (`manifest.xml` in the repo root): points at `https://localhost:3000` — use with `npm run dev`.
- **Production manifest** (`dist/manifest.xml` after `npm run build`, or downloaded from the GitHub Pages deployment): points at `https://reconnaishawnce.github.io/snippetlib/` — no local tooling needed.

Teammates only ever need the **production manifest** file; the add-in itself is served from GitHub Pages.

---

## Developers: run from source (Windows or Mac)

```bash
npm install
npm run dev
```

This starts the HTTPS dev server on port 3000, registers the dev certificates (accept the prompts on first run), sideloads the manifest, and launches Word. To stop and unload: `npm run stop`.

If the dev-certificate prompt is declined or fails, run `npx office-addin-dev-certs install` and retry.

---

## Windows (Word desktop): shared-folder catalog

1. Save `manifest.xml` (production) to a folder, e.g. `C:\OfficeAddins`.
2. Right-click the folder → **Properties → Sharing → Share…** → share with yourself (your own account). Note the network path (`\\YOURMACHINE\OfficeAddins`).
3. In Word: **File → Options → Trust Center → Trust Center Settings… → Trusted Add-in Catalogs**.
4. Paste the network path into **Catalog Url**, click **Add catalog**, and check **Show in Menu**. Click OK and restart Word.
5. In Word: **Home tab → Add-ins → More Add-ins** (or **Insert → My Add-ins** in older versions) → **SHARED FOLDER** tab → select **ReportSnips** → **Add**.
6. The **ReportSnips** button appears on the Home tab; click it to open the task pane.

## Mac (Word desktop): wef folder

1. In Finder, press **Cmd+Shift+G** and go to:
   `~/Library/Containers/com.microsoft.Word/Data/Documents/wef`
   (Create the `wef` folder if it doesn't exist.)
2. Copy the production `manifest.xml` into that folder.
3. Restart Word.
4. **Home tab → Add-ins → More Add-ins** (or **Insert → Add-ins → My Add-ins** dropdown) → under **Developer Add-ins**, select **ReportSnips**.
5. The **ReportSnips** button appears on the Home tab; click it to open the task pane.

---

## Verifying the install

- The task pane opens and shows the ReportSnips welcome screen (M0: title + tagline).
- No blank white pane, no certificate warnings (production manifest only — the dev manifest requires the dev certs from `npm run dev`).

## Troubleshooting

- **Blank pane:** check that the machine can reach the hosting URL in a browser (`https://reconnaishawnce.github.io/snippetlib/taskpane.html`).
- **Add-in not listed (Mac):** confirm the file landed in the `wef` folder of the _Word_ container (not Excel/PowerPoint) and restart Word.
- **Add-in not listed (Windows):** confirm the Trusted Add-in Catalog path is the _network share_ form (`\\machine\share`), not a local `C:\` path, and that **Show in Menu** is checked.
- **Stale UI after an update:** Office caches add-in resources; clear the Office web cache ([Microsoft docs](https://learn.microsoft.com/office/dev/add-ins/testing/clear-cache)) and reopen Word.
