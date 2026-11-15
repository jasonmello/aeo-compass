#!/usr/bin/env node
// Offline test suite for the AEO Compass skill scripts. Node >= 18 built-ins only, no network.
// Run from the skill root: node tests/run.mjs
// Only folder modes, local sitemaps and dry runs are exercised. Nothing is ever run with --send.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeHtml, parseArgs, sameHostUrls, robotsAllowsRoot, parseRobots } from '../scripts/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const FIX = path.join(ROOT, 'tests', 'fixtures');
const TMP = path.join(ROOT, 'tests', 'tmp');

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

// Environment without the Bing key, so bing-submit can never authenticate.
const env = { ...process.env };
delete env.BING_API_KEY;

function run(script, args = [], { cwd = ROOT } = {}) {
  // Safety net: tests never submit. --send only appears with a negative value, which the scripts must reject.
  args.forEach((a, i) => {
    if (a === '--send') assert.match(args[i + 1] || '', /^(false|no|0|off)$/i, 'tests never run --send');
    if (a.startsWith('--send=')) assert.notEqual(a, '--send=true', 'tests never run --send');
  });
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], { cwd, env, encoding: 'utf8', timeout: 30000 });
  return { code: r.status, out: r.stdout, err: r.stderr, all: r.stdout + r.stderr };
}
const runJson = (script, args, opts) => {
  const r = run(script, [...args, '--json'], opts);
  assert.equal(r.code, 0, `${script} failed: ${r.all}`);
  return JSON.parse(r.out);
};
function tmpCopy(name, label = name) {
  const dest = path.join(TMP, `${label}-${Math.random().toString(36).slice(2, 8)}`);
  fs.cpSync(path.join(FIX, name), dest, { recursive: true });
  return dest;
}

