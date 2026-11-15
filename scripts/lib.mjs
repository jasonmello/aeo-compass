// Shared utilities. Node >= 18, no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const UA = 'Mozilla/5.0 (compatible; aeo-compass/1.0)';

// Boolean flags never consume the next argument (otherwise `--json ./folder` swallows the folder).
export const BOOLEAN_FLAGS = ['send', 'json', 'html', 'quota', 'force'];

export function parseArgs(argv = process.argv.slice(2), { boolean = BOOLEAN_FLAGS } = {}) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const k = eq < 0 ? a.slice(2) : a.slice(2, eq);
      const v = eq < 0 ? undefined : a.slice(eq + 1);
      if (boolean.includes(k)) {
        // --send=false must never trigger a submission: any explicit value other than "true" is an error.
        const bad = v !== undefined ? v !== 'true' : /^(false|no|n[aã]o|0|off)$/i.test(argv[i + 1] || '');
        if (bad) { console.error(`--${k} does not take a value ("${v ?? argv[i + 1]}"). Use just --${k} or leave it out.`); process.exit(1); }
        out[k] = true;
      } else if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

export const isUrl = (s) => /^https?:\/\//i.test(s || '');

/** Validates --site. Exits with code 1 if it is missing or not an http(s) URL. */
export function parseSite(raw) {
  if (raw === undefined || raw === null || raw === '' || raw === true) {
    console.error('Provide --site https://domain.com');
    process.exit(1);
  }
  let url = null;
  try { url = new URL(raw); } catch {}
  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    console.error(`Invalid --site ("${raw}"): use the full URL with https://, e.g. --site https://domain.com`);
    process.exit(1);
  }
  return { site: String(raw).replace(/\/$/, ''), host: url.host };
}

/** Splits URLs on the given host from those on other hosts. `switchTo` suggests the right host when only the www differs. */
export function sameHostUrls(urls, host) {
  const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
  const ok = [], foreign = [];
  for (const u of urls) (hostOf(u) === host ? ok : foreign).push(u);
  const otherHosts = [...new Set(foreign.map(hostOf).filter(Boolean))];
  const stripWww = (h) => h.replace(/^www\./, '');
  // Suggest switching www/apex when most URLs are on the same domain with or without www, even if other hosts are mixed in.
  const twinHost = otherHosts.find((h) => stripWww(h) === stripWww(host));
  const twinCount = twinHost ? foreign.filter((u) => hostOf(u) === twinHost).length : 0;
  const switchTo = twinHost && twinCount * 2 >= urls.length ? twinHost : null;
  return { ok, foreign, otherHosts, switchTo };
}

const MAX_BYTES = 10 * 1024 * 1024;

export async function fetchText(url, { ua = UA, timeout = 15000, maxBytes = MAX_BYTES } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'user-agent': ua, accept: 'text/html,application/xml,text/plain,*/*' }, redirect: 'follow', signal: ctrl.signal });
    // Streams the body with a byte cap; a gzip body (sitemap.xml.gz without Content-Encoding) is decompressed.
    const chunks = []; let size = 0, truncated = false;
    if (res.body) for await (const c of res.body) {
      chunks.push(c); size += c.length;
      if (size >= maxBytes) { truncated = true; ctrl.abort(); break; }
    }
    let buf = Buffer.concat(chunks).subarray(0, maxBytes);
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      try { buf = zlib.gunzipSync(buf, { maxOutputLength: maxBytes }); } catch { truncated = true; }
    }
    const text = buf.toString('utf8');
    return { ok: res.ok, status: res.status, url: res.url, headers: Object.fromEntries(res.headers), text, ...(truncated && { truncated: true }) };
  } catch (e) {
    return { ok: false, status: 0, url, headers: {}, text: '', error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(t);
  }
}

export function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

