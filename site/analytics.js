/* Production GA4: one pageview and two intentional actions; no consent UI. */
(function () {
  'use strict';
  var settings = document.querySelector('meta[name="portfolio:analytics"]');
  if (!settings) return;
  var config;
  try { config = JSON.parse(settings.content); } catch (_) { return; }
  if (!/^G-[A-Z0-9]{6,}$/.test(config.measurementId || '') ||
      !config.hosts || config.hosts.indexOf(location.hostname) === -1 ||
      window.portfolioAnalyticsInitialized) return;
  window.portfolioAnalyticsInitialized = true;

  var measurementId = config.measurementId;

  function externalOrigin(value) {
    try {
      var parsed = new URL(value);
      return /^https?:$/.test(parsed.protocol) && config.hosts.indexOf(parsed.hostname) === -1 ? parsed.origin : '';
    } catch (_) { return ''; }
  }

  var current = new URL(location.href);
  var incomingReferrer = externalOrigin(current.searchParams.get('_portfolio_ref')) || externalOrigin(document.referrer);
  if (current.searchParams.has('_portfolio_ref')) {
    current.searchParams.delete('_portfolio_ref');
    history.replaceState(history.state, '', current.pathname + current.search + current.hash);
  }
  // Keep earlier explicit refusals until their original 180-day expiry.
  // Removing the controls must not silently reverse a visitor's saved choice.
  try {
    var saved = JSON.parse(localStorage.getItem('ramsey.analytics.consent.v1') || 'null');
    var age = saved && Date.now() - saved.time;
    if (saved && saved.value === 'denied' && Number.isFinite(saved.time) && age >= 0 && age < 180 * 86400000) {
      window['ga-disable-' + measurementId] = true;
      return;
    }
  } catch (_) { /* Unavailable storage does not break the site or its analytics. */ }

  var reportedLocation = new URL(current.href);
  var campaignFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_id', 'utm_term', 'utm_source_platform'];
  Array.from(reportedLocation.searchParams.keys()).forEach(function (name) {
    if (campaignFields.indexOf(name) === -1) reportedLocation.searchParams.delete(name);
  });
  reportedLocation.hash = '';
  var source = (reportedLocation.searchParams.get('utm_source') || '').trim().toLowerCase();
  var medium = (reportedLocation.searchParams.get('utm_medium') || '').trim().toLowerCase();
  if (/^(?:ig|instagram|(?:www\.|l\.|m\.)?instagram\.com)$/.test(source)) {
    reportedLocation.searchParams.set('utm_source', 'instagram');
    if (!medium || /^(?:social|referral|social[-_ ](?:media|network)|sm)$/.test(medium)) {
      reportedLocation.searchParams.set('utm_medium', 'social');
    } else {
      reportedLocation.searchParams.set('utm_medium', medium);
    }
  }
  var canonical = document.querySelector('link[rel="canonical"]');
  var canonicalPath = canonical ? new URL(canonical.href).pathname : current.pathname;
  var contentGroup = /\/(?:en|fr)\/$/.test(canonicalPath) ? 'home' :
    /\/(?:about|a-propos)\/$/.test(canonicalPath) ? 'about' : 'project';

  window['ga-disable-' + measurementId] = false;
  window.dataLayer = window.dataLayer || [];
  function command() { window.dataLayer.push(arguments); }
  // Advertising storage and personalization remain disabled.
  command('consent', 'default', {ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'});
  command('js', new Date());
  command('config', measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: reportedLocation.href,
    page_referrer: incomingReferrer,
    content_group: contentGroup
  });
  command('event', 'page_view', {send_to: measurementId});
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
  document.head.appendChild(script);

  document.addEventListener('click', function (event) {
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
})();
