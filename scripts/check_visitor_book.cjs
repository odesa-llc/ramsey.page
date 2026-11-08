const assert = require('node:assert/strict');
const book = require('../site/visitor-book/reports.js');
// Date boundaries use the property timezone, including near midnight and DST.
const range = book.ranges('current', new Date('2026-11-06T23:30:00Z'));
assert.deepEqual(range, {startDate:'2026-10-31',endDate:'2026-11-06'});
assert.deepEqual(book.ranges('previous',new Date('2026-03-30T01:00:00Z')), {startDate:'2026-03-16',endDate:'2026-03-22'});
const requests = book.requests(range,{source:'instagram',medium:'social'});
assert.equal(requests.length,5);
assert.ok(requests.every(r=>JSON.stringify(r.dimensionFilter).includes('instagram')),'Every panel must use the same source filter');
assert.deepEqual(requests[4].dimensionFilter.andGroup.expressions[1].filter.inListFilter.values,['cv_click','contact_click']);
function report(dimensions,metrics,rows,metadata) {
  return {dimensionHeaders:dimensions.map(name=>({name})),metricHeaders:metrics.map(name=>({name})),
    rows:rows.map(([d,m])=>({dimensionValues:d.map(value=>({value})),metricValues:m.map(value=>({value:String(value)}))})),metadata};
}
const data=book.normalize([
  report([],['sessions','screenPageViews'],[[[],[8,19]]]),
  report(['date'],['sessions'],[[['20261101'],[8]]]),
  report(['sessionSource','sessionMedium'],['sessions'],[[['instagram','social'],[8]]]),
  report(['pagePath'],['screenPageViews'],[[['/en/restitch/'],[5]],[['/fr/restitch/'],[4]],[['/restitch/'],[1]],[['/fr/a-propos/'],[9]]]),
  report(['eventName'],['eventCount'],[[['contact_click'],[2]]],{subjectToThresholding:true})
],range);
assert.equal(data.days.length,7);
assert.equal(data.days[0].count,0,'Missing dates must be zero-filled');
assert.equal(data.days[1].count,8);
assert.deepEqual(data.pages,[{name:'Restitch',count:10},{name:'about me',count:9}],'English, French and legacy routes should combine');
assert.equal(data.cv,0); assert.equal(data.contact,2); assert.equal(data.sessions,8); assert.equal(data.views,19);
assert.equal(data.limited,true,'Do not hide Google reporting limitations');
assert.equal(book.normalize([{}, {}, {}, {}, {}],range).sessions,0,'Empty data is a valid state');
const grouped=book.groupSources([
  {source:'instagram',medium:'social',count:12},
  {source:'ig',medium:'social',count:3},
  {source:'l.instagram.com',medium:'referral',count:2},
  {source:'instagram',medium:'paid_social',count:1}
]);
const instagram=grouped.find(row=>row.medium==='social');
assert.equal(grouped.length,2,'Keep paid Instagram traffic separate');
assert.equal(instagram.members.length,3,'Group historical aliases without losing the original filter values');
assert.equal(book.sourceName(instagram),'Instagram');
assert.equal(book.sourceName(grouped.find(row=>row.medium==='paid')),'Instagram ads');
const combinedRequests=book.requests(range,instagram);
assert.ok(combinedRequests.every(r=>JSON.stringify(r.dimensionFilter).includes('l.instagram.com')),'Every panel must include every alias');
assert.equal(combinedRequests[0].dimensionFilter.orGroup.expressions.length,3);
assert.equal(combinedRequests[0].dimensionFilter.orGroup.expressions[0].andGroup.expressions[0].filter.stringFilter.caseSensitive,true,'Use the exact original values in filters');
assert.equal(book.sourceName({source:'(data not available)',medium:'(data not available)'}),'source unavailable');
assert.equal(book.sourceName({source:'(not set)',medium:'(not set)'}),'source not recorded');
assert.equal(book.sourceName({source:'(direct)',medium:'(none)'}),'direct / no referrer');
assert.equal(book.sourceName({source:'google',medium:'organic'}),'google search');
assert.equal(book.limited({rowCount:1001,rows:new Array(1000)}),true,'Truncated source lists must be flagged');

