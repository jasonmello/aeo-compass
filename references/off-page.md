# Off-page: what happens outside the site

The user does these steps while logged in to their own accounts. The skill provides the checklist with links and explains why; it does not try to log in or fill out forms for them.

## 1. Search engines (top priority)

- [ ] **Google Search Console** (https://search.google.com/search-console): verify the domain, submit the sitemap.
- [ ] **Bing Webmaster Tools** (https://www.bing.com/webmasters): you can **import the site directly from Search Console**. Submit the sitemap, turn on IndexNow, use "URL Submission" for the main pages. Bing feeds ChatGPT search and Copilot.
- [ ] Check on Bing: `site:domain.com` at bing.com. If nothing shows up, that is problem #1.
- [ ] **Brave Search**: no webmaster dashboard; make sure the site shows up on `search.brave.com` (relevant for Claude). Being indexable and having backlinks raises the chance of showing up.

## 2. Local listing (if there is a location that serves the public)

- [ ] **Google Business Profile** (https://business.google.com): complete it: the right category, hours, photos, services, a description that matches the site, a link to the site.
- [ ] **Bing Places for Business** (https://www.bingplaces.com): **import the listing from Google Business Profile** (import option during setup). Few people do this. Bing uses the listing in local searches, and Copilot and ChatGPT search rely on Bing.
- [ ] **Apple Business Connect** (https://businessconnect.apple.com): Siri and Apple Maps.
- [ ] NAP (name, address, phone) **consistent** across the site, schema, Google, Bing, Apple, Instagram and directories. Standardize even the abbreviations ("St." or "Street", pick one).
- [ ] Real reviews: ask satisfied customers on Google. Reply to all of them. AI reads reviews for "best X in Y".

## 3. Social profiles as an entity signal

- [ ] **Instagram bio**: name with the main keyword (the name field is searchable), a description of what the business does + where, a **link to the site** (not just a link aggregator; if one is used, put the site first). Same base sentence as the site and Google.
- [ ] Instagram: professional account with category, address and contact filled in; captions with real text (Google and AI assistants index public posts); alt text on images.
- [ ] LinkedIn (company + person), YouTube (descriptions and transcripts), TikTok, Pinterest depending on the niche. All with a link to the site and listed in the schema `sameAs`.
- [ ] Same handle on every network, if possible.

## 4. Backlinks and mentions (they carry a lot of weight)

Why: AI trusts whoever other sites cite, and mentions end up in model training data.

Honest ideas, from easiest to strongest:
- [ ] Serious niche and local directories (trade associations, chambers of commerce, city guides). Vertical platforms: Doctoralia (health), iFood/TripAdvisor (restaurants), Capterra/G2/B2B Stack/Product Hunt (software).
- [ ] Partners, suppliers and B2B clients: a "partners"/"case studies" page with a link.
- [ ] Original data content (surveys, industry statistics), pitched to journalists and blogs.
- [ ] Local press, podcasts, interviews, talks (event pages link to speakers).
- [ ] Guest posts on relevant sites (real content, not a link farm).
- [ ] "Best X in Y" lists: ask to be included, with a reason.
- [ ] Reddit, Quora, niche forums and groups: give real answers from an identified profile. AI assistants cite Reddit a lot.
- [ ] Wikipedia/Wikidata only if there is real notability, with independent sources (press, not the site itself); promotional items get deleted. On Wikidata: P31 (instance of), P856 (official website), P2002/P2003/P4264 (X/Instagram/LinkedIn), each with a reference. Then put the ID in `profiles.wikidata` and in `sameAs`.
- [ ] Monitor unlinked mentions and ask for the link.

Never: buying links, PBNs, mass link exchanges, comment spam.

## 5. Online store (if the business sells online)

`Product` schema alone does not reach AI shopping answers; they read product feeds.
- [ ] **Google Merchant Center** (https://merchants.google.com): product feed and free listings. It feeds the Shopping Graph that Google's AI answers use.
- [ ] **Microsoft Merchant Center** (inside Microsoft Advertising): feed for Bing Shopping and shopping in Copilot. Confirm availability in the user's country before promising anything.
- [ ] **ChatGPT**: product feed program for merchants at https://chatgpt.com/merchants. It started in the US; confirm the status in the user's country and do not promise checkout inside ChatGPT.
- [ ] Verified product reviews through a platform (e.g. Trustvox, Yotpo, Judge.me), which feed `aggregateRating` with real data. Never invent a rating.

## 6. Measure

- Ask AI assistants the questions in `aeo/questions.md` (ChatGPT with search, Perplexity, Gemini, Copilot, Claude) and note whether they cite the site, in what position and which page. Repeat monthly.
- Search Console and Bing Webmaster: impressions, queries, indexed pages.
- **Bing Webmaster → AI Performance** (https://www.bing.com/webmasters/aiperformance): citations in Copilot and in Bing's AI summaries per page, plus the grounding queries. Compare month over month. It has no clicks and covers only the Microsoft ecosystem.
- Analytics: traffic with referrer `chatgpt.com`/`chat.openai.com`, `perplexity.ai`, `copilot.microsoft.com`, `gemini.google.com`, `claude.ai`. ChatGPT usually adds `utm_source=chatgpt.com`.
- GA4: Admin → Data display → Channel groups → create (or copy) a group with a channel named "AI", condition source matches regex `chatgpt\.com|chat\.openai|perplexity|copilot\.microsoft|gemini\.google|claude\.ai|meta\.ai|deepseek|grok`. Move the channel above "Referral", or the sessions keep being counted there.

## Country-specific notes

**Brazil:**
- **Reclame Aqui** (any business in Brazil, not only local ones): claim the company page, answer complaints and work toward the RA1000 seal. It is a frequent source for questions like "Is X trustworthy?".
- NAP abbreviations: standardize "R." or "Rua" (pick one).
- Wikidata: add P6204 (CNPJ), with a reference, alongside the properties in section 4.
- Google Merchant Center free listings work in Brazil without Google Ads.
- Microsoft Merchant Center and the ChatGPT merchant program: confirm availability in Brazil before promising anything.
