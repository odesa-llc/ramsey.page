# Portfolio agent access

The GitHub Pages build generates 17 Markdown pages from the localized public
portfolio, `/llms.txt`, a portfolio-reading skill and its integrity index, and
`/agent-content.json`. The latter is the exact public route allowlist used by
the Worker. Unlisted projects, owner statistics and concept previews are absent.
The existing HTML, language entry, artwork, interactions and analytics remain
on the existing origin.

## Production configuration

The Worker serves the build's Markdown on the existing Cloudflare Free plan,
without an AI conversion service or a paid upgrade. Normal Workers quotas
still apply. The route uses fail-open behavior so an unavailable Worker leaves
the GitHub Pages portfolio accessible.

The exact configuration is `edge/wrangler.jsonc`:

- Script: `ramsey-portfolio-agent-readiness`.
- Route: `ramsey.page/*` in the existing `ramsey.page` zone.
- Entry point: `edge/agent-readiness.mjs`.
- `BASE_PATH=/`; workers.dev and preview URLs disabled.
- No new DNS records, origin changes, storage, secrets or authentication system.

For the route to run, the existing hostname must be proxied through Cloudflare.
Inspect existing Worker routes first; do not overwrite another Worker attached
to the same route. Merge the handler with that Worker if one exists. Do not
enable automatic Markdown conversion on top of this Worker.

For subsequent deployments:

1. Publish the source through the existing GitHub Pages workflow. Confirm
   `/agent-content.json`, `/llms.txt` and the skill index return the generated
   files before attaching the Worker.
2. In an already authorized Cloudflare account, deploy with
   `npx wrangler@4 deploy --config edge/wrangler.jsonc`, or create the named
   module Worker with the same source, route and variable in the dashboard.
3. Verify the responses below, plus ordinary page navigation and media. Then
   rerun https://isitagentready.com/ramsey.page and record its observed score.

```sh
curl -i -H 'Accept: text/markdown' https://ramsey.page/
curl -i -H 'Accept: text/markdown' https://ramsey.page/fr/a-propos/
curl -I -H 'Accept: text/html' https://ramsey.page/en/
curl -i https://ramsey.page/.well-known/agent-skills/index.json
```

Negotiated requests return `Content-Type: text/markdown`, a language, a
`Content-Location` for the corresponding generated file, and discovery `Link`
headers. HTML remains the default. `Vary` includes `Accept`, and negotiated page
URLs use `Cache-Control: private, no-cache` so shared caches cannot mix HTML
and Markdown. Origin asset requests retain their existing behavior. Public
agent resources have explicit media types and permit cross-origin reads.
Security headers are retained. Missing manifests or Markdown fall back to the
original page. Owner tools and unlisted content receive no agent discovery.

The initial production deployment on 2026-11-09 enabled Cloudflare's proxy on
the eight existing apex A/AAAA records, preserving their GitHub Pages targets,
TLS Full mode, the www record and verification records. The Workers URL and
preview URLs are disabled. No CLI authentication was added.

The observed audit improved from 20/100 (Level 1) to 47/100 (Level 4,
Agent-Integrated). Markdown negotiation, discovery Link headers, the reading
skill index and the content policy all passed. Remaining API/authentication and
agent-server checks describe services this public portfolio does not provide.

## Content-use preference

When the owner chooses a policy, store `search`, `ai-input` and `ai-train` as
`"yes"` or `"no"` in root `agent-preferences.json`. The build adds the same
Content Signal to robots.txt and the manifest; the Worker uses it as the
response header. Without that file, this change makes no new content-use
declaration. These signals express preferences; they do not enforce access.

The approved policy is stored in `agent-preferences.json`: search and AI input
are allowed; model training is disallowed.

## Checks and rollback

```sh
python3 scripts/build.py --base-path / --site-url https://ramsey.page
python3 scripts/check_build.py dist --base-path / --site-url https://ramsey.page
python3 scripts/check_agent_readiness.py dist --site-url https://ramsey.page
node scripts/check_agent_edge.mjs dist
```

The deployment workflow runs these checks alongside the existing language,
analytics and visitor-book checks. Resource checks cover translated copy,
public-route exclusions, CV links and skill digests. Worker checks cover
content preferences, all allowlisted routes in HTML/Markdown/HEAD modes,
security headers, media types and fallback behavior.

To roll back edge behavior, remove only this Worker's `ramsey.page/*` route.
The existing GitHub Pages origin continues serving HTML. The generated Markdown
can remain as direct files; it does not imply that content negotiation is live.
OAuth, MCP, API and commerce endpoints have not been invented for scoring.
