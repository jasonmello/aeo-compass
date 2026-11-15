#!/usr/bin/env node
// Submits priority URLs through the Bing Webmaster URL Submission API.
// The key comes ONLY from the BING_API_KEY environment variable (the user exports it in their own terminal). Never write it to a file.
// DRY RUN by default (no key needed). Submits only with --send. --quota is also an authenticated call to Bing (read-only).
// Usage: node bing-submit.mjs --site https://domain.com --urls https://domain.com/a,https://domain.com/b [--send]
//        node bing-submit.mjs --site https://domain.com --quota      (shows the remaining quota)
import { parseArgs, parseSite, sameHostUrls } from './lib.mjs';

const args = parseArgs();
const { site, host } = parseSite(args.site);
const api = 'https://ssl.bing.com/webmaster/api.svc/json';

const send = args.send === true;

function needKey() {
  const k = process.env.BING_API_KEY;
  if (k) return k;
  console.error("BING_API_KEY is not set. Generate one in Bing Webmaster → Settings → API Access and run this in your terminal (the key is not echoed or saved to history):\n  read -rs BING_API_KEY && export BING_API_KEY\n(do not paste the key into the chat)");
  process.exit(1);
}

async function call(url, opts = {}) {
  try {
    return await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
  } catch (e) {
    console.error(`Could not reach Bing: ${e.name === 'TimeoutError' ? 'timed out (30s)' : e.message}`);
    process.exit(4);
  }
}

if (args.quota) {
  const key = needKey();
  const r = await call(`${api}/GetUrlSubmissionQuota?siteUrl=${encodeURIComponent(site)}&apikey=${encodeURIComponent(key)}`);
  const j = await r.json().catch(() => ({}));
  console.log(r.status, JSON.stringify(j.d ?? j).replaceAll(key, '***'));
  process.exit(r.ok ? 0 : 4);
}

let urls = String(args.urls || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!urls.length) { console.error('Pass --urls as a comma-separated list'); process.exit(1); }
const h = sameHostUrls(urls, host);
if (h.switchTo) {
  console.error(`Your URLs use ${h.switchTo}, not ${host}. Run again with --site https://${h.switchTo} (that is the host that must be verified in Bing Webmaster).`);
  process.exit(1);
}
if (h.foreign.length) {
  console.error(`Skipping ${h.foreign.length} URL(s) from another host (${h.otherHosts.join(', ') || 'invalid URL'}): Bing rejects the whole batch if any URL is not from the site.`);
  urls = h.ok;
}
if (!urls.length) { console.error(`No URL belongs to ${host}.`); process.exit(1); }
console.log(`Site: ${site}\nURLs (${urls.length}):\n${urls.map((u) => '  ' + u).join('\n')}`);
if (!send) { console.log('\nDRY RUN: nothing was submitted. Confirm with the user and run with --send.'); process.exit(0); }

const key = needKey();
const r = await call(`${api}/SubmitUrlBatch?apikey=${encodeURIComponent(key)}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ siteUrl: site, urlList: urls }),
});
const body = (await r.text()).replaceAll(key, '***');
console.log(`\nBing responded ${r.status} ${body.slice(0, 300)}`);
process.exit(r.ok ? 0 : 4);
