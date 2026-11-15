# Changelog

All notable changes to this skill are documented here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-11-15

- Renamed the skill to **AEO Compass**: skill name and slash command `/aeo-compass`, repository `jasonmello/aeo-compass`, install folder `~/.claude/skills/aeo-compass`. The project data folder stays `aeo/`.

## [1.0.0] - 2026-11-15

Initial public release.

### Added

- The `SKILL.md` router plus all references, scripts and templates.
- Scripts (plain Node.js 18 or later, no npm dependencies, shared helpers in `scripts/lib.mjs`):
  - `audit.mjs`: technical AEO audit of a live URL or a local build folder, scoring 0 to 75 (the other 25 points of the rubric in `references/audit.md` cover off-page and indexing).
  - `detect-stack.mjs`: detects the project's framework or platform so changes land in the right files.
  - `generate-schema.mjs`: generates the site-wide JSON-LD (entity, WebSite and, for apps, SoftwareApplication) from `aeo/profile.json`.
  - `generate-llms-txt.mjs`: generates `llms.txt` from a sitemap or a folder of HTML files.
  - `indexnow.mjs` and `bing-submit.mjs`: submit changed URLs to IndexNow and the Bing Webmaster API. Both do a dry run unless you pass `--send`.
- References: `principles.md`, `technical.md`, `schema.md`, `content.md`, `indexing.md`, `off-page.md`, `stacks.md`, `audit.md`.
- Templates: `robots.txt`, `profile.json`, `questions.md`, `faq-section.md`, `audit-report.md`.

## Maintenance

Some facts in this skill go stale within months. Re-check these every three to four months and update the dates in the files:

| Fact | Where it lives |
| --- | --- |
| AI crawler user-agent tokens (training, search and user-triggered bots) | `references/technical.md` (section 2, robots.txt) and `templates/robots.txt` |
| Which index each assistant uses (ChatGPT, Perplexity, Gemini, Copilot, Claude, Google AI Overviews) | `references/principles.md` ("Which index each assistant uses") |
| `llms.txt` status (Google's position, Lighthouse checks, bot access) | `references/technical.md` (section 5), `references/principles.md` ("What does not work"), `references/stacks.md` |
| Google rich result changes (FAQ, HowTo, deprecated types) | `references/schema.md`, `references/stacks.md` (Documentation) |
| Bing Webmaster AI Performance report status (still in preview, what it covers) | `references/off-page.md` (section 6), `references/indexing.md`, `references/audit.md` |
| IndexNow participating search engines | `references/indexing.md` |
