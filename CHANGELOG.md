# Changelog

## 1.0.1 (2026-10-02)

### Fixed

- Keyboard focus: tabbing from the text to "Accept all" or a block's pill no longer drops focus to the page when the editor redraws. A block stays active while one of its buttons has focus, so its "not used" field pills stay visible. Reported by the Statamic Marketplace review.

### Changed

- The README now states that link targets are sent with their IDs, titles and descriptions, not their URLs.
- The marketplace images in `art/` are no longer part of the package download.

## 1.0.0 (2026-09-30)

### What's new

- Per-field opt-in: a "Bard Assist" toggle in every Bard field's settings.
- Suggests a set for each block of paragraphs, from the field's own sets and their instructions.
- Maps each line to a field of the suggested set, and picks link targets from your entries.
- Accept a suggestion with one click or ⌥↩; "Back to text", "Other set" and moving a line to another field undo or correct it.
- Suggestions in the live preview, drawn with your own set partials, without reloading the preview.
- Providers: TypeSafe directly, or through the Vercel AI Gateway.
- English and German interface, keyboard-operable menus.
- Every endpoint that spends the key or builds a set requires the publish form's blueprint token and an opted-in field; requests are size-limited and rate-limited (`rate_limit`).
- The live preview escapes the editor's text before drawing a suggestion, and only accepts refresh messages from the embedding control panel.
