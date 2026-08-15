# What is phase 1

In phase 1, I take look at every item with na empty "Status" column and analyze it briefly whether it's good to take a better look later, or discard it as we speak. I do phase 1 every day.

# Single item form view for phase 1

In the form I want to see the following columns:
- Source
- Url
- New Title
- Old Title
- Notes

Buttons:
- Curate
- Delete

Additionally to mouse clicking, I want to click "c" button to mark it as "Phase 2", and "d" button to delete the row.

# The loop

The loop starts with opening the first item with empty "Status".

I check the content I have manually.

Then I decide.

- Update "Status" to "Phase 2"
- Delete this row

Once the decision is made, either status column is updated, or the entire row gets deleted.

# The result

After a daily phase 1, there are no rows without a Status. Only rows with Status set to "Phase 2".

# Implementation plan (approved 2026-08-15)

## Decisions

- **UI:** modal dialog launched from the **Curated** menu in the bound spreadsheet.
- **Sheet:** active sheet, fixed column layout, header row at row 1, data from row 2.
- **Form fields:** read-only (review only).
- **Delete:** confirmation prompt (Enter = yes, Esc = no).

## Sheet column layout (fixed)

| Column | Header |
| --- | --- |
| A | Old Title |
| B | New Title |
| C | Notes |
| D | URL |
| E | New URL |
| F | Source |
| G | Target Category |
| H | Status |
| I | Added Date |

Form shows: Old Title (A), New Title (B), Notes (C), URL (D), Source (F).

## Server functions (src/Kod.js)

- `getNextPhase1Item()` — scan rows 2..last for the first row whose Status (H) is empty (trimmed); return `{ row, oldTitle, newTitle, notes, url, source }` or `null`. Fully blank rows are skipped.
- `markPhase1Curated(row)` — compare-and-swap: re-read Status; if no longer empty, abort; otherwise set H to `Phase 2`.
- `deletePhase1Row(row)` — compare-and-swap, then `deleteRow(row)`.
- `openPhase1Form()` — launch the `Phase1Form.html` dialog.

## Form UI (src/Phase1Form.html)

- Read-only fields; URL rendered as a clickable link (opens in new tab).
- Buttons: **Curate (c)**, **Delete (d)**, **Close**.
- Keyboard: `c` curates, `d` opens delete confirmation (Enter = yes, Esc = no); shortcuts ignore modifier keys.
- After each action the form auto-advances to the next item; when none remain, show "All items processed — no more rows with empty Status."
- All content escaped to prevent HTML injection.

## Edge cases handled

- Whitespace-only Status treated as empty; "Phase 2" exact constant.
- Compare-and-swap prevents double-processing from stale row references.
- Fully blank rows skipped.
- Errors from `google.script.run` shown in the dialog.
- Rows with a non-empty Status other than "Phase 2" are skipped (left untouched).
- Active button blurred after click so keyboard shortcuts keep working.
