# Schema (JSON-LD)

Rules:
- JSON-LD format in `<script type="application/ld+json">` in the rendered HTML (do not inject it only via client-side JS).
- Everything in the schema must be visible on the page.
- Use a stable `@id` (`https://domain.com/#organization`) to link entities across pages.
- `sameAs` is what ties the entity together: site + Instagram + LinkedIn + YouTube + Google Business Profile + Wikidata, if it exists.
- Never invent `aggregateRating`, `review`, price or award.
- Reviews from Google or other external platforms are not copied into the site's own schema. A company's `aggregateRating` about itself (on `LocalBusiness`/`Organization`) is "self-serving": it does not produce stars. Use it only on `Product`, `SoftwareApplication`, `Course` etc., with reviews collected on the site itself and visible on the page. (`LocalBusiness` with a rating is still valid for a site that reviews *other* businesses.) The reputation signal for AI comes from external platforms.
- Validate at https://validator.schema.org and https://search.google.com/test/rich-results. For `FAQPage`, use only validator.schema.org (the Rich Results Test no longer accepts FAQ).

`<skill>/scripts/generate-schema.mjs` generates the global blocks from `aeo/profile.json`.

## Which type to use

| Situation | Type |
|---|---|
| Every page (in the layout) | `Organization` (or subtype) + `WebSite` |
| Serves the public at an address | `LocalBusiness` or subtype: `Dentist`, `MedicalClinic`, `Restaurant`, `LegalService`, `Store`… |
| Independent professional / creator | `Person` (+ `ProfilePage` on the About page) |
| App or software | `SoftwareApplication` / `MobileApplication` / `WebApplication` |
| Physical product | `Product` + `Offer` |
| Course | `Course` |
| Post/article | `Article` / `BlogPosting` with `author` and dates |
| Questions page | `FAQPage` |
| Step-by-step tutorial | `HowTo` (Google no longer shows a rich result, but AI assistants read the structure) |
| Navigation | `BreadcrumbList` |
| Event | `Event` |
| Video on the page | `VideoObject` (`name`, `thumbnailUrl`, `uploadDate` required; `description`, `duration`, `contentUrl`/`embedUrl`, `transcript`) |

Note: since May 7, 2026, Google does not show FAQ rich results for any site. `FAQPage` markup is still valid; use it when the page has real questions and answers, as a structure readable by AI assistants and by Bing.

## Examples

### Organization + WebSite (layout)
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#organization",
      "name": "Example",
      "url": "https://example.com",
      "logo": "https://example.com/logo.png",
      "description": "Same sentence used in the Instagram bio and on Google Business Profile.",
      "sameAs": [
        "https://www.instagram.com/example",
        "https://www.linkedin.com/company/example",
        "https://www.youtube.com/@example"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com",
      "name": "Example",
      "publisher": { "@id": "https://example.com/#organization" },
      "inLanguage": "en-US"
    }
  ]
}
```

### LocalBusiness
```json
{
  "@context": "https://schema.org",
  "@type": "Dentist",
  "@id": "https://example.com/#organization",
  "name": "Example Dental",
  "url": "https://example.com",
  "telephone": "+1-512-555-0100",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "Austin",
    "addressRegion": "TX",
    "postalCode": "78701",
    "addressCountry": "US"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": 30.27, "longitude": -97.74 },
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "08:00", "closes": "18:00" }
  ],
  "hasMap": "https://maps.google.com/?cid=...",
  "sameAs": ["https://www.instagram.com/example"]
}
```
The address and phone must be **identical** to the ones on Google Business Profile and Bing Places (consistent NAP).

### SoftwareApplication
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Example App",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web, iOS, Android",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "publisher": { "@id": "https://example.com/#organization" },
  "downloadUrl": "https://apps.apple.com/app/id000"
}
```

### Product (e-commerce)
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Example Run Sneaker",
  "image": ["https://example.com/img/sneaker-1x1.jpg", "https://example.com/img/sneaker-16x9.jpg"],
  "description": "Same short description as the product page.",
  "sku": "ERS-10-BL",
  "gtin13": "0012345678905",
  "brand": { "@type": "Brand", "name": "Example" },
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/product/example-run-sneaker",
    "price": "89.90",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "US" },
      "shippingRate": { "@type": "MonetaryAmount", "value": "5.90", "currency": "USD" },
      "deliveryTime": {
        "@type": "ShippingDeliveryTime",
        "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 1, "unitCode": "DAY" },
        "transitTime": { "@type": "QuantitativeValue", "minValue": 2, "maxValue": 7, "unitCode": "DAY" }
      }
    },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "applicableCountry": "US",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 30
    }
  }
}
```
- Price and stock in the schema come from the **same data** the page shows (same source, same render). A mismatch gets the listing pulled.
- `merchantReturnDays` is the store's real return window, never below the legal minimum where the country sets one (see Country-specific notes).
- `priceValidUntil` only with a real end date for a sale; an expired date removes the product from the listing.
- Shipping and returns that are the same for the whole store: declare them once on the `Organization` (`hasShippingService`/`hasMerchantReturnPolicy`) and put in the `Offer` only the exceptions.

### VideoObject
```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "How to whiten your teeth safely",
  "description": "A 1–2 sentence summary of the video.",
  "thumbnailUrl": "https://example.com/img/video-thumb.jpg",
  "uploadDate": "2026-11-15",
  "duration": "PT4M30S",
  "embedUrl": "https://www.youtube.com/embed/XXXXXXXXXXX",
  "transcript": "Only if the transcript is visible on the page."
}
```

### FAQPage
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How much does X cost?",
      "acceptedAnswer": { "@type": "Answer", "text": "Same short answer that appears on the page." }
    }
  ]
}
```

### Article
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Title",
  "datePublished": "2026-11-15",
  "dateModified": "2026-11-15",
  "author": { "@type": "Person", "name": "Name", "url": "https://example.com/about", "jobTitle": "Job title/credential" },
  "publisher": { "@id": "https://example.com/#organization" },
  "mainEntityOfPage": "https://example.com/article"
}
```

Example names, addresses, prices and IDs above are illustrative.

## Country-specific notes

**Brazil:**
- Ratings from Reclame Aqui, like Google reviews, are not copied into the site's own schema; they count as an external reputation signal.
- `merchantReturnDays: 7` is the legal minimum (Brazil's 7-day right of withdrawal, Consumer Defense Code, art. 49); use the store's real window if it is longer. In a Brazilian store use `"applicableCountry": "BR"`, `"addressCountry": "BR"` and `"priceCurrency": "BRL"`.
- Phone numbers use the +55 country code (e.g. `"+55-11-0000-0000"`), and `inLanguage` is `"pt-BR"`.
