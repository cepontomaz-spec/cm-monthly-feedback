import { store, json, slug, validate } from "../lib/common.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const raw = await req.text();
  if (raw.length > 30000) return json({ error: "too_large" }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "bad_json" }, 400); }

  if (body && typeof body.website === "string" && body.website.trim()) return json({ ok: true }); // bot trap

  const v = validate(body);
  if (v.error) return json(v, 400);
  const rec = v.rec;

  const key = `${rec.month}/${slug(rec.country)}--${slug(rec.name)}`;
  const s = store();
  const prev = await s.get(key, { type: "json" });
  const now = new Date().toISOString();
  const out = {
    ...rec,
    key,
    submittedAt: now,
    firstSubmittedAt: prev?.firstSubmittedAt || now,
    revisions: prev ? (prev.revisions || 0) + 1 : 0,
  };
  await s.setJSON(key, out);
  return json({ ok: true, key, updated: !!prev });
};

export const config = { path: "/api/submit" };
