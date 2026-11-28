#!/usr/bin/env node
// Technical AEO audit. Score from 0 to 75 (the other 25 are off-page/indexing, see references/audit.md).
// Usage:
//   node audit.mjs https://domain.com [--pages 10] [--json]
//   node audit.mjs ./out            (build folder or static site)
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, isUrl, fetchText, readIfExists, collectSitemapUrls, collectSitemapFile,
  analyzeHtml, parseRobots, robotsAllowsRoot, findFiles, loadProfile,
} from './lib.mjs';

const args = parseArgs();
const target = args._[0];
if (!target) {
  console.error('Usage: node audit.mjs <url|folder> [--pages N (default 10)] [--json]');
  process.exit(1);
}
const samplePages = Number(args.pages ?? 10);
// Pages left out of the sample (errors, thank-you, admin) and pages that go first.
const SKIP_PAGE = /(^|\/)(404|500|_?not-found|_error|obrigado|gracias|thank-?you|thanks|admin|wp-admin)(\/|\.html|$)/i;
// Priority only when a path segment starts with the word (/faq.html, /services-x; not /legal/inbound-services).
const PRIORITY = /(^|\/)(about|sobre|acerca|nosotros|faq|questions|perguntas|preguntas|pricing|pre[cç]os?|precios?|services?|servi[cç]os?|servicios?|products?|produtos?|productos?|blog)(?=$|[\/._-])/i;
const pathOf = (u) => { try { return new URL(u, 'http://x').pathname; } catch { return String(u); } };
const byPriority = (list) => [...list].sort((x, y) => PRIORITY.test(pathOf(y)) - PRIORITY.test(pathOf(x)));
// Compares URLs ignoring protocol, www, trailing slash and hash.
const normUrl = (u, ref) => { try { const x = new URL(u, ref); return x.host.toLowerCase().replace(/^www\./, '') + (x.pathname.replace(/\/+$/, '') || '/') + x.search; } catch { return String(u); } };

const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot', 'Claude-User'];
const TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'Applebot-Extended', 'Meta-ExternalAgent', 'Amazonbot', 'MistralAI-Training'];
const BOT_UA = {
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Claude-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)',
};

const checks = [];
const add = (cat, id, max, score, status, msg, fix = '') => checks.push({ cat, id, max, score: Math.max(0, Math.min(max, score)), status, msg, fix });

// ---------- collection ----------
const mode = isUrl(target) ? 'url' : 'dir';
let home = '', homeHeaders = {}, robotsTxt = null, sitemapInfo = null, llmsTxt = null, https = false;
let siteUrls = [], htmlFiles = [], botStatus = {}, homeStatus = 0, base = '', dir = '';
const inner = []; // inner pages analyzed: { ref, status, a, html, issues }

if (mode === 'url') {
  const u = new URL(target);
  base = u.origin;
  https = u.protocol === 'https:';
  const r = await fetchText(target);
  homeStatus = r.status;
  if (!r.ok) {
    console.error(`Could not open ${target}: status ${r.status} ${r.error || ''}`);
    process.exit(2);
  }
  home = r.text; homeHeaders = r.headers;
  if (r.url.startsWith('https:')) https = true;
  const rb = await fetchText(`${base}/robots.txt`);
  robotsTxt = rb.ok && !/<html/i.test(rb.text) ? rb.text : null;
  const robotsParsed = parseRobots(robotsTxt || '');
  const smUrl = robotsParsed.sitemaps[0] || `${base}/sitemap.xml`;
  const sm = await collectSitemapUrls(smUrl);
  sitemapInfo = sm.ok ? { url: smUrl, total: sm.urls.length, lastmodValues: sm.lastmodValues } : null;
  siteUrls = sm.urls || [];
  const ll = await fetchText(`${base}/llms.txt`);
  llmsTxt = ll.ok && !/<html/i.test(ll.text) ? ll.text : null;
  for (const [bot, ua] of Object.entries(BOT_UA)) {
    const b = await fetchText(target, { ua });
    botStatus[bot] = b.status;
  }
} else {
  dir = path.resolve(target);
  if (!fs.existsSync(dir)) { console.error(`Folder not found: ${dir}`); process.exit(1); }
  htmlFiles = findFiles(dir, ['.html']);
  const idx = htmlFiles.find((f) => f === 'index.html') || htmlFiles[0];
  if (!idx) { console.error('No .html in the folder. Run the build and point to the output folder (out/, dist/, build/).'); process.exit(2); }
  home = readIfExists(path.join(dir, idx));
  robotsTxt = readIfExists(path.join(dir, 'robots.txt'));
  // Sitemap (and index children) read from the folder itself, no network: folder audits are offline.
  const smName = ['sitemap.xml', 'sitemap-index.xml', 'sitemap-0.xml'].find((n) => fs.existsSync(path.join(dir, n)));
  if (smName) {
    const sm = await collectSitemapFile(path.join(dir, smName), { fetchMissing: false });
    if (sm.ok) { siteUrls = sm.urls; sitemapInfo = { url: smName, total: sm.urls.length, lastmodValues: sm.lastmodValues }; }
  }
  llmsTxt = readIfExists(path.join(dir, 'llms.txt'));
  for (const f of byPriority(htmlFiles.filter((f) => f !== idx && !SKIP_PAGE.test('/' + f))).slice(0, 50)) {
    const html = readIfExists(path.join(dir, f));
    inner.push({ ref: '/' + f, status: 200, a: analyzeHtml(html), html, issues: [] });
  }
}

