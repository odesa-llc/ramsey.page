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
  function exact(field, value) { return {filter: {fieldName: field, stringFilter: {matchType: 'EXACT', value: value}}}; }
  function requests(range, source) {
    var sourceFilter = source ? {andGroup: {expressions: [exact('sessionSource', source.source), exact('sessionMedium', source.medium)]}} : null;
    function report(dimensions, metrics, extra) {
      var request = Object.assign({dateRanges: [range], dimensions: dimensions.map(function (name) { return {name: name}; }), metrics: metrics.map(function (name) { return {name: name}; }), limit: '1000'}, extra || {});
      if (sourceFilter) request.dimensionFilter = request.dimensionFilter ? {andGroup: {expressions: [sourceFilter, request.dimensionFilter]}} : sourceFilter;
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
    return {'/':'selected work','/about/':'about me','/a-propos/':'about me','/handbag/':'the handbag','/sac-fait-main/':'the handbag','/tidle/':'Tidle','/restitch/':'Restitch','/fuzz/':'breadboard fuzz','/beirut/':'Beirut, in passing','/beyrouth/':'Beirut, in passing'}[route] || route;
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
      sources: table(reports[2]).map(function (row) { return {source: row.sessionSource, medium: row.sessionMedium, count: row.sessions}; }),
      pages: Array.from(pages, function (entry) { return {name: entry[0], count: entry[1]}; }).sort(function (a,b) { return b.count-a.count; }),
      cv: count('cv_click'), contact: count('contact_click'), limited: reports.some(function (report) { return report.metadata && (report.metadata.subjectToThresholding || report.metadata.dataLossFromOtherRow || (report.metadata.samplingMetadatas || []).length); })};
  }
  var api = {ranges: ranges, requests: requests, table: table, pageName: pageName, normalize: normalize};
  if (typeof module !== 'undefined') module.exports = api; else root.VisitorReports = api;
})(typeof window === 'undefined' ? this : window);
