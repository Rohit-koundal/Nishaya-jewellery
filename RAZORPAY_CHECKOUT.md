# Razorpay Standard Web Checkout

This project uses React (Create React App), Express, Mongoose and the existing
`razorpay` Node SDK. Standard Checkout is already part of the store's checkout;
do not add a second Pay button or an independent amount-only payment route.

## Configuration

Set these in `backend/.env` locally and in the **backend** Render service's
Environment settings for a deployment. Local `.env` files are gitignored and
are not deployed automatically. Restart/redeploy after changing credentials.

```ini
RAZORPAY_KEY_ID=rzp_test_Ths7Fx3mZlxaun
RAZORPAY_KEY_SECRET=3QzncK6GmRqhn9sv773OigUT
# Needed for webhook recovery; use the same secret in the Razorpay dashboard.
RAZORPAY_WEBHOOK_SECRET=YOUR_SEPARATE_RANDOM_WEBHOOK_SECRET
```

- Use a matching test key pair (`rzp_test_...`) for testing. Test keys cannot
  collect real payments. Use your activated account's live pair for go-live.
- Keep `RAZORPAY_MOCK` unset outside automated tests.
- Never commit API secrets, paste them into frontend code, or use a URL as a
  webhook secret. Rotate keys shared in chat/screenshots.
- `REACT_APP_RAZORPAY_KEY_ID` is an optional legacy public-key fallback, not
  required: the create-order response supplies the backend's matching public
  key. There must be no frontend key-secret variable.
- In **Admin > Settings > Payments & COD**, enable **Accept online payments**
  and the methods needed (Card, UPI, Net Banking, Wallet).
- An available database, valid application licence and normal checkout setup
  are still required. This integration does not bypass those controls.

Run `npm run check:payments` from `backend` for a secret-free local report.
Configured means local values are present, not that Razorpay accepted them.

The supplied test pair was checked with a read-only request to Razorpay's Orders
API and returned **401 Unauthorized**. Replace it with a newly generated,
matching Test Key ID and Secret before expecting the payment modal to work.
No provider order was created and no payment was made during that check.

## Existing endpoints and UI

- `POST /api/payments/create-order` (alias `/api/create-order`): requires the
  logged-in customer's bearer token, `orderItems`, `shippingAddress`, an online
  `paymentMethod` and `checkoutAttemptId`. The current frontend also supplies
  `expectedTotal` from its shipping quote. Reuse the attempt ID for the same
  checkout retry. Prices, shipping, discounts and totals come from the server;
  client `amount`, `currency` and `receipt` do not override them.
- Response includes `{ order_id, amount, currency, keyId, orderId, totals }`.
  `order_id` is Razorpay's order ID, `orderId` is the store's database ID,
  `amount` is integer paise (minimum 100), and currency is INR.
- The existing checkout button calls `openRazorpayCheckout`, which loads
  `https://checkout.razorpay.com/v1/checkout.js` and opens Standard Checkout
  with that order and public key. Dismissal, payment failure, script timeout
  and interrupted verification are already handled.
- `POST /api/payments/verify` (alias `/api/verify-payment`) accepts
  `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` for the same
  logged-in customer. HMAC-SHA256 uses the stored provider order ID and backend
  secret, with constant-time comparison. Invalid/missing fields or a mismatched
  signature return 400 without marking the order paid; unauthenticated requests
  return 401. Another customer's order cannot be confirmed.
- Razorpay order-creation authentication failures return 401; other gateway
  creation failures return 500. Existing stock reservations, duplicate callback
  protection, cancellation/refund and cart recovery remain in place.

## Manual dashboard setup

Enable automatic payment capture in Razorpay. The existing store confirmation
flow assumes the Standard Checkout payment will be captured; configure capture
before accepting live orders.

Configure an HTTPS webhook pointing to the **backend**, not the storefront or
the old WordPress URL:

```text
https://nishaya-jewellery-backend.onrender.com/api/payments/webhook/razorpay
```

Use the same separate signing secret as `RAZORPAY_WEBHOOK_SECRET`. For the
checkout/recovery flow, enable `payment.captured`, `payment.failed`, and
`refund.processed`. Configure in the corresponding test/live dashboard mode.
The webhook handles customers who close the browser before confirmation and
keeps refund state in sync. It is distinct from Checkout's browser handler;
do not add a `callback_url` to replace that handler.

The local pre-existing URL in `RAZORPAY_WEBHOOK_SECRET` was cleared. A real
dashboard-matched webhook secret still needs to be supplied. With it blank,
the webhook correctly returns 503 instead of trusting unsigned requests;
normal signed browser verification can still be tested.

## Test

1. In one terminal: `cd backend`, then `npm start`. In another, from the project
   root: `npm start`. Keep the app's existing API URL, MongoDB, auth and licence
   configuration intact.
2. Sign in, add an available product, select a delivery address, and choose an
   enabled online payment method. Total must be at least Rs. 1.
3. Click the existing checkout/place-order button. Complete Razorpay's test-mode
   flow using the test instruments in the official documentation (not real card
   details). Confirm the order is Paid in the store and the test payment appears
   in Razorpay. No real money moves with test keys.
4. Repeat with cancellation and simulated payment failure: no paid confirmation,
   a useful error, and reserved stock released. Test a verification retry and
   duplicate webhook: no duplicate order or stock deduction.
5. Before going live, configure webhooks/capture, replace the backend keys with
   the matching live pair, redeploy, and perform a controlled live smoke test.

Automated regression checks (isolated test MongoDB, mock Razorpay; no charges):

```powershell
# backend
npm run check:payments
npm run test:payments
node --test --test-concurrency=1 tests/razorpayService.unit.test.js tests/payments.test.js tests/paymentSettings.test.js
# project root
npm test -- --watch=false --runInBand --runTestsByPath src/utils/razorpayCheckout.test.js src/pages/customer/Checkout.selection.test.jsx src/pages/customer/Checkout.recovery.test.jsx
```

Reference: [Razorpay Standard Checkout integration and testing](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).

## Files changed in this integration pass

- `backend/.env` (local and gitignored): updated test pair; cleared the old URL
  from the webhook-secret field. The pair currently fails provider authentication.
- `backend/controllers/paymentController.js`: safe integer amounts, verification
  input validation, and signature verification against the stored provider order.
- `backend/services/razorpayService.js`: minimum/integer amount guard before SDK calls.
- `backend/utils/paymentUtils.js`: reject malformed signature inputs safely.
- `src/utils/razorpayCheckout.js`: reject invalid amounts before opening the modal.
- `backend/scripts/check-payment-config.js` (new): secret-free configuration report.
- `backend/package.json`: adds `check:payments`; SDK was already installed.
- `backend/scripts/test-payment-flow.js`: correctly awaits async rule assertions.
- `backend/tests/payments.test.js`: alias, pricing, minimum, malformed-input and
  authentication coverage; existing test-only licence fixture enabled.
- `backend/tests/paymentSettings.test.js`: existing test-only licence fixture enabled.
- `backend/tests/razorpayService.unit.test.js` (new): isolated SDK/error-path tests.
- `src/utils/razorpayCheckout.test.js`: amount and Standard Checkout callback tests.
- `RAZORPAY_CHECKOUT.md` (new): deployment, dashboard and testing instructions.

Verification: 43 backend tests and 41 frontend tests passed, along with payment
helper checks, frontend lint, backend syntax checks and the production frontend
build. Provider authentication was tested read-only and returned 401; an actual
Razorpay modal payment still requires valid replacement credentials and a manual
smoke test. No production deployment or real payment was performed.
