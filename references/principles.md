# Principles: how an answer engine picks what to cite

Reviewed November 2026. Facts that change quickly are marked with a date; if more than 3 months have passed, confirm them on the web before stating them to the user and say where the confirmation came from.

## The path to a citation

1. **Retrieval.** When the answer needs current data, the assistant searches an index and takes a few results. If you are not in the index, you do not exist.
2. **Reading.** The bot downloads the page. Most **do not run JavaScript**. Content that only appears after JS is gone.
3. **Extraction.** The model looks for passages that answer the question directly and on their own. A paragraph that opens with the answer beats one that rambles.
4. **Trust.** Sources that other sites cite, with an identifiable author, sourced data and a consistent entity across many places, have a better chance.
5. **Model memory.** Without search, the model answers from what it learned in training. What counts then is being mentioned in many places (press, Wikipedia, Reddit, directories, reviews) over time.

## Which index each assistant uses (Nov 2026)

| Assistant | Main search index | Consequence |
|---|---|---|
| ChatGPT search | Own index (OAI-SearchBot) + Bing + other sources (there are reports of Google SERPs via third parties) | Bing Webmaster, IndexNow and allowing OAI-SearchBot matter a lot |
| Microsoft Copilot | Bing | Same as above; Bing Places for local businesses |
| Perplexity | Own index (PerplexityBot) + others | Allow PerplexityBot; fresh, sourced content |
| Google AI Overviews / AI Mode / Gemini | Google index | Regular Google SEO + Search Console + Google Business Profile |
| Claude (web search) | External search provider (reported as Brave) + Claude-SearchBot | Allow Claude-SearchBot and Claude-User; be in Brave Search |

Many people optimize only for Google; adding the site to Bing is cheap and often forgotten.

## The four pillars (typical order of impact)

1. **Be indexable and readable:** SSR, robots allowed, sitemap, indexing in Bing and Google.
2. **Be a clear entity:** the same name, description, NAP and links across the site, schema `sameAs`, Google Business Profile, Bing Places, Instagram, LinkedIn. The Instagram bio belongs here: it is one of the places where AI confirms who you are.
3. **Have authority:** backlinks from relevant sites, press mentions, podcasts, "best X" lists, Reddit/Quora/forums, real reviews.
4. **Have the citable passage:** real questions answered directly, with data and a date.

## What does not work (or is a myth)

- `llms.txt` as a citation factor: Google has said it does not use it (Search Central, 2026) and log studies show almost no access. Keep it only as a cheap extra.
- Stuffing the page with keywords or generating hundreds of near-identical pages.
- Schema with data that is not visible on the page.
- Hidden "instructions for AI" in the HTML: it is manipulation and can be treated as spam.