// Folder mode: file (relative to the folder) that serves the URL, or null.
const fileFor = (u) => {
  let rel = u; try { rel = new URL(u).pathname; } catch {}
  try { rel = decodeURI(rel); } catch {}
  rel = rel.replace(/^\/+/, '').replace(/\/+$/, '') || 'index.html';
  return [rel, `${rel}.html`, path.join(rel, 'index.html')].find((c) => fs.existsSync(path.join(dir, c)) && fs.statSync(path.join(dir, c)).isFile()) || null;
};

// Sitemap sample in URL mode: status, redirect, noindex and canonical of each page.
if (mode === 'url' && samplePages > 0 && siteUrls.length) {
  const pick = byPriority(siteUrls.filter((u) => normUrl(u) !== normUrl(target) && !SKIP_PAGE.test(u))).slice(0, samplePages);
  for (const u of pick) {
    const r = await fetchText(u);
    const p = r.ok ? analyzeHtml(r.text) : null;
    const issues = [];
    if (r.status !== 200) issues.push(`status ${r.status || r.error || 'error'}`);
    if (r.url && normUrl(r.url) !== normUrl(u)) issues.push(`redirects to ${r.url}`);
    if (p && (/noindex/i.test(p.robotsMeta || '') || /noindex/i.test(r.headers?.['x-robots-tag'] || ''))) issues.push('in sitemap but noindex');
    if (p?.canonical && normUrl(p.canonical, r.url || u) !== normUrl(r.url || u)) issues.push(`canonical points to ${p.canonical}`);
    inner.push({ ref: u, status: r.status, a: p, html: r.ok ? r.text : '', headers: r.headers || {}, issues });
  }
}

const a = analyzeHtml(home);
const httpsKnown = mode === 'url' || !!(a.canonical || a.og.url);
if (mode === 'dir') https = (a.canonical || a.og.url || '').startsWith('https:');
// Per-page checks (ssr, h1, title): the score is the average of the home page and the inner pages analyzed.
// noindex only counts on the home page; an inner page with noindex loses points only if it is in the sitemap (sitemap check).
const analyzed = [{ ref: '/', isHome: true, a, html: home, headers: homeHeaders }, ...inner.filter((p) => p.a)];
const perPage = (max, fn, label) => {
  const scores = analyzed.map((p) => Math.max(0, Math.min(max, fn(p.a, p))));
  const bad = analyzed.filter((p, i) => i > 0 && scores[i] < max).map((p) => p.ref);
  const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
  const note = bad.length ? ` · ${label || 'failed'} on ${bad.length}/${analyzed.length - 1} inner page(s): ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? '…' : ''}` : '';
  return { score: Math.round(avg), home: scores[0], bad, note };
};
const isNoindex = (x, p) => /noindex/i.test(x.robotsMeta || '') || /noindex/i.test(p.headers?.['x-robots-tag'] || '');

