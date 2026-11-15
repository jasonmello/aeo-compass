# Technical: make the site readable for AI bots

## 1. Rendering

- Prefer SSG/SSR. Test: `curl -sL -A "OAI-SearchBot" https://site | sed -n '1,200p'`. The main text, the `<h1>` and the JSON-LD must show up.
- SPA (Vite/CRA/Lovable without SSR): prerender at build time (e.g. `vite-plugin-prerender`, `react-snap`, or move public pages to Next/Astro). See `stacks.md`.
- Don't hide important content behind tabs that only load on click/JS, behind a login or in a modal.
- Images get descriptive `alt` text; important text can't live only inside an image.
- Performance: low TTFB and a light page. Bots have short timeouts.

## 2. robots.txt: user agents (Nov 2026)

Use the **token**, not the version (GPTBot/1.1, /1.3 change).

| Company | Token | Role | Default recommendation |
|---|---|---|---|
| OpenAI | `OAI-SearchBot` | ChatGPT search index | **allow** |
| OpenAI | `ChatGPT-User` | user-triggered fetch | **allow** (OpenAI no longer promises it respects robots) |
| OpenAI | `GPTBot` | training | user's choice |
| OpenAI | `OAI-AdsBot` | validates ad landing pages | allow if the site runs ads |
| Anthropic | `Claude-SearchBot` | Claude search index | **allow** |
| Anthropic | `Claude-User` | user-triggered fetch | **allow** |
| Anthropic | `ClaudeBot` | training | user's choice |
| Perplexity | `PerplexityBot` | index | **allow** |
| Perplexity | `Perplexity-User` | user fetch | **allow** (generally ignores robots) |
| Google | `Googlebot` | Search + AI Overviews/AI Mode | **always allow** |
| Google | `Google-Extended` | training **and** grounding in the Gemini app/Vertex AI; does not affect Google Search (or AI Overviews, which come from Googlebot) | user's choice (blocking removes the site from Gemini app answers) |
| Microsoft | `Bingbot` | Bing, Copilot, ChatGPT | **always allow** |
| Apple | `Applebot` / `Applebot-Extended` | Siri/Spotlight / training | allow / user's choice |
| Common Crawl | `CCBot` | dataset many use for training | user's choice |
| DuckDuckGo | `DuckDuckBot` | DuckDuckGo search index | **allow** |
| DuckDuckGo | `DuckAssistBot` | DuckAssist answers (cites sources, no training) | **allow** |
| Mistral | `MistralAI-Index` | Le Chat search index (no training) | **allow** |
| Mistral | `MistralAI-User` | user-triggered fetch | **allow** |
| Mistral | `MistralAI-Training` | training | user's choice |
| Meta | `Meta-WebIndexer` | Meta AI search/citations (Meta's docs are vague) | **allow** |
| Meta | `Meta-ExternalFetcher` | user-triggered fetch (may ignore robots) | **allow** |
| Meta | `Meta-ExternalAgent` | mixed (training + indexing) | user's choice |
| Amazon | `Amzn-SearchBot` | Alexa search (no training) | **allow** |
| Amazon | `Amzn-User` | user-triggered action (may ignore robots) | **allow** |
| Amazon | `Amazonbot` | mixed (products + may train AI) | user's choice |

Obsolete: `anthropic-ai`, `Claude-Web`. No need to list them.

Watch out for **WAF/CDN**: Cloudflare and similar services have a "block AI bots" option turned on by default on some plans. An open robots.txt does nothing if the firewall blocks the bots. Ask the user and have them check the dashboard.

Blocking training does **not** remove the site from search: you can block GPTBot and allow OAI-SearchBot. Exception: `Google-Extended` also cuts grounding in the Gemini app.

User-triggered fetchers (`ChatGPT-User`, `Perplexity-User`, `Meta-ExternalFetcher`, `Amzn-User`) may ignore robots; only a WAF really blocks them. Robots changes take ~24h to apply (don't re-audit right away). Google announced it should accept the AIPREF signal for AI training use in early 2027 (secondary source; check the docs before relying on it).

## 3. Sitemap

- `sitemap.xml` at the root (or a sitemap index), only canonical URLs that return 200.
- `<lastmod>` with the real modification date. A fake date (always "today") makes Bing ignore the field.
- Referenced in robots: `Sitemap: https://domain.com/sitemap.xml`.

## 4. Per page

- `<html lang="en">` (or the right language, e.g. pt-BR, es).
- A unique `<title>`, 50–60 characters, with the topic + brand.
- `<meta name="description">` of 140–160 characters that answers what the page delivers.
- An absolute `<link rel="canonical">`.
- Open Graph (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) and `twitter:card`.
- One `<h1>`. H2/H3 in hierarchy; question-style H2s on informational pages.
- Semantic HTML: `<main>`, `<article>`, `<nav>`, `<header>`, `<footer>`, real lists and tables.
- Visible published/updated date + `datePublished`/`dateModified` in the schema.
- Visible author with a link to an author page.

## 4.1 Internal links

- No orphan pages: every answer page gets contextual links from related pages and from the topic hub (ideally 2+).
- Real links (`<a href>`), not JS `onclick`; descriptive anchor text ("how to issue an invoice"), never "click here".
- Visible breadcrumb + `BreadcrumbList` (see `schema.md`).

## 5. llms.txt (optional)

A Markdown file at `/llms.txt`: H1 title, summary in a blockquote, H2 sections with link lists `- [Name](url): description`. You can add `/llms-full.txt` with the full content. Status in 2026: Google says it doesn't use it for Search; Lighthouse started checking it under "agentic browsing"; almost no search bot fetches it. Generate it if it's cheap; don't sell it as a ranking factor.

## 6. Other

- HTTPS, no redirect chains, no accidental `noindex` (check `<meta name="robots">` and the `X-Robots-Tag` header).
- A real 404 page (status 404, not 200).
- Multiple languages: one URL per language; reciprocal `hreflang` on every version (including itself + `x-default`), with absolute, canonical, 200 URLs; each language's canonical points to itself, not to the main-language version; `lang` and `inLanguage` match the page language; one questions file per language for the citation tests (`aeo/questions.md`, `aeo/questions.es.md`, etc.).
- Readable, stable URLs. URL changed → 301 redirect.
