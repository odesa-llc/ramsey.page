/* Behavioral checks: automatic tracking, event counts, attribution and production scope. */
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
    document, location, URL, URLSearchParams, console,
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
  const click = kind => document.handlers.click && document.handlers.click({target: {closest(selector) {
    if (selector === '[data-copy-email], a[href^="mailto:"]' && kind === 'contact') return {};
    if (selector === 'a[href]' && kind === 'cv') return {href: 'https://ramsey.page/assets/ramsey-hatoum-product-design-resume.pdf'};
    if (selector === 'a[href]' && kind === 'other') return {href: 'https://example.com/anything.pdf'};
    return null;
  }}});
  return {context, document, storage, panel, reopen, actions, commands, events, click};
}

const visitor = fixture();
assert.equal(visitor.panel, undefined, 'No analytics panel may be created');
assert.equal(visitor.reopen, undefined, 'No analytics preferences button may be created');
assert.equal(visitor.document.body.children.length, 0);
assert.equal(visitor.document.head.children.length, 1, 'Tracking starts automatically');
assert.match(visitor.document.head.children[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-/);
assert.equal(visitor.events('page_view').length, 1);
visitor.click('cv'); visitor.click('contact'); visitor.click('other');
assert.equal(visitor.events('cv_click').length, 1);
assert.equal(visitor.events('contact_click').length, 1);
assert.equal(visitor.events('file_download').length, 0, 'Only one CV measurement convention is used');
const initialConfig = visitor.commands().find(item => item[0] === 'config')[2];
assert.equal(initialConfig.allow_google_signals, false);
assert.equal(initialConfig.allow_ad_personalization_signals, false);
assert.equal(initialConfig.send_page_view, false, 'The explicit pageview owns page tracking');
assert.equal(visitor.commands()[0][2].ad_storage, 'denied');
vm.runInNewContext(source, visitor.context);
assert.equal(visitor.document.head.children.length, 1, 'Repeated initialization must not load another tag');
assert.equal(visitor.events('page_view').length, 1, 'Repeated initialization must not duplicate a pageview');

const declined = fixture({saved: {value: 'denied', time: Date.now()}});
assert.equal(declined.document.head.children.length, 0, 'Keep an earlier explicit refusal');
assert.equal(declined.context.window['ga-disable-G-TEST123456'], true);
declined.click('contact');
assert.equal(declined.events('contact_click').length, 0);
assert.equal(fixture({saved: {value: 'granted', time: Date.now()}}).events('page_view').length, 1);
assert.equal(fixture({saved: {value: 'denied', time: Date.now() - 181 * 86400000}}).events('page_view').length, 1);
assert.equal(fixture({saved: {value: 'denied', time: Date.now() + 86400000}}).events('page_view').length, 1);
assert.equal(fixture({url: 'http://127.0.0.1:4185/en/'}).document.head.children.length, 0, 'Local previews must not be tracked');
assert.equal(fixture({storageBlocked: true}).events('page_view').length, 1, 'Blocked storage must not break the website');

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
assert.equal(fixture({referrer:'https://www.ramsey.page/en/'}).commands().find(item=>item[0]==='config')[2].page_referrer, '', 'Do not attribute internal navigation as an external referral');
for (const [sourceTag, mediumTag, expectedMedium] of [['ig','social','social'], ['IG','referral','social'], ['l.instagram.com','','social'], ['instagram','paid_social','paid_social']]) {
  const visit=fixture({url:'https://ramsey.page/en/?utm_source='+sourceTag+'&utm_medium='+mediumTag+'&utm_campaign=portfolio&utm_content=story'});
  const location=new URL(visit.commands().find(item=>item[0]==='config')[2].page_location);
  assert.equal(location.searchParams.get('utm_source'),'instagram');
  assert.equal(location.searchParams.get('utm_medium'),expectedMedium,'Preserve paid campaign attribution');
  assert.equal(location.searchParams.get('utm_content'),'story');
}

for (const language of ['en', 'fr']) {
  let target;
  vm.runInNewContext(entry, {
    URL, URLSearchParams,
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

// Exercise both redirects: Instagram shortcut -> language gateway -> page.
const shortcut=fs.readFileSync(path.join(root,'site/ig/index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
let gateway;
const shortcutLocation=new URL('https://ramsey.page/ig/?extra=private');
shortcutLocation.replace=value=>{gateway=new URL(value);};
vm.runInNewContext(shortcut,{URL,document:{referrer:'https://l.instagram.com/?private=value'},location:shortcutLocation});
let destination;
gateway.replace=value=>{destination=new URL(value,gateway);};
vm.runInNewContext(entry, {URL,URLSearchParams,document:{currentScript:{getAttribute:()=> '/'},referrer:'https://ramsey.page/ig/'},navigator:{languages:['fr']},location:gateway});
assert.equal(destination.pathname,'/fr/');
assert.equal(destination.searchParams.getAll('_portfolio_ref').length,1,'The redirect chain must not duplicate or replace the original referral');
const redirectedVisit=fixture({url:destination.href,referrer:gateway.href});
const redirectedConfig=redirectedVisit.commands().find(item=>item[0]==='config')[2];
assert.equal(redirectedConfig.page_referrer,'https://l.instagram.com');
assert.equal(new URL(redirectedConfig.page_location).searchParams.get('utm_source'),'instagram');
assert.equal(new URL(redirectedConfig.page_location).searchParams.get('utm_content'),'bio');
assert.equal(new URL(redirectedConfig.page_location).searchParams.has('extra'),false);

const settings = JSON.parse(fs.readFileSync(path.join(root, 'analytics.json'), 'utf8'));
if (settings.measurement_id && fs.existsSync(path.join(root, 'dist/index.html'))) {
  assert.equal(fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8').includes('portfolio:analytics'), false, 'The redirect must not emit a pageview');
  const paths = ['en', 'fr', 'en/about', 'fr/a-propos', 'en/handbag', 'fr/sac-fait-main', 'en/tidle', 'fr/tidle', 'en/restitch', 'fr/restitch', 'en/fuzz', 'fr/fuzz', 'en/beirut', 'fr/beyrouth', 'en/role-management', 'fr/gestion-des-roles', 'en/skull-cap', 'fr/skull-cap'];
  for (const route of paths) {
    const html = fs.readFileSync(path.join(root, 'dist', route, 'index.html'), 'utf8');
    assert.equal((html.match(/name="portfolio:analytics"/g) || []).length, 1, route);
    assert.equal((html.match(/src="[^"]*\/analytics\.js\?/g) || []).length, 1, route);
    assert.equal(html.includes('/analytics.css'), false, 'No consent-control styles are injected');
    assert.equal(html.includes('googletagmanager.com/gtag'), false, 'The analytics loader owns the Google tag');
  }
  assert.equal(fs.readFileSync(path.join(root,'dist/visitors/index.html'),'utf8').includes('portfolio:analytics'),false,'Checking private stats must not count as a site visit');
}
console.log('Passed automatic analytics, no controls, saved refusals, action counts, production scope, campaign/referral handoff and build checks.');