// ---------- 1. Crawlable (25) ----------
const R = 'Crawlable';
add(R, 'robots', 3, robotsTxt ? 3 : 0, robotsTxt ? 'ok' : 'fail', robotsTxt ? 'robots.txt found' : 'robots.txt missing', 'Add a robots.txt based on <skill>/templates/robots.txt');

const rp = parseRobots(robotsTxt || '');
const blocked = SEARCH_BOTS.filter((b) => !robotsAllowsRoot(rp, b).allowed);
const wafBlocked = Object.entries(botStatus).filter(([, s]) => s === 403 || s === 401 || s === 429 || s === 503).map(([b, s]) => `${b} (HTTP ${s})`);
// Blocking Googlebot/Bingbot scores zero; each blocked AI bot costs 3 points.
const coreBlocked = blocked.some((b) => b === 'Googlebot' || b === 'Bingbot');
const botScore = coreBlocked ? 0 : 10 - 3 * (blocked.length + wafBlocked.length);
add(R, 'search-bots', 10, Math.round(botScore), blocked.length || wafBlocked.length ? 'fail' : 'ok',
  blocked.length || wafBlocked.length
    ? `Blocked: ${[...blocked.map((b) => `${b} (robots)`), ...wafBlocked.map((b) => `${b} (firewall/CDN)`)].join(', ')}`
    : `Search bots allowed: ${SEARCH_BOTS.join(', ')}${mode === 'url' ? ' (robots and access test)' : ''}`,
  wafBlocked.length ? 'Allow these user agents in the firewall/CDN (Vercel: AI Bots → AI Assistants; Cloudflare: AI Crawler and Agent access policies → Search and Agent)' : 'Allow the search bots in robots.txt');

const homeNoindex = isNoindex(a, { headers: homeHeaders });
add(R, 'noindex', 5, homeNoindex ? 0 : 5, homeNoindex ? 'fail' : 'ok', homeNoindex ? 'Home page has noindex (meta robots or X-Robots-Tag)' : 'Home page has no noindex', 'Remove noindex from the home page');

// Sitemap (6): exists 3 · in robots 1 · real lastmod 1 · clean URLs 1 (only canonical URLs with status 200).
let smScore = 0; const smNotes = [];
const lastmods = sitemapInfo?.lastmodValues || [];
const allSameLastmod = lastmods.length > 3 && new Set(lastmods.map((d) => d.slice(0, 10))).size === 1;
let dirtyUrls = [];
if (mode === 'url') dirtyUrls = inner.filter((p) => p.issues.length).map((p) => `${p.ref} (${p.issues.join(', ')})`);
else {
  const homeFile = htmlFiles.find((f) => f === 'index.html') || htmlFiles[0];
  const analysisOf = (f) => (f === homeFile ? a : inner.find((p) => p.ref === '/' + f)?.a || analyzeHtml(readIfExists(path.join(dir, f)) || ''));
  for (const u of siteUrls) {
    const f = fileFor(u);
    if (!f) dirtyUrls.push(`${u} (no file in folder)`);
    else if (/noindex/i.test(analysisOf(f).robotsMeta || '')) dirtyUrls.push(`${u} (in sitemap but noindex)`);
  }
}
if (sitemapInfo && sitemapInfo.total > 0) {
  smScore += 3; smNotes.push(`${sitemapInfo.total} URLs`);
  if (rp.sitemaps.length) { smScore += 1; smNotes.push('listed in robots'); } else smNotes.push('not listed in robots');
  if (lastmods.length && !allSameLastmod) { smScore += 1; smNotes.push('with lastmod'); } else smNotes.push(allSameLastmod ? 'same lastmod on every URL (looks fake)' : 'no lastmod');
  if (!dirtyUrls.length && (mode === 'dir' || inner.length)) smScore += 1;
  if (dirtyUrls.length) smNotes.push(`${dirtyUrls.length} URL(s) with issues: ${dirtyUrls.slice(0, 3).join('; ')}${dirtyUrls.length > 3 ? '…' : ''}`);
}
add(R, 'sitemap', 6, smScore, smScore === 6 ? 'ok' : smScore ? 'warn' : 'fail', smNotes.length ? `Sitemap: ${smNotes.join(', ')}` : 'Sitemap missing or empty',
  dirtyUrls.length ? `Keep only canonical URLs with status 200 in the sitemap, no redirects or noindex${mode === 'dir' ? ' (for dynamic routes, check the live site by URL)' : ''}` : 'Generate sitemap.xml with real lastmod and add "Sitemap:" to robots');

