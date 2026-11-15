#!/usr/bin/env node
// Detects the project's stack and says where to apply each AEO item.
// Usage: node detect-stack.mjs [folder] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, readIfExists } from './lib.mjs';

const args = parseArgs();
const root = path.resolve(args._[0] || process.cwd());
const has = (p) => fs.existsSync(path.join(root, p));
const pkgRaw = readIfExists(path.join(root, 'package.json'));
let pkg = {};
try { pkg = pkgRaw ? JSON.parse(pkgRaw) : {}; } catch {}
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const dep = (n) => Object.prototype.hasOwnProperty.call(deps, n);

let stack = 'unknown';
let info = {};
const warnings = [];
const viteSsr = ['vike', 'vite-plugin-ssr', 'vite-ssg', '@builder.io/qwik-city', '@solidjs/start', '@analogjs/platform', '@tanstack/start', '@tanstack/react-start'].find(dep);
const fw = ['solid-js', 'preact', 'vue', 'svelte', 'lit', 'react'].find(dep);
const headByFramework = { 'solid-js': '@solidjs/meta', preact: 'hoofd or react-helmet-async (preact/compat)', vue: '@unhead/vue (useHead)', svelte: '<svelte:head>', lit: 'document.title/meta in the router', react: 'react-helmet-async' };
// Vite without a framework: it is only a SPA if index.html has an empty mount node and almost no text.
const indexHtml = readIfExists(path.join(root, 'index.html')) || '';
const emptyHtml = /<(div|main)[^>]*id=["'][\w-]+["'][^>]*>\s*<\/\1>/i.test(indexHtml)
  && (indexHtml.match(/<body[\s\S]*<\/body>/i)?.[0] || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim().length < 200;

if (dep('next')) {
  const appDir = ['app', 'src/app'].find(has);
  const pagesDir = ['pages', 'src/pages'].find(has);
  const output = /output\s*:\s*['"]export['"]/.test(readIfExists(path.join(root, 'next.config.js')) || readIfExists(path.join(root, 'next.config.mjs')) || readIfExists(path.join(root, 'next.config.ts')) || '');
  stack = appDir ? 'nextjs-app-router' : 'nextjs-pages-router';
  if (!appDir && !pagesDir) warnings.push('No app/ or pages/ found (not in src/ either). Check that this is the app root (monorepo?). New project: use app/ (App Router, the default since Next 13.4).');
  info = {
    head: appDir ? `${appDir}/layout.tsx (metadata / generateMetadata)` : `${pagesDir ?? 'pages'}/_document.tsx + next/head`,
    robots: appDir ? `${appDir}/robots.ts` : 'public/robots.txt or next-sitemap',
    sitemap: appDir ? `${appDir}/sitemap.ts` : 'public/sitemap.xml or next-sitemap',
    public: 'public/',
    buildOut: output ? 'out/' : '.next/ (audit the URL while running `next start`)',
    rendering: 'Native SSR/SSG. Check pages with "use client" that load content on the client.',
  };
} else if (dep('astro')) {
  stack = 'astro';
  info = { head: 'src/layouts/*.astro', robots: 'public/robots.txt', sitemap: '@astrojs/sitemap', public: 'public/', buildOut: 'dist/', rendering: 'SSG by default (great).' };
} else if (dep('@remix-run/react') || dep('@react-router/dev')) {
  stack = 'remix-react-router';
  info = { head: 'export const meta / links in routes; root.tsx', robots: 'resource route robots[.]txt or public/', sitemap: 'resource route sitemap[.]xml', public: 'public/', buildOut: 'build/ (audit the URL)', rendering: 'Native SSR.' };
} else if (dep('nuxt')) {
  stack = 'nuxt';
  info = { head: 'useHead / useSeoMeta; nuxt.config app.head', robots: '@nuxtjs/robots or public/robots.txt', sitemap: '@nuxtjs/sitemap', public: 'public/', buildOut: '.output/public (generate)', rendering: 'Native SSR/SSG.' };
} else if (dep('@sveltejs/kit')) {
  stack = 'sveltekit';
  info = { head: '<svelte:head> in pages; src/app.html', robots: 'static/robots.txt', sitemap: 'route src/routes/sitemap.xml/+server.ts', public: 'static/', buildOut: 'build/', rendering: 'Native SSR/prerender.' };
} else if (dep('gatsby')) {
  stack = 'gatsby';
  info = { head: 'Head API in pages', robots: 'gatsby-plugin-robots-txt', sitemap: 'gatsby-plugin-sitemap', public: 'static/', buildOut: 'public/', rendering: 'SSG.' };
} else if (viteSsr) {
  stack = 'vite-ssr';
  info = { head: `${viteSsr} head API`, robots: 'public/robots.txt', sitemap: 'framework sitemap route or plugin', public: 'public/', buildOut: 'dist/ (audit the URL)', rendering: `SSR/SSG via ${viteSsr}. Confirm on the URL that the initial HTML already includes the content.` };
} else if (dep('@angular/core')) {
  const ssr = dep('@angular/ssr') || dep('@nguniversal/express-engine');
  stack = ssr ? 'angular-ssr' : 'angular-spa';
  info = {
    head: 'src/index.html (global) + Meta and Title services (@angular/platform-browser) per route',
    robots: has('public') ? 'public/robots.txt' : 'src/robots.txt (list it in assets in angular.json)', sitemap: 'generate at build time, next to robots.txt',
    public: has('public') ? 'public/' : 'src/', buildOut: 'dist/<project>/browser',
    ...(has('public') ? {} : { publicNote: 'Angular without public/: files in src/ only reach the build if listed in "assets" in angular.json (robots.txt, sitemap.xml, llms.txt and the IndexNow key file).' }),
    rendering: ssr ? 'SSR/prerender via @angular/ssr. Confirm on the URL that the initial HTML already includes the content.' : 'SPA: empty initial HTML. Enable SSR/prerendering with `ng add @angular/ssr`.',
  };
} else if (dep('vite') && !fw && !emptyHtml) {
  stack = 'vite-static';
  info = { head: '<head> of each .html', robots: 'public/robots.txt', sitemap: 'public/sitemap.xml', public: 'public/', buildOut: 'dist/', rendering: 'Vite without a framework, with real HTML: good for AEO. Check that each page has content in its .html.' };
} else if (dep('vite')) {
  const lovable = dep('lovable-tagger') || /lovable/i.test(readIfExists(path.join(root, 'README.md')) || '');
  stack = lovable ? 'lovable-vite-spa' : 'vite-spa';
  info = {
    head: `index.html (global) + ${headByFramework[fw] || 'updated document.title/meta'} per route`,
    robots: 'public/robots.txt', sitemap: 'public/sitemap.xml (generate at build time)', public: 'public/', buildOut: 'dist/',
    rendering: 'SPA: empty initial HTML. Propose prerendering (vite-plugin-prerender / vite-ssg) or moving public pages to Next/Astro.',
    ...(lovable ? { editing: 'Lovable project: edit through the Lovable connector send_message, batching the changes.' } : {}),
  };
} else if (dep('react-scripts')) {
  stack = 'create-react-app-spa';
  info = { head: 'public/index.html + react-helmet-async', robots: 'public/robots.txt', sitemap: 'public/sitemap.xml', public: 'public/', buildOut: 'build/', rendering: 'SPA: use react-snap or migrate public pages.' };
} else if (has('wp-config.php') || has('wp-content')) {
  stack = 'wordpress';
  info = { head: 'SEO plugin (Yoast/Rank Math)', robots: 'SEO plugin', sitemap: 'SEO plugin', public: '.', rendering: 'SSR.', indexnow: 'IndexNow plugin or Rank Math' };
} else if (has('_config.yml') && has('_layouts')) {
  stack = 'jekyll';
  info = { head: '_includes/head.html', robots: 'robots.txt at the root', sitemap: 'jekyll-sitemap', public: '.', buildOut: '_site/', rendering: 'SSG.' };
} else if (has('hugo.toml') || has('config.toml') && has('layouts')) {
  stack = 'hugo';
  info = { head: 'layouts/partials/head.html', robots: 'enableRobotsTXT + layouts/robots.txt', sitemap: 'built in', public: 'static/', buildOut: 'public/', rendering: 'SSG.' };
} else if (fs.existsSync(root) && fs.readdirSync(root).some((f) => f.endsWith('.html'))) {
  stack = 'static-html';
  info = {
    head: '<head> of each .html', robots: 'robots.txt at the root', sitemap: 'sitemap.xml at the root', public: '.', buildOut: '.',
    rendering: emptyHtml
      ? 'Compiled SPA: index.html has an empty mount node and content only via <script src>. AI bots without JS see an empty page. Prerender the public routes in the source project (vite-plugin-prerender, vite-ssg, react-snap) or migrate them to Next/Astro (references/stacks.md, "React SPA"). If this folder is build output, run detect-stack on the source code folder.'
      : 'Static (great).',
  };
  if (emptyHtml) warnings.push('index.html is a compiled SPA (empty mount node): AI bots without JS see no content. Prerender in the source project or run detect-stack on the source code folder.');
}

const existing = ['robots.txt', 'public/robots.txt', 'static/robots.txt', 'sitemap.xml', 'public/sitemap.xml', 'public/llms.txt', 'llms.txt', 'aeo/profile.json', 'app/robots.ts', 'src/app/robots.ts', 'app/sitemap.ts', 'src/app/sitemap.ts']
  .filter(has);

if (info.public === '.') {
  const howToExclude = { wordpress: 'block /aeo/ in .htaccess or nginx', jekyll: 'add `exclude: [aeo]` to _config.yml' }[stack] || 'publish only the site files or exclude aeo/ on deploy (e.g. .vercelignore, rsync --exclude aeo)';
  warnings.push(`The public folder is the project root (.): the aeo/ folder (profile, questions, reports) would ship with the deploy. Keep aeo/ out of what gets published: ${howToExclude}.`);
}

const result = { root, stack, ...info, existingAeoFiles: existing, profile: has('aeo/profile.json'), warnings };

if (args.json) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`Stack: ${stack}`);
  for (const [k, v] of Object.entries(info)) console.log(`  ${k.padEnd(14)} ${v}`);
  console.log(`  ${'existing'.padEnd(14)} ${existing.join(', ') || '(none)'}`);
  for (const w of warnings) console.log(`\nWarning: ${w}`);
  if (!result.profile) console.log('\naeo/profile.json does not exist: run onboarding (SKILL.md, step 0).');
  if (stack === 'unknown') console.log('\nStack not recognized. Ask the user or read references/stacks.md.');
}
