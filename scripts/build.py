#!/usr/bin/env python3
"""Compile shared portfolio pages and JSON copy into a bilingual static website."""
import argparse
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = ('en', 'fr')
PAGES = {
    'home': ('index.html', {'en': '', 'fr': ''}),
    'about': ('about/index.html', {'en': 'about/', 'fr': 'a-propos/'}),
    'handbag': ('handbag/index.html', {'en': 'handbag/', 'fr': 'sac-fait-main/'}),
    'tidle': ('tidle/index.html', {'en': 'tidle/', 'fr': 'tidle/'}),
    'restitch': ('restitch/index.html', {'en': 'restitch/', 'fr': 'restitch/'}),
    'fuzz': ('fuzz/index.html', {'en': 'fuzz/', 'fr': 'fuzz/'}),
    'beirut': ('beirut/index.html', {'en': 'beirut/', 'fr': 'beyrouth/'}),
}
ALIASES = {}
SOURCE_ROUTES = {'/' + filename.removesuffix('index.html'): page for page, (filename, _) in PAGES.items()}
SOURCE_ROUTES.update(ALIASES)
TOKEN = re.compile(r'<!--i18n:([\w.]+)-->(.*?)<!--/i18n-->', re.S)
ATTRIBUTE = re.compile(r'\s+data-i18n-([\w-]+)="([\w.]+)"')
TAG = re.compile(r'<[^>]+>')
QUOTED_PATH = re.compile(r'''(?P<quote>["'])(?P<url>/(?!/)[^"'\s<>\\]*)(?=(?P=quote))''')
CSS_PATH = re.compile(r'''(?P<start>url\(\s*)(?P<url>/(?!/)[^\s)'"\\]+)''')
FAVICON_LINKS = '''<link rel="icon" href="/favicon.ico?v=1" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon/avatar-beige-16.png?v=1">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon/avatar-beige-32.png?v=1">
<link rel="icon" type="image/png" sizes="48x48" href="/assets/favicon/avatar-beige-48.png?v=1">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/favicon/avatar-beige-180.png?v=1">'''


def flatten(value, prefix=''):
    result = {}
    for key, item in value.items():
        name = prefix + key
        if isinstance(item, dict):
            result.update(flatten(item, name + '.'))
        elif isinstance(item, str):
            result[name] = item
        else:
            raise ValueError('Messages must be strings: ' + name)
    return result


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key: ' + key)
        result[key] = value
    return result


def load_catalogs():
    catalogs = {lang: flatten(json.loads((ROOT / 'locales' / (lang + '.json')).read_text(),
                                       object_pairs_hook=unique_object)) for lang in LANGUAGES}
    english = catalogs['en']
    for lang, catalog in catalogs.items():
        if catalog.keys() != english.keys():
            raise ValueError(f'{lang}: missing {sorted(english.keys() - catalog.keys())}; '
                             f'extra {sorted(catalog.keys() - english.keys())}')
        for key, value in catalog.items():
            if not value.strip():
                raise ValueError(f'{lang}: empty translation: {key}')
            if set(re.findall(r'\{\w+\}', value)) != set(re.findall(r'\{\w+\}', english[key])):
                raise ValueError(f'{lang}: mismatched placeholders: {key}')
    return catalogs


def translate(source, messages):
    def translated_text(match):
        original = match[2]
        leading = re.match(r'\s*', original)[0]
        trailing = re.search(r'\s*$', original)[0]
        return leading + html.escape(messages[match[1]], quote=False) + trailing
    source = TOKEN.sub(translated_text, source)

    def translate_tag(match):
        tag = match[0]
        for attribute in list(ATTRIBUTE.finditer(tag)):
            name, key = attribute[1], attribute[2]
            value = html.escape(messages[key], quote=True)
            pattern = re.compile(r'(\b' + re.escape(name) + r'\s*=\s*)(["\'])(.*?)\2', re.S)
            tag, count = pattern.subn(lambda m: m[1] + '"' + value + '"', tag, count=1)
            if count != 1:
                raise ValueError(f'Missing translated attribute {name}: {key}')
        return ATTRIBUTE.sub('', tag)

    source = TAG.sub(translate_tag, source)
    if '<!--i18n:' in source or 'data-i18n-' in source:
        raise ValueError('Unresolved translation marker')
    return source


