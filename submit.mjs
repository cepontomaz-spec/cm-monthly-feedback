import { getStore } from "@netlify/blobs";

/* ---- helpers ---- */
const STORE = "csm-feedback";
const store = () => getStore({ name: STORE, consistency: "strong" });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

function slug(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "x";
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const rating = (v) => (Number.isInteger(v) && v >= 1 && v <= 5 ? v : null);
const yn = (v) => (v === "yes" || v === "no" ? v : null);
const list = (v, n, max) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

/* Returns { rec } or { error:"invalid", field } */
function validate(b) {
  if (!b || typeof b !== "object") return { error: "invalid", field: "body" };
  const r = {
    name: str(b.name, 80),
    country: str(b.country, 60),
    month: str(b.month, 7),
    salesRating: rating(b.salesRating),
    campaign: yn(b.campaign),
    campaignRating: null,
    event: yn(b.event),
    eventRating: null,
    positive: str(b.positive, 1500),
    negatives: list(b.negatives, 2, 1500),
    wishes: list(b.wishes, 3, 1000),
    biB2B: yn(b.biB2B),
    stockInfo: yn(b.stockInfo),
  };
  if (r.name.length < 2) return { error: "invalid", field: "name" };
  if (!r.country) return { error: "invalid", field: "country" };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)) return { error: "invalid", field: "month" };
  if (!r.salesRating) return { error: "invalid", field: "salesRating" };
  if (!r.campaign) return { error: "invalid", field: "campaign" };
  if (r.campaign === "yes" && !(r.campaignRating = rating(b.campaignRating))) return { error: "invalid", field: "campaignRating" };
  if (!r.event) return { error: "invalid", field: "event" };
  if (r.event === "yes" && !(r.eventRating = rating(b.eventRating))) return { error: "invalid", field: "eventRating" };
  if (r.positive.length < 3) return { error: "invalid", field: "positive" };
  if (!r.biB2B) return { error: "invalid", field: "biB2B" };
  if (!r.stockInfo) return { error: "invalid", field: "stockInfo" };
  return { rec: r };
}

/* RESULTS_KEY can hold one password or several separated by ";" */
function authorized(req) {
  const cfg = (process.env.RESULTS_KEY || globalThis.Netlify?.env?.get?.("RESULTS_KEY") || "").trim();
  if (!cfg) return "not_configured";
  const given = req.headers.get("x-results-key") || "";
  const ok = cfg.split(";").map((s) => s.trim()).filter(Boolean).some((k) => safeEq(k, given));
  return ok ? "ok" : "unauthorized";
}
function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ---- function ---- */
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
