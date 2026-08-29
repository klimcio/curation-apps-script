# Google Sheets → Curated.co Data Pipeline

This document describes the end-to-end process of moving links from the **Google Sheets curation spreadsheet** (this Apps Script project) into a **Curated.co newsletter publication**. It replaces the previous Airtable-based pipeline and is written to be studied before implementation.

## Lifecycle

1. **One-time setup:** Set API Token → Set Publication ID (pick from fetched list)
2. **Daily:** Open Phase 1 Curation → review empty-Status rows → mark as "Phase 2" or delete
3. **Weekly:** Open Phase 2 Curation → review "Phase 2" rows → mark as "Curation" (with edits) or delete
4. **Anytime:** Publish to Curated → reads all "Curation" rows → POSTs each link → marks them "Published" with a timestamp

## Overview

```
Google Sheets (bound GAS project, src/Kod.js)
        │
        ▼
Read rows with Status = "Curation"  (SpreadsheetApp)
        │
        ▼
Transform each row ──►  Link { title, url, category, image }
        │
        ▼
Curated API ──POST──►  Link added to next issue
```

Compared to the Airtable pipeline:

| Airtable concept | Google Sheets replacement |
|---|---|
| Airtable API + access token | `SpreadsheetApp` on the bound sheet (no HTTP, no token) |
| Base / table / view | Active sheet, header row 1, data rows 2+ |
| Records (JSON array) | Rows read via `getValues()` |
| Env vars | Script Properties (`PropertiesService`) + constants in `Kod.js` |
| `:true` string-replace parsing hack | Not needed — Sheet cells hold native values |
| `Status` "read but unused" | **Used** — selects which rows get published |

## 1. Configuration

There is no config file and no environment variables. Everything lives either in **Script Properties** or as a **constant** in `src/Kod.js`.

### Google Sheets

- The **bound spreadsheet** (the one this script is attached to), **active sheet**.
- **Header row:** row 1. **Data:** rows 2+.
- **Fixed column layout** (identical to the Phase 1/2 forms):

| Column | Header |
|---|---|
| A | Old Title |
| B | New Title |
| C | Notes |
| D | URL |
| E | New URL |
| F | Source |
| G | Target Category |
| H | Status |
| I | Added Date |
| J | Published Date |

> **Sheet setup note:** column J is new. The implementation must ensure the `Published Date` header exists (create it if missing).

These indices are already defined as the `COL` object in `Kod.js` and must be reused — **do not** hardcode literals. Column J (`PUBLISHED_DATE = 10`) is a new entry to be added to `COL`.

### Script Properties (PropertiesService)

| Property | Description | Set by |
|---|---|---|
| `CURATED_API_TOKEN` | Curated API token | Existing `setCuratedApiToken()` menu item |
| `CURATED_PUBLICATION_ID` | Target publication ID | New **Set Publication ID** flow (below) |

Missing token or publication ID → throw and abort (same pattern as `selectPublication()`).

### Selecting the target publication

New menu item **Set Publication ID**:

1. `selectPublication()` — reuse the stored token and `GET {CURATED_API_URL}` (the existing publications fetch) to load the publication list.
2. Open a picker dialog (`SelectPublication.html`) listing each publication by name + id.
3. On selection, `savePublicationId(id)` stores it in Script Properties as `CURATED_PUBLICATION_ID`.
4. If no token is set, throw the same "API token not set" error as `selectPublication()`.

### Constants in `src/Kod.js`

| Constant | Value | Role |
|---|---|---|
| `CURATED_API_URL` | `https://api.curated.co/api/v3/publications` | Curated API base (v3, already in use) |
| `CURATION_STATUS` | `Curation` | Selector for publish-ready rows |
| `PUBLISHED_STATUS` | `Published` | Written to column H after a successful POST |
| `TARGET_CATEGORIES` | 11 fixed categories | Validation / mapping for the `category` param |

## 2. Data source: Google Sheets

**Method:** `SpreadsheetApp.getActiveSheet()` — already implemented patterns in `getNextPhase1Item()` / `getNextPhase2Item()`.

1. Read column H (Status) for rows 2..last.
2. Select rows where the trimmed Status equals `CURATION_STATUS` (`Curation`) — rows already `Published` are naturally excluded.
3. Read the full row for each match. All matching rows are processed.

**Invalid rows:** a row is skipped (warning logged, processing continues) if:
- it has **neither New URL nor URL set (both empty)**, or
- it has **no Target Category**.

### Fields read from each row

| Column | Used? |
|---|---|
| Old Title (A) | Fallback title |
| New Title (B) | Preferred title — run through `cleanNewTitle_()` first |
| Notes (C) | Read but **not sent** to Curated (context only) |
| URL (D) | Fallback URL |
| New URL (E) | Preferred URL |
| Source (F) | Read but **not sent** (context only) |
| Target Category (G) | Category sent to Curated |
| Status (H) | **Selector** — not part of the payload |
| Added Date (I) | Read but **not sent** (context only) |