def page_path(page, lang):
    return '/' + lang + '/' + PAGES[page][1][lang]


def localize_links(source, lang):
    def replace(match):
        raw = match[2]
        parsed = urlsplit(raw)
        route = parsed.path
        if route.endswith('/index.html'):
            route = route[:-len('index.html')]
        if route in SOURCE_ROUTES:
            target = page_path(SOURCE_ROUTES[route], lang)
            if parsed.query: target += '?' + parsed.query
            if parsed.fragment: target += '#' + parsed.fragment
            return match[1] + target + match[3]
        return match[0]
    return re.sub(r'''(\bhref\s*=\s*["'])(/[^"']*)(["'])''', replace, source)


def clean_seo(source):
    # Authored-template previews use generated English defaults. Production uses
    # its own embedded language catalog and loads the formatter exactly once.
    source = re.sub(r'<script\s+src=["\']/(?:i18n-preview|i18n)\.js\?v=1["\']\s*></script>', '', source)
    source = re.sub(r'<title\b[^>]*>.*?</title>', '', source, flags=re.I|re.S)
    source = re.sub(r'<meta\b[^>]*(?:name=["\'](?:description|robots)["\']|property=["\']og:[^"\']+["\']|name=["\']twitter:[^"\']+["\'])[^>]*>', '', source, flags=re.I)
    source = re.sub(r'<link\b[^>]*rel=["\'](?:canonical|alternate)["\'][^>]*>', '', source, flags=re.I)
    return source


def add_favicon(source):
    """Apply the selected avatar to every page, replacing old empty icons."""
    source = re.sub(r'''<link\b(?=[^>]*\brel\s*=\s*["'](?:icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed)["'])[^>]*>\s*''',
                    '', source, flags=re.I)
    # Keep charset first; these links need no script and work on redirect pages.
    return re.sub(r'(</head\s*>)', lambda match: '\n' + FAVICON_LINKS + '\n' + match[1],
                  source, count=1, flags=re.I)


def bootstrap(messages):
    runtime = {key: value for key, value in messages.items() if key.startswith(('runtime.', 'home.'))}
    payload = json.dumps(runtime, ensure_ascii=False).replace('<', '\\u003c').replace('&', '\\u0026')
    return '<script id="portfolio-messages" type="application/json">' + payload + '</script>\n<script src="/i18n.js?v=1"></script>'


