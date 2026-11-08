(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var reports = window.VisitorReports;
  var preview = new URL(location.href).searchParams.get('preview') === '1';
  var config, token = '', expires = 0, client, period = 'current', selectedSource = null, revision = 0;
  var format = new Intl.NumberFormat('en');
  var configUrl = new URL('config.json', document.currentScript.src);
  function status(text) { $('status').textContent = text; }
  function text(tag, value, className) { var node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; }
  var sourceName = reports.sourceName;
  function render(data, range) {
    $('visit-total').textContent = format.format(data.sessions);
    var displayDate = function (date) { return new Intl.DateTimeFormat('en', {timeZone:'UTC', month:'short', day:'numeric'}).format(new Date(date + 'T12:00:00Z')); };
    $('date-label').textContent = displayDate(range.startDate) + ' – ' + displayDate(range.endDate) + ' · Paris time';
    $('days').replaceChildren();
    var max = Math.max.apply(null, data.days.map(function (day) { return day.count; }).concat([0]));
    var unit = Math.max(1, Math.ceil(max / 12));
    var chartLabels = [];
    data.days.forEach(function (day) {
      var date = new Date(day.date + 'T12:00:00Z');
      var label = new Intl.DateTimeFormat('en', {weekday:'short',timeZone:'UTC'}).format(date).toLowerCase();
      var column = text('div','', 'visitor-day'), stack = text('div','', 'visitor-stack');
      for (var i=0; i<Math.ceil(day.count/unit); i++) { var dot=text('span','', 'visitor-dot'); dot.setAttribute('aria-hidden','true'); stack.appendChild(dot); }
      column.append(stack,text('div',label),text('div',format.format(day.count),'visitor-count'));
      $('days').appendChild(column); chartLabels.push(displayDate(day.date) + ': ' + day.count + ' visits');
    });
    $('days').setAttribute('aria-label', chartLabels.join('; '));
    $('dot-legend').textContent = unit === 1 ? 'one mark for each visit' : 'each mark represents up to ' + format.format(unit) + ' visits';
    $('busiest').textContent = max ? format.format(max) + ' visits on ' + displayDate(data.days.find(function (day) { return day.count === max; }).date) + '.' : 'A quiet week so far.';
    $('views').textContent = format.format(data.views); $('cv').textContent = format.format(data.cv); $('contact').textContent = format.format(data.contact);
    $('sources').replaceChildren();
    data.sources.slice(0,8).forEach(function (row) {
      var button = text('button','', 'source-row'); button.type = 'button';
      button.append(text('span',sourceName(row)),text('span',format.format(row.count)));
      button.title = row.members.map(function (member) { return member.source + ' / ' + member.medium; }).join('; ');
      button.addEventListener('click', function () { selectedSource = row; load(); }); $('sources').appendChild(button);
    });
    if (!data.sources.length) $('sources').appendChild(text('p','No recorded visits yet.'));
    $('pages').replaceChildren();
    data.pages.slice(0,5).forEach(function (row) {
      var line=text('div','', 'page-row'), bar=text('span','', 'bar'); bar.setAttribute('aria-hidden','true');
      bar.style.width = (30*row.count/(data.pages[0].count || 1)) + '%';
      line.append(text('span',row.name),bar,text('span',format.format(row.count))); $('pages').appendChild(line);
    });
    if (!data.pages.length) $('pages').appendChild(text('p','Project views will appear here.'));
    $('source-filter').hidden = !selectedSource;
    $('source-filter').querySelector('span').textContent = selectedSource ? 'from ' + sourceName(selectedSource) : '';
    var sourceTotal = data.sources.reduce(function (sum, row) { return sum + row.count; }, 0);
    $('source-note').hidden = sourceTotal === data.sessions;
    $('source-note').textContent = sourceTotal === data.sessions ? '' : 'Source counts differ from total visits (' + format.format(sourceTotal) + ' vs ' + format.format(data.sessions) + '). Treat this breakdown as provisional.';
    $('data-note').textContent = preview ? 'Sample data only. No live reports or Google connection.' : 'GA4 · visits are sessions, including repeat visits · reports can take 24–48 hours to settle.' + (data.limited ? ' Some results are limited, truncated or sampled by Google.' : '') + (data.sources.some(function (row) { return row.source === '(not set)' || row.source === '(data not available)'; }) ? ' Missing source information cannot always be recovered.' : '');
    $('report').hidden=false;
  }
  function demo(range) {
    var counts = period === 'previous' ? [2,4,3,5,2,5,3] : [3,5,2,8,4,6,4];
    var sources = reports.groupSources([{source:'(direct)',medium:'(none)',count:period==='previous'?14:18},{source:'instagram',medium:'social',count:period==='previous'?6:9},{source:'google',medium:'organic',count:period==='previous'?4:5}]);
    var total = counts.reduce(function (a,b) { return a+b; },0), selected = selectedSource && sources.find(function (row) { return row.id===selectedSource.id; });
    var ratio = selected ? selected.count/total : 1;
    counts=counts.map(function (count) { return Math.floor(count*ratio); });
    for (var extra=(selected?selected.count:total)-counts.reduce(function (a,b) { return a+b; },0), i=0; i<extra; i++) counts[i%7]++;
    return {sessions:counts.reduce(function (a,b) { return a+b; },0),views:Math.round(59*ratio),cv:Math.round(4*ratio),contact:Math.round(2*ratio),
      days:counts.map(function (count,index) { var date=new Date(range.startDate+'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+index); return {date:date.toISOString().slice(0,10),count:count}; }),
      sources:selected ? [selected] : sources,
      pages:[{name:'selected work',count:Math.round(28*ratio)},{name:'Tidle',count:Math.round(13*ratio)},{name:'Restitch',count:Math.round(11*ratio)},{name:'about me',count:Math.round(7*ratio)}]};
  }
  async function fetchReports(requests, version) {
    var response=await fetch('https://analyticsdata.googleapis.com/v1beta/properties/'+config.propertyId+':batchRunReports',{
      method:'POST',credentials:'omit',cache:'no-store',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({requests:requests})
    });
    if (version!==revision) return null;
    if (!response.ok) {
      if (response.status===401) { token=''; expires=0; $('connection').hidden=false; $('disconnect').hidden=true; throw Error('Your connection expired. Connect again to refresh.'); }
      if (response.status===403) throw Error('Google could not read this property. Use an account with access to ramsey.page and enable the Analytics Data API.');
      if (response.status===429) throw Error('Google is busy. Try again in a minute.');
      throw Error('The reports could not load. Try connecting again.');
    }
    var result=await response.json();
    if (!result.reports || result.reports.length!==requests.length) throw Error('Google returned an incomplete report. Try again.');
    return result.reports;
  }
  async function load() {
    var version=++revision, range=reports.ranges(period);
    if (preview) { render(demo(range),range); return; }
    if (!token || Date.now()>=expires) { token=''; $('report').hidden=true; $('connection').hidden=false; $('disconnect').hidden=true; status('Connect your Google account to read your reports.'); return; }
    $('report').hidden=true; status('Turning the pages…');
    try {
      var result=await fetchReports(reports.requests(range,selectedSource),version);
      if (version!==revision) return;
      var data=reports.normalize(result,range);
      var grouped=data.sources.filter(function (row) { return row.members.length>1; });
      for (var i=0; i<grouped.length; i+=5) {
        var batch=grouped.slice(i,i+5);
        var counts=await fetchReports(batch.map(function (row) { return reports.requests(range,row)[0]; }),version);
        if (version!==revision) return;
        counts.forEach(function (report,index) {
          batch[index].count=(reports.table(report)[0] || {}).sessions || 0;
          data.limited=data.limited || reports.limited(report);
        });
      }
      data.sources.sort(function (a,b) { return b.count-a.count; });
      render(data,range); status('');
    } catch (error) { if (version===revision) status(error.message); }
  }
  $('clear-filter').addEventListener('click',function () { selectedSource=null; load(); });
  document.querySelectorAll('[data-period]').forEach(function (button) {
    button.addEventListener('click',function () {
      period=button.dataset.period;
      document.querySelectorAll('[data-period]').forEach(function (item) { item.setAttribute('aria-pressed',String(item===button)); }); load();
    });
  });
  $('disconnect').addEventListener('click',function () {
    var previousToken=token; token=''; expires=0; revision++; selectedSource=null;
    $('report').hidden=true; $('connection').hidden=false; $('disconnect').hidden=true; $('visit-total').textContent='—'; $('source-filter').hidden=true;
    ['days','sources','pages'].forEach(function (id) { $(id).replaceChildren(); });
    ['views','cv','contact'].forEach(function (id) { $(id).textContent='—'; });
    // Revoke this browser's grant, then discard the token. No token is persisted.
    if (previousToken && window.google) google.accounts.oauth2.revoke(previousToken,function () {});
    status('Disconnected.');
  });
  if (preview) { $('sample-label').hidden=false; $('connection').hidden=true; status(''); load(); return; }
  $('connect').disabled=true;
  fetch(configUrl,{cache:'no-store'}).then(function (response) { if (!response.ok) throw Error(); return response.json(); }).then(function (settings) {
    config=settings;
    if (!/^\d+$/.test(config.propertyId) || !/^[\w-]+\.apps\.googleusercontent\.com$/.test(config.clientId)) {
      status('Site stats is ready. The private Google connection is awaiting setup.'); return;
    }
    var script=document.createElement('script'); script.src='https://accounts.google.com/gsi/client'; script.async=true;
    script.onerror=function () { status('Google could not load. Check your connection or content blocker.'); };
    script.onload=function () {
      client=google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope:'https://www.googleapis.com/auth/analytics.readonly',include_granted_scopes:false,
        callback:function (response) {
          if (response.error || !response.access_token || !google.accounts.oauth2.hasGrantedAllScopes(response,'https://www.googleapis.com/auth/analytics.readonly')) { status('Read access was not granted. Your reports remain private.'); return; }
          token=response.access_token; expires=Date.now()+(Number(response.expires_in)-60)*1000;
          $('connection').hidden=true; $('disconnect').hidden=false; load();
        },error_callback:function () { status('The Google connection was closed. You can try again.'); }
      }); $('connect').disabled=false;
    }; document.head.appendChild(script);
  }).catch(function () { status('The connection settings could not load. Refresh to try again.'); });
  $('connect').addEventListener('click',function () { if (client) client.requestAccessToken({prompt:token ? '' : 'select_account'}); });
})();
