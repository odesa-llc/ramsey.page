# Ramsey Hatoum — portfolio

An English and French portfolio of apps, objects, research, and photography.
The selected projects are Handmade Handbag, Tidle, Restitch, Breadboard Fuzz,
and Beirut, in passing. The homepage headline is “made for use.”

## Edit and preview

Edit authored pages in `site/` and copy in `locales/en.json` and
`locales/fr.json`. Preserve matching keys, interpolation placeholders, and
translation markers. Generated output lives in `dist/`.

```sh
python3 serve.py 4185
```

Open `http://127.0.0.1:4185/`. The neutral root chooses English or French from
browser preferences; explicit `/en/` and `/fr/` routes retain their language.
No backend or dependency installation is required.

## Build and validate

```sh
python3 scripts/build.py --base-path / --site-url https://ramsey.page
python3 scripts/check_build.py dist --base-path / --site-url https://ramsey.page
node scripts/check_languages.cjs
node scripts/check_analytics.cjs
```

For repository-path hosting, pass `--base-path /ramsey.page/` and
`--site-url https://odesa-llc.github.io` to both Python commands.

## Publish

Enable GitHub Pages with **Settings → Pages → Source → GitHub Actions**.
The deployment workflow uses GitHub's actual origin and base path, builds and
validates all fourteen localized pages, then publishes `dist/` on pushes to
`main`. Configure `ramsey.page` in Pages settings after registering the domain.

## Analytics

GA4 is configured in `analytics.json` for production hosts only. An empty
measurement ID disables injection. Local previews send no analytics.

Visitors can allow or decline optional analytics in English or French and
change their choice with **Analytics choices**. Google loads only after they
allow it. Choices expire after 180 days. Advertising features are disabled.

The site sends one `page_view` per page load plus `cv_click` and `contact_click`.
The contact action measures clicking the copy-email control, not a sent enquiry;
CV clicks do not confirm that someone saved or read the PDF. GA4 supplies its
standard session and engagement events. Enhanced measurement is off to avoid
extra interaction events and duplicate CV tracking.

Use GA4's **Traffic acquisition** report with session source/medium to compare
search, social, and direct visits, and **Pages and screens** to see project
views. Tag external links consistently, using lowercase values. Instagram bio:

```text
https://ramsey.page/?utm_source=instagram&utm_medium=social&utm_campaign=portfolio&utm_content=bio
```

Change `utm_content` for a story or another placement. Do not add UTMs to
internal site navigation. The language entry preserves campaign tags and
external referring origins. Tracking excludes URL fragments and arbitrary
query parameters. Consent refusals, blockers, missing referrers, and cross-device
visits mean these reports are directional rather than complete visitor counts.

For a basic ordered funnel in GA4 Explore, use `session_start` → a `page_view`
whose `content_group` is `project` → `contact_click`, with indirectly followed
steps. Keep CV actions available independently; a visitor need not view a
project first. A funnel counts users completing steps, not independent click
totals. The custom dashboard, report API credentials, Firebase, and Chart.js
are deferred until the built-in reports prove insufficient.
