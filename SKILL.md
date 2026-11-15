---
name: aeo
description: 'Answer Engine Optimization (AEO/GEO, "SEO for AI") for any website, app or software. Builds sites optimized from the start, audits and fixes existing ones, automates indexing (IndexNow, Bing Webmaster) and writes content in the format ChatGPT, Perplexity, Gemini, Copilot, Claude and Google AI Overviews cite. Use when the user mentions AEO, GEO, LLM SEO, AI search visibility, "show up in ChatGPT", "get cited by AI", llms.txt, schema/JSON-LD, structured data, robots.txt for AI bots, Bing Webmaster, Bing Places, IndexNow, getting pages indexed, backlinks, or asks to build or review a site with search in mind. Also in Portuguese and Spanish: "SEO para IA", "aparecer no ChatGPT", "ser citado pela IA", "aparecer en ChatGPT", "que la IA me cite", "posicionamiento en IA".'
---

# /aeo

Steps to get search engines and AI assistants to find, read and cite the site. Works on any stack. In step 0, do only the parts the chosen mode needs (see the table).

Language: reply to the user in the user's own language. Write onboarding questions and reports (filled from `<skill>/templates/audit-report.md`) in that language too. Write site content in the site's language (profile `language` or `<html lang>`). The templates are in English; translate their headings when you fill them.

Paths: `<skill>` is the folder of this file. Run the scripts from the root of the user's project. The project's AEO data lives in `aeo/` at its root; if detect-stack warns that the public folder is the root, keep `aeo/` out of the deploy as it says, and in a public repository add `aeo/reports/` to `.gitignore`. Scripts are plain Node (>= 18), no `npm install`.

## The core idea

AI cites what it **can find** (the Bing, Google and Brave indexes), **can read without JavaScript**, **understands as an entity** (schema + consistent profiles) and **finds trustworthy** (other sites talking about you). Each step below works on one of these four things. Details in `references/principles.md`.

## 0. Prepare

| Mode | Needs |
|---|---|
| Audit a URL | 0.1 only |
| Audit a local folder, Index | 0.1, 0.2 and the domain |
| Build, Content | everything |

1. `node -v`. If it is missing or < 18, offer to install it (`brew install node` or nvm) **with the user's approval**, or continue without scripts: `curl -sL -A "OAI-SearchBot" <url>` + the checklist in `references/technical.md`, with the schema written by hand from `references/schema.md`.
2. If there is a `package.json` or `.html` at the root: `node <skill>/scripts/detect-stack.mjs` → framework, where the `<head>` lives, `public` (public folder; always a plain path to pass to `--public`/`--out`), `buildOut` (build output) and warnings. If it returns `publicNote`, follow the note (e.g. Angular without `public/`: list the files under `assets` in `angular.json`). Read the matching section in `references/stacks.md`. Without local code, see "Platforms without local code".
3. If `aeo/profile.json` does not exist: copy `<skill>/templates/profile.json` to `aeo/profile.json` and run onboarding **in a single message, with numbered questions**. Only what it is and the domain are required; afterwards, ask again only for what is missing.
   - What is the business/product, in one sentence? Website, app or software?
   - Does it have a physical location that serves the public? (decides LocalBusiness and Bing Places)
   - Country and site language? (set `language`, `address.country` and `app.currency` to match)
   - Official domain and profiles: Instagram, LinkedIn, YouTube, TikTok, Google Business Profile, App Store/Play Store, GitHub.
   - Who is the customer, and **10 to 30 questions they would ask ChatGPT** before buying/using it. Save them to `aeo/questions.md` (template in `<skill>/templates/questions.md`).
   - Who signs the content (a person with credentials = authority).
   - (Optional, companies) Legal name and tax ID (e.g. CNPJ in Brazil), only if they want them published in the schema (`legalName`/`taxID`).

   Warn them: whatever goes into `profile.json` may show up in the site's public code (JSON-LD, llms.txt). They should not give a home address or personal contact they do not want published; without a location that serves the public, leave `address.street` empty.