if (httpsKnown) add(R, 'https', 1, https ? 1 : 0, https ? 'ok' : 'warn', https ? 'HTTPS' : mode === 'url' ? 'No HTTPS' : 'Canonical/og:url without https', 'Serve the site over HTTPS');
else add(R, 'https', 1, 1, 'warn', 'HTTPS cannot be checked in the folder (no canonical/og:url)', '');

// ---------- 2. Readable without JS (20) ----------
const L = 'Readable without JS';
// Home page: 150+ words for full points. Inner pages (contact, pricing) can be short: content in the HTML is enough.
// JS dependence (lib): empty #root, or little text with a script in the body.
const ssr = perPage(8, (x, p) => (x.jsDependent ? 0 : x.wordCount < (p.isHome ? 150 : 50) ? 4 : 8), 'content depends on JS or has little text');
add(L, 'ssr', 8, ssr.score, ssr.score === 8 ? 'ok' : a.jsDependent || analyzed.some((p) => p.a.jsDependent) ? 'fail' : 'warn',
  `${a.wordCount} words in the home page's initial HTML${a.jsDependent ? ' (content built by JS: SPA)' : a.wordCount < 150 ? ' (short home page)' : ''}${ssr.note}`,
  'Prerender/SSR the public pages (<skill>/references/stacks.md)');
const h1 = perPage(3, (x) => (x.h1.length === 1 ? 3 : x.h1.length > 1 ? 2 : 0), 'not exactly one h1');
add(L, 'h1', 3, h1.score, h1.score === 3 ? 'ok' : h1.score ? 'warn' : 'fail', `${a.h1.length} <h1> on the home page${a.h1[0] ? `: "${a.h1[0].slice(0, 70)}"` : ''}${h1.note}`, 'Use exactly one descriptive <h1> per page');
const titleCount = {};
for (const p of analyzed) if (p.a.title) titleCount[p.a.title] = (titleCount[p.a.title] || 0) + 1;
const tlScore = (x) => { const n = (x.title || '').length; return n >= 10 && n <= 70 ? (titleCount[x.title] > 1 ? 2 : 3) : n ? 2 : 0; };
const tt = perPage(3, tlScore, 'title missing, wrong length or duplicated');
const tl = (a.title || '').length;
add(L, 'title', 3, tt.score, tt.score === 3 ? 'ok' : tt.score ? 'warn' : 'fail', (a.title ? `Home page title has ${tl} characters: "${a.title.slice(0, 80)}"` : 'Home page has no <title>') + tt.note, 'Unique title per page, 50–60 characters: topic + brand');
const dl = (a.description || '').length;
add(L, 'description', 2, dl >= 50 && dl <= 170 ? 2 : dl ? 1 : 0, dl >= 50 && dl <= 170 ? 'ok' : dl ? 'warn' : 'fail', a.description ? `Meta description has ${dl} characters` : 'No meta description', 'Meta description of 140–160 characters');
add(L, 'canonical', 2, a.canonical ? 2 : 0, a.canonical ? 'ok' : 'warn', a.canonical ? `Canonical: ${a.canonical}` : 'No canonical', 'Add an absolute <link rel="canonical">');
add(L, 'lang', 2, a.lang ? 2 : 0, a.lang ? 'ok' : 'warn', a.lang ? `lang="${a.lang}"` : 'No lang attribute on <html>', 'Add <html lang="..."> with the page language (e.g. en, pt-BR, es)');

// ---------- 3. Entity (15) ----------
const E = 'Entity';
const ldOk = a.jsonld.filter((j) => j.ok).length, ldBad = a.jsonld.filter((j) => !j.ok);
add(E, 'jsonld', 5, ldOk && !ldBad.length ? 5 : ldOk ? 3 : 0, ldOk && !ldBad.length ? 'ok' : ldOk ? 'warn' : 'fail',
  a.jsonld.length ? `${ldOk} valid JSON-LD block(s)${ldBad.length ? `, ${ldBad.length} broken (parser error: ${ldBad[0].error})` : ''}. Types: ${a.types.join(', ') || '-'}` : 'No JSON-LD in the initial HTML',
  'Generate it with <skill>/scripts/generate-schema.mjs and render it on the server');
