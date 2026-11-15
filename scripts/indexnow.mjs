#!/usr/bin/env node
// IndexNow: notifies Bing (→ ChatGPT search, Copilot) and the other participants (listed in references/indexing.md) of new or changed URLs.
// Dry run by default. Submits only with --send.
// Usage:
//   node indexnow.mjs --site https://domain.com --public public            (creates key + key file, lists URLs)
//   node indexnow.mjs --site https://domain.com --send                     (submits every URL in the sitemap)
//   node indexnow.mjs --site https://domain.com --urls a,b,c --send
//   node indexnow.mjs --site https://domain.com --changed-since 2026-11-01 --send   (only lastmod >= date, in local time)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, fetchText, parseRobots, readIfExists, isUrl, parseSite, sameHostUrls, collectSitemapUrls, collectSitemapFile } from './lib.mjs';

const args = parseArgs();
const fail = (m) => { console.error(m); process.exit(1); };
const { site, host } = parseSite(args.site);
const send = args.send === true;
const cfgPath = path.resolve('aeo/indexnow.json');

let pubDir = null;
if (args.public) {
  pubDir = path.resolve(args.public === true ? '.' : args.public);
  if (!fs.existsSync(pubDir)) fail(`Public folder "${args.public}" does not exist. Run the build first or pass the source folder (e.g. public, static; "." for the root).`);
}

let since = null;
const sinceArg = args['changed-since'];
if (sinceArg !== undefined) {
  since = new Date(sinceArg);
  if (sinceArg === true || isNaN(since)) fail('Invalid date in --changed-since. Use YYYY-MM-DD.');
}
const isDateOnly = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const localDay = (s) => (isDateOnly(s) ? s : isNaN(new Date(s)) ? '' : new Date(s).toLocaleDateString('sv-SE'));

// URLs
let urls = [];
if (args.urls) urls = String(args.urls).split(',').map((s) => s.trim()).filter(Boolean);
else {
  let smUrl = args.sitemap;
  if (!smUrl) {
    const rb = await fetchText(`${site}/robots.txt`);
    smUrl = (rb.ok && parseRobots(rb.text).sitemaps[0]) || `${site}/sitemap.xml`;
  }
  const res = isUrl(smUrl) ? await collectSitemapUrls(smUrl) : await collectSitemapFile(smUrl);
  if (!isUrl(smUrl) && !res.ok) fail(`Local sitemap not found: ${smUrl}`);
  const entries = res.entries;
  let filtered = entries;
  if (since) {
    // YYYY-MM-DD compares by day in local time (date-only lastmod too); with a time, compares the exact instant.
    filtered = entries.filter((e) => e.lastmod && (isDateOnly(sinceArg) ? localDay(e.lastmod) >= sinceArg : new Date(e.lastmod) >= since));
    const noLastmod = entries.filter((e) => !e.lastmod).length;
    if (noLastmod) console.log(`Warning: ${noLastmod} URL(s) without <lastmod> were left out of --changed-since.`);
  }
  urls = filtered.map((e) => e.loc);
  if (!entries.length) console.log(`No URLs in the sitemap (${smUrl}). Use --urls or --sitemap.`);
}
const h = sameHostUrls(urls, host);
if (h.switchTo) fail(`${args.urls ? 'Your URLs use' : 'Your sitemap uses'} ${h.switchTo}, not ${host}. Run again with --site https://${h.switchTo} (the key file must also be published on that host).`);
if (h.foreign.length) {
  console.log(`Skipping ${h.foreign.length} URL(s) from another host (${h.otherHosts.join(', ') || 'invalid URL'}).`);
  urls = h.ok;
}
urls = [...new Set(urls)];

// key (public by nature; it lives on the site itself)
let cfg = {};
try { cfg = JSON.parse(readIfExists(cfgPath) || '{}'); } catch {}
if (!cfg.key) {
  cfg.key = crypto.randomBytes(16).toString('hex');
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
  fs.writeFileSync(cfgPath, JSON.stringify({ ...cfg, host }, null, 2) + '\n');
  console.log(`IndexNow key created and saved to aeo/indexnow.json`);
}
const keyLocation = `${site}/${cfg.key}.txt`;
if (pubDir) {
  const f = path.join(pubDir, `${cfg.key}.txt`);
  if (!fs.existsSync(f)) { fs.writeFileSync(f, cfg.key); console.log(`Key file created: ${path.relative(process.cwd(), f) || f} (publish it on deploy)`); }
}

const BATCH = 10000; // protocol limit per POST
console.log(`\nHost: ${host}\nKey file (must be published): ${keyLocation}\nURLs (${urls.length}):`);
urls.slice(0, 30).forEach((u) => console.log(`  ${u}`));
if (urls.length > 30) console.log(`  ... and ${urls.length - 30} more`);
if (urls.length > BATCH) console.log(`Over ${BATCH} URLs: submission will go in ${Math.ceil(urls.length / BATCH)} batches. To submit only what changed, prefer --changed-since.`);

if (!send) {
  console.log('\nDRY RUN: nothing was submitted. Publish the key file, show the list to the user and, with their approval, run again with --send.');
  process.exit(0);
}
if (!urls.length) { console.log('Nothing to submit.'); process.exit(0); }

const k = await fetchText(keyLocation);
if (!k.ok || k.text.trim() !== cfg.key) {
  console.error(`\nThe key file is not published at ${keyLocation} (status ${k.status}). Deploy before submitting.`);
  process.exit(3);
}

const MSG = { 200: 'OK', 202: 'Accepted (key pending validation)', 400: 'Bad request format', 403: 'Key invalid or not found', 422: 'URLs do not belong to the host or key does not match', 429: 'Too many requests, try later' };
let submitted = 0, status = 0;
for (let i = 0; i < urls.length; i += BATCH) {
  const batch = urls.slice(i, i + BATCH);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: cfg.key, keyLocation, urlList: batch }),
  });
  status = res.status;
  console.log(`\nIndexNow responded ${res.status} ${MSG[res.status] || ''} (batch ${i / BATCH + 1}: ${batch.length} URLs)`);
  if (!res.ok) { if (submitted) console.log(`Submitted ${submitted} of ${urls.length} before the error.`); break; }
  submitted += batch.length;
}
if (submitted) {
  cfg.lastSubmission = { date: new Date().toISOString(), urls: submitted, total: urls.length, status };
  fs.writeFileSync(cfgPath, JSON.stringify({ ...cfg, host }, null, 2) + '\n');
}
process.exit(submitted === urls.length ? 0 : 4);
