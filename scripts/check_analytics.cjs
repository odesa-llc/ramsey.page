/* Behavioral checks: consent, event counts, attribution, and production scope. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'site/analytics.js'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'site/language-entry.js'), 'utf8');

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.handlers = {}; this.attributes = {}; }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, handler) { this.handlers[name] = handler; }
  focus() { this.focused = true; }
  click() { this.handlers.click(); }
}

function fixture({url = 'https://ramsey.page/en/about/', saved, referrer = '', storageBlocked = false} = {}) {
  const storage = new Map();
  if (saved) storage.set('ramsey.analytics.consent.v1', JSON.stringify(saved));
  const document = {
    head: new Element('head'), body: new Element('body'), handlers: {}, cookie: '', referrer,
    querySelector(selector) {
      if (selector === 'meta[name="portfolio:analytics"]') return {content: JSON.stringify({measurementId: 'G-TEST123456', hosts: ['ramsey.page', 'www.ramsey.page']})};
      if (selector === 'link[rel="canonical"]') return {href: 'https://ramsey.page/en/about/'};
      return null;
    },
    createElement(tag) { return new Element(tag); },
    addEventListener(name, handler) { this.handlers[name] = handler; }
  };
  const location = new URL(url);
  const context = {
    document, location, URL, console,
    window: {portfolioText: key => key},
    localStorage: {
      getItem(key) { if (storageBlocked) throw Error('blocked'); return storage.get(key) || null; },
      setItem(key, value) { if (storageBlocked) throw Error('blocked'); storage.set(key, value); }
    },
    history: {state: null, replaceState(state, title, url) { location.href = new URL(url, location).href; }}
  };
  vm.runInNewContext(source, context);
  const panel = document.body.children.find(child => child.id === 'portfolio-analytics-choice');
  const reopen = document.body.children.find(child => child.className === 'portfolio-analytics-reopen');
  const actions = panel && panel.children[2].children;
  const commands = () => Array.from(context.window.dataLayer || [], value => Array.from(value));
  const events = name => commands().filter(command => command[0] === 'event' && command[1] === name);
  const click = kind => document.handlers.click({target: {closest(selector) {
    if (selector === '[data-copy-email], a[href^="mailto:"]' && kind === 'contact') return {};
    if (selector === 'a[href]' && kind === 'cv') return {href: 'https://ramsey.page/assets/ramsey-hatoum-product-design-resume.pdf'};
    if (selector === 'a[href]' && kind === 'other') return {href: 'https://example.com/anything.pdf'};
    return null;
  }}});
  return {context, document, storage, panel, reopen, actions, commands, events, click};
}

const visitor = fixture();
assert.equal(visitor.panel.hidden, false);
assert.equal(visitor.document.head.children.length, 0, 'Google must not load before consent');
visitor.click('cv'); visitor.click('contact');
assert.equal(visitor.commands().length, 0, 'No actions are queued before consent');
visitor.actions[0].click();
assert.equal(visitor.document.head.children.length, 1);
assert.match(visitor.document.head.children[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-/);
assert.equal(visitor.events('page_view').length, 1);
visitor.click('cv'); visitor.click('contact'); visitor.click('other');
assert.equal(visitor.events('cv_click').length, 1);
assert.equal(visitor.events('contact_click').length, 1);
assert.equal(visitor.events('file_download').length, 0, 'Only one CV measurement convention is used');
assert.equal(visitor.commands().find(item => item[0] === 'config')[2].allow_google_signals, false);
visitor.reopen.click();
visitor.actions[1].click();
visitor.click('contact');
assert.equal(visitor.events('contact_click').length, 1, 'Revocation stops actions immediately');
assert.equal(visitor.context.window['ga-disable-G-TEST123456'], true);
visitor.reopen.click(); visitor.actions[0].click();
assert.equal(visitor.document.head.children.length, 1, 'Re-consenting must not load a second tag');
assert.equal(visitor.events('page_view').length, 1, 'Re-consenting must not duplicate a pageview');

const declined = fixture(); declined.actions[1].click();
assert.equal(declined.document.head.children.length, 0);
assert.equal(JSON.parse(declined.storage.get('ramsey.analytics.consent.v1')).value, 'denied');
assert.equal(fixture({saved: {value: 'denied', time: Date.now()}}).panel.hidden, true);
const returning = fixture({saved: {value: 'granted', time: Date.now()}});
assert.equal(returning.events('page_view').length, 1);
assert.equal(returning.panel.hidden, true);
assert.equal(fixture({saved: {value: 'granted', time: Date.now() - 181 * 86400000}}).document.head.children.length, 0);
assert.equal(fixture({saved: {value: 'granted', time: Date.now() + 86400000}}).document.head.children.length, 0);
assert.equal(fixture({url: 'http://127.0.0.1:4185/en/'}).panel, undefined, 'Local previews must not be tracked');
const blocked = fixture({storageBlocked: true}); blocked.actions[0].click();
assert.equal(blocked.events('page_view').length, 1, 'Blocked storage must not break the website');

const campaign = fixture({
  url: 'https://ramsey.page/fr/?utm_source=instagram&utm_medium=social&utm_campaign=portfolio&utm_content=bio&_portfolio_ref=https%3A%2F%2Fl.instagram.com&email=private%40example.com#private',
  saved: {value: 'granted', time: Date.now()},
  referrer: 'https://ramsey.page/'
});
const config = campaign.commands().find(item => item[0] === 'config')[2];
assert.equal(config.page_referrer, 'https://l.instagram.com');
assert.equal(new URL(config.page_location).searchParams.get('utm_content'), 'bio');
assert.equal(new URL(config.page_location).searchParams.has('email'), false);
assert.equal(new URL(config.page_location).searchParams.has('_portfolio_ref'), false);
assert.equal(new URL(config.page_location).hash, '');
assert.equal(campaign.context.location.search.includes('_portfolio_ref'), false);

for (const language of ['en', 'fr']) {
  let target;
  vm.runInNewContext(entry, {
    URL,
    document: {currentScript: {getAttribute: () => '/'}, referrer: 'https://www.google.com/search?q=private+terms'},
    navigator: {languages: [language]},
    location: {pathname: '/', origin: 'https://ramsey.page', search: '?utm_source=instagram&utm_medium=social&utm_campaign=portfolio&utm_content=bio', hash: '#work', replace(value) {target = value;}}
  });
  const redirected = new URL(target, 'https://ramsey.page');
  assert.equal(redirected.pathname, '/' + language + '/');
  assert.equal(redirected.searchParams.get('utm_content'), 'bio');
  assert.equal(redirected.searchParams.get('_portfolio_ref'), 'https://www.google.com');
  assert.equal(target.includes('private+terms'), false);
  assert.equal(redirected.hash, '#work');
}

const settings = JSON.parse(fs.readFileSync(path.join(root, 'analytics.json'), 'utf8'));
if (settings.measurement_id && fs.existsSync(path.join(root, 'dist/index.html'))) {
  assert.equal(fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8').includes('portfolio:analytics'), false, 'The redirect must not emit a pageview');
  const paths = ['en', 'fr', 'en/about', 'fr/a-propos', 'en/handbag', 'fr/sac-fait-main', 'en/tidle', 'fr/tidle', 'en/restitch', 'fr/restitch', 'en/fuzz', 'fr/fuzz', 'en/beirut', 'fr/beyrouth'];
  for (const route of paths) {
    const html = fs.readFileSync(path.join(root, 'dist', route, 'index.html'), 'utf8');
    assert.equal((html.match(/name="portfolio:analytics"/g) || []).length, 1, route);
    assert.equal((html.match(/src="[^"]*\/analytics\.js\?/g) || []).length, 1, route);
    assert.equal(html.includes('googletagmanager.com/gtag'), false, 'Consent-controlled loader owns the Google tag');
  }
}
console.log('Passed analytics consent, action counts, production scope, campaign/referral handoff and build checks.');
