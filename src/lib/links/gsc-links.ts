import { unzipSync } from "fflate";

/**
 * Reads the files Search Console gives you when you export the Links report: the ZIP it
 * downloads, or its CSVs one by one. Google localises the file names and the column
 * headers, so each table is recognised by what is in it, not by what it is called.
 */

export type LinkKind = "SITE" | "PAGE" | "TEXT";
export type LinkRowInput = { label: string; links: number; related: number | null };
export type ParsedTable = { kind: LinkKind; fileName: string; rows: LinkRowInput[] };
export type ParseOutcome = { tables: ParsedTable[]; skipped: { fileName: string; reason: string }[] };

export const KIND_LABEL: Record<LinkKind, string> = { SITE: "linking sites", PAGE: "linked pages", TEXT: "link text" };

const MAX_ROWS = 5_000;
const MAX_LABEL = 2_048;
const MAX_ZIP_ENTRIES = 12;
const MAX_ENTRY_BYTES = 3_000_000;
const MAX_TOTAL_BYTES = 8_000_000;

const HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]{2,}$/i;
const URL_START = /^https?:\/\//i;
const NUMBER_LIKE = /^[\d.,\s  ]+$/;

function decode(bytes: Uint8Array): string {
  // Excel's "Unicode text" is UTF-16; Google's export is UTF-8, sometimes with a BOM
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  const text = new TextDecoder("utf-8").decode(bytes);
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** RFC 4180: quoted fields may hold the delimiter, quotes ("" is one quote) and line breaks. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = ([",", ";", "\t"] as const).map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

/** "1,234", "1.234" and "1 234" are all 1234. NaN when there is no number. */
function toCount(cell: string | undefined): number {
  const digits = (cell ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : NaN;
}

function classify(fileName: string, rows: string[][]): ParsedTable | { skip: string } {
  if (rows.length === 0) return { skip: "The file is empty." };
  const width = Math.max(...rows.map((r) => r.length));
  if (width < 2) return { skip: "It needs at least two columns: the item and a count." };
  // A header row has text where the data rows have a number
  const hasHeader = !NUMBER_LIKE.test((rows[0][1] ?? "").trim());
  const data = (hasHeader ? rows.slice(1) : rows).filter((r) => (r[0] ?? "").trim() !== "" && Number.isFinite(toCount(r[1])));
  if (data.length === 0) return { skip: "No rows with a count were found." };

  const firsts = data.map((r) => r[0].trim());
  const share = (re: RegExp) => firsts.filter((v) => re.test(v)).length / firsts.length;
  let kind: LinkKind;
  if (share(HOST) >= 0.8) kind = "SITE";
  else if (share(URL_START) >= 0.8) {
    // Linked pages have a third column (linking sites); the internal-links table only has the count
    if (width < 3) return { skip: "This looks like the internal links table, which isn't used. Import the external one." };
    kind = "PAGE";
  } else kind = "TEXT";

  const out: LinkRowInput[] = [];
  for (const r of data.slice(0, MAX_ROWS)) {
    const related = toCount(r[2]);
    out.push({ label: r[0].trim().slice(0, MAX_LABEL), links: toCount(r[1]), related: kind === "TEXT" || !Number.isFinite(related) ? null : related });
  }
  return { kind, fileName, rows: out };
}

function expandZip(name: string, bytes: Uint8Array, skipped: ParseOutcome["skipped"]): { name: string; bytes: Uint8Array }[] {
  let entries: Record<string, Uint8Array>;
  let tooLarge = 0;
  try {
    let seen = 0;
    entries = unzipSync(bytes, {
      // Decided from the ZIP's own directory before anything is inflated, so an oversized entry is never expanded
      filter: (file) => {
        const lower = file.name.toLowerCase();
        if (!lower.endsWith(".csv") || lower.startsWith("__macosx/")) return false;
        if (file.originalSize > MAX_ENTRY_BYTES) {
          tooLarge++;
          return false;
        }
        if (seen >= MAX_ZIP_ENTRIES) return false;
        seen++;
        return true;
      },
    });
  } catch {
    skipped.push({ fileName: name, reason: "This ZIP couldn't be read." });
    return [];
  }
  const files = Object.entries(entries).map(([entry, data]) => ({ name: `${name} / ${entry.split("/").pop()}`, bytes: data }));
  if (tooLarge > 0) skipped.push({ fileName: name, reason: `${tooLarge} file${tooLarge === 1 ? "" : "s"} inside the ZIP ${tooLarge === 1 ? "is" : "are"} too large to be a Links export.` });
  else if (files.length === 0) skipped.push({ fileName: name, reason: "No CSV files inside the ZIP." });
  if (files.reduce((s, f) => s + f.bytes.length, 0) > MAX_TOTAL_BYTES) {
    skipped.push({ fileName: name, reason: "The ZIP is too large." });
    return [];
  }
  return files;
}

export function parseLinkFiles(files: { name: string; bytes: Uint8Array }[]): ParseOutcome {
  const skipped: ParseOutcome["skipped"] = [];
  const csvs: { name: string; bytes: Uint8Array }[] = [];
  for (const f of files) {
    const isZip = f.bytes[0] === 0x50 && f.bytes[1] === 0x4b && f.bytes[2] === 0x03 && f.bytes[3] === 0x04;
    if (isZip) csvs.push(...expandZip(f.name, f.bytes, skipped));
    else if (/\.xlsx?$/i.test(f.name)) skipped.push({ fileName: f.name, reason: "Export the report as CSV, not Excel." });
    else csvs.push(f);
  }
  const tables: ParsedTable[] = [];
  for (const f of csvs) {
    const result = classify(f.name, parseCsv(decode(f.bytes)));
    if ("skip" in result) skipped.push({ fileName: f.name, reason: result.skip });
    else if (tables.some((t) => t.kind === result.kind)) skipped.push({ fileName: f.name, reason: `A table of ${KIND_LABEL[result.kind]} was already in this upload.` });
    else tables.push(result);
  }
  return { tables, skipped };
}
