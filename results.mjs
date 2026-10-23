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
  const auth = authorized(req);
  if (auth === "not_configured") return json({ error: "not_configured" }, 503);
  if (auth !== "ok") return json({ error: "unauthorized" }, 401);
  const s = store();

  if (req.method === "GET") {
    const { blobs } = await s.list();
    const entries = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
    return json({ entries });
  }

  if (req.method === "DELETE") {
    const key = new URL(req.url).searchParams.get("key") || "";
    if (!/^\d{4}-\d{2}\/[a-z0-9-]+$/.test(key)) return json({ error: "bad_key" }, 400);
    await s.delete(key);
    return json({ ok: true });
  }

  return json({ error: "method_not_allowed" }, 405);
};

export const config = { path: "/api/results" };
