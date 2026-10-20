// kassawmar service worker: lets the app be installed and opens the last version when offline.
// It only handles the app's own main page; every other request (Firebase, calls, other folders) goes straight to the network.
const CACHE = "kassawmar-v1";
const HOME = new URL("./", self.registration.scope).href;
const PAGES = [HOME, HOME + "index.html"];

self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("kassawmar-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  const url = new URL(req.url); url.search = ""; url.hash = "";
  if (!PAGES.includes(url.href)) return;            // tv/, studio/ and the rest are not touched
  e.respondWith((async () => {
    try {
      const res = await fetch(req);                // always try the newest version first
      if (res.ok) { const c = await caches.open(CACHE); c.put(HOME, res.clone()); }
      return res;
    } catch (err) {
      const hit = await caches.match(HOME);
      return hit || new Response("<h1 dir=rtl>אין חיבור לאינטרנט</h1>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
  })());
});
