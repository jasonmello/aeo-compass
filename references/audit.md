# Audit: rubric and report

`scripts/audit.mjs` covers the technical side and returns the technical score. The overall score adds the off-page items you confirm with the user.

## Rubric (100 points)

| Category | Points | Source |
|---|---|---|
| Crawlable (robots allows AI search bots, no noindex, valid sitemap, HTTPS) | 25 | script |
| Readable without JS (main text and h1 in the initial HTML, lang, title, description, canonical) | 20 | script |
| Entity (valid JSON-LD, Organization/LocalBusiness, sameAs, OG) | 15 | script |
| Citable content (question-style H2s, FAQ, dates, author, About/Contact pages, llms.txt) | 15 | script + your reading (can only lower it) |
| Indexing (Bing Webmaster, Search Console, IndexNow) | 10 | ask (or the user checks the dashboard: site verified, sitemap submitted, IndexNow active) |
| Off-page (local listings, NAP, bio, backlinks, reviews) | 15 | ask |

The script scores the first four categories (up to 75). For Citable content it only sees the HTML: after reading the pages, you can lower that score if the answers are vague, have no source or no date. The deduction comes off the technical score the script already returned (after the cap) and is recorded, with the reason, on the "Manual adjustment to Citable content" line of `templates/audit-report.md`. Mismatches reported in `nap` go in the NAP section of the report. Indexing and off-page come from the user's answers; anything they don't know scores 0 and goes under "Not verified".

Bands: 0–39 invisible · 40–59 basic · 60–79 good · 80+ strong.

Cap: if the home page depends on JS to show its content (empty #root/#app/#__next div, or fewer than 50 words in the initial HTML with a `<script src>` in the body or a `<script type="module" src>`), the script caps the technical score at 30 and returns `cappedBy`. Adding the 25 from indexing and off-page, the overall score tops out at 55 (basic). Warn that the site is "invisible to ChatGPT, Claude and Perplexity, which don't run JS" until rendering is fixed. A static page that is merely short (no script building the content) does not trigger the cap.

## How to present

1. Score and band on one line.
2. **Top 5 by impact**, each with: the issue, why it matters for AI, the fix, who does it (Claude, in the code / the user, in the dashboard).
3. Full table of checks (ok / fail / warning).
4. What could not be verified.

Use `<skill>/templates/audit-report.md`. Save it to `aeo/reports/YYYY-MM-DD.md` to compare later.

## Real-world test

After fixing and indexing (wait 1–4 weeks):
- Ask 5–10 questions from `aeo/questions.md` in ChatGPT (with search), Perplexity, Copilot, Gemini and Claude.
- Bing Webmaster → AI Performance (free, in preview): citations in Copilot and in Bing's AI answers, by URL and by query. It doesn't cover ChatGPT or show clicks; it complements the manual test.
- Record in the report: was the site cited? Which URL? Was a competitor cited instead?
- Competitor cited in your place = open their page and see what it has that yours doesn't (direct answer, data, backlink, schema).
