# AEO audit: {site}

Date: {YYYY-MM-DD} · Target: {url or folder} · Stack: {stack}

## Overall score: {total}/100 ({invisible | basic | good | strong})

| Category | Score |
|---|---|
| Crawlable | /25 |
| Readable without JS | /20 |
| Entity | /15 |
| Citable content | /15 |
| Technical subtotal (script) | /75 |
| Indexing (Bing, Google, IndexNow) | /10 |
| Off-page (listings, NAP, bio, backlinks, reviews) | /15 |

<!-- The subtotal is the script's `technicalScore`, with the cap already applied. If there is a `cappedBy`, the category rows above show the uncapped points for reference only and do not add up to the subtotal. -->

Manual adjustment to Citable content: {−N pts and the reason (vague answers, no source or no date) | none}

Capped technical score: {cappedBy from the script, e.g. content not rendered without JS (cap 30) | no}

## Top 5 by impact

1. **{issue}**. Why it matters for AI: {…}. Fix: {…}. Who: {Claude, in the code | you, in the dashboard}.
2. …

## Technical checks

{table Category | Check | Score | Status | Message, built from checks[] in audit.mjs --json}

## NAP (schema vs aeo/profile.json)

{mismatches from the nap field in audit.mjs --json, one per line | identical | no aeo/profile.json for this site}

The NAP text must be identical everywhere. The script does not score it; it counts toward off-page.

## Off-page (confirmed with the user)

- [ ] Bing Webmaster verified and sitemap submitted
- [ ] Google Search Console verified and sitemap submitted
- [ ] IndexNow set up
- [ ] Google Business Profile complete
- [ ] Bing Places imported from Google
- [ ] NAP identical everywhere
- [ ] Instagram bio with the standard description + site link
- [ ] Relevant backlinks / mentions: {how many and which}

## Not verified

{…}

## Real-world test in AI assistants

| Question | ChatGPT | Perplexity | Copilot | Gemini | Claude |
|---|---|---|---|---|---|
| {question} | {cited? URL?} | | | | |
