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
console.log('Passed visitor-book timezone, filtering, route grouping, empty-data and reporting-limit checks.');
