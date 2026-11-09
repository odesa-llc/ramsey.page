#!/usr/bin/env python3
"""Check public content parity, discovery integrity, and excluded routes."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
from build import PAGES, LANGUAGES, UNLISTED_PAGES, load_catalogs, page_path
from agent_readiness import Document, find, markdown


def check(output, base_path, site_url):
    base_path = base_path.rstrip('/') + '/'
    manifest = json.loads((output / 'agent-content.json').read_text())
    assert manifest['basePath'] == base_path
    catalogs = load_catalogs()
    public = set(PAGES) - UNLISTED_PAGES
    expected_md = {base_path + 'index.md'}
    for page in public:
        for lang in LANGUAGES:
            route = page_path(page, lang)
            path = base_path.rstrip('/') + route
            md_path = path + 'index.md'
            expected_md.add(md_path)
            entry = manifest['routes'][path]
            assert entry == {'markdown': md_path, 'language': lang}
            source = (output / (route.lstrip('/') + 'index.md')).read_text()
            metadata, body = source.split('---\n', 2)[1:]
            fields = dict(line.split(': ', 1) for line in metadata.strip().splitlines())
            assert json.loads(fields['url']) == site_url + path
            assert json.loads(fields['title']) == catalogs[lang][f'seo.{page}Title']
            assert json.loads(fields['description']) == catalogs[lang][f'seo.{page}Description']
            assert fields['language'] == lang
            assert len(body.strip()) > 100
            assert '<script' not in body and '<!--i18n:' not in source and '{{' not in source
            if page == 'about':
                assert site_url + base_path.rstrip('/') + catalogs[lang]['about.cvHref'] in body
                assert 'mailto:ramseyhat@gmail.com' in body
    assert {entry['markdown'] for entry in manifest['routes'].values()} == expected_md
    llms = (output / 'llms.txt').read_text()
    assert all(site_url + path in llms for path in expected_md if path != base_path + 'index.md')
    for data in [json.dumps(manifest), llms]:
        assert not any(path in data for path in ['/skull-cap/', '/thinking-cap/', '/visitors/', '/visitor-book/', '/concepts/'])
    for relative in manifest['resources']:
        assert relative.startswith(base_path)
        assert (output / relative[len(base_path):]).is_file(), relative
    for path in expected_md:
        source = (output / path[len(base_path):]).read_text()
        for href in re.findall(r'\]\(([^)]+)\)', source):
            url = urlsplit(href)
            if url.netloc == urlsplit(site_url).netloc:
                assert url.path.startswith(base_path), href
                target = output / unquote(url.path[len(base_path):])
                if target.is_dir():
                    target /= 'index.html'
                assert target.is_file(), href

    index = json.loads((output / '.well-known/agent-skills/index.json').read_text())
    assert index['$schema'] == 'https://schemas.agentskills.io/discovery/0.2.0/schema.json'
    skill = index['skills'][0]
    assert len(index['skills']) == 1 and skill['type'] == 'skill-md'
    raw = (output / '.well-known/agent-skills/read-ramsey-portfolio/SKILL.md').read_bytes()
    assert skill['digest'] == 'sha256:' + hashlib.sha256(raw).hexdigest()
    assert re.search(r'^name: ' + re.escape(skill['name']) + '$', raw.decode(), re.M)
    assert re.search(r'^description: ' + re.escape(skill['description']) + '$', raw.decode(), re.M)
    robots = (output / 'robots.txt').read_text()
    if manifest['contentSignal']:
        assert 'Content-Signal: ' + manifest['contentSignal'] in robots
    else:
        assert 'Content-Signal:' not in robots

    # A conversion must retain the research caveat while removing controls and scripts.
    example = Document('<main><h1>A <em>study</em></h1><p>11 of 19 people.</p><details><summary>Limits</summary><p>Self-selected sample.</p></details><button>Play</button><span hidden>Secret</span><svg aria-hidden="true"><text>Noise</text></svg><script>leak()</script></main>')
    converted = markdown(find(example.root, 'main'), site_url + '/', 'en')
    assert '11 of 19' in converted and 'Self-selected sample' in converted
    assert all(value not in converted for value in ['Play', 'Secret', 'Noise', 'leak()'])
    print(f'Passed {len(expected_md)} Markdown pages, localized CVs, public-route exclusions, links, policy, and skill digest at {base_path}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--base-path', default='/')
    parser.add_argument('--site-url', required=True)
    args = parser.parse_args()
    check(args.output, args.base_path, args.site_url)
