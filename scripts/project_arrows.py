"""Use the About page's drawn arrow in localized project links."""
import re

ARROW_PATH = 'M5 19c4.6-4.4 9.2-9.4 14-14M8.5 5.3l10.7-.5-.4 10.6'
DIRECTIONS = {'↗': 'out', '→': 'right', '↓': 'down', '←': 'left',
              '↑': 'up', '↘': 'down-right', '↙': 'down-left', '↖': 'up-left'}
ARROW = re.compile('([' + ''.join(DIRECTIONS) + '])\ufe0f?')
LINK = re.compile(r'(<(?:a|button)\b[^>]*>)(.*?)(</(?:a|button)>)', re.S | re.I)


def project_link_arrows(source):
    def icon(match):
        direction = DIRECTIONS[match[1]]
        return (f'<span class="project-link-arrow project-link-arrow--{direction}" aria-hidden="true">'
                '<svg class="link-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
                'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" '
                f'stroke-linejoin="round" focusable="false"><path d="{ARROW_PATH}"/></svg></span>')

    def link(match):
        # Only visible text changes; preserve attributes, artwork and existing SVGs.
        parts = re.split(r'(<[^>]*>)', match[2])
        content = ''.join(part if i % 2 else ARROW.sub(icon, part)
                          for i, part in enumerate(parts))
        return match[1] + content + match[3]

    return LINK.sub(link, source)
