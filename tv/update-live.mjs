// Finds which channels are live on YouTube right now and writes tv/live.json.
// Runs automatically on GitHub every ~20 minutes (see .github/workflows/tv-live.yml).
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const ids = [...new Set([...html.matchAll(/yt:"(UC[\w-]{22})"/g)].map(m => m[1]))];

async function check(id) {
  try {
    const r = await fetch(`https://www.youtube.com/channel/${id}/live`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
        "Cookie": "CONSENT=YES+1; SOCS=CAI"
      }
    });
    const h = await r.text();
    const video = (h.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/) || [])[1];
    const live = /"isLiveNow":true/.test(h) || /"isLive":true/.test(h);
    const embed = !/"playableInEmbed":false/.test(h);
    const why = r.status !== 200 ? "http " + r.status
      : /consent\.youtube|Before you continue/i.test(h) ? "consent page"
      : /confirm you.re not a bot|unusual traffic/i.test(h) ? "bot check"
      : !video ? "no live video" : !live ? "video not live" : "live";
    return { res: video && live ? { video, embed } : null, why };
  } catch (e) { return { res: null, why: "error " + e.message }; }
}

// last known broadcasts: used when YouTube blocks the check ("bot check"), since 24/7 streams keep their id for a long time
let prev = {};
try { prev = JSON.parse(readFileSync(new URL("./live.json", import.meta.url), "utf8")).live || {}; } catch (e) {}

const out = { updated: new Date().toISOString(), live: {}, status: {} };
for (const id of ids) {
  const { res, why } = await check(id);
  if (res) out.live[id] = res;
  else if (why === "bot check" && prev[id]) out.live[id] = { ...prev[id], kept: true };
  out.status[id] = why;
  await new Promise(r => setTimeout(r, 700));
}
writeFileSync(new URL("./live.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`checked ${ids.length} channels, live: ${Object.keys(out.live).length}`);
