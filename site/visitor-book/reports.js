/* Pure report definitions and formatting, shared by the page and checks. */
(function (root) {
  'use strict';
  function ranges(period, today) {
    var parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(today || new Date());
    var get = function (type) { return parts.find(function (p) { return p.type === type; }).value; };
    var end = new Date(get('year') + '-' + get('month') + '-' + get('day') + 'T12:00:00Z');
    end.setUTCDate(end.getUTCDate() - (period === 'previous' ? 8 : 1));
    var start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
    return {startDate: start.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10)};
  }
  function exact(field, value) { return {filter: {fieldName: field, stringFilter: {matchType: 'EXACT', value: value, caseSensitive: true}}}; }
  function sourceFilter(source) {
    var expressions = (source.members || [source]).map(function (member) {
      return {andGroup: {expressions: [exact('sessionSource', member.source), exact('sessionMedium', member.medium)]}};
    });
    return expressions.length === 1 ? expressions[0] : {orGroup: {expressions: expressions}};
  }
  function requests(range, source) {
    var selected = source ? sourceFilter(source) : null;
    function report(dimensions, metrics, extra) {
      var request = Object.assign({dateRanges: [range], dimensions: dimensions.map(function (name) { return {name: name}; }), metrics: metrics.map(function (name) { return {name: name}; }), limit: '1000'}, extra || {});
      if (selected) request.dimensionFilter = request.dimensionFilter ? {andGroup: {expressions: [selected, request.dimensionFilter]}} : selected;
      return request;
    }
    return [
      report([], ['sessions', 'screenPageViews']),
      report(['date'], ['sessions'], {orderBys: [{dimension: {dimensionName: 'date'}}]}),
      report(['sessionSource', 'sessionMedium'], ['sessions'], {orderBys: [{metric: {metricName: 'sessions'}, desc: true}]}),
      report(['pagePath'], ['screenPageViews'], {orderBys: [{metric: {metricName: 'screenPageViews'}, desc: true}]}),
      report(['eventName'], ['eventCount'], {dimensionFilter: {filter: {fieldName: 'eventName', inListFilter: {values: ['cv_click','contact_click']}}}})
    ];
  }
  function table(report) {
    return (report.rows || []).map(function (row) {
      var result = {};
      (report.dimensionHeaders || []).forEach(function (header, index) { result[header.name] = row.dimensionValues[index].value; });
      (report.metricHeaders || []).forEach(function (header, index) { result[header.name] = Number(row.metricValues[index].value) || 0; });
      return result;
    });
  }
  function pageName(path) {
    var route = path.replace(/^\/(en|fr)(?=\/)/, '').replace(/\/index\.html$/, '/');
    return {'/':'selected work','/about/':'about me','/a-propos/':'about me','/handbag/':'the handbag','/sac-fait-main/':'the handbag','/tidle/':'Tidle','/restitch/':'Restitch','/fuzz/':'breadboard fuzz','/beirut/':'Beirut, in passing','/beyrouth/':'Beirut, in passing','/role-management/':'airline roles','/gestion-des-roles/':'airline roles','/thinking-cap/':'Thinking Cap'}[route] || route;
  }
  function sourceIdentity(row) {
    var source = (row.source || '').trim().toLowerCase();
    var medium = (row.medium || '').trim().toLowerCase();
    if (/^(?:ig|instagram|(?:www\.|l\.|m\.)?instagram\.com)$/.test(source)) {
      source = 'instagram';
      medium = /^(?:cpc|ppc|paid_social|paid-social|paid|cpm|display)$/.test(medium) ? 'paid' : 'social';
    } else if (!source || source === '(not set)') {
      source = '(not set)'; medium = '';
    } else if (['(direct)','(data not available)','(other)'].indexOf(source) !== -1) {
      medium = '';
    }
    return {source: source, medium: medium};
  }
  function sourceName(row) {
    var identity = sourceIdentity(row), source = identity.source, medium = identity.medium;
    if (source === '(direct)') return 'direct / no referrer';
    if (!source || source === '(not set)') return 'source not recorded';
    if (source === '(data not available)') return 'source unavailable';
    if (source === '(other)') return 'other sources';
    if (source === 'instagram') return medium === 'paid' ? 'Instagram ads' : 'Instagram';
    if (medium === 'organic') return source + ' search';
    if (['cpc','ppc','paid_social','paid-social','paid','cpm','display'].indexOf(medium) !== -1) return source + ' ads';
    return source + (medium && ['(none)','(not set)','(data not available)','social','referral'].indexOf(medium) === -1 ? ' (' + medium + ')' : '');
  }
  function groupSources(rows) {
    var groups = new Map();
    rows.forEach(function (row) {
      var identity = sourceIdentity(row), id = JSON.stringify([identity.source, identity.medium]);
      if (!groups.has(id)) groups.set(id, {id: id, source: identity.source, medium: identity.medium, count: 0, members: []});
      var group = groups.get(id);
      group.count += row.count;
      group.members.push({source: row.source, medium: row.medium});
    });
    // Multi-member counts are replaced with an aggregate query before display:
    // summing distinct sessions across aliases could count a session twice.
    return Array.from(groups.values()).sort(function (a,b) { return b.count-a.count; });
  }
  function limited(report) {
    return Boolean((report.rowCount || 0) > (report.rows || []).length || report.metadata &&
      (report.metadata.subjectToThresholding || report.metadata.dataLossFromOtherRow || (report.metadata.samplingMetadatas || []).length));
  }
  function normalize(reports, range) {
    var totals = table(reports[0])[0] || {};
    var daily = table(reports[1]);
    var days = [];
    for (var d = new Date(range.startDate + 'T12:00:00Z'); d.toISOString().slice(0,10) <= range.endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      var iso = d.toISOString().slice(0,10), match = daily.find(function (row) { return row.date === iso.replace(/-/g,''); });
      days.push({date: iso, count: match ? match.sessions : 0});
    }
    var pages = new Map();
    table(reports[3]).forEach(function (row) { var name = pageName(row.pagePath); pages.set(name, (pages.get(name) || 0) + row.screenPageViews); });
    var events = table(reports[4]);
    var count = function (name) { return (events.find(function (row) { return row.eventName === name; }) || {}).eventCount || 0; };
    return {sessions: totals.sessions || 0, views: totals.screenPageViews || 0, days: days,
      sources: groupSources(table(reports[2]).map(function (row) { return {source: row.sessionSource, medium: row.sessionMedium, count: row.sessions}; })),
      pages: Array.from(pages, function (entry) { return {name: entry[0], count: entry[1]}; }).sort(function (a,b) { return b.count-a.count; }),
      cv: count('cv_click'), contact: count('contact_click'), limited: reports.some(limited)};
  }
  var api = {ranges: ranges, requests: requests, table: table, pageName: pageName, normalize: normalize, sourceName: sourceName, groupSources: groupSources, limited: limited};
  if (typeof module !== 'undefined') module.exports = api; else root.VisitorReports = api;
})(typeof window === 'undefined' ? this : window);
