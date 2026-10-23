/* ------------------------------------------------------------------
   Lisca – Country Sales Managers feedback: settings shared by both pages.
   Edit MARKETS to match the people who receive the link.
   ------------------------------------------------------------------ */
window.CSM = (function () {
  "use strict";

  var MARKETS = [
    "Austria", "Bosnia and Herzegovina", "Croatia", "Czech Republic", "Finland & Baltics",
    "France", "Germany", "Hungary", "Italy", "Montenegro", "North Macedonia", "Poland",
    "Russia", "Scandinavia", "Serbia", "Slovakia", "Slovenia", "Spain", "Switzerland",
    "United Kingdom", "USA"
  ];

  /* Question texts, as sent in the questionnaire. Used by the survey, the results page and the CSV. */
  var Q = {
    salesRating:    "How do you rate your sales for the current month?",
    campaign:       "Did you carry out any sales promotion campaigns?",
    campaignRating: "What was the response to the campaign?",
    event:          "Did you host or support any special events in the market or at your customers?",
    eventRating:    "What was the response to the event?",
    positive:       "Express at least one positive activity or development in the market.",
    negatives:      "Express up to two negative developments in the market.",
    wishes:         "List up to three activities or offers you would like to see prepared for the SS27 or AW27 season.",
    biB2B:          "Have you arranged weekly BI reports and B2B access?",
    stockInfo:      "Do you read the weekly stock information we send via email, and do you pass it on to your agents and sales staff in the market?"
  };
  var SCALE = ["Very poor", "Poor", "Average", "Good", "Excellent"];

  /* ---------- months ---------- */
  function monthKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
  function monthLabel(k) {
    var p = String(k).split("-");
    try { return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(+p[0], +p[1] - 1, 1)); }
    catch (e) { return k; }
  }
  function recentMonths(n) {
    var out = [], d = new Date();
    for (var i = 0; i < n; i++) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
    return out;
  }

  /* ---------- storage: Netlify functions, or this browser when opened from disk ---------- */
  var DEMO = location.protocol === "file:";
  var DEMO_KEY = "lisca-csm-demo";
  function demoAll() { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "{}"); } catch (e) { return {}; } }
  function demoPut(all) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(all)); } catch (e) {} }
  function slug(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "x";
  }
  function recordKey(r) { return r.month + "/" + slug(r.country) + "--" + slug(r.name); }

  function http(method, url, body, key) {
    var h = { "Content-Type": "application/json" };
    if (key) h["X-Results-Key"] = key;
    return fetch(url, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: "no-store" })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw { status: r.status, code: j.error || ("http_" + r.status), field: j.field };
          return j;
        });
      }, function () { throw { code: "network" }; });
  }

  function submit(rec) {
    if (!DEMO) return http("POST", "/api/submit", rec);
    var all = demoAll(), k = recordKey(rec), prev = all[k], now = new Date().toISOString();
    var out = Object.assign({}, rec, { key: k, submittedAt: now, firstSubmittedAt: prev ? prev.firstSubmittedAt : now, revisions: prev ? (prev.revisions || 0) + 1 : 0 });
    delete out.website;
    all[k] = out; demoPut(all);
    return Promise.resolve({ ok: true, key: k, updated: !!prev });
  }
  function results(key) {
    if (!DEMO) return http("GET", "/api/results", null, key);
    var all = demoAll();
    return Promise.resolve({ entries: Object.keys(all).map(function (k) { return all[k]; }) });
  }
  function remove(key, recKey) {
    if (!DEMO) return http("DELETE", "/api/results?key=" + encodeURIComponent(recKey), null, key);
    var all = demoAll(); delete all[recKey]; demoPut(all);
    return Promise.resolve({ ok: true });
  }
  function resetDemo() { try { localStorage.removeItem(DEMO_KEY); } catch (e) {} }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  return {
    MARKETS: MARKETS, Q: Q, SCALE: SCALE, DEMO: DEMO,
    monthKey: monthKey, monthLabel: monthLabel, recentMonths: recentMonths,
    submit: submit, results: results, remove: remove, resetDemo: resetDemo, esc: esc
  };
})();