def render(source, page, lang, messages, site_url, base_path, gateway=False):
    source = clean_seo(localize_links(translate(source, messages), lang))
    source = re.sub(r'<html\b[^>]*>', '<html lang="' + lang + '">', source, count=1, flags=re.I)
    absolute = lambda path: site_url + base_path.rstrip('/') + path
    canonical = absolute('/') if gateway else absolute(page_path(page, lang))
    title, description = messages['seo.' + page + 'Title'], messages['seo.' + page + 'Description']
    esc = lambda value: html.escape(value, quote=True)
    metadata = [
        f'<title>{esc(title)}</title>',
        f'<meta name="description" content="{esc(description)}">',
        f'<link rel="canonical" href="{esc(canonical)}">',
        *[f'<link rel="alternate" hreflang="{locale}" href="{esc(absolute(page_path(page, locale)))}">' for locale in LANGUAGES],
        f'<link rel="alternate" hreflang="x-default" href="{esc(absolute("/" if page == "home" else page_path(page, "en")))}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{esc(title)}">',
        f'<meta property="og:description" content="{esc(description)}">',
        f'<meta property="og:url" content="{esc(canonical)}">',
        f'<meta property="og:locale" content="{"fr_FR" if lang == "fr" else "en_US"}">',
        f'<meta property="og:locale:alternate" content="{"en_US" if lang == "fr" else "fr_FR"}">',
        '<meta name="twitter:card" content="summary">',
        f'<meta name="twitter:title" content="{esc(title)}">',
        f'<meta name="twitter:description" content="{esc(description)}">',
    ]
    # Translation data exists before any existing scripts initialize their controls.
    # Keep charset inside the first 1024 bytes; redirect before any other script.
    source = re.sub(r'<meta\s+charset=["\'][^"\']+["\']\s*/?>', '', source, flags=re.I)
    entry = '<script src="/language-entry.js?v=1" data-base-path="/"></script>\n' if gateway else ''
    header = '\n<meta charset="utf-8">\n' + entry + bootstrap(messages) + '\n' + '\n'.join(metadata)
    source = re.sub(r'(<head\b[^>]*>)', lambda m: m[1] + header, source, count=1, flags=re.I)
    source = source.replace('</head>', '<link rel="stylesheet" href="/localized.css?v=1">\n</head>', 1)
    if page == 'home':
        # Keep text, images, and ordinary project links usable without the renderer.
        fallback = '<noscript><style>x-dc{display:block}.tile-study [data-grid]{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))!important}.tile-study .tile{min-height:360px}.project-filters{display:none}.tile-study .tile-caption{flex:auto!important}html,body{height:auto!important}</style></noscript>'
        source = source.replace('</head>', fallback + '\n</head>', 1)
    return source


def prefix_paths(source, base_path, filename):
    if base_path == '/': return source
    def replace(match):
        value = match['url']
        # A standalone slash in JavaScript is a delimiter, not an asset URL.
        if value == '/' and filename.endswith('.js'): return match[0]
        return match[0][:-len(value)] + base_path + value[1:]
    return CSS_PATH.sub(replace, QUOTED_PATH.sub(replace, source))


class LocalReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in {'href', 'src', 'poster'} and value and value.startswith('/'):
                self.urls.append(value)
    handle_startendtag = handle_starttag


def verify(output, base_path):
    errors, checked = [], 0
    # Only shipped production routes, aliases, and their resources are required.
    files = [output / 'index.html']
    files += [output / (page_path(page, lang).lstrip('/') + 'index.html') for page in PAGES for lang in LANGUAGES]
    for path in files:
        refs = LocalReferences(); refs.feed(path.read_text())
        for url in refs.urls:
            if url.startswith('//') or '{{' in url: continue
            target = unquote(urlsplit(url).path)
            if not target.startswith(base_path):
                errors.append(f'{path.relative_to(output)}: outside base path: {url}'); continue
            destination = output / target[len(base_path):]
            if destination.is_dir(): destination /= 'index.html'
            checked += 1
            if not destination.is_file(): errors.append(f'{path.relative_to(output)}: missing {url}')
    if errors: raise ValueError('\n'.join(sorted(set(errors))))
    return checked


