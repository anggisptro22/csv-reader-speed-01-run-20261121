// csv-reader-speed entry: a drop-in for csv-reader 1.0.0 that answers exactly as it does,
// but scans with indexOf/charCodeAt and slices whole spans instead of concatenating one
// character at a time. The broken-row policy is csv-reader 1.0.0's, byte for byte:
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; an empty line is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a quoted field runs to the next undoubled quote, "" is one quote, each CRLF or lone
//     CR inside it is read as LF; text after the closing quote is appended as it stands
//     (quote_junk when non-empty); an unclosed quote is a literal, the text after it read
//     again as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character;
//   - rows are padded (short_row) or cut (long_row) to the first record's width;
//   - each error is {code, line, row} in the order met.
// Pure: nothing kept from one call to the next.

const COMMA = 0; // the field ended at a comma: the record goes on
const LINE_BREAK = 1; // the field ended at a line break: the record ends
const END = 2; // the field ended at the end of the text: the record ends

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const len = text.length;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0; // a BOM at the very start is dropped
  let line = 1;

  let recordLine = 1; // the line the record being read starts on
  let recordRow = null; // its index in rows (null: the header)

  // Reads an unquoted field from p onto `value`: up to the next comma or line break; a CR
  // not followed by LF is dropped (stray_cr). Returns {value, ended, pos, line}; `added`
  // counts the characters kept past `value` (a quote_junk test uses it).
  function readUnquoted(p, value, startLine) {
    let added = 0;
    let ln = startLine;
    for (;;) {
      const c = text.indexOf(',', p);
      const n = text.indexOf('\n', p);
      let r = text.indexOf('\r', p);
      // the earliest of the three ends the plain span
      let end = len;
      if (c !== -1 && c < end) end = c;
      if (n !== -1 && n < end) end = n;
      if (r !== -1 && r < end) end = r;
      if (end === len) return { value: value + text.slice(p), ended: END, pos: len, line: ln, added: added + len - p };
      if (end === c) {
        return { value: value + text.slice(p, c), ended: COMMA, pos: c + 1, line: ln, added: added + c - p };
      }
      if (end === n) {
        return { value: value + text.slice(p, n), ended: LINE_BREAK, pos: n + 1, line: ln + 1, added: added + n - p };
      }
      // a CR: a line break only when an LF follows it, else a stray_cr dropped
      if (text.charCodeAt(r + 1) === 10) {
        return { value: value + text.slice(p, r), ended: LINE_BREAK, pos: r + 2, line: ln + 1, added: added + r - p };
      }
      value += text.slice(p, r);
      added += r - p;
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      p = r + 1;
    }
  }

  // Reads a quoted field whose opening quote is at p.
  function readQuoted(p, startLine) {
    const open = p;
    const openLine = startLine;
    let value = '';
    let ln = startLine;
    let q = text.indexOf('"', p + 1);
    let closed = false;
    while (q !== -1) {
      // the span between p and q joins the value; CR and LF inside it count lines
      const seg = text.slice(p + 1, q);
      if (seg.indexOf('\r') !== -1 || seg.indexOf('\n') !== -1) {
        for (let i = 0; i < seg.length; i++) {
          const ch = seg.charCodeAt(i);
          if (ch === 13) {
            value += '\n';
            ln += 1;
            if (seg.charCodeAt(i + 1) === 10) i += 1; // a CRLF is one LF
          } else if (ch === 10) {
            value += '\n';
            ln += 1;
          } else {
            value += seg[i];
          }
        }
      } else {
        value += seg;
      }
      if (text.charCodeAt(q + 1) === 34) {
        // a doubled quote is one quote inside the field
        value += '"';
        p = q + 1;
        q = text.indexOf('"', p + 1);
        continue;
      }
      closed = true;
      p = q + 1;
      break;
    }
    if (!closed) {
      // the quote never closes: a literal character, the text after it read again as unquoted
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      const u = readUnquoted(open + 1, '"', openLine);
      return { value: u.value, ended: u.ended, pos: u.pos, line: u.line };
    }
    if (p >= len) return { value, ended: END, pos: len, line: ln };
    const ch = text.charCodeAt(p);
    if (ch === 44) return { value, ended: COMMA, pos: p + 1, line: ln };
    if (ch === 10) return { value, ended: LINE_BREAK, pos: p + 1, line: ln + 1 };
    if (ch === 13 && text.charCodeAt(p + 1) === 10) return { value, ended: LINE_BREAK, pos: p + 2, line: ln + 1 };
    // what follows the closing quote is appended as it stands, up to a comma or line break
    const junk = readUnquoted(p, value, ln);
    if (junk.added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    return { value: junk.value, ended: junk.ended, pos: junk.pos, line: junk.line };
  }

  for (;;) {
    // lines with no characters are no records
    while (pos < len) {
      const ch = text.charCodeAt(pos);
      if (ch === 10) {
        pos += 1;
        line += 1;
      } else if (ch === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) {
        const f = readQuoted(pos, line);
        field = { value: f.value, ended: f.ended };
        pos = f.pos;
        line = f.line;
      } else {
        const f = readUnquoted(pos, '', line);
        field = { value: f.value, ended: f.ended };
        pos = f.pos;
        line = f.line;
      }
      fields.push(field.value);
    } while (field.ended === COMMA);

    // a line that held only stray CRs is left with no characters: no record
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? columns ?? [] : null, rows, errors };
}
