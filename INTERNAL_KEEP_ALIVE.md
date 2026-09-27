# Internal Render keep-alive (Nishaya backend)

This is an opt-in, best-effort self-ping inside the Nishaya backend. No external
scheduler, monitoring account, Redis queue or new package is required. It is not
an always-on hosting guarantee and cannot execute while its own process is stopped.

## Enable on the Nishaya backend

1. Deploy the backend changes, including `services/selfKeepAliveService.js` and
   `utils/livenessProbe.js`.
2. In the **Nishaya backend** Render service's Environment settings, add:

   ```env
   SELF_KEEP_ALIVE_ENABLED=true
   ```

3. Save/redeploy. The service must have `NODE_ENV=production`. Render supplies
   `RENDER=true`, `RENDER_SERVICE_TYPE=web` and `RENDER_EXTERNAL_URL` automatically.
   Do not replace these with the frontend or Samira/control-plane URL. The worker
   deliberately ignores `PUBLIC_API_URL` and `CONTROL_PLANE_URL`.
4. Check backend logs for `[self-keep-alive] Enabled`, then
   `Public self-ping verified`. Enable alone does **not** prove a request worked.
   The initial attempt is scheduled ten seconds after the HTTP listener starts.
5. Leave the app closed for more than fifteen minutes and verify that scheduled
   probes still succeed in the backend logs. Then measure a fresh storefront load
   on mobile. Verify separately after a deploy/restart and during a failure.

No frontend environment change, secret key, database migration or Samira setting
is needed for this worker. Existing mobile loading improvements are separate.

## Scheduling and safeguards

- After success, wait five minutes before the next public HTTPS request.
- A failure gets retries after 15, 30 and 60 seconds. After those three retries,
  wait five minutes before starting another bounded attempt sequence.
- Each attempt has a 20-second deadline covering headers and body. Failed/hung
  fetches are aborted; no unbounded retry loop runs alongside customer requests.
- There is only one worker per process. The next timer is scheduled only after an
  attempt finishes. Delayed timers send one probe, never a burst of missed probes.
- Every probe uses a new random nonce, requests no caching, rejects redirects and
  verifies a small exact application response (at most 256 bytes). A proxy's 200
  startup HTML, stale response, error status or wrong service is not a success.
- The fixed destination is the process's Render-provided HTTPS `onrender.com`
  origin plus `/health/live`. No user-provided URLs, credentials or licence keys
  are sent. Malformed origins, local/test/preview/worker environments disable it.
- `/health/live` is public **process liveness only**: no MongoDB, Redis, media,
  licence, OTP, cart, payment or order operation. It returns a tiny `no-store`
  response. Existing `/health` still reports database/storage readiness; **do not
  change Render's readiness health-check path to `/health/live`**.
- Startup, first success, roughly hourly successful heartbeat, failures, delayed
  timers and recovery are logged. Raw response bodies, URLs and credentials are
  not logged. Logging or probe failures do not reject customer requests.
- Shutdown stops timers and aborts the active probe before closing HTTP. Timers
  are unreferenced so this feature cannot keep an exiting process alive.

## Limits that code cannot remove

[Render documents](https://render.com/docs/free) a fifteen-minute idle threshold,
possible arbitrary restarts and 750 free running-hours per workspace per month.
The inference behind this workaround is that successful requests to the public
URL count as inbound activity. Render does not promise that self-pinging is a
supported always-on mechanism; confirm the observed behaviour on the deployment.

The internal timer cannot wake a stopped/suspended service, recover a crashed
process by itself, run during a blocked event loop, bypass hosting quotas or fix
database/query latency. A fresh successful boot starts the worker again. A
prolonged network outage can still allow the service to sleep. No zero-delay or
zero-failure claim is made.

Continuously running one service uses 720 hours in a 30-day month or 744 hours in
a 31-day month. If Samira shares the workspace, its running hours share the same
750-hour pool, including licence-refresh traffic even when its shop is unused.
Monitor **Billing -> Monthly Included Usage**. Ping frequency does not reduce
running-hour consumption while the service remains awake. Enabling this worker
does not keep Samira warm or remove Nishaya's licence dependency for writes.

## Disable / rollback

Set `SELF_KEEP_ALIVE_ENABLED=false` (or remove it) and redeploy. It is disabled by
default. Existing routes, root response and readiness checks continue unchanged;
no data needs reverting. Production activation was not performed by the code change.

## Tests

From `backend`:

```sh
node --test --test-concurrency=1 tests/selfKeepAlive.unit.test.js tests/selfKeepAliveLifecycle.unit.test.js tests/liveness.unit.test.js tests/env.test.js
node --test --require ./tests/catalogTestSetup.js --test-concurrency=1 tests/leftovers.test.js tests/storefrontPerformance.unit.test.js tests/storefrontHome.integration.test.js tests/auth.test.js tests/cart.test.js tests/orders.test.js tests/payments.test.js
```

Worker tests use fake time and simulated failures. Liveness tests also exercise
real Node HTTP fetch against a local Express listener, never the production service.

Verified locally: 26 worker/liveness/startup tests passed; 85 of 89 broader
backend tests passed. The four failures in `tests/leftovers.test.js` also reproduce
with the pre-change `HEAD` app/test source: an old Samira CORS expectation and
three seller-provisioning cases expecting routes absent from this client build.
Those unrelated expectations/routes were not changed. Backend syntax checks passed.
