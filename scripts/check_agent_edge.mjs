import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {handleRequest, prefersMarkdown} from '../edge/agent-readiness.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)), process.argv[2] || 'dist');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'agent-content.json'), 'utf8'));
const base = manifest.basePath;
const origin = 'https://ramsey.page';
let calls = [];
let missingMarkdown = false;
const originalHeaders = {'Content-Type': 'text/html', 'Vary': 'Accept-Encoding', 'Content-Security-Policy': "default-src 'self'"};

async function originFetch(request) {
  calls.push(request);
  const url = new URL(request.url);
  if (missingMarkdown && url.pathname.endsWith('.md')) return new Response('Not found', {status: 404});
  let relative = decodeURIComponent(url.pathname.slice(base.length));
  if (relative === '' || relative.endsWith('/')) relative += 'index.html';
  if (!url.pathname.startsWith(base) || relative.split('/').includes('..')) return new Response('Not found', {status: 404});
  try {
    const body = await fs.readFile(path.join(root, relative));
    return new Response(request.method === 'HEAD' ? null : body, {headers: originalHeaders});
  } catch {
    return new Response('Not found', {status: 404});
  }
}

for (const [header, expected] of [
  ['', false], ['*/*', false], ['text/*', false], ['text/html', false],
  ['text/markdown', true], ['text/markdown;q=0', false],
  ['text/markdown;q=.7,text/html;q=1', false],
  ['text/markdown;q=.9,text/html;q=.2', true],
  ['text/markdown;q=.5,*/*;q=1', false],
  ['text/markdown;q=invalid', false], ['TEXT/MARKDOWN', true],
]) assert.equal(prefersMarkdown(header), expected, header);

for (const [route, page] of Object.entries(manifest.routes)) {
  const request = new Request(origin + route + '?utm_source=check', {
    headers: {Accept: 'text/markdown', Cookie: 'private=keep-at-origin', 'If-None-Match': 'html-version', Range: 'bytes=0-20'},
  });
  const response = await handleRequest(request, originFetch, base);
  assert.equal(response.status, 200, route);
  assert.match(response.headers.get('Content-Type'), /^text\/markdown/);
  assert.equal(response.headers.get('Content-Language'), page.language);
  assert.match(response.headers.get('Vary'), /Accept-Encoding, Accept/);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-cache');
  assert.equal(response.headers.get('Content-Security-Policy'), originalHeaders['Content-Security-Policy']);
  assert.match(response.headers.get('Link'), /rel="alternate"; type="text\/markdown"/);
  assert.equal(await response.text(), await fs.readFile(path.join(root, page.markdown.slice(base.length)), 'utf8'));
  const internal = calls.at(-1);
  assert.equal(calls.at(-2).redirect, 'manual', 'manifest reads must use a Workers-supported redirect mode');
  assert.equal(internal.redirect, 'manual', 'Markdown reads must use a Workers-supported redirect mode');
  assert.equal(new URL(internal.url).search, '');
  for (const header of ['Cookie', 'Range', 'If-None-Match']) assert.equal(internal.headers.get(header), null);
  const html = await handleRequest(new Request(origin + route, {headers: {Accept: 'text/html,*/*;q=.8'}}), originFetch, base);
  assert.match(html.headers.get('Content-Type'), /^text\/html/);
  assert.match(await html.text(), /<!doctype html>/i);
  const head = await handleRequest(new Request(origin + route, {method: 'HEAD', headers: {Accept: 'text/markdown'}}), originFetch, base);
  assert.match(head.headers.get('Content-Type'), /^text\/markdown/);
  assert.equal(await head.text(), '');
}

const home = origin + base;
missingMarkdown = true;
const fallback = await handleRequest(new Request(home, {headers: {Accept: 'text/markdown'}}), originFetch, base);
assert.match(fallback.headers.get('Content-Type'), /^text\/html/);
missingMarkdown = false;

for (const [resource, type] of Object.entries(manifest.resources)) {
  const response = await handleRequest(new Request(origin + resource), originFetch, base);
  assert.equal(response.headers.get('Content-Type'), type);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('Content-Signal'), manifest.contentSignal);
}
for (const route of ['visitors/', 'visitor-book/', 'en/skull-cap/', 'concepts/tile-layout-1.html', 'unknown/']) {
  const response = await handleRequest(new Request(origin + base + route, {headers: {Accept: 'text/markdown'}}), originFetch, base);
  assert.equal(response.headers.get('Link'), null, route);
}
calls = [];
await handleRequest(new Request(home, {method: 'POST', body: 'unchanged'}), originFetch, base);
assert.equal(calls.length, 1);
assert.equal(calls[0].method, 'POST');
const offlineManifest = async request => new URL(request.url).pathname.endsWith('agent-content.json')
  ? new Response('Unavailable', {status: 503}) : originFetch(request);
const failOpen = await handleRequest(new Request(home), offlineManifest, base);
assert.match(await failOpen.text(), /<!doctype html>/i);
for (const target of ['agent-content.json', '.md']) {
  const redirectingOrigin = async request => new URL(request.url).pathname.endsWith(target)
    ? new Response(null, {status: 302, headers: {Location: 'https://example.com/unexpected'}}) : originFetch(request);
  const redirectFallback = await handleRequest(new Request(home, {headers: {Accept: 'text/markdown'}}), redirectingOrigin, base);
  assert.match(await redirectFallback.text(), /<!doctype html>/i, `${target} redirects must preserve the original page`);
}
console.log(`Passed Accept preferences, HTML/Markdown/HEAD for ${Object.keys(manifest.routes).length} routes, security headers, resource types, exclusions and origin fallbacks at ${base}`);