const ENTITY = ['Organization', 'LocalBusiness', 'Person', 'Corporation', 'ProfessionalService', 'MedicalBusiness', 'Dentist', 'MedicalClinic', 'Physician', 'Store', 'Restaurant', 'LegalService', 'EducationalOrganization', 'NGO', 'OnlineStore', 'SoftwareApplication', 'MobileApplication', 'WebApplication'];
const hasEntity = a.types.some((t) => ENTITY.includes(t) || /Business|Organization|Service|Clinic|Store/.test(t));
add(E, 'entity', 4, hasEntity ? 4 : 0, hasEntity ? 'ok' : 'fail', hasEntity ? 'Main entity declared in the schema' : 'No Organization/LocalBusiness/Person/SoftwareApplication', 'Add the entity schema to the layout (<skill>/references/schema.md)');
add(E, 'sameAs', 3, a.sameAs.length >= 2 ? 3 : a.sameAs.length ? 1 : 0, a.sameAs.length >= 2 ? 'ok' : 'warn', `${a.sameAs.length} profile(s) in sameAs`, 'List Instagram, LinkedIn, YouTube, Google Business Profile in sameAs');
const og = (a.og.title ? 1 : 0) + (a.og.image ? 1 : 0) + (a.og.description ? 1 : 0);
add(E, 'opengraph', 3, og, og === 3 ? 'ok' : og ? 'warn' : 'fail', `Open Graph: ${['title', 'description', 'image'].filter((k) => a.og[k]).join(', ') || 'none'}`, 'Add og:title, og:description, og:image');

// ---------- 4. Citable content (15) ----------
const C = 'Citable content';
add(C, 'question-h2s', 4, a.questionH2 >= 2 ? 4 : a.questionH2 ? 2 : 0, a.questionH2 >= 2 ? 'ok' : 'warn', a.h2.length ? `${a.questionH2} of ${a.h2.length} H2s are questions` : 'No H2 on the page', 'Use real questions as H2s with a direct answer below (<skill>/references/content.md)');
// Site paths: in folder mode, a sitemap URL only counts if it has a file.
const homeLinks = [...home.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
const smPaths = (mode === 'url' ? siteUrls : siteUrls.filter((u) => fileFor(u))).map(pathOf);
const allPaths = [...smPaths, ...htmlFiles.map((f) => '/' + f), ...homeLinks].map((s) => s.toLowerCase());
const hasFaq = a.types.includes('FAQPage') || allPaths.some((p) => /faq|questions|perguntas|preguntas|duvidas|dúvidas|dudas/.test(p));
add(C, 'faq', 3, hasFaq ? 3 : 0, hasFaq ? 'ok' : 'warn', hasFaq ? 'FAQ found (schema or page)' : 'No FAQ/questions page', 'Create an FAQ per service/product with FAQPage schema');
// Dates: real value of dateModified/datePublished (JSON-LD) or <time datetime>, on the home page and inner pages.
const dateVals = [];
const walkDates = (o) => {
  if (Array.isArray(o)) return o.forEach(walkDates);
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) (k === 'dateModified' || k === 'datePublished') && typeof v === 'string' ? dateVals.push(v) : walkDates(v);
};
for (const p of [{ a, html: home }, ...inner.filter((x) => x.a)]) {
  p.a.jsonld.filter((j) => j.ok).forEach((j) => walkDates(j.data));
  for (const m of (p.html || '').matchAll(/<time\b[^>]*\bdatetime=["']([^"']+)["']/gi)) dateVals.push(m[1]);
}
const newest = Math.max(...dateVals.map((d) => Date.parse(d)).filter((t) => t && t <= Date.now() + 864e5), 0);
const dateAgeDays = newest ? Math.floor((Date.now() - newest) / 864e5) : null;
const dateScore = newest ? (dateAgeDays <= 365 ? 2 : 1) : 0;
add(C, 'dates', 2, dateScore, dateScore === 2 ? 'ok' : 'warn',
  newest ? `Most recent date: ${new Date(newest).toISOString().slice(0, 10)}${dateAgeDays > 365 ? ' (over 12 months old)' : ''}` : 'No dates with a value (time datetime/datePublished/dateModified)',
  newest ? 'Review the key pages and update dateModified only when the content really changes' : 'Show "Updated" with <time datetime> and use dateModified in the schema');
