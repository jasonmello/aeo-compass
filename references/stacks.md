# Where to apply each thing, by stack

Run `node <skill>/scripts/detect-stack.mjs` first. The map is below.

## Next.js — App Router (`app/`)
- Metadata: `export const metadata` or `generateMetadata()` in `app/layout.tsx` / `page.tsx` (`title`, `description`, `alternates.canonical`, `openGraph`). `metadataBase` in the root layout.
- robots: `app/robots.ts` returning `MetadataRoute.Robots`, with `rules` per `userAgent` and `sitemap`.
- sitemap: `app/sitemap.ts` returning `MetadataRoute.Sitemap` with a real `lastModified`.
- JSON-LD: a server component that renders `<script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(data)}} />` in the layout (global) and in pages.
- llms.txt: a static file at `public/llms.txt` or `app/llms.txt/route.ts`.
- Confirm that public pages do not have `"use client"` at the top while loading their content with a client-side fetch.

## Next.js — Pages Router (`pages/`)
- `next/head` on each page; `_document.tsx` for `lang`.
- robots/sitemap: files in `public/` or `next-sitemap`.
- Use `getStaticProps`/`getServerSideProps` for content.

## Astro
- `<head>` in the layout (`src/layouts/*.astro`); `@astrojs/sitemap`; `public/robots.txt`.
- JSON-LD: `<script type="application/ld+json" set:html={JSON.stringify(data)} />`.
- It is SSG by default, which is great for AEO.

## React SPA (Vite, CRA) and Lovable
- Main problem: empty initial HTML. Options, from best to simplest:
  1. Move public pages (home, about, services, FAQ, blog) to Next/Astro and keep the logged-in app as an SPA.
  2. Prerender routes at build time (`vite-plugin-prerender`, `vite-ssg`, `react-snap`).
  3. At minimum: global meta tags and JSON-LD directly in `index.html` + `react-helmet-async` per route (helps little with bots that don't run JS).
- `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`.
- **Lovable:** edits go through the Lovable connector's `send_message` in natural language ("add to public/robots.txt...", "add this JSON-LD to index.html"). Explicitly ask for prerendering/SSG of the public routes. Then check with the connector's `read_file`/`grep_files` and with `curl` on the published URL. Messages spend the user's credits: group the changes into a single message.

## Static HTML
- Everything goes directly in the `<head>` of each `.html`; robots/sitemap/llms at the root.
- Many pages: generate the sitemap with a simple script that lists the `.html` files.

## WordPress
- An SEO plugin (Yoast, Rank Math, SEOPress) handles title/meta/sitemap/basic schema; configure Organization/LocalBusiness and social profiles in it.
- robots: edit through the plugin. Check whether a security plugin is blocking AI bots.
- IndexNow: Rank Math (free), Yoast (Premium only) or the official IndexNow plugin submit automatically.

## Shopify / Wix / Squarespace / Webflow
- Edit through each platform's SEO settings; JSON-LD via a custom code block in the theme/head.
- IndexNow: built in on Wix Premium plans; on Shopify, check the dashboard, otherwise use an app.

## Mobile apps and desktop software
- The "site" the AI reads is the landing page + the store page. Build a dedicated landing page (SSG) with `SoftwareApplication`, FAQ, price, screenshots with alt text, changelog.
- App Store/Play Store page: name and short description using the same sentence as the site; links back to the site.
- Public docs: see the section below.

## Documentation (Docusaurus, Mintlify, Nextra, VitePress, Starlight)
- Well-structured docs are among the most cited content: one topic per page, question-style titles, complete examples (with imports and version), one page per error message (title = the error text), a dated changelog.
- Schema: `TechArticle` + `BreadcrumbList` (Google treats `TechArticle` as `Article`, with no rich result of its own).
- `/llms.txt`, `/llms-full.txt` and a `<url>.md` version of each page (with a "Copy as Markdown" button): Mintlify generates them natively; the others need a plugin. Same caveat as in `technical.md`: cheap and optional, not a ranking factor.
- Public MCP server for searching the docs (Mintlify offers one out of the box): optional; it helps agents and IDEs, not citation in search engines.