export function parseSitemap(xml) {
  if (!xml) return { urls: [], sitemaps: [], lastmods: 0 };
  // Accepts CDATA, a namespace prefix (<sm:url>) and attributes on the tag.
  const blocks = (tag) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'gi'))].map((m) => m[1]);
  const field = (b, name) => (b.match(new RegExp(`<(?:\\w+:)?${name}>\\s*(?:<!\\[CDATA\\[)?\\s*([^<\\]\\s]+)`, 'i')) || [])[1];
  const entries = blocks('url').map((b) => ({ loc: field(b, 'loc'), lastmod: field(b, 'lastmod') })).filter((e) => e.loc).map((e) => ({ ...e, loc: decodeEntities(e.loc) }));
  return {
    urls: entries.map((e) => e.loc),
    entries,
    sitemaps: blocks('sitemap').map((b) => field(b, 'loc')).filter(Boolean).map(decodeEntities),
    lastmods: (xml.match(/<lastmod>/gi) || []).length,
    lastmodValues: [...xml.matchAll(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/gi)].map((m) => m[1]),
  };
}

/**
 * Fetches the sitemap and returns URLs (+ entries with lastmod). Follows indexes up to `depth` levels,
 * decompresses .gz, fetches at most `maxChildren` child sitemaps and skips children on another host.
 * Truncations and skips go to `warnings` (and stderr).
 */
export async function collectSitemapUrls(sitemapUrl, { limit = 50000, maxChildren = 50, depth = 2 } = {}) {
  const r = await fetchText(sitemapUrl);
  if (!r.ok) return { ok: false, status: r.status, urls: [], entries: [], warnings: [] };
  const sm = parseSitemap(r.text);
  const host = new URL(r.url || sitemapUrl).host;
  const entries = [...sm.entries], warnings = [], seen = new Set([sitemapUrl]);
  const queue = sm.sitemaps.map((u) => [u, 1]);
  let fetched = 0;
  if (r.truncated) warnings.push(`${sitemapUrl} is over 10 MB; only the beginning was read.`);
  while (queue.length && entries.length < limit) {
    const [child, d] = queue.shift();
    if (seen.has(child)) continue;
    seen.add(child);
    let h; try { h = new URL(child, sitemapUrl).host; } catch { h = null; }
    if (h !== host) { warnings.push(`Skipped child sitemap on another host: ${child}`); continue; }
    if (fetched >= maxChildren) { warnings.push(`Reached the limit of ${maxChildren} child sitemaps; ${queue.length + 1} not read.`); break; }
    fetched++;
    const c = await fetchText(child);
    if (!c.ok) continue;
    if (c.truncated) warnings.push(`${child} is over 10 MB; only the beginning was read.`);
    const p = parseSitemap(c.text);
    entries.push(...p.entries);
    if (p.sitemaps.length) {
      if (d < depth) queue.push(...p.sitemaps.map((u) => [u, d + 1]));
      else warnings.push(`Index nested too deep in ${child}; ${p.sitemaps.length} sitemaps not read.`);
    }
  }
  warnings.forEach((w) => console.error(`warning: ${w}`));
  const byLoc = new Map();
  for (const e of entries) if (!byLoc.has(e.loc)) byLoc.set(e.loc, e);
  const uniq = [...byLoc.values()].slice(0, limit);
  return { ok: true, status: r.status, urls: uniq.map((e) => e.loc), entries: uniq, lastmodValues: uniq.map((e) => e.lastmod).filter(Boolean), warnings, raw: r.text, parsed: sm };
}

function readMaybeGz(p) {
  try {
    let buf = fs.readFileSync(p);
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf, { maxOutputLength: MAX_BYTES });
    return buf.toString('utf8');
  } catch { return null; }
}

/**
 * Local version of collectSitemapUrls: reads the sitemap from a file (.xml or .gz). Children of an index
 * are looked up next to the file first (URL path, then file name only); if they are missing
 * and `fetchMissing` is set, they are downloaded. Same return shape as URL mode.
 */