add(C, 'author', 2, a.author ? 2 : 0, a.author ? 'ok' : 'warn', a.author ? 'Author indicated' : 'No identifiable author', 'Show an author with credentials and an author page');
const about = allPaths.some((p) => /about|sobre|quem-somos|acerca|nosotros|quienes-somos|equipe|equipo|team/.test(p));
const contact = allPaths.some((p) => /contact|contato|contacto|fale-conosco/.test(p)) || /tel:|mailto:/i.test(home);
add(C, 'about-contact', 3, (about ? 2 : 0) + (contact ? 1 : 0), about && contact ? 'ok' : 'warn', `About: ${about ? 'yes' : 'no'} · Contact: ${contact ? 'yes' : 'no'}`, 'Create an About page (who, credentials) and a Contact page with NAP');
add(C, 'llms', 1, llmsTxt ? 1 : 0, llmsTxt ? 'ok' : 'warn', llmsTxt ? 'llms.txt present' : 'No llms.txt (optional, low impact)', '<skill>/scripts/generate-llms-txt.mjs');

// ---------- informational ----------
const training = Object.fromEntries(TRAINING_BOTS.map((b) => [b, robotsAllowsRoot(rp, b).allowed ? 'allowed' : 'blocked']));
const extras = [];
if (a.imgNoAlt) extras.push(`${a.imgNoAlt} of ${a.imgCount} images without alt`);
if (!a.hasMain) extras.push('no <main> (semantic HTML helps extract the main content)');

