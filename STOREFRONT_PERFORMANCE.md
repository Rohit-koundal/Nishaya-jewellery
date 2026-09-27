# Mobile storefront loading

## Changes

- Ordinary GET/HEAD requests no longer wait on the external licence service. The previous middleware did a remote/cache licence lookup even where the result did not restrict access. Signed-in feature-gated reads, commerce writes, plan limits and licence expiry checks still use the existing guard.
- The mobile home feed starts product, category, banner, settings and theme queries concurrently. Only explicitly configured product selections wait for theme IDs. Query filters, tenant scope, visibility, scheduled publishing, collection ordering, pricing and stock serialization are unchanged.
- Website configuration loads its theme and settings concurrently. Its scheduled publishing and existing cache/invalidation remain intact.
- Public browsing and initial account/cart/wishlist reads do not activate the full-screen mobile action overlay. They have a 15-second network deadline. OTP, uploads, cart mutations, payment and order requests keep their existing action behaviour and are not automatically retried.
- Home, catalogue and route loading use inline, reduced-motion-aware skeletons. After five seconds the skeleton explains the delay; failed home/catalogue requests expose Retry. Menus and navigation remain usable while reads are pending.
- A timeout/network/server error no longer triggers a second batch of legacy home requests. Compatibility fallback is limited to missing/unsupported feed endpoints (404/405), requests at most 48 products, and does not wait for optional banners/categories before showing products.
- Current-store cached feed content stays visible during background refreshes. A failed refresh shows a notice. Previous-store results are not reused for a different store scope. Degraded feed responses are marked `no-store` instead of caching an incomplete result as healthy.

No product images were recompressed, and no image quality, database schema, checkout validation, OTP provider or admin-session policy was changed.

## Deployment and hosting

Deploy the **Nishaya backend first**, then the frontend. No new environment variables or database migration are needed. The master/licence service is still required for writes; this is not a licence bypass.

Render Free web services sleep after 15 minutes without inbound traffic, and waking them can take about a minute ([Render documentation](https://render.com/docs/free)). If this deployment uses Free instances, a code change cannot guarantee a fast first response after idle. For a customer-facing production shop, use an always-on backend; the licence/master service should also be available for checkout. No hosting plan changes or purchases are made by this patch.

Do not equate a skeleton or a 15-second deadline with faster data delivery. Measure first visit after idle separately from a warm request. Check Network timing for `/api/storefront/home`, `/api/website-config` and `/api/products`, plus backend/Atlas region and query latency. This patch removes demonstrated code waits; actual production timings must be measured after deployment.

An optional [internal Render keep-alive](INTERNAL_KEEP_ALIVE.md) is now available separately. It is disabled by default and requires `SELF_KEEP_ALIVE_ENABLED=true` on the Nishaya backend. It uses only this service's public liveness endpoint, with deadlines and bounded retries. It cannot wake a stopped process or bypass Render's shared free-hours quota. The existing `/health` readiness check must remain unchanged.

## Verification

Backend tests: `node --test --test-concurrency=1 tests/storefrontPerformance.unit.test.js tests/storefrontHome.integration.test.js` from `backend`.

Frontend coverage includes the request policy, pending read vs action overlay, timeout/session preservation, scoped cache, legacy paginated fallback, optional-data delays, reduced-motion skeleton classes and retry rendering.

Before a demo, verify on a real mobile browser: first home load, navigate while loading, category/product pages, back navigation, slow/offline retry, guest cart, OTP login, checkout and a different store scope. Do not place a real paid order merely to test loading.
