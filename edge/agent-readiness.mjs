// A route Worker in front of the existing GitHub Pages origin.
// The build publishes the allowlist and Markdown; the Worker never guesses routes.
export function prefersMarkdown(accept = '') {
  const ranges = accept.toLowerCase().split(',').map(part => {
    const [type, ...parameters] = part.trim().split(';');
    const parameter = parameters.map(value => value.trim()).find(value => value.startsWith('q='));
    const q = parameter ? Number(parameter.slice(2)) : 1;
    return {type, q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0};
  });
  function quality(type) {
    for (const candidate of [type, 'text/*', '*/*']) {
      const range = ranges.find(range => range.type === candidate);
      if (range) return range.q;
    }
    return 0;
  }
  return ranges.some(range => range.type === 'text/markdown') &&
    quality('text/markdown') > 0 && quality('text/markdown') >= quality('text/html');
}

function addVary(headers, name) {
  const values = (headers.get('Vary') || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!values.some(value => value === '*' || value.toLowerCase() === name.toLowerCase())) values.push(name);
  headers.set('Vary', values.join(', '));
}

export async function handleRequest(request, fetchOrigin = fetch, basePath = '/') {
  const url = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method)) return fetchOrigin(request);
  // Leave assets, analytics and owner tools on their existing path without extra reads.
  const candidate = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('.md') || url.pathname === basePath + 'llms.txt' ||
    url.pathname.startsWith(basePath + '.well-known/agent-skills/') ||
    url.pathname === basePath + 'agent-content.json';
  if (!candidate) return fetchOrigin(request);

  let manifest;
  try {
    const manifestResponse = await fetchOrigin(new Request(new URL(basePath + 'agent-content.json', url), {
      headers: {Accept: 'application/json'}, redirect: 'error',
    }));
    if (!manifestResponse.ok) return fetchOrigin(request);
    manifest = await manifestResponse.json();
    if (manifest.version !== 1 || manifest.basePath !== basePath || !manifest.routes || !manifest.resources) {
      return fetchOrigin(request);
    }
  } catch {
    return fetchOrigin(request);
  }

  const page = Object.hasOwn(manifest.routes, url.pathname) ? manifest.routes[url.pathname] : null;
  const resourceType = Object.hasOwn(manifest.resources, url.pathname) ? manifest.resources[url.pathname] : null;
  if (!page && !resourceType) return fetchOrigin(request);

  let response, negotiated = false;
  if (page && prefersMarkdown(request.headers.get('Accept') || '')) {
    const markdownUrl = new URL(page.markdown, url);
    // Do not forward page cookies, query parameters, ranges or conditional HTML validators.
    if (markdownUrl.origin === url.origin && markdownUrl.pathname.startsWith(basePath)) {
      try {
        const markdownResponse = await fetchOrigin(new Request(markdownUrl, {
          headers: {Accept: 'text/markdown'}, redirect: 'error',
        }));
        if (markdownResponse.status === 200) {
          response = markdownResponse;
          negotiated = true;
        }
      } catch { /* Preserve the original page if a generated representation is unavailable. */ }
    }
  }
  response ||= await fetchOrigin(request);
  if (!response.ok && response.status !== 304) return response;

  const headers = new Headers(response.headers);
  const absolute = path => new URL(basePath + path, url).href;
  const links = [
    `<${absolute('llms.txt')}>; rel="index"; type="text/plain"`,
    `<${absolute('.well-known/agent-skills/index.json')}>; rel="service-meta"; type="application/json"`,
  ];
  if (page) {
    links.push(`<${new URL(page.markdown, url).href}>; rel="alternate"; type="text/markdown"; hreflang="${page.language}"`);
    headers.set('Content-Language', page.language);
    addVary(headers, 'Accept');
    // Vary alone is insufficient for shared caches that ignore Accept.
    // Origin HTML and .md files have separate URLs; final negotiated pages are not shared-cacheable.
    headers.set('Cache-Control', 'private, no-cache');
  }
  headers.append('Link', links.join(', '));
  if (negotiated || resourceType) headers.set('Content-Type', negotiated ? 'text/markdown; charset=utf-8' : resourceType);
  if (negotiated) {
    headers.set('Content-Location', new URL(page.markdown, url).href);
    headers.delete('Content-Length');
    headers.delete('Content-Range');
    headers.delete('Accept-Ranges');
  }
  if (resourceType || negotiated) headers.set('Access-Control-Allow-Origin', '*');
  if (manifest.contentSignal) headers.set('Content-Signal', manifest.contentSignal);
  return new Response(request.method === 'HEAD' || response.status === 304 ? null : response.body, {
    status: response.status, statusText: response.statusText, headers,
  });
}

export default {
  fetch(request, env) {
    return handleRequest(request, fetch, env.BASE_PATH || '/');
  },
};