4. **Never invent** profile data (address, phone, ratings, price, tax ID). If something is missing, ask or leave it empty.

## 1. Choose the mode

| Request | Mode |
|---|---|
| "build a site/app/landing page", new project | **Build** (Step 2) |
| "review", "why don't I show up", existing URL or folder, vague request | **Audit** (Step 3), then fix |
| "index", "Bing", "IndexNow", "I just published" | **Index** (Step 4) |
| "write a FAQ", "questions page", "content for AI" | **Content** (Step 5) |

Modes can be chained: build → index; audit → fix → index. New project: act directly. Existing project, in any mode: show the plan and **ask for approval before editing**.

## 2. Build (or fix) optimized from the start

Read `references/technical.md` and `references/schema.md`. Apply them in the right place for the stack (`references/stacks.md`):

1. **Server-rendered HTML** (SSR/SSG). A pure SPA that only shows content after JS runs is invisible to most AI bots. If the stack is an SPA, propose prerendering.
2. `robots.txt` allowing the AI search bots (template in `<skill>/templates/robots.txt`). Training bots stay allowed until the user decides. Ask about GPTBot and ClaudeBot: they are training only, and blocking them does not remove the site from ChatGPT search or Claude (which use OAI-SearchBot and Claude-SearchBot). Ask separately about Google-Extended: it controls Gemini training and grounding in the Gemini app and Vertex AI; blocking it does not affect Google Search, but removes the site from Gemini app answers.
3. `sitemap.xml` with a real `<lastmod>`, referenced in robots.
4. Per page: a unique `<title>`, meta description, canonical, `lang`, Open Graph, one `<h1>`, question-style H2s where they make sense.
5. JSON-LD: `node <skill>/scripts/generate-schema.mjs` generates Organization/LocalBusiness/WebSite from `aeo/profile.json`, with `sameAs` linking every profile. FAQPage/Article/Product/SoftwareApplication per page, as described in `schema.md`.
6. `llms.txt` (optional, low cost): `node <skill>/scripts/generate-llms-txt.mjs --dir <buildOut> --site https://domain.com --out <public>/llms.txt`, or `--sitemap https://domain.com/sitemap.xml --out <public>/llms.txt` when `buildOut` is not a folder of HTML (SSR). Be honest with the user: Google says it does not use it; it is mostly useful for agents and documentation sites.
7. Pages AI looks for: About (who, since when, credentials), Contact with NAP, FAQ, pricing when there is any, honest "X vs Y" comparisons.

**Always check the HTML without JS:** `curl -sL <url> | grep -c '<h1'` and confirm the main text and the JSON-LD are there. In a local project, run the build and audit as in step 3.1.

## 3. Audit

1. `node <skill>/scripts/audit.mjs <url-or-folder> [--json]`. It accepts the published URL or the `buildOut` folder from detect-stack (not `public/`, which in most stacks only holds source assets). SSR without a static export (Next without `output: export`, Remix, Vite SSR): run the build + `start`/`preview` in the background, audit `http://localhost:<port>` and stop the server at the end; there, ignore the HTTPS warning and canonical/URLs pointing to the production domain.
2. The script covers only the technical side. Complete it with the checklist in `references/off-page.md` by asking the user (Bing Webmaster verified? Bing Places? Google Business Profile? Instagram bio with a link and the same description?).
3. Build the report with `references/audit.md` and `<skill>/templates/audit-report.md`; save it to `aeo/reports/YYYY-MM-DD.md`.
4. Show the overall score /100: the script's technical score (up to 75) + indexing and off-page (up to 25); anything not verified counts as 0 and is shown as "not verified". Say what the technical score covers: noindex, description, canonical, `lang`, JSON-LD, entity, `sameAs`, Open Graph, question-style H2s and author look only at the home page (or the folder's `index.html`); ssr, h1 and title are the average of the home page and the inner pages analyzed (for a URL, up to `--pages` URLs from the sitemap, default 10; for a folder, up to 50 `.html` files; in both cases About, FAQ, pricing, services, products and blog come first); dates count from the home page and the inner pages; the sitemap check drops the clean-URLs point if any URL has a problem (for a URL, among the sampled ones: status other than 200, redirect, noindex or canonical to another page; for a folder, a sitemap URL with no file or with noindex); FAQ, About and Contact count from the home page links and the sitemap paths (for a folder, only those with a file, plus the existing `.html` files). If `cappedBy` is present, the home page depends on JS and the technical score was capped at 30: explain that first. Show the `nap` mismatches, if any. Then the 5 highest-impact items, what you fix yourself in the code and what is manual (off-page). **Ask for approval before editing.**

