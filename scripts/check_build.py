#!/usr/bin/env python3
"""Acceptance checks against both root-hosted and repository-hosted output."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET
from build import PAGES, LANGUAGES, page_path, load_catalogs


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(); self.tags = []; self.feed(source)
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


def check(output, base_path, site_url):
    catalogs = load_catalogs()
    expected = set()
    for page in PAGES:
        for lang in LANGUAGES:
            route = page_path(page, lang)
            absolute = site_url + base_path.rstrip('/') + route
            expected.add(absolute)
            source = (output / (route.lstrip('/') + 'index.html')).read_text()
            assert source.index('<meta charset="utf-8">') < 1024
            doc = Document(source)
            assert [attrs['lang'] for tag, attrs in doc.tags if tag == 'html'] == [lang]
            canonicals = [attrs['href'] for tag, attrs in doc.tags if tag == 'link' and attrs.get('rel') == 'canonical']
            assert canonicals == [absolute], (route, canonicals)
            alternates = {a['hreflang']: a['href'] for tag, a in doc.tags if tag == 'link' and a.get('rel') == 'alternate'}
            for locale in LANGUAGES:
                assert alternates[locale] == site_url + base_path.rstrip('/') + page_path(page, locale)
            assert alternates['x-default'] == site_url + base_path.rstrip('/') + ('/' if page == 'home' else page_path(page, 'en'))
            assert not any(a.get('name') == 'robots' and 'noindex' in a.get('content', '') for _, a in doc.tags)
            assert '<!--i18n:' not in source and 'data-i18n-' not in source
            assert not any('language-entry.js' in a.get('src', '') for _, a in doc.tags)
            assert len([a for tag, a in doc.tags if tag == 'script' and '/i18n.js?' in a.get('src', '')]) == 1
            assert 'src="' + base_path + 'i18n-preview.js' not in source
            assert not any('hreflang' in a for tag, a in doc.tags if tag == 'a'), 'Visible language selector found'
            for tag, attrs in doc.tags:
                href = attrs.get('href', '')
                if tag == 'a' and href.startswith('/') and not href.startswith('//') and '/assets/' not in href:
                    assert urlsplit(href).path.startswith(base_path + lang + '/'), (route, href)
            assert any(a.get('name') == 'description' and a.get('content') == catalogs[lang]['seo.'+page+'Description'] for _, a in doc.tags)
            if page == 'about':
                cv_href = base_path.rstrip('/') + catalogs[lang]['about.cvHref']
                assert any(tag == 'a' and attrs.get('href') == cv_href for tag, attrs in doc.tags), (lang, cv_href)
    source = (output / 'index.html').read_text()
    doc = Document(source)
    entries = [a for tag, a in doc.tags if tag == 'script' and 'language-entry.js' in a.get('src', '')]
    assert len(entries) == 1 and entries[0]['data-base-path'] == base_path, entries
    assert source.index('language-entry.js') < source.index('/support.js')
    assert '<noscript>' in source and 'English / Français' not in source
    tree = ET.parse(output / 'sitemap.xml')
    urls = {e.text for e in tree.findall('.//{*}loc')}
    assert urls == expected | {site_url + base_path}
    study = (output / 'concepts/original-layout.html').read_text()
    assert 'name="robots" content="noindex"' in study
    assert base_path + 'sitemap.xml' in (output / 'robots.txt').read_text()
    print(f'Passed HTML, metadata, navigation, sitemap, and entry checks for 14 pages at {base_path}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--base-path', default='/')
    parser.add_argument('--site-url', required=True)
    args = parser.parse_args()
    check(args.output, args.base_path, args.site_url)
