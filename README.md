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
```

For repository-path hosting, pass `--base-path /ramsey.page/` and
`--site-url https://odesa-llc.github.io` to both Python commands.

## Publish

Enable GitHub Pages with **Settings → Pages → Source → GitHub Actions**.
The deployment workflow uses GitHub's actual origin and base path, builds and
validates all fourteen localized pages, then publishes `dist/` on pushes to
`main`. Configure `ramsey.page` in Pages settings after registering the domain.