## 4. Index

Read `references/indexing.md`. Without local code, use the plugin or the dashboard (section below) instead of the scripts.

1. `node <skill>/scripts/indexnow.mjs --site https://domain.com --public <public from detect-stack>`. If the site is not live yet, add `--sitemap <local sitemap.xml from the build>` (the `<loc>` entries must use the `--site` domain); without it, the script reads the published sitemap. **By default it only does a dry run: nothing is sent without `--send`**, but the key (`aeo/indexnow.json`) and the key file in the public folder are created.
2. After the key file is deployed, show the list and only then run with `--send`, **with the user's approval** (it is a submission to an external service). IndexNow notifies Bing (one of ChatGPT search's sources and the base of Copilot), plus Yandex, Seznam, Naver, Yep, Internet Archive and Amazon. Notifying speeds up crawling, but does not guarantee indexing or citation.
3. Optional: `bing-submit.mjs` (Bing Webmaster API). The dry run works without a key. To submit, build the full command with `--send`, without the key, and ask the user to run it in their own terminal after `read -rs BING_API_KEY && export BING_API_KEY` (the key is not shown and does not go into history). An export done in another terminal does not reach your shell. Never pass the key on the command line (`BING_API_KEY=... node ...`), never ask for it in chat and never write it to a file (not even `~/.zshrc`). If you need to run it yourself, the user restarts the session with the variable already in the environment.
4. Hand over the manual checklist from `references/off-page.md` (sections 1 and 2, which already include the links). The user does these steps logged into their own accounts.

## Platforms without local code

- **WordPress, Shopify, Wix** and similar: robots, sitemap, schema and IndexNow through the SEO plugin or the native dashboard; audit the published URL.
- **Lovable** (connector only): identify the project, audit the published URL, send the changes grouped in one `send_message` only after the user's approval (it spends credits) and check with `read_file`/`curl`.

Details in `references/stacks.md`.

## 5. Content

1. Read `references/content.md`, `aeo/questions.md` and `aeo/profile.json` (if no questions are saved, ask the user).
2. Use `<skill>/templates/faq-section.md` as the base for FAQ blocks (question-style H2/H3, 40–60 word answer, date, author and FAQPage with the same text). For each question: an H2 with the question the way people type it, **a direct answer in 40–60 words right below**, then detail, sourced data, a table or list when it helps, update date, author.
3. Generate the matching FAQPage/Article JSON-LD, with the same text that is visible on the page (schema that differs from the content is spam).
4. If the `humanizer` skill is available, run the text through it. If not, review it yourself: cut openers like "Great question", "it's not X, it's Y" contrasts, forced lists of three, excess bold and empty adjectives.
5. Do not mass-produce pages just for keywords. One good page per real intent.

## 6. Wrap up

- Save/update `aeo/reports/`.
- List in 3 blocks: **done in the code**, **submitted** (indexing), **manual for the user** (listings, bio, backlinks, Reddit/YouTube, etc.).
- Suggest running the audit again in 30 days and testing by asking the AI assistants (`references/audit.md`, "Real-world test" section).

## Fixed rules

- Never write API keys or tokens to project or skill files.
- No invented data in the schema (reviews, ratings, prices, awards).
- Do not promise rankings or citations. Nobody controls that; you can only raise the odds.
- Any external submission (IndexNow, Bing API, forms) needs confirmation.
- Backlinks: strategy and honest outreach. Never recommend buying links or a private blog network (PBN).
