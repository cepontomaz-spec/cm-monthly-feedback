import { store, json, authorized } from "../lib/common.mjs";

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
