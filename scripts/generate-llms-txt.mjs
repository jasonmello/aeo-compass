#!/usr/bin/env node
// Generates llms.txt from the sitemap (URL or local file) or from a folder of .html files, using aeo/profile.json for the header.
// Usage:
//   node generate-llms-txt.mjs --sitemap https://domain.com/sitemap.xml [--out public/llms.txt] [--max 100]
//   node generate-llms-txt.mjs --dir out --site https://domain.com [--out out/llms.txt]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, isUrl, fetchText, collectSitemapUrls, collectSitemapFile, analyzeHtml, findFiles, loadProfile, parseSite } from './lib.mjs';

const args = parseArgs();
const max = Number(args.max || 100);
let profile = {};
try { profile = loadProfile() || {}; } catch (e) { console.error(e.message); process.exit(1); }
const pages = [];

if (args.sitemap) {
  let urls = [];
  if (isUrl(args.sitemap)) urls = (await collectSitemapUrls(args.sitemap)).urls;
  else {
    // local file: follows the index (Astro/next-sitemap); each child is looked up next to the index by URL path, then by file name, and finally over the network
    const res = await collectSitemapFile(args.sitemap);
    if (!res.ok) { console.error(`Sitemap not found: ${args.sitemap}`); process.exit(1); }
    urls = res.urls;
  }
  let failures = 0;
  const batch = urls.slice(0, max);
  for (const u of batch) {
    const r = await fetchText(u);
    if (!r.ok) { failures++; continue; }
    const a = analyzeHtml(r.text);
    pages.push({ url: u, title: a.h1[0] || a.title || u, desc: a.description || '' });
  }
  if (failures) console.error(`Warning: ${failures} of ${batch.length} sitemap URLs did not load (is the site live?). If the site is not published yet, use --dir <build> --site <url>, which works offline.`);
} else if (args.dir) {
  if (!args.site) { console.error('--dir requires --site https://domain.com'); process.exit(1); }
  const dir = path.resolve(args.dir);
  const { site } = parseSite(args.site);
  for (const f of findFiles(dir, ['.html']).filter((f) => !/^404|\/404/.test(f)).slice(0, max)) {
    const a = analyzeHtml(fs.readFileSync(path.join(dir, f), 'utf8'));
    const rel = f.replace(/index\.html$/, '').replace(/\.html$/, '');
    pages.push({ url: `${site}/${rel}`.replace(/\/$/, '') || site, title: a.h1[0] || a.title || rel, desc: a.description || '' });
  }
} else {
  console.error('Pass --sitemap <url|file> or --dir <folder> --site <url>');
  process.exit(1);
}

if (!pages.length) console.error('Warning: no pages found; check the sitemap/folder (llms.txt will only have the header).');

// group by the first path segment
const groups = {};
for (const p of pages) {
  let seg = '';
  try { seg = new URL(p.url).pathname.split('/').filter(Boolean)[0] || ''; } catch {}
  const label = seg ? seg.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'Main';
  (groups[label] ??= []).push(p);
}

const name = profile.name || 'Site';
let md = `# ${name}\n\n`;
if (profile.description) md += `> ${profile.description}\n\n`;
const facts = [];
if (profile.address?.city) facts.push(`Location: ${[profile.address.city, profile.address.state].filter(Boolean).join(' - ')}`);
if (profile.areaServed) facts.push(`Service area: ${profile.areaServed}`);
if (profile.audience) facts.push(`Audience: ${profile.audience}`);
if (profile.telephone) facts.push(`Contact: ${profile.telephone}`);
if (facts.length) md += facts.map((f) => `- ${f}`).join('\n') + '\n\n';

const order = Object.keys(groups).sort((x, y) => (x === 'Main' ? -1 : y === 'Main' ? 1 : x.localeCompare(y)));
for (const g of order) {
  md += `## ${g}\n\n`;
  for (const p of groups[g]) md += `- [${p.title.replace(/[\[\]]/g, '')}](${p.url})${p.desc ? `: ${p.desc}` : ''}\n`;
  md += '\n';
}

if (args.out) { fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true }); fs.writeFileSync(args.out, md); console.error(`llms.txt with ${pages.length} pages written to ${args.out}`); }
else process.stdout.write(md);
