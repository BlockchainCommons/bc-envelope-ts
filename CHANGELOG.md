# Changelog

## Unreleased

### Changed

- **Diagnostic notation breaks lines by UTF-8 bytes** through dcbor
  1.0.0-beta.2, to which `diagnostic` delegates: a group holding a
  non-ASCII string of more than 20 bytes — `201("unicode ✓ ☺ 日本")` —
  breaks over several lines exactly as the reference prints it. No envelope
  code changed: the `leaf:text:unicode` golden vector is regenerated, the
  harness rule that allowed the old shape is gone (differential tombstone
  T14), and the package now requires `@blockchaincommons/dcbor`
  1.0.0-beta.2 for its tests to pass. ASCII output is unchanged.

## 1.0.0-beta.2 - 2026-09-12

The review against `bc-envelope-rust` 0.43.0 corrected text summaries and
debug renderings without changing the envelope wire format.

### Changed

- **Text summaries truncate as the reference does.** `summary`, tree lines
  and mermaid labels decide whether to truncate by the text's **UTF-8 byte
  length** and cut by **whole characters** (`envelope_summary.rs`:
  `string.len() > max_length`, then `chars().take(max_length)`), where the
  port counted UTF-16 units for both. A non-ASCII text can therefore gain
  an `…` without losing a character, exactly as the reference prints it;
  ASCII text is unchanged.
- **Debug renderings print the reference's `Display`.**
  `Function.toString()` / `Parameter.toString()` give the assigned name or
  the number (`add`, `99`) and the name in quotes for a named one
  (`"greet"`), not `«1»` / `❰2❱` — those forms belong to the format
  strings, where the format context still prints them on both sides.
  `Expression.toString()` is the quoted format string (the reference's
  `{:?}` of `format()`). `Response.summary()` writes `id: X error: E`
  (no comma) on the failure branches, as the reference does; the success
  branch is unchanged. `bc-gstp-ts`, which embeds `summary()`, prints what
  `gstp-rust` prints.
- The `Expression.fromEnvelope` mismatch message reads
  `expected function add, but found sub` (it used the `«…»` form).

## 1.0.0-beta.1 - 2026-09-09

Initial beta implementation.