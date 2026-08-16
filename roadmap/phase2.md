# Goal

Phase 2 happens once a week, usually on Thursday evening. It's basically a more detailed look at all all the items marked as "Phase 2".

For every item with "Status" column set to "Phase 2", I want to see a form where I can analyze the data and mark them as "Curation".

# Form layout

Fields
- Old Title (non-editable)
- New Title (editable)
- Notes (non-editable)
- Url (non-editable)
- New Url (editable)
- Target Category (a dropdown that allows to pick from: `Godot-News`, `GodotCon`, `Resources`, `Assets`, `Tutorials`, `Plugins`, `ProTips`, `Project-Templates`, `Showcases`, `Miscellanous`, `Shaders`)

Buttons
- Go to (when pressed, or keypressed space I want to open the URL in a new tab)
- Mark as Curation (key: "c"; sets "Status" column to "Curation")
- Delete (key: "d", deletes this row)

When "c" or "d" actions are performed, the fields are greyed out, edition is disabled, and a label at the bottom telling that it is "processing".

# What next

After phase2 is over there should be no rows with "Status" marked as "Phase 2". There are either rows marked as "Curation", the rest is deleted.

# Implementation plan (approved 2026-08-15)

## Decisions

- **UI:** modal dialog launched from the **Curated** menu in the bound spreadsheet.
- **Sheet:** active sheet, fixed column layout, header row at row 1, data from row 2.
- **Editable fields:** New Title, New URL, Target Category.
- **Delete:** confirmation prompt (Enter = yes, Esc = no) — same as Phase 1.
- **`en:::` prefix:** stripped on load for display, persisted on save — same as Phase 1.
- **New URL default:** starts empty (blank); user types/pastes a new URL if needed.
- **Go to button:** opens the original URL (column D) in a new tab.
- **Target Category dropdown:** 11 hardcoded options (no dynamic source).
- **Persist edits:** on "Mark as Curation", write edited New Title, New URL, and Target Category to the sheet alongside Status.

## Sheet column layout (fixed — same as Phase 1)

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

## Server functions (src/Kod.js)

- `getNextPhase2Item()` — scan rows 2..last for the first row whose Status (H) equals "Phase 2"; return `{ row, oldTitle, newTitle, notes, url, source, targetCategory }` or `null`. Fully blank rows skipped. `newTitle` cleaned via `cleanNewTitle_()`.
- `markPhase2Curation(row, editedTitle, editedNewUrl, editedCategory)` — compare-and-swap: re-read Status; if not "Phase 2", abort. Otherwise write: New Title (B) = editedTitle, New URL (E) = editedNewUrl, Target Category (G) = editedCategory, Status (H) = "Curation".
- `deletePhase2Row(row)` — compare-and-swap, then `deleteRow(row)`.
- `openPhase2Form()` — launch the `Phase2Form.html` dialog.

## Form UI (src/Phase2Form.html)

- **h4 header:** New Title rendered as an `h4` at the top (placeholder `(no new title)` when blank); on load the `en:::` prefix is stripped for display; the edited value is persisted on save.
- **Read-only fields:** Old Title, Notes, Source. URL rendered as a clickable link (opens in new tab).
- **Editable inputs:** New URL (text input, starts empty), Target Category (dropdown with 11 hardcoded options, pre-selected from sheet value).
- **Buttons:** Go to (space), Mark as Curation (c), Delete (d), Close.
- **Keyboard:** `c` → mark as curation, `d` → delete confirmation (Enter = yes, Esc = no), `space` → open original URL in new tab; shortcuts ignore modifier keys and are disabled while processing.
- **Processing indicator:** same as Phase 1 — grey all fields + inputs, disable all buttons + inputs + dropdown, show `Processing…` label below buttons; clears on next item load or error.
- **Auto-advance:** same as Phase 1; empty state message when no rows remain.

## Edge cases handled

- Compare-and-swap prevents double-processing from stale row references.
- `en:::` prefix stripped on load, persisted on save.
- Fully blank rows skipped.
- Processing state cleared on error.
- Delete confirmation prompt (Enter/Esc).
- Active button blurred after click so keyboard shortcuts keep working.
- Dropdown pre-selected from existing sheet value (or default to first option if blank).
- New URL starts empty — not pre-filled from sheet.
