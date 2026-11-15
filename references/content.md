# Content that AI cites

## Find the questions

- Primary source: `aeo/questions.md` (what a customer would ask ChatGPT).
- Add to it from: Google's "People also ask", Google/Bing autocomplete, questions the user gets again and again on WhatsApp or in DMs, Reddit and niche forums, Instagram/YouTube comments.
- Group by intent: what is it / how much does it cost / how does it work / X vs Y / best X in [city] / is it worth it / problems and precautions.

## Format of each answer

```
## How much does it cost to install solar panels on a house in Austin?

A solar power system for an average house in Austin (900 kWh/month of usage) costs $15,000 to $25,000 in 2026, installed, based on the quotes Example Solar closed this year. The price changes with usage, roof type and panel brand. [40–60 words, answers on its own]

### What the price includes
- ...list or table...

### When it costs more
...details, examples, source of the numbers...

Updated November 15, 2026 · by Jane Smith, licensed electrical engineer, Texas PE No. 00000
```

The numbers in the example are illustrative. On the real page, use only figures the user provides or that come from a cited source; if there are none, ask.

Rules:
1. **The first sentence answers.** No "Great question", no historical introduction.
2. **Self-contained passage.** The paragraph has to make sense when clipped out on its own (repeat the subject instead of writing "this").
3. **Concrete numbers with source and date.** Assistants tend to cite passages that have a number, a source and a date (GEO study, Aggarwal et al., 2023).
4. **Tables and lists** for comparisons, steps, pros and cons.
5. **Explicit entities:** brand name, city, product. Avoid vague pronouns.
6. **Author with credentials** shown on the page (E-E-A-T): name, title, professional license, link to an author page.
7. **Update date** visible and real. Review important pages every 3–6 months.
8. **Your own opinion and experience** ("across our 200 projects in 2025, ...") set the page apart from generic content. Only real data the user provides; never invent these numbers.
9. Honest X vs Y comparisons that admit when the competitor is better earn more trust.

## Page types that pay off most

- One FAQ per service/product (not one giant generic FAQ). Ready-made template in `<skill>/templates/faq-section.md`: questions in H2/H3, a 40–60 word answer, date, author and FAQPage with the same text as the page.
- "How much does X cost" with real price ranges (for regulated professions, see below).
- "Best X for Y" and "X vs Y".
- "How to" guides with numbered steps.
- A glossary of the niche.
- Original studies and data (customer surveys, internal numbers): other sites cite them as a source, which means backlinks.
- About/Team page with credentials.

## Regulated professions (healthcare, law, accounting)

Before publishing prices, results, before/after photos or testimonials, check the advertising rules of the professional board or licensing body. Some ban advertising prices and payment terms outright. Prefer explaining what affects the cost and what the patient or client should ask at the appointment, with no figures and no promises.

## Video (YouTube, Shorts, Reels)

AI only reads a video's text: title, description, chapters and captions.
- Title = the real question, as in `questions.md`.
- The description opens with the answer in 40–60 words, followed by the link to the site page.
- Chapters with timestamps (`00:00 What it is`, `01:20 How much it costs`...), each one a sub-question.
- Reviewed captions in the video's language (automatic captions get names, technical terms and numbers wrong).
- On the site page: embed + text transcript + `VideoObject` schema (name, description, thumbnailUrl, uploadDate, duration, embedUrl; see `schema.md`).
- Shorts/Reels: write the main spoken line as text in the post's description or caption.

## What to avoid

- Mass-generated pages that only swap the city.
- Text that reads as AI-written: run it through the `humanizer` skill. If it isn't installed, review it yourself: cut punchy one-liners, "it's not X, it's Y" contrasts, forced triads, excess em dashes, inflated adjectives and sales jargon.
- Content that exists only as video or images with no transcript.
- FAQPage schema with questions that aren't on the page.

## Country-specific notes

**Brazil:**
- Professional boards (CFO, CFM, OAB, CFC, etc.) set advertising rules for regulated professions. The Dental Code of Ethics (Código de Ética Odontológica), for example, bans advertising prices and payment terms.
- For Brazilian audiences, use reviewed pt-BR captions (automatic captions get names, technical terms and numbers wrong).