def build(base_path='/', output=None, site_url='https://odesa-llc.github.io'):
    if not base_path.startswith('/') or any(c in base_path for c in '?#') or any(p in {'.', '..'} for p in base_path.split('/')):
        raise ValueError('Use an absolute base path such as / or /ramsey.page/.')
    base_path = base_path.rstrip('/') + '/'
    parsed = urlsplit(site_url)
    if parsed.scheme not in ('https', 'http') or not parsed.netloc or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise ValueError('--site-url must be an origin, for example https://example.com')
    site_url = site_url.rstrip('/')
    output = Path(output or ROOT / 'dist')
    output = (output if output.is_absolute() else ROOT / output).resolve()
    source = ROOT / 'site'
    if output == ROOT or ROOT not in output.parents or output == source or source in output.parents:
        raise ValueError('Build output must be inside this project and outside site/.')
    catalogs = load_catalogs()
    preview = {key: value for key, value in catalogs['en'].items() if key.startswith(('runtime.', 'home.'))}
    preview_source = '// Generated from locales/en.json for direct authored-template previews.\nwindow.PORTFOLIO_PREVIEW_MESSAGES = ' + json.dumps(preview, ensure_ascii=False) + ';\n'
    (source / 'i18n-preview.js').write_text(preview_source)
    if output.exists(): shutil.rmtree(output)
    shutil.copytree(source, output, ignore=shutil.ignore_patterns('.DS_Store'))
    # Retain studies locally but make every nonproduction HTML page nonindexable.
    for path in output.rglob('*.html'):
        text = translate(path.read_text(), catalogs['en'])
        text = re.sub(r'<head\b[^>]*>', lambda m: m[0] + '<meta name="robots" content="noindex">' + bootstrap(catalogs['en']), text, count=1, flags=re.I)
        path.write_text(text)
    for page, (filename, _) in PAGES.items():
        template = (source / filename).read_text()
        for lang in LANGUAGES:
            destination = output / (page_path(page, lang).lstrip('/') + 'index.html')
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(render(template, page, lang, catalogs[lang], site_url, base_path))
        if page != 'home':
            # Existing bookmarks remain readable English aliases, canonical to /en/.
            (output / filename).write_text(render(template, page, 'en', catalogs['en'], site_url, base_path))
    (output / 'index.html').write_text(render((source / 'index.html').read_text(), 'home', 'en', catalogs['en'], site_url, base_path, gateway=True))
    for alias, page in ALIASES.items():
        destination = output / alias.lstrip('/') / 'index.html'
        destination.parent.mkdir(parents=True, exist_ok=True)
        target = page_path(page, 'en')
        destination.write_text('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            + f'<title>{html.escape(catalogs["en"]["seo." + page + "Title"])}</title>'
            + f'<link rel="canonical" href="{site_url + base_path.rstrip("/") + target}">'
            + f'<meta http-equiv="refresh" content="0;url={target}"></head>'
            + f'<body><script>location.replace({json.dumps(target)}+location.search+location.hash);</script></body></html>')
    # Script-maintained project destinations follow the current page language.
    visibility = output / 'project-visibility.js'
    code = visibility.read_text()
    route_map = {route: {lang: page_path(page, lang) for lang in LANGUAGES} for route, page in SOURCE_ROUTES.items()}
    code = code.replace('window.PORTFOLIO_PROJECTS = projects;',
        'var routes = ' + json.dumps(route_map) + ';\n'
        + '  var language = document.documentElement.lang === "fr" ? "fr" : "en";\n'
        + '  projects.forEach(function (project) { if (routes[project.path]) project.path = routes[project.path][language]; });\n'
        + '  window.PORTFOLIO_PROJECTS = projects;')
    visibility.write_text(code)
    for path in output.rglob('*'):
        if path.suffix in {'.html', '.css', '.js'} and 'vendor' not in path.relative_to(output).parts:
            text = path.read_text()
            if path.suffix == '.html':
                text = add_favicon(text)
            path.write_text(prefix_paths(text, base_path, path.name))
    namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    ET.register_namespace('', namespace)
    sitemap = ET.Element('{' + namespace + '}urlset')
    for route in ['/'] + [page_path(page, lang) for page in PAGES for lang in LANGUAGES]:
        entry = ET.SubElement(sitemap, '{' + namespace + '}url')
        ET.SubElement(entry, '{' + namespace + '}loc').text = site_url + base_path.rstrip('/') + route
    ET.ElementTree(sitemap).write(output / 'sitemap.xml', encoding='utf-8', xml_declaration=True)
    (output / 'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: ' + site_url + base_path + 'sitemap.xml\n')
    (output / '.nojekyll').touch()
    checked = verify(output, base_path)
    print(f'Built 14 localized pages + language entry; checked {checked} local HTML references at {output}')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-path', default='/')
    parser.add_argument('--site-url', default='https://odesa-llc.github.io')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    build(args.base_path, args.output, args.site_url)
