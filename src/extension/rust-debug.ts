/**
 * The reference's `Debug` rendering of a string (`<str as Debug>::fmt`),
 * used where an error message embeds one, so the port's text equals the
 * reference's byte for byte.
 *
 * Internal to the expression module; not part of any entry point.
 *
 * @module rust-debug
 */

/**
 * The characters `core::unicode::printable::is_printable` rejects: the
 * general categories Cc, Cf, Cs, Co, Cn, Zl, Zp and Zs, except the space.
 * The host engine's Unicode tables stand in for the toolchain's.
 */
const NOT_PRINTABLE = /^[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]$/u;

/** `char::is_grapheme_extended`: the `Grapheme_Extend` property. */
const GRAPHEME_EXTEND = /^\p{Grapheme_Extend}$/u;

/**
 * `format!("{s:?}")` of a `&str`: the text between double quotes with
 * `\0`, `\t`, `\r`, `\n`, `\\` and `\"` escaped, every grapheme-extending
 * or non-printable character as `\u{…}` (lowercase hex, no padding), and
 * everything else, including `'`, as itself.
 */
export function rustDebugString(s: string): string {
  let out = '"';
  for (const ch of s) {
    switch (ch) {
      case "\0":
        out += "\\0";
        continue;
      case "\t":
        out += "\\t";
        continue;
      case "\r":
        out += "\\r";
        continue;
      case "\n":
        out += "\\n";
        continue;
      case "\\":
        out += "\\\\";
        continue;
      case '"':
        out += '\\"';
        continue;
      case " ":
        out += ch;
        continue;
      default:
        break;
    }
    if (GRAPHEME_EXTEND.test(ch) || NOT_PRINTABLE.test(ch)) {
      out += `\\u{${(ch.codePointAt(0) ?? 0).toString(16)}}`;
    } else {
      out += ch;
    }
  }
  return `${out}"`;
}
