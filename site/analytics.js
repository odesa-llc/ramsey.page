/* Optional GA4: one pageview and two intentional actions, after consent. */
(function () {
  'use strict';
  var settings = document.querySelector('meta[name="portfolio:analytics"]');
  if (!settings) return;
  var config;
  try { config = JSON.parse(settings.content); } catch (_) { return; }
  if (!/^G-[A-Z0-9]{6,}$/.test(config.measurementId || '') ||
      !config.hosts || config.hosts.indexOf(location.hostname) === -1) return;

  var key = 'ramsey.analytics.consent.v1';
  var lifetime = 180 * 24 * 60 * 60 * 1000;
  var choice = null;
  var initialized = false;
  var pageviewSent = false;
  var measurementId = config.measurementId;
  var t = window.portfolioText;
  if (typeof t !== 'function') return;

  try {
    var saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && (saved.value === 'granted' || saved.value === 'denied') &&
        Number.isFinite(saved.time) && Date.now() - saved.time >= 0 && Date.now() - saved.time < lifetime) {
      choice = saved.value;
    }
  } catch (_) { /* A blocked storage preference does not break the page. */ }

  function origin(value) {
    try {
      var parsed = new URL(value);
      return /^https?:$/.test(parsed.protocol) ? parsed.origin : '';
    } catch (_) { return ''; }
  }

  var current = new URL(location.href);
  var incomingReferrer = origin(current.searchParams.get('_portfolio_ref')) || origin(document.referrer);
  if (current.searchParams.has('_portfolio_ref')) {
    current.searchParams.delete('_portfolio_ref');
    history.replaceState(history.state, '', current.pathname + current.search + current.hash);
  }
  var reportedLocation = new URL(current.href);
  var campaignFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_id', 'utm_term', 'utm_source_platform'];
  Array.from(reportedLocation.searchParams.keys()).forEach(function (name) {
    if (campaignFields.indexOf(name) === -1) reportedLocation.searchParams.delete(name);
  });
  reportedLocation.hash = '';
  var canonical = document.querySelector('link[rel="canonical"]');
  var canonicalPath = canonical ? new URL(canonical.href).pathname : current.pathname;
  var contentGroup = /\/(?:en|fr)\/$/.test(canonicalPath) ? 'home' :
    /\/(?:about|a-propos)\/$/.test(canonicalPath) ? 'about' : 'project';

  function command() { window.dataLayer.push(arguments); }

  function start() {
    window['ga-disable-' + measurementId] = false;
    if (!initialized) {
      initialized = true;
      window.dataLayer = window.dataLayer || [];
      command('consent', 'default', {
        analytics_storage: 'denied', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied'
      });
      command('consent', 'update', {analytics_storage: 'granted'});
      command('js', new Date());
      command('config', measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: reportedLocation.href,
        page_referrer: incomingReferrer,
        content_group: contentGroup
      });
      var script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
      document.head.appendChild(script);
    } else {
      command('consent', 'update', {analytics_storage: 'granted'});
    }
    if (!pageviewSent) {
      pageviewSent = true;
      command('event', 'page_view', {send_to: measurementId});
    }
  }

  function stop() {
    window['ga-disable-' + measurementId] = true;
    if (initialized) command('consent', 'update', {analytics_storage: 'denied'});
    document.cookie.split(';').forEach(function (item) {
      var name = item.split('=')[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) return;
      ['', location.hostname, '.' + location.hostname, '.ramsey.page'].forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax' + (domain ? '; domain=' + domain : '');
      });
    });
  }

  var panel = document.createElement('section');
  panel.className = 'portfolio-analytics-choice';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', t('analytics.title'));
  var heading = document.createElement('strong');
  heading.textContent = t('analytics.title');
  var description = document.createElement('p');
  description.textContent = t('analytics.description');
  var actions = document.createElement('div');
  actions.className = 'portfolio-analytics-actions';
  var allow = document.createElement('button');
  allow.type = 'button'; allow.textContent = t('analytics.allow');
  var decline = document.createElement('button');
  decline.type = 'button'; decline.textContent = t('analytics.decline');
  actions.appendChild(allow); actions.appendChild(decline);
  panel.appendChild(heading); panel.appendChild(description); panel.appendChild(actions);

  var reopen = document.createElement('button');
  reopen.type = 'button'; reopen.className = 'portfolio-analytics-reopen';
  reopen.textContent = t('analytics.choices');
  reopen.setAttribute('aria-expanded', 'false');
  panel.id = 'portfolio-analytics-choice'; reopen.setAttribute('aria-controls', panel.id);
  panel.hidden = choice !== null;
  document.body.appendChild(panel); document.body.appendChild(reopen);

  function select(value) {
    choice = value;
    try { localStorage.setItem(key, JSON.stringify({value: value, time: Date.now()})); } catch (_) {}
    if (value === 'granted') start(); else stop();
    panel.hidden = true; reopen.setAttribute('aria-expanded', 'false');
  }
  allow.addEventListener('click', function () { select('granted'); });
  decline.addEventListener('click', function () { select('denied'); });
  reopen.addEventListener('click', function () {
    panel.hidden = !panel.hidden;
    reopen.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) decline.focus();
  });

  document.addEventListener('click', function (event) {
    if (choice !== 'granted' || !initialized) return;
    var element = event.target && event.target.closest ? event.target : null;
    if (!element) return;
    var contact = element.closest('[data-copy-email], a[href^="mailto:"]');
    if (contact) {
      command('event', 'contact_click', {send_to: measurementId});
      return;
    }
    var link = element.closest('a[href]');
    if (!link) return;
    var destination;
    try { destination = new URL(link.href, location.href); } catch (_) { return; }
    if (destination.origin === location.origin &&
        /\/assets\/ramsey-hatoum-product-design-resume(?:-[a-z]{2})?\.pdf$/i.test(destination.pathname)) {
      command('event', 'cv_click', {send_to: measurementId});
    }
  });
  if (choice === 'granted') start();
  else window['ga-disable-' + measurementId] = true;
})();
