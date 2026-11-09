"""Generate public agent resources from the same localized pages as the site."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urljoin


VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
SKIP = {'script', 'style', 'noscript', 'nav', 'footer', 'canvas', 'input', 'select', 'template'}


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(re.sub(r'\s+', ' ', data))


def find(node, tag):
    if isinstance(node, str):
        return None
    if node.tag == tag:
        return node
    return next((found for child in node.children if (found := find(child, tag))), None)


def escape(text):
    return re.sub(r'([\\`*\[\]])', r'\\\1', text)


def markdown(node, canonical, lang):
    if isinstance(node, str):
        return escape(node)
    tag, attrs = node.tag, node.attrs
    if tag in SKIP or 'hidden' in attrs or attrs.get('aria-hidden') == 'true':
        return ''
    if tag == 'button':
        email = attrs.get('data-copy-email')
        return f'[{email}](mailto:{email})' if email else ''
    if tag in {'svg', 'figure'} and attrs.get('role') == 'img':
        label = attrs.get('aria-label', '')
        return '\n\n' + escape(label) + '\n\n' if label else ''
    if tag == 'svg':
        return ''
    if tag == 'br':
        return ' '
    if tag == 'img':
        alt, src = attrs.get('alt', ''), attrs.get('src', '')
        return f'\n\n![{escape(alt)}]({urljoin(canonical, src)})\n\n' if alt and src else ''
    if tag == 'source' and attrs.get('src'):
        label = 'Média' if lang == 'fr' else 'Media'
        return f'\n\n[{label}]({urljoin(canonical, attrs["src"])})\n\n'
    text = ''.join(markdown(child, canonical, lang) for child in node.children)
    if tag == 'a' and attrs.get('href') and text.strip():
        href = urljoin(canonical, attrs['href'])
        if href.startswith(('https://', 'http://', 'mailto:')):
            return f'[{text.strip()}]({href})'
    if tag in {'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}:
        return '\n\n' + '#' * int(tag[1]) + ' ' + re.sub(r'\s+', ' ', text).strip() + '\n\n'
    if tag == 'li':
        return '\n- ' + text.strip() + '\n'
    if tag == 'dt':
        return '\n**' + text.strip() + '**: '
    if tag == 'dd':
        return text.strip() + '\n'
    if tag in {'strong', 'b'} and text.strip():
        return '**' + text.strip() + '**'
    if tag in {'p', 'section', 'article', 'figure', 'figcaption', 'details', 'summary', 'ul', 'ol', 'dl', 'aside'}:
        return '\n\n' + text.strip() + '\n\n' if text.strip() else ''
    return text


def clean(text):
    text = re.sub(r'[ \t]{2,}', ' ', text)
    text = re.sub(r'[ \t]+\n', '\n', text)
    text = re.sub(r'\n[ \t]+', '\n', text)
    return re.sub(r'\n{3,}', '\n\n', text).strip() + '\n'


def generate(root, output, pages, languages, unlisted, catalogs, site_url, base_path):
    absolute = lambda path: site_url + base_path.rstrip('/') + path
    route = lambda page, lang: '/' + lang + '/' + pages[page][1][lang]
    public = [page for page in pages if page not in unlisted]
    manifest = {'version': 1, 'basePath': base_path, 'routes': {}, 'resources': {}, 'contentSignal': None}
    preferences = root / 'agent-preferences.json'
    if preferences.exists():
        policy = json.loads(preferences.read_text())
        if set(policy) != {'search', 'ai-input', 'ai-train'} or any(value not in {'yes', 'no'} for value in policy.values()):
            raise ValueError('agent-preferences.json must declare search, ai-input and ai-train as yes or no')
        manifest['contentSignal'] = ', '.join(f'{key}={policy[key]}' for key in ('search', 'ai-input', 'ai-train'))
        robots = output / 'robots.txt'
        robots.write_text(robots.read_text().replace('Allow: /\n', 'Allow: /\nContent-Signal: ' + manifest['contentSignal'] + '\n', 1))

    def add_route(path, md_path, lang):
        manifest['routes'][base_path.rstrip('/') + path] = {'markdown': base_path.rstrip('/') + md_path, 'language': lang}

    for lang in languages:
        messages = catalogs[lang]
        for page in public:
            path = route(page, lang)
            canonical = absolute(path)
            if page == 'home':
                body = '# Ramsey Hatoum\n\n' + messages['seo.homeDescription'] + '\n\n'
                body += ('## Projets\n\n' if lang == 'fr' else '## Projects\n\n')
                for project in public:
                    if project in {'home', 'about'}:
                        continue
                    title = messages[f'seo.{project}Title'].split(' — ')[0]
                    body += f'- [{title}]({absolute(route(project, lang))}): {messages[f"seo.{project}Description"]}\n'
                body += '\n## ' + ('À propos et contact' if lang == 'fr' else 'About and contact') + '\n\n'
                body += f'[{messages["seo.aboutTitle"]}]({absolute(route("about", lang))})\n\n'
                body += f'[CV]({absolute(messages["about.cvHref"])})\n'
            else:
                document = Document((output / (path.lstrip('/') + 'index.html')).read_text())
                main = find(document.root, 'main')
                if main is None:
                    raise ValueError('No main content for ' + path)
                body = markdown(main, canonical, lang)
            frontmatter = '\n'.join([
                '---', 'title: ' + json.dumps(messages[f'seo.{page}Title'], ensure_ascii=False),
                'description: ' + json.dumps(messages[f'seo.{page}Description'], ensure_ascii=False),
                'url: ' + json.dumps(canonical), 'language: ' + lang, '---', '',
            ])
            md_path = path + 'index.md'
            (output / md_path.lstrip('/')).write_text(frontmatter + '\n' + clean(body))
            add_route(path, md_path, lang)
            add_route(path + 'index.html', md_path, lang)
            manifest['resources'][base_path.rstrip('/') + md_path] = 'text/markdown; charset=utf-8'
            if lang == 'en' and page != 'home':
                alias = '/' + pages[page][0].removesuffix('index.html')
                add_route(alias, md_path, lang)
                add_route(alias + 'index.html', md_path, lang)

    # The neutral root remains English for agents; browsers retain their existing language entry.
    neutral = (output / 'en/index.md').read_text().replace(
        'url: ' + json.dumps(absolute('/en/')), 'url: ' + json.dumps(absolute('/')), 1)
    (output / 'index.md').write_text(neutral)
    add_route('/', '/index.md', 'en')
    add_route('/index.html', '/index.md', 'en')
    manifest['resources'][base_path + 'index.md'] = 'text/markdown; charset=utf-8'

    index = ['# Ramsey Hatoum', '', '> Public portfolio: apps, objects, research, and photography.', '',
             'English and French pages are authoritative. Use their Markdown alternatives for text access.', '',
             '## Portfolio', '']
    for lang in languages:
        for page in public:
            path = route(page, lang)
            index.append(f'- [{catalogs[lang][f"seo.{page}Title"]} ({lang})]({absolute(path + "index.md")}): {catalogs[lang][f"seo.{page}Description"]}')
    index += ['', '## CV', '']
    index += [f'- [CV ({lang})]({absolute(catalogs[lang]["about.cvHref"])})' for lang in languages]
    index += ['', '## Agent guidance', '', f'- [Read this portfolio]({absolute("/.well-known/agent-skills/read-ramsey-portfolio/SKILL.md")})', '']
    (output / 'llms.txt').write_text('\n'.join(index))

    skill_path = '/.well-known/agent-skills/read-ramsey-portfolio/SKILL.md'
    skill = (root / 'site' / skill_path.lstrip('/')).read_text().replace(
        'https://ramsey.page', site_url + base_path.rstrip('/')).encode('utf-8')
    (output / skill_path.lstrip('/')).write_bytes(skill)
    description = 'Read Ramsey Hatoum’s public portfolio, find relevant case studies, and locate his CV and published contact details in English or French.'
    skills = {'$schema': 'https://schemas.agentskills.io/discovery/0.2.0/schema.json', 'skills': [{
        'name': 'read-ramsey-portfolio', 'type': 'skill-md', 'description': description,
        'url': absolute(skill_path), 'digest': 'sha256:' + hashlib.sha256(skill).hexdigest(),
    }]}
    (output / '.well-known/agent-skills/index.json').write_text(json.dumps(skills, ensure_ascii=False, indent=2) + '\n')
    manifest['resources'].update({
        base_path + 'llms.txt': 'text/plain; charset=utf-8',
        base_path.rstrip('/') + skill_path: 'text/markdown; charset=utf-8',
        base_path + '.well-known/agent-skills/index.json': 'application/json; charset=utf-8',
        base_path + 'agent-content.json': 'application/json; charset=utf-8',
    })
    (output / 'agent-content.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'Generated {len(public) * len(languages) + 1} public Markdown pages, llms.txt, and the portfolio skill index')