export async function collectSitemapFile(file, { fetchMissing = true, depth = 2, maxChildren = 50, limit = 50000 } = {}) {
  const xml = readMaybeGz(file);
  if (xml === null) return { ok: false, urls: [], entries: [], lastmodValues: [], warnings: [] };
  const sm = parseSitemap(xml);
  const dir = path.dirname(file);
  const entries = [...sm.entries], warnings = [], seen = new Set();
  const queue = sm.sitemaps.map((u) => [u, 1]);
  let read = 0;
  while (queue.length && entries.length < limit) {
    const [loc, d] = queue.shift();
    if (seen.has(loc)) continue;
    seen.add(loc);
    if (read >= maxChildren) { warnings.push(`Reached the limit of ${maxChildren} child sitemaps; ${queue.length + 1} not read.`); break; }
    read++;
    let rel; try { rel = new URL(loc).pathname; } catch { rel = loc; }
    try { rel = decodeURI(rel); } catch {}
    let text = readMaybeGz(path.join(dir, rel.replace(/^\/+/, ''))) ?? readMaybeGz(path.join(dir, path.basename(rel)));
    if (text === null && fetchMissing && isUrl(loc)) {
      const c = await fetchText(loc);
      if (c.ok) {
        text = c.text;
        if (c.truncated) warnings.push(`${loc} is over 10 MB; only the beginning was read.`);
      }
    }
    if (text === null) { warnings.push(`Child sitemap not found: ${loc}`); continue; }
    const p = parseSitemap(text);
    entries.push(...p.entries);
    if (p.sitemaps.length) {
      if (d < depth) queue.push(...p.sitemaps.map((u) => [u, d + 1]));
      else warnings.push(`Index nested too deep in ${loc}; ${p.sitemaps.length} sitemaps not read.`);
    }
  }
  warnings.forEach((w) => console.error(`warning: ${w}`));
  const byLoc = new Map();
  for (const e of entries) if (!byLoc.has(e.loc)) byLoc.set(e.loc, e);
  const uniq = [...byLoc.values()].slice(0, limit);
  return { ok: true, urls: uniq.map((e) => e.loc), entries: uniq, lastmodValues: uniq.map((e) => e.lastmod).filter(Boolean), warnings, parsed: sm };
}

export function decodeEntities(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export function stripTags(html) {
  return decodeEntities(String(html).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : null;
}

export function metaContent(html, key) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const t = m[0];
    const n = (attr(t, 'name') || attr(t, 'property') || '').toLowerCase();
    if (n === key.toLowerCase()) return attr(t, 'content');
  }
  return null;
}

// Question-style H2 (en/pt/es): trailing '?', leading '¿' or a question word at the start.
// Lookahead instead of \b, because \b fails after accented letters (qué, cómo).
const QUESTION_END = /[?？]\s*$/;
const QUESTION_H2 = /^(?:¿\s*)?(?:what|how|why|when|where|which|who|whose|is|are|can|could|does|do|did|should|will|would|como|o que|qual|quais|quanto|quanta|quantos|quantas|quando|onde|por que|porque|para que|quem|vale|qué|que|cómo|cuál|cuáles|cuánto|cuánta|cuántos|cuántas|cuándo|dónde|por qué|para qué|quién|quiénes|vale la pena|es|son|puedo|se puede)(?=[\s?¿,:]|$)/iu;