// Home page schema NAP vs aeo/profile.json (not scored). Only when the profile belongs to this site.
const hostOf = (u) => { try { return new URL(u).host.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const siteHost = hostOf(mode === 'url' ? target : a.canonical || a.og.url || '');
let profile = null, nap = null;
try {
  const own = mode === 'dir' ? loadProfile(dir) : null;
  const cwdProfile = own ? null : loadProfile();
  profile = own || (cwdProfile && (siteHost ? hostOf(cwdProfile.url) === siteHost : mode === 'dir') ? cwdProfile : null);
} catch (e) { extras.push(e.message); }
if (profile) {
  const nodes = []; const walkN = (o) => { if (Array.isArray(o)) return o.forEach(walkN); if (o && typeof o === 'object') { nodes.push(o); Object.values(o).forEach(walkN); } };
  a.jsonld.filter((j) => j.ok).forEach((j) => walkN(j.data));
  const entity = nodes.find((o) => o.telephone || o.address) || nodes.find((o) => o.name && o['@type'] && o['@type'] !== 'WebSite') || {};
  const addr = typeof entity.address === 'object' && entity.address ? entity.address : {};
  const digits = (s) => String(s || '').replace(/\D/g, '');
  // Phones match when the digits are equal, or when one ends with the other and they differ only by a country code (up to 3 digits).
  const samePhone = (x, y) => {
    const dx = digits(x), dy = digits(y);
    if (dx === dy) return true;
    if (dx.length < 8 || dy.length < 8) return false;
    const [longer, shorter] = dx.length >= dy.length ? [dx, dy] : [dy, dx];
    return longer.endsWith(shorter) && longer.length - shorter.length <= 3;
  };
  const same = (x, y) => String(x || '').trim().toLowerCase() === String(y || '').trim().toLowerCase();
  const mismatches = [];
  if (profile.name && !same(profile.name, entity.name)) mismatches.push(`name: profile "${profile.name}" vs schema "${entity.name || '-'}"`);
  if (profile.telephone && !samePhone(profile.telephone, entity.telephone)) mismatches.push(`telephone: profile "${profile.telephone}" vs schema "${entity.telephone || '-'}"`);
  if (profile.address?.street && !same(profile.address.street, addr.streetAddress)) mismatches.push(`street: profile "${profile.address.street}" vs schema "${addr.streetAddress || '-'}"`);
  if (profile.address?.city && !same(profile.address.city, addr.addressLocality)) mismatches.push(`city: profile "${profile.address.city}" vs schema "${addr.addressLocality || '-'}"`);
  const missing = Object.entries(profile.profiles || {}).filter(([, u]) => u && !a.sameAs.includes(u)).map(([k]) => k);
  if (missing.length) mismatches.push(`missing from sameAs: ${missing.join(', ')}`);
  nap = { ok: !mismatches.length, mismatches };
}

// ---------- output ----------
let total = checks.reduce((s, c) => s + c.score, 0);
// Cap: a home page whose content depends on JS gets at most 30 technical points, even with a perfect <head>.
// A short static page has no cap (it only loses points on the ssr check).
const cappedBy = a.jsDependent && total > 30 ? 'content not rendered without JS (cap 30)' : null;
if (cappedBy) total = 30;
const pages = inner.map((p) => ({ url: p.ref, status: p.status, title: p.a?.title?.slice(0, 60) || null, h1: p.a?.h1.length ?? 0, description: !!p.a?.description, jsonld: p.a?.jsonld.filter((j) => j.ok).length ?? 0, words: p.a?.wordCount ?? 0, noindex: p.a ? isNoindex(p.a, p) : null, issues: p.issues }));
const cats = {};
for (const c of checks) { cats[c.cat] ??= { score: 0, max: 0 }; cats[c.cat].score += c.score; cats[c.cat].max += c.max; }
const top = checks.filter((c) => c.score < c.max).sort((x, y) => (y.max - y.score) - (x.max - x.score)).slice(0, 5);
const report = { target, mode, technicalScore: total, max: 75, cappedBy, categories: cats, top5: top, checks, trainingBots: training, extraWarnings: extras, nap, sampledPages: pages, date: new Date().toISOString().slice(0, 10) };

if (args.json) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

const icon = { ok: '✓', warn: '!', fail: '✗' };
console.log(`\nTechnical AEO audit — ${target} (${mode})`);
console.log(`Technical score: ${total}/75   (add up to 25 for indexing + off-page; see <skill>/references/audit.md)`);
if (cappedBy) console.log(`  Capped score: ${cappedBy}. AI bots without JS see an empty page.`);
console.log('');
for (const [k, v] of Object.entries(cats)) console.log(`  ${k.padEnd(21)} ${String(v.score).padStart(2)}/${v.max}`);
console.log('\nHighest impact:');
top.forEach((c, i) => console.log(`  ${i + 1}. [${c.cat}] ${c.msg}\n     → ${c.fix}  (−${c.max - c.score} ${c.max - c.score === 1 ? 'pt' : 'pts'})`));
if (!top.length) console.log('  (nothing to fix)');
console.log('\nAll checks:');
for (const c of checks) console.log(`  ${icon[c.status]} ${c.cat.padEnd(20)} ${String(c.score).padStart(2)}/${String(c.max).padEnd(2)} ${c.msg}`);
console.log(`\nTraining bots (user's choice, not scored): ${Object.entries(training).map(([b, s]) => `${b}=${s}`).join(' · ')}`);
if (extras.length) console.log(`Other warnings: ${extras.join('; ')}`);
if (nap) console.log(nap.ok ? 'Schema NAP matches aeo/profile.json (not scored)' : `Schema NAP differs from aeo/profile.json (not scored; the text must be identical everywhere):\n  - ${nap.mismatches.join('\n  - ')}`);
if (pages.length) {
  console.log(`\nInner pages analyzed (${pages.length}):`);
  for (const p of pages.slice(0, 15)) console.log(`  ${p.status} ${p.url}\n      h1=${p.h1} desc=${p.description ? 'yes' : 'no'} jsonld=${p.jsonld} words=${p.words} title="${p.title || '-'}"${p.noindex ? ' NOINDEX' : ''}${p.issues.length ? ` · ${p.issues.join(', ')}` : ''}`);
  if (pages.length > 15) console.log(`  … ${pages.length - 15} more (use --json to see all)`);
}
console.log('');