// Run the dashboard loader with Google responses, including an aggregate
// session count smaller than the sum of alias rows. Never inflate the total.
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
class Element {
  constructor(){this.children=[];this.handlers={};this.style={};this.dataset={};this.hidden=false;}
  append(...nodes){this.children.push(...nodes);}
  appendChild(node){this.children.push(node);if(node.onload)node.onload();}
  replaceChildren(...nodes){this.children=nodes;}
  addEventListener(name,handler){this.handlers[name]=handler;}
  setAttribute(){}
  querySelector(){return this.label || (this.label=new Element());}
}
(async function(){
  const ids=Object.fromEntries(['visit-total','date-label','days','dot-legend','busiest','views','cv','contact','sources','pages','source-filter','source-note','data-note','report','connection','disconnect','status','clear-filter','connect','sample-label'].map(id=>[id,new Element()]));
  const requests=[];
  const base=[
    report([],['sessions','screenPageViews'],[[[],[17,109]]]),
    report(['date'],['sessions'],[[['20261106'],[17]]]),
    report(['sessionSource','sessionMedium'],['sessions'],[[['instagram','social'],[12]],[['ig','social'],[3]],[['(not set)','(not set)'],[7]],[['(data not available)','(data not available)'],[1]],[['(direct)','(none)'],[1]]]),
    report(['pagePath'],['screenPageViews'],[[['/en/'],[109]]]),
    report(['eventName'],['eventCount'],[])
  ];
  let callback;
  const google={accounts:{oauth2:{initTokenClient(options){callback=options.callback;return {requestAccessToken(){callback({access_token:'test-token',expires_in:3600});}};},hasGrantedAllScopes(){return true;}}}};
  const context={URL,Intl,window:{VisitorReports:{...book,ranges:()=>range},google},google,
    location:new URL('https://ramsey.page/visitors/'),
    document:{currentScript:{src:'https://ramsey.page/visitor-book/book.js'},head:new Element(),getElementById:id=>ids[id],createElement:()=>new Element(),querySelectorAll:()=>[]},
    async fetch(url,options){
      if(!options || !options.body)return {ok:true,json:async()=>({propertyId:'562895025',clientId:'test.apps.googleusercontent.com'})};
      const batch=JSON.parse(options.body).requests;requests.push(batch);
      return {ok:true,json:async()=>({reports:batch.length===5?base:[report([],['sessions','screenPageViews'],[[[],[14,80]]])]})};
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../site/visitor-book/book.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  ids.connect.handlers.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ids.report.hidden,false);
  assert.equal(ids['visit-total'].textContent,'17','Keep the independent property total: '+ids.status.textContent);
  const instagramRow=ids.sources.children.find(row=>row.children[0].textContent==='Instagram');
  assert.equal(instagramRow.children[1].textContent,'14','Use the aggregate count, not 12 + 3');
  assert.equal(requests.length,2,'Fetch an aggregate for aliases after the source report');
  assert.equal(requests[1][0].dimensionFilter.orGroup.expressions.length,2);
  assert.equal(ids['source-note'].hidden,false);
  assert.match(ids['source-note'].textContent,/23 vs 17/,'Explain inconsistent sources without changing counts');
  instagramRow.handlers.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(requests[2].every(r=>JSON.stringify(r.dimensionFilter).includes('ig')),'Clicking the combined row must filter every panel by all aliases');
  console.log('Passed visitor-book dates, alias grouping, aggregate counts, source filters, placeholders, discrepancies, route grouping and reporting-limit checks.');
})().catch(error=>{console.error(error);process.exitCode=1;});
