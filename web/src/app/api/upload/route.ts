import Papa from "papaparse";
import { runPipeline, type RawRow } from "@/lib/scoring";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request budget minus headroom
const MAX_ROWS = 20_000;

function bad(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function parseRows(name: string, content: string): RawRow[] | string {
  const isJson = name.toLowerCase().endsWith(".json") || content.trimStart().startsWith("[") || content.trimStart().startsWith("{");
  if (isJson) {
    try {
      const parsed = JSON.parse(content);
      const rows = Array.isArray(parsed) ? parsed : parsed.data ?? parsed.posts ?? parsed.records;
      if (!Array.isArray(rows)) return "JSON must be an array of records (or contain a data/posts/records array).";
      return rows as RawRow[];
    } catch {
      return "That JSON file couldn't be parsed.";
    }
  }
  const result = Papa.parse<RawRow>(content, { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (result.errors.length > 0 && result.data.length === 0) {
    return `That CSV couldn't be parsed (${result.errors[0].message}).`;
  }
  return result.data;
}

/** Bring-your-own data: CSV or JSON in, audited posts + insights out. Stateless. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return bad(400, "Send a CSV or JSON file in the 'file' field.");
  if (file.size > MAX_BYTES) return bad(413, "File is larger than 4 MB — trim it or split it.");

  const content = await file.text();
  const rows = parseRows(file.name, content);
  if (typeof rows === "string") return bad(422, rows);
  if (rows.length === 0) return bad(422, "The file parsed but contained no rows.");
  if (rows.length > MAX_ROWS) return bad(413, `That's ${rows.length.toLocaleString()} rows — the limit is ${MAX_ROWS.toLocaleString()}.`);

  const { posts, insights } = runPipeline(rows, file.name);
  const withText = posts.filter((p) => p.text.length > 0).length;
  if (withText === 0) {
    return bad(422, "No text column found. Make sure your file has a column named text, content, message, post or body.");
  }
  return Response.json({ posts, insights });
}
