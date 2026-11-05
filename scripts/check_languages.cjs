const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../site/language-entry.js'), 'utf8');

function route(pathname, languages, language = 'en', base = '/') {
  let destination = null;
  const context = {
    document: {currentScript: {getAttribute: () => base}},
    navigator: {languages, language},
    location: {pathname, search: '?ref=portfolio', hash: '#projects', replace: value => {destination = value;}}
  };
  vm.runInNewContext(source, context);
  return destination;
}
assert.equal(route('/', ['fr-FR', 'en']), '/fr/?ref=portfolio#projects');
assert.equal(route('/', ['en-US', 'fr']), '/en/?ref=portfolio#projects');
assert.equal(route('/', ['de-DE', 'fr-CA', 'en']), '/fr/?ref=portfolio#projects');
assert.equal(route('/', ['de', 'es']), '/en/?ref=portfolio#projects');
assert.equal(route('/', [], 'fr-BE'), '/fr/?ref=portfolio#projects');
assert.equal(route('/', undefined, undefined), '/en/?ref=portfolio#projects');
assert.equal(route('/index.html', ['FR-ca']), '/fr/?ref=portfolio#projects');
assert.equal(route('/en/', ['fr']), null);
assert.equal(route('/fr/tidle/', ['en']), null);
assert.equal(route('/tidle/', ['fr']), null);
assert.equal(route('/ramsey.page/', ['fr'], 'en', '/ramsey.page/'), '/ramsey.page/fr/?ref=portfolio#projects');
assert.equal(route('/ramsey.page/fr/', ['en'], 'en', '/ramsey.page/'), null);
assert.equal(route('/elsewhere/', ['fr'], 'en', '/ramsey.page/'), null);

// Exercise the actual formatter with both catalog payloads and live counters.
const formatter = fs.readFileSync(path.join(__dirname, '../site/i18n.js'), 'utf8');
for (const locale of ['en', 'fr']) {
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, `../locales/${locale}.json`), 'utf8'));
  const messages = {};
  for (const [group, entries] of Object.entries(catalog)) {
    for (const [key, value] of Object.entries(entries)) messages[`${group}.${key}`] = value;
  }
  const context = {document: {getElementById: () => ({textContent: JSON.stringify(messages)})}, window: {}};
  vm.runInNewContext(formatter, context);
  const t = context.window.portfolioText;
  assert.equal(t('runtime.done', {done: 3, total: 8}), locale === 'fr' ? '3 sur 8' : 'Done 3 of 8');
  assert.equal(t('runtime.filteredOne', {count: 1, category: t('home.objects')}), locale === 'fr' ? '1 projet affiché dans « objets ».' : 'Showing 1 project in objects.');
  assert.throws(() => t('missing.key'), /Missing portfolio message/);
}
const previewContext = {window: {}, document: {getElementById: () => null}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../site/i18n-preview.js'), 'utf8'), previewContext);
vm.runInNewContext(formatter, previewContext);
assert.equal(previewContext.window.portfolioText('runtime.done', {done: 1, total: 8}), 'Done 1 of 8');
console.log('Passed 13 entry-routing cases and English/French runtime-message checks.');

// Test the deployed script too: URL rewriting must preserve its separators.
const builtEntry = path.join(__dirname, '../dist/language-entry.js');
if (fs.existsSync(builtEntry)) {
  const builtSource = fs.readFileSync(builtEntry, 'utf8');
  const builtHtml = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  const base = builtHtml.match(/data-base-path="([^"]+)"/)[1];
  for (const language of ['en', 'fr']) {
    let destination;
    const context = {
      document: {currentScript: {getAttribute: () => base}},
      navigator: {languages: [language + '-FR']},
      location: {pathname: base, search: '?ref=portfolio', hash: '#projects', replace: value => {destination = value;}}
    };
    vm.runInNewContext(builtSource, context);
    assert.equal(destination, base + language + '/?ref=portfolio#projects');
  }
  console.log('Passed built English/French entry redirects at ' + base);
}
