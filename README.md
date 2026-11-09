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
node scripts/check_visitor_book.cjs
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

Tracking starts automatically on production pages, without an analytics panel
or preferences button. Earlier explicit refusals remain respected until their
original 180-day expiry. Advertising storage, Google signals and advertising
personalization remain disabled.

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
query parameters. Earlier refusals, blockers, missing referrers, and cross-device
visits mean these reports are directional rather than complete visitor counts.

For a basic ordered funnel in GA4 Explore, use `session_start` → a `page_view`
whose `content_group` is `project` → `contact_click`, with indirectly followed
steps. Keep CV actions available independently; a visitor need not view a
project first. A funnel counts users completing steps, not independent click
totals.

### Private site stats

`/visitors/` displays Site stats using the selected handwritten design. It reads
the same GA4 property directly through the Analytics Data API. Set its public
OAuth web client ID in `site/visitor-book/config.json`; enable the Analytics
Data API on that client's Google Cloud project and allow the JavaScript origin
`https://ramsey.page`. The authorized account must have access to the property.
The only requested scope is `analytics.readonly`; Google scopes this to the
Analytics properties that account can read, while the page queries only this
portfolio's configured property. For personal use, keep the OAuth app in
Testing with the owner's account as a test user.

There is no client secret, server, API key, custom database, or public report
export. Access tokens and report responses stay in page memory and disappear
on reload. Disconnect revokes the grant and clears the displayed reports.
The HTML is public and nonindexable; the actual report data requires Google
authorization. No analytics is collected on the visitors page itself.

The previous `/visitor-book/` URL redirects to `/visitors/`, preserving preview links.

The view shows seven complete days in Europe/Paris, daily session dots, traffic
sources, page views, CV and contact clicks, and top pages. Selecting a source filters
every panel. Google can delay, threshold, or sample results; the view flags
reported limitations. Instagram source aliases are grouped, with aggregate
queries to avoid double-counting sessions within a group. Selecting Instagram
includes all of its original source/medium pairs across every panel. Incoming
Instagram UTM aliases are standardized to `instagram / social` while paid
mediums are preserved. Missing and unavailable attribution have separate labels;
source-count discrepancies are flagged without changing Google's total or
inventing sources for historical sessions.

This is an acquisition/outcome summary, not an ordered
funnel. `?preview=1` explicitly uses sample data without Google requests. The
small dot chart uses CSS; Firebase, Cloudflare Workers and Chart.js are not
needed for this version.

## Agent access

The build also generates Markdown versions of the public English and French
pages, `/llms.txt`, and a portfolio-reading skill discovery index. The prepared
Cloudflare Worker adds content negotiation and HTTP discovery headers after
deployment. See [edge/README.md](edge/README.md) for the exact configuration,
content-use preference, checks, publication order and rollback.