export function analyzeHtml(html) {
  const raw = html;
  html = html.replace(/<!--[\s\S]*?-->/g, ''); // comments left out of the analysis (JSON-LD uses the original)
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const htmlTag = (html.match(/<html\b[^>]*>/i) || [''])[0];
  const canonicalTag = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((t) => (attr(t, 'rel') || '').toLowerCase() === 'canonical');
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1]));
  const h2 = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripTags(m[1]));
  const body = (html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i) || [, html])[1];
  const bodyText = stripTags(body);
  const scriptTags = (s) => [...s.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]);
  const hasSrc = (t) => /\ssrc\s*=/i.test(t); // \s avoids matching data-src
  const scriptSrc = scriptTags(body).some(hasSrc)
    || scriptTags(html).some((t) => hasSrc(t) && /\stype\s*=\s*["']?module\b/i.test(t));
  const jsonld = [];
  for (const m of raw.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { jsonld.push({ ok: true, data: JSON.parse(m[1].trim()) }); }
    catch (e) { jsonld.push({ ok: false, error: e.message, snippet: m[1].trim().slice(0, 120) }); }
  }
  const types = new Set();
  const sameAs = new Set();
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      const t = o['@type'];
      (Array.isArray(t) ? t : t ? [t] : []).forEach((x) => types.add(String(x)));
      const s = o.sameAs;
      (Array.isArray(s) ? s : s ? [s] : []).forEach((x) => sameAs.add(String(x)));
      Object.values(o).forEach(walk);
    }
  };
  jsonld.filter((j) => j.ok).forEach((j) => walk(j.data));
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  const rootEmpty = /<div\b[^>]*\sid=["'](root|app|__next)["'][^>]*>\s*<\/div>/i.test(html);
  return {
    title: title ? stripTags(title) : null,
    lang: attr(htmlTag, 'lang'),
    description: metaContent(html, 'description'),
    robotsMeta: metaContent(html, 'robots'),
    canonical: canonicalTag ? attr(canonicalTag, 'href') : null,
    og: { title: metaContent(html, 'og:title'), description: metaContent(html, 'og:description'), image: metaContent(html, 'og:image'), url: metaContent(html, 'og:url') },
    h1, h2,
    questionH2: h2.filter((h) => QUESTION_END.test(h) || /^¿/.test(h) || QUESTION_H2.test(h)).length,
    wordCount,
    jsonld, types: [...types], sameAs: [...sameAs],
    imgCount: imgs.length,
    imgNoAlt: imgs.filter((t) => attr(t, 'alt') === null).length,
    hasMain: /<main\b/i.test(html),
    dates: /datePublished|dateModified|<time\b/i.test(html),
    author: /"author"|rel=["']author|class=["'][^"']*author/i.test(html),
    rootEmpty,
    scriptSrc,
    jsDependent: rootEmpty || (wordCount < 50 && scriptSrc),
  };
}

/** robots.txt: returns whether the agent may access "/" (simplified algorithm, the most specific group wins). */
export function parseRobots(txt) {
  const groups = [];
  let cur = null, lastWasUA = false;
  const sitemaps = [];
  for (const raw of (txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === 'user-agent') {
      if (!lastWasUA || !cur) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
      lastWasUA = true;
    } else {
      lastWasUA = false;
      if (k === 'sitemap') sitemaps.push(v);
      else if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push({ type: k, path: v });
    }
  }
  return { groups, sitemaps };
}

export function robotsAllowsRoot(parsed, agent) {
  const a = agent.toLowerCase();
  let g = parsed.groups.filter((x) => x.agents.includes(a));
  if (!g.length) g = parsed.groups.filter((x) => x.agents.includes('*'));
  if (!g.length) return { allowed: true, via: 'no rule' };
  // RFC 9309: '*' matches any sequence, a trailing '$' anchors the end. Priority = pattern length (like Google's parser).
  const toRe = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\?\$$/, '$'));
  const matching = g.flatMap((x) => x.rules).filter((r) => r.path && toRe(r.path).test('/'));
  if (!matching.length) return { allowed: true, via: g[0].agents.includes(a) ? agent : '*' };
  const best = matching.sort((x, y) => y.path.length - x.path.length || (x.type === 'allow' ? -1 : 1))[0];
  return { allowed: best.type === 'allow', via: g[0].agents.includes(a) ? agent : '*' };
}

export function findFiles(dir, exts, max = 500, base = dir, acc = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (acc.length >= max) break;
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findFiles(p, exts, max, base, acc);
    else if (exts.some((x) => e.name.toLowerCase().endsWith(x))) acc.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return acc;
}

export function loadProfile(root = process.cwd()) {
  const p = path.join(root, 'aeo', 'profile.json');
  const raw = readIfExists(p);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { throw new Error(`aeo/profile.json is invalid: ${e.message}`); }
}