### `en:::` prefix

Titles may arrive from external imports as `en:::Something`. Reuse the existing `cleanNewTitle_()` helper before sending so the title never contains the prefix. The helper trims and strips `en:::` case-insensitively.

## 3. Transformation (row → link)

Each selected row maps to a link:

- **Title** = if New Title is set, use it (run through `cleanNewTitle_()`); otherwise use Old Title
- **URL** = if New URL is set, use it; otherwise use URL (the original)
- **Category** = `Target Category`; empty → omitted from request; **lowercased** when sent
- **Image** — see below

### YouTube thumbnail extraction

If the link URL starts with `https://www.youtube.com` or `https://youtu.be`:

1. Extract the video ID:
   - `https://www.youtube.com/watch?v=XYZ` → value of the `v` query parameter
   - `https://youtu.be/XYZ` → first path segment after the domain
2. Build the thumbnail URL: `https://img.youtube.com/vi/{videoId}/mqdefault.jpg`
3. Send this URL as the `image` parameter (**as a URL string**, never binary data)

For all non-YouTube links the image is empty and the `image` parameter is omitted.

## 4. Curated API call

**Method:** `POST` per link (one request per link).

**URL** (confirmed against Curated API docs, base `https://api.curated.co/api/v3`):
```
https://api.curated.co/api/v3/publications/{publication_id}/links?url=...&title=...&category=...&image=...
```

**Headers:**
- `Authorization: Token token="{CURATED_API_TOKEN}"`
- `Content-Type: application/json`

**Body:** empty — all data travels in the query string.

### Query parameters

| Parameter | Required | Source | Notes |
|---|---|---|---|
| `url` | Yes | link URL | URL-encoded; sent **as-is** (no scheme normalization) |
| `title` | Yes | link title | URL-encoded |
| `category` | No | `Target Category` | URL-encoded, **lowercased**; omitted if empty |
| `image` | No | thumbnail URL | URL-encoded; omitted if empty |

> `category` is the Curated **category code**, not the display name. `description` is supported by the API but is not sent by this pipeline (Notes stay in the sheet).

On success the API returns a link object (containing `id`) — log the id. On failure, log the HTTP status and continue.

Example:
```
https://api.curated.co/api/v3/publications/pub_abc123/links?url=https%3A%2F%2Fexample.com%2Farticle&title=Example+Article&category=tutorials
```

## 5. Runtime behavior

Triggered manually via a new **Curated** menu item **Publish to Curated** (`publishToCurated()`). No time-based trigger.

1. Read `CURATED_API_TOKEN` and `CURATED_PUBLICATION_ID` from Script Properties; missing → throw and abort:
   - Missing token → `'API token not set. Use the "Set API Token" menu item first.'`
   - Missing publication ID → `'Publication ID not set. Use the "Set Publication ID" menu item first.'`
2. Read all rows with Status = `Curation` in sheet order; skip invalid rows (neither New URL nor URL set, no category) with a logged warning.
3. Transform each row into a link.
4. Open the progress dialog (`PublishProgress.html`).
5. Send links to Curated **sequentially** (one `POST` at a time, awaiting each response); update the dialog counter and log after each result.
6. On **success**: set Status (H) to `Published` **and** write the current timestamp to Published Date (J) — `markRowPublished_(row)`. This makes re-runs safe: published rows are no longer selected.
7. On HTTP failure: log the failure in the dialog and continue with the next link (no retry, no delay).
8. After all rows processed: show a summary in the dialog (X published, Y failed, Z skipped). Close button enabled.

### Progress dialog

A modal dialog (`PublishProgress.html`, same pattern as Phase 1/2 forms) launched at the start of `publishToCurated()`:

- **During the run:** header shows "Publishing link 3 of 12…" counter; below it, a live log where each row appends its result (title truncated, success with link id / failure with HTTP status code / skipped with reason).
- **During the run:** dialog greyed out, all interaction blocked, "Processing…" label shown (same processing pattern as Phase 1/2).
- **After completion:** summary line replaces the counter ("12 links published, 0 failed, 0 skipped"); Close button enabled.
- **Console backup:** success/failure also logged to `console.log`/`console.error` for post-run review.

## Menu items added (implementation)

- **Set Publication ID** → `selectPublication()` (fetch list → picker dialog → `savePublicationId(id)`)
- **Publish to Curated** → `publishToCurated()`

## Implementation notes

- `COL` gains `PUBLISHED_DATE: 10`; ensure header J `Published Date` exists.
- New files: `src/PublishProgress.html`, `src/SelectPublication.html`
- `cleanNewTitle_()` reused for titles; `TARGET_CATEGORIES` used for the `category` param (lowercased).
- YouTube thumbnail extraction unchanged from the original pipeline (only `https://www.youtube.com` / `https://youtu.be`, `mqdefault.jpg`, sent as a URL string).