// ---------- syntax ----------
test('every script passes node --check', () => {
  for (const f of fs.readdirSync(SCRIPTS).filter((f) => f.endsWith('.mjs'))) {
    const r = spawnSync(process.execPath, ['--check', path.join(SCRIPTS, f)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${f}: ${r.stderr}`);
  }
});

// ---------- lib ----------
test('lib: question-style H2s in en/pt/es, including accented words', () => {
  const html = '<body>' + [
    'What is AEO', 'How much does it cost', 'Is it worth it', 'Quanto custa um implante', 'O que é AEO', 'Por que usar',
    'Cómo funciona', 'Qué es el AEO', 'Cuánto cuesta', '¿Vale la pena', 'Pricing plans?', 'Our services', 'Whatever works', 'Isolation tips',
  ].map((h) => `<h2>${h}</h2>`).join('') + '</body>';
  const a = analyzeHtml(html);
  // 11 questions; "Our services", "Whatever works" and "Isolation tips" are not (prefix words must end at a boundary).
  assert.equal(a.questionH2, 11);
});

test('lib: --force never swallows the next argument; --send=false is rejected', () => {
  const a = parseArgs(['--out', 'x.json', '--force', './site']);
  assert.equal(a.force, true);
  assert.deepEqual(a._, ['./site']);
  const r = run('bing-submit.mjs', ['--site', 'https://example.com', '--urls', 'https://example.com/a', '--send=false']);
  assert.equal(r.code, 1);
});

test('lib: sameHostUrls returns otherHosts and switchTo; robots "no rule"', () => {
  const h = sameHostUrls(['https://www.example.com/a', 'https://www.example.com/b', 'https://other.org/c'], 'example.com');
  assert.deepEqual(h.ok, []);
  assert.equal(h.switchTo, 'www.example.com');
  assert.deepEqual(h.otherHosts.sort(), ['other.org', 'www.example.com']);
  assert.equal(robotsAllowsRoot(parseRobots(''), 'GPTBot').via, 'no rule');
});

// ---------- detect-stack ----------
test('detect-stack: bad-spa is static-html flagged as a compiled SPA', () => {
  const j = runJson('detect-stack.mjs', [path.join(FIX, 'bad-spa')]);
  assert.equal(j.stack, 'static-html');
  assert.match(j.rendering, /Compiled SPA/);
  assert.ok(j.warnings.some((w) => /compiled SPA/.test(w)));
  assert.equal(j.profile, false);
  assert.ok(j.existingAeoFiles.includes('robots.txt'));
});

test('detect-stack: good-static is static-html with a profile', () => {
  const j = runJson('detect-stack.mjs', [path.join(FIX, 'good-static')]);
  assert.equal(j.stack, 'static-html');
  assert.equal(j.rendering, 'Static (great).');
  assert.equal(j.profile, true);
  for (const f of ['robots.txt', 'sitemap.xml', 'llms.txt', 'aeo/profile.json']) assert.ok(j.existingAeoFiles.includes(f), f);
  assert.equal(j.public, '.');
  assert.ok(j.warnings.some((w) => /aeo\/ folder/.test(w)), 'warns that aeo/ would ship with a root public folder');
});

test('detect-stack: nextjs without app/ is pages router (with warning), with app/ is app router', () => {
  const j = runJson('detect-stack.mjs', [path.join(FIX, 'nextjs')]);
  assert.equal(j.stack, 'nextjs-pages-router');
  assert.ok(j.warnings.some((w) => /No app\/ or pages\//.test(w)));
  const copy = tmpCopy('nextjs');
  fs.mkdirSync(path.join(copy, 'app'));
  fs.writeFileSync(path.join(copy, 'app', 'layout.tsx'), 'export default function L({ children }) { return children; }\n');
  const k = runJson('detect-stack.mjs', [copy]);
  assert.equal(k.stack, 'nextjs-app-router');
  assert.equal(k.head, 'app/layout.tsx (metadata / generateMetadata)');
  assert.equal(k.public, 'public/');
});

test('detect-stack: text output points to onboarding when there is no profile', () => {
  const r = run('detect-stack.mjs', [path.join(FIX, 'nextjs')]);
  assert.equal(r.code, 0);
  assert.match(r.out, /Stack: nextjs-pages-router/);
  assert.match(r.out, /run onboarding \(SKILL\.md, step 0\)/);
});

// ---------- audit ----------
test('audit: bad-spa scores low and flags robots block, broken JSON-LD and SPA', () => {
  const j = runJson('audit.mjs', [path.join(FIX, 'bad-spa')]);
  assert.equal(j.mode, 'dir');
  assert.equal(j.max, 75);
  assert.ok(j.technicalScore <= 30, `score ${j.technicalScore}`);
  const c = Object.fromEntries(j.checks.map((x) => [x.id, x]));
  assert.equal(c['search-bots'].status, 'fail');
  assert.match(c['search-bots'].msg, /OAI-SearchBot \(robots\)/);
  assert.equal(c['search-bots'].score, 7);
  assert.equal(c.jsonld.status, 'fail');
  assert.match(c.jsonld.msg, /1 broken \(parser error/);
  assert.equal(c.ssr.status, 'fail');
  assert.match(c.ssr.msg, /SPA/);
  assert.equal(c.lang.status, 'warn');
  assert.match(c.lang.fix, /e\.g\. en, pt-BR, es/);
  for (const s of j.checks.map((x) => x.status)) assert.ok(['ok', 'warn', 'fail'].includes(s), s);
  assert.equal(j.nap, null);
});

test('audit: good-static scores >= 70/75 and category maxima sum to 75', () => {
  const j = runJson('audit.mjs', [path.join(FIX, 'good-static')]);
  assert.ok(j.technicalScore >= 70, `score ${j.technicalScore}: ${JSON.stringify(j.top5)}`);
  assert.equal(j.cappedBy, null);
  assert.deepEqual(Object.keys(j.categories), ['Crawlable', 'Readable without JS', 'Entity', 'Citable content']);
  assert.equal(Object.values(j.categories).reduce((s, c) => s + c.max, 0), 75);
  assert.deepEqual(Object.values(j.categories).map((c) => c.max), [25, 20, 15, 15]);
  const ids = j.checks.map((c) => c.id);
  for (const id of ['robots', 'search-bots', 'noindex', 'sitemap', 'https', 'ssr', 'h1', 'title', 'description', 'canonical', 'lang', 'jsonld', 'entity', 'sameAs', 'opengraph', 'question-h2s', 'faq', 'dates', 'author', 'about-contact', 'llms']) assert.ok(ids.includes(id), id);
  // NAP: profile phone "(512) 555-0100" matches schema "+1-512-555-0100" (country code difference).
  assert.deepEqual(j.nap, { ok: true, mismatches: [] });
  assert.equal(Object.values(j.trainingBots).every((v) => v === 'allowed'), true);
  assert.ok(j.sampledPages.length === 3 && j.sampledPages.every((p) => p.words >= 50 && Array.isArray(p.issues)));
  assert.ok(!j.sampledPages.some((p) => /404/.test(p.url)), '404 page is skipped');
  for (const k of ['target', 'mode', 'technicalScore', 'max', 'cappedBy', 'categories', 'top5', 'checks', 'trainingBots', 'extraWarnings', 'nap', 'sampledPages', 'date']) assert.ok(k in j, k);
});

test('audit: JS-dependent home page is capped at 30 with the exact cappedBy text; NAP mismatches are reported', () => {
  const copy = tmpCopy('good-static', 'capped');
  const idx = path.join(copy, 'index.html');
  const html = fs.readFileSync(idx, 'utf8').replace(/<body>[\s\S]*<\/body>/, '<body><div id="root"></div><script type="module" src="/assets/app.js"></script></body>');
  fs.writeFileSync(idx, html);
  const prof = JSON.parse(fs.readFileSync(path.join(copy, 'aeo', 'profile.json'), 'utf8'));
  prof.telephone = '+1-512-555-0199';
  prof.profiles.youtube = 'https://www.youtube.com/@exampledental';
  fs.writeFileSync(path.join(copy, 'aeo', 'profile.json'), JSON.stringify(prof, null, 2));
  const j = runJson('audit.mjs', [copy]);
  assert.equal(j.cappedBy, 'content not rendered without JS (cap 30)');
  assert.equal(j.technicalScore, 30);
  assert.equal(j.nap.ok, false);
  assert.ok(j.nap.mismatches.some((m) => m.startsWith('telephone: profile "+1-512-555-0199"')));
  assert.ok(j.nap.mismatches.includes('missing from sameAs: youtube'));
  const t = run('audit.mjs', [copy]);
  assert.match(t.out, /Capped score: content not rendered without JS \(cap 30\)/);
  assert.match(t.out, /Technical score: 30\/75/);
});

test('audit: sitemap URL without a file is flagged in folder mode', () => {
  const copy = tmpCopy('good-static', 'dirty');
  const sm = path.join(copy, 'sitemap.xml');
  fs.writeFileSync(sm, fs.readFileSync(sm, 'utf8').replace('</urlset>', '  <url><loc>https://example.com/missing-page</loc><lastmod>2026-11-02</lastmod></url>\n</urlset>'));
  const j = runJson('audit.mjs', [copy]);
  const s = j.checks.find((c) => c.id === 'sitemap');
  assert.equal(s.score, 5);
  assert.match(s.msg, /missing-page \(no file in folder\)/);
});

test('audit: missing target exits 1, empty folder exits 2', () => {
  assert.equal(run('audit.mjs', []).code, 1);
  const empty = path.join(TMP, 'empty');
  fs.mkdirSync(empty, { recursive: true });
  assert.equal(run('audit.mjs', [empty]).code, 2);
});

// ---------- generate-schema ----------
test('generate-schema: valid JSON-LD from the profile', () => {
  const r = run('generate-schema.mjs', ['--profile', path.join(FIX, 'good-static', 'aeo', 'profile.json')]);
  assert.equal(r.code, 0, r.all);
  const j = JSON.parse(r.out);
  assert.equal(j['@context'], 'https://schema.org');
  const [entity, site] = j['@graph'];
  assert.equal(entity['@type'], 'Dentist');
  assert.equal(entity['@id'], 'https://example.com/#organization');
  assert.equal(entity.name, 'Example Dental');
  assert.equal(entity.telephone, '(512) 555-0100');
  assert.deepEqual(entity.sameAs, ['https://www.instagram.com/exampledental', 'https://www.linkedin.com/company/exampledental']);
  assert.deepEqual(entity.address, { '@type': 'PostalAddress', streetAddress: '123 Main St', addressLocality: 'Austin', addressRegion: 'TX', postalCode: '78701', addressCountry: 'US' });
  assert.equal(entity.geo.latitude, 30.2672);
  assert.equal(entity.openingHoursSpecification[0].opens, '08:00');
  assert.equal(entity.founder.name, 'Dr. Jane Smith');
  assert.equal(entity.legalName, undefined, 'empty fields are dropped');
  assert.equal(site['@type'], 'WebSite');
  assert.equal(site.inLanguage, 'en');
  assert.equal(j['@graph'].length, 2, 'no app node without app.name');
});

test('generate-schema: defaults (language en, currency USD, no country) and --html/--out/--force', () => {
  const p = path.join(TMP, 'profile-min.json');
  fs.writeFileSync(p, JSON.stringify({
    name: 'Acme Notes', url: 'https://acme.example/', description: 'A note-taking app for small teams that works offline.',
    address: { street: '1 Elm St', city: 'Springfield' }, profiles: { github: 'https://github.com/acme' },
    app: { name: 'Acme Notes', category: 'BusinessApplication', operatingSystem: 'iOS, Android', price: 0 },
  }));
  const r = run('generate-schema.mjs', ['--profile', p]);
  assert.equal(r.code, 0, r.all);
  const g = JSON.parse(r.out)['@graph'];
  assert.equal(g[0]['@type'], 'Organization');
  assert.equal(g[0].address.addressCountry, undefined);
  assert.equal(g[1].inLanguage, 'en');
  assert.equal(g[2]['@type'], 'SoftwareApplication');
  assert.deepEqual(g[2].offers, { '@type': 'Offer', price: '0', priceCurrency: 'USD' });
  assert.match(r.err, /fewer than 2 profiles/);
  const out = path.join(TMP, 'schema-out', 'head.html');
  assert.equal(run('generate-schema.mjs', ['--profile', p, '--html', '--out', out]).code, 0);
  assert.match(fs.readFileSync(out, 'utf8'), /^<script type="application\/ld\+json">/);
  const other = path.join(TMP, 'schema-out', 'page.html');
  fs.writeFileSync(other, '<p>hand-written</p>');
  assert.equal(run('generate-schema.mjs', ['--profile', p, '--out', other]).code, 1);
  assert.equal(run('generate-schema.mjs', ['--profile', p, '--out', other, '--force']).code, 0);
});

test('generate-schema: rejects the empty template and a short description', () => {
  const r = run('generate-schema.mjs', ['--profile', path.join(ROOT, 'templates', 'profile.json')]);
  assert.equal(r.code, 1);
  assert.match(r.err, /Required fields empty in profile\.json: name, url, description/);
  const p = path.join(TMP, 'profile-short.json');
  fs.writeFileSync(p, JSON.stringify({ name: 'X', url: 'https://x.example', description: 'Too short' }));
  const s = run('generate-schema.mjs', ['--profile', p]);
  assert.equal(s.code, 1);
  assert.match(s.err, /Field 'description' is too short/);
  assert.equal(run('generate-schema.mjs', ['--profile', path.join(TMP, 'nope.json')]).code, 1);
});

test('templates/profile.json is valid JSON with the English keys', () => {
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates', 'profile.json'), 'utf8'));
  assert.equal(t.language, 'en');
  assert.equal(t.address.country, '');
  assert.equal(t.app.currency, 'USD');
  for (const k of ['name', 'type', 'description', 'url', 'logo', 'foundingDate', 'legalName', 'taxID', 'jobTitle', 'telephone', 'email', 'address', 'geo', 'mapUrl', 'areaServed', 'priceRange', 'openingHours', 'profiles', 'founder', 'app', 'audience', 'competitors']) assert.ok(k in t, k);
});

// ---------- generate-llms-txt ----------
test('generate-llms-txt: folder mode lists pages with the profile header', () => {
  const site = path.join(FIX, 'good-static');
  const r = run('generate-llms-txt.mjs', ['--dir', '.', '--site', 'https://example.com'], { cwd: site });
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /^# Example Dental\n\n> Dental implants and general dentistry/);
  assert.match(r.out, /- Location: Austin - TX/);
  assert.match(r.out, /- Audience: Adults who need dental implants/);
  assert.match(r.out, /- Contact: \(512\) 555-0100/);
  assert.match(r.out, /\n## Main\n/);
  assert.match(r.out, /- \[Dental implants in Austin, TX\]\(https:\/\/example\.com\): Example Dental places/);
  for (const p of ['about', 'contact', 'faq']) assert.match(r.out, new RegExp(`\\(https://example\\.com/${p}\\)`), p);
  assert.doesNotMatch(r.out, /404|Page not found/);
});

test('generate-llms-txt: --out writes the file; --dir without --site and bad --site fail', () => {
  const out = path.join(TMP, 'llms', 'llms.txt');
  const r = run('generate-llms-txt.mjs', ['--dir', path.join(FIX, 'good-static'), '--site', 'https://example.com', '--out', out], { cwd: TMP });
  assert.equal(r.code, 0, r.all);
  assert.match(r.err, /llms\.txt with 4 pages written/);
  assert.match(fs.readFileSync(out, 'utf8'), /^# Site\n/, 'no profile in cwd: generic header');
  const n = run('generate-llms-txt.mjs', ['--dir', path.join(FIX, 'good-static')], { cwd: TMP });
  assert.equal(n.code, 1);
  assert.match(n.err, /--dir requires --site https:\/\/domain\.com/);
  assert.equal(run('generate-llms-txt.mjs', ['--dir', path.join(FIX, 'good-static'), '--site', 'example.com'], { cwd: TMP }).code, 1);
  assert.equal(run('generate-llms-txt.mjs', [], { cwd: TMP }).code, 1);
});

// ---------- indexnow (dry run only) ----------
test('indexnow: dry run creates the key file and resolves the local sitemap index (CDATA, namespaced tags)', () => {
  const work = tmpCopy('sitemap-index', 'indexnow');
  fs.mkdirSync(path.join(work, 'public'));
  const r = run('indexnow.mjs', ['--site', 'https://example.com', '--public', 'public', '--sitemap', 'sitemap-index.xml'], { cwd: work });
  assert.equal(r.code, 0, r.all);
  const cfg = JSON.parse(fs.readFileSync(path.join(work, 'aeo', 'indexnow.json'), 'utf8'));
  assert.match(cfg.key, /^[0-9a-f]{32}$/);
  assert.equal(cfg.host, 'example.com');
  assert.equal(cfg.lastSubmission, undefined);
  assert.equal(fs.readFileSync(path.join(work, 'public', `${cfg.key}.txt`), 'utf8'), cfg.key);
  assert.match(r.out, /URLs \(4\):/);
  for (const u of ['https://example.com/', 'https://example.com/services/implants', 'https://example.com/blog/old-post', 'https://example.com/about?ref=a&b=c']) assert.ok(r.out.includes(`  ${u}\n`), u);
  assert.match(r.out, new RegExp(`Key file \\(must be published\\): https://example\\.com/${cfg.key}\\.txt`));
  assert.match(r.out, /DRY RUN: nothing was submitted/);
  // Second run reuses the key.
  const r2 = run('indexnow.mjs', ['--site', 'https://example.com', '--public', 'public', '--sitemap', 'sitemap-index.xml'], { cwd: work });
  assert.equal(r2.code, 0);
  assert.doesNotMatch(r2.out, /key created/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(work, 'aeo', 'indexnow.json'), 'utf8')).key, cfg.key);
});

test('indexnow: --changed-since keeps only lastmod >= date and warns about URLs without lastmod', () => {
  const work = tmpCopy('sitemap-index', 'since');
  const r = run('indexnow.mjs', ['--site', 'https://example.com', '--sitemap', 'sitemap-index.xml', '--changed-since', '2026-11-01'], { cwd: work });
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /URLs \(2\):/);
  assert.ok(r.out.includes('  https://example.com/\n'));
  assert.ok(r.out.includes('  https://example.com/services/implants\n'));
  assert.ok(!r.out.includes('old-post'));
  assert.match(r.out, /1 URL\(s\) without <lastmod> were left out of --changed-since/);
  assert.equal(run('indexnow.mjs', ['--site', 'https://example.com', '--sitemap', 'sitemap-index.xml', '--changed-since', 'yesterday'], { cwd: work }).code, 1);
});

test('indexnow: rejects --site without scheme, missing public folder and missing local sitemap', () => {
  const work = tmpCopy('sitemap-index', 'reject');
  const r = run('indexnow.mjs', ['--site', 'example.com', '--urls', 'https://example.com/a'], { cwd: work });
  assert.equal(r.code, 1);
  assert.match(r.err, /Invalid --site \("example\.com"\)/);
  assert.equal(run('indexnow.mjs', ['--urls', 'https://example.com/a'], { cwd: work }).code, 1);
  assert.equal(run('indexnow.mjs', ['--site', 'https://example.com', '--public', 'nope', '--urls', 'https://example.com/a'], { cwd: work }).code, 1);
  const s = run('indexnow.mjs', ['--site', 'https://example.com', '--sitemap', 'missing.xml'], { cwd: work });
  assert.equal(s.code, 1);
  assert.match(s.err, /Local sitemap not found/);
  assert.equal(fs.existsSync(path.join(work, 'aeo')), false, 'no key written when validation fails');
});

test('indexnow: detects www mismatch and skips foreign hosts', () => {
  const work = tmpCopy('sitemap-index', 'www');
  const r = run('indexnow.mjs', ['--site', 'https://example.com', '--urls', 'https://www.example.com/a,https://www.example.com/b'], { cwd: work });
  assert.equal(r.code, 1);
  assert.match(r.err, /Your URLs use www\.example\.com, not example\.com\. Run again with --site https:\/\/www\.example\.com/);
  const f = run('indexnow.mjs', ['--site', 'https://example.com', '--urls', 'https://example.com/a,https://other.org/b'], { cwd: work });
  assert.equal(f.code, 0, f.all);
  assert.match(f.out, /Skipping 1 URL\(s\) from another host \(other\.org\)/);
  assert.match(f.out, /URLs \(1\):\n  https:\/\/example\.com\/a\n/);
  assert.equal(run('indexnow.mjs', ['--site', 'https://example.com', '--urls', 'https://example.com/a', '--send=false'], { cwd: work }).code, 1);
});

// ---------- bing-submit (dry run only) ----------
test('bing-submit: dry run works without BING_API_KEY', () => {
  const r = run('bing-submit.mjs', ['--site', 'https://example.com', '--urls', 'https://example.com/a,https://example.com/b']);
  assert.equal(r.code, 0, r.all);
  assert.match(r.out, /Site: https:\/\/example\.com\nURLs \(2\):/);
  assert.match(r.out, /DRY RUN: nothing was submitted/);
});

test('bing-submit: rejects --send=false, "--send false", www mismatch and missing URLs', () => {
  for (const extra of [['--send=false'], ['--send', 'false'], ['--send=no']]) {
    const r = run('bing-submit.mjs', ['--site', 'https://example.com', '--urls', 'https://example.com/a', ...extra]);
    assert.equal(r.code, 1, extra.join(' '));
    assert.match(r.err, /--send does not take a value/);
  }
  const w = run('bing-submit.mjs', ['--site', 'https://example.com', '--urls', 'https://www.example.com/a']);
  assert.equal(w.code, 1);
  assert.match(w.err, /Your URLs use www\.example\.com/);
  assert.equal(run('bing-submit.mjs', ['--site', 'https://example.com']).code, 1);
  assert.equal(run('bing-submit.mjs', ['--site', 'example.com', '--urls', 'https://example.com/a']).code, 1);
});

test('bing-submit: --quota without a key asks for it via read -rs and never calls Bing', () => {
  const r = run('bing-submit.mjs', ['--site', 'https://example.com', '--quota']);
  assert.equal(r.code, 1);
  assert.match(r.err, /BING_API_KEY is not set/);
  assert.match(r.err, /read -rs BING_API_KEY && export BING_API_KEY/);
  assert.match(r.err, /Settings → API Access/);
});
