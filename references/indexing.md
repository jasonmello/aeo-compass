# Indexing: what you can automate

| Channel | Automatable? | Feeds |
|---|---|---|
| IndexNow | Yes (`scripts/indexnow.mjs`) | Bing (→ Copilot and one of the sources for ChatGPT search), Yandex, Seznam, Naver, Yep, Internet Archive and Amazon (Amazonbot) |
| Bing Webmaster URL Submission API | Yes, with a key (`scripts/bing-submit.mjs`) | Bing |
| Sitemap in robots.txt | Yes (file) | All |
| Google Search Console | Only the sitemap and manual "Request indexing". Google's Indexing API is officially only for job postings and livestreams; do not use it for regular pages | Google, AI Overviews, Gemini |
| Bing Places / Google Business Profile | Manual | Local search |

## IndexNow

Open protocol: you report which URLs changed, and one submission is shared among the participating search engines.

1. Key: 8 to 128 characters `[a-zA-Z0-9-]`. The script generates 32 hex characters.
2. File `https://domain.com/<key>.txt` containing only the key (the script creates it in `--public`). **It must be live before you submit.**
3. Submission: `POST https://api.indexnow.org/indexnow` with JSON
   ```json
   { "host": "domain.com", "key": "<key>", "keyLocation": "https://domain.com/<key>.txt", "urlList": ["https://domain.com/a", "..."] }
   ```
   Up to 10,000 URLs per call. Responses: 200/202 ok; 400 bad format; 403 key not found/invalid; 422 URLs do not belong to the host; 429 too many requests.
4. Submit when pages are created, changed or deleted. Do not resubmit the whole site when nothing changed.
5. The key lives in the project's `aeo/indexnow.json` (it is public by nature: it sits on the site itself, so it is not a secret).

Automating on deploy (only with the user's explicit approval; it covers the automation, not one-off submissions):
- The CI runner has no `<skill>`: copy `indexnow.mjs` **and** `lib.mjs` to `scripts/aeo/` in the repository.
- Commit `aeo/indexnow.json` (the key is public). Without it, every build generates a new key and IndexNow answers 403.
- Run the step **after** the deploy (`<key>.txt` must be live): `node scripts/aeo/indexnow.mjs --site https://domain.com --send --changed-since <date>`, with `<date>` = the previous deploy date (e.g. the previous commit, `git log -1 --format=%cs HEAD~1`, which needs a non-shallow clone). It only works if the sitemap `lastmod` values are real.
- No-code alternative: the platform's native integration (Cloudflare "Crawler Hints", WordPress plugins, built-in Shopify/Wix support).

## Bing Webmaster API

- Key in Bing Webmaster → Settings → API Access. It is a **secret**: the user exports `BING_API_KEY` in the terminal; never write it to a file or paste it in chat.
- `POST https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlBatch?apikey=$BING_API_KEY` with `{ "siteUrl": "https://domain.com", "urlList": [...] }`. There is a daily and monthly quota per site: check it with `node <skill>/scripts/bing-submit.mjs --site https://domain.com --quota` before large batches.
- In practice IndexNow already covers Bing; use the API only to push priority pages.

## Checking after indexing

- `site:domain.com` on Bing and Google after a few days.
- Bing Webmaster → "URL Inspection" for important pages.
- Ask ChatGPT with search on something only the new page answers.
- Page still not indexed after 7 days: resubmit (IndexNow or `bing-submit.mjs`) and check again.
- Bing Webmaster → AI Performance: Copilot/Bing citations by query and by page (Microsoft ecosystem only, no clicks).
