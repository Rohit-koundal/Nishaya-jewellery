# Nishaya Jewellery

A standalone Jewellery commerce project generated for **Nishaya Jewellery**. It has its own source tree and must use its own database, storage and service credentials. Master Configuration, Store Portfolio and project-generation tools are intentionally absent from this client project.
## Managed installation

This package has one unique, revocable installation identity. Open `client-installation.json`, copy its values into the **backend hosting environment**, and then permanently delete that file before committing or sharing the project. Never put `CLIENT_LICENSE_KEY` in the frontend. The admin **System & updates** screen shows subscription, limits, connection state and assigned updates without exposing that key.

## Start locally

1. Extract this folder.
2. Copy `.env.example` to `.env`.
3. Copy `backend/.env.example` to `backend/.env`.
4. Set a new MongoDB database URL and replace the JWT secrets.
5. If present, transfer `client-installation.json` values to the backend environment and delete the file.
6. Run `npm install` in this folder and in `backend`.
7. Run `npm run server` in one terminal and `npm start` in another.

## OTP providers

Each client can select Twilio, MSG91, 2Factor or Fast2SMS using backend configuration. See [OTP provider setup](docs/otp-providers.md) for credentials, compatibility and safe readiness checks. Existing Twilio `SMS_*` variables continue to work.

**2Factor now uses transactional SMS only.** The old OTP API branch is removed. Before deploying to a 2Factor installation, supply an approved sender and message template; an API key alone no longer enables sending. See [2Factor SMS-only setup and deployment checks](backend/TWOFACTOR_SMS_DELIVERY.md).

## Phone app experience

The responsive storefront is also an installable Progressive Web App. It includes mobile navigation, product search and filters, product detail and sharing, bag, wishlist, address and payment checkout, orders and tracking, returns, profile, notifications, offline/update status, safe-area layout and home-screen shortcuts. The same backend remains the source of truth for identity, price, stock, coupons, payment and order state.

The default catalog uses **Jewellery** with 16 product fields and 18 category definitions. Update branding, owner phone, payment, media, SMS and shipping credentials in the new installation before deployment. Website Designer remains available to the project admin.

## Order notifications

Customer and admin in-app notifications are enabled. New COD bookings and successfully paid online orders queue independent email and WhatsApp notifications. Email uses Brevo; WhatsApp uses **direct Meta Cloud API**, not 2Factor SMS OTP. Customers need a **verified profile email** for email and an explicit **checkout opt-in on their verified login number** for WhatsApp. Phone-only customers are not automatically opted in. SMS order alerts and browser/phone push are not connected. Login OTP delivery is unchanged.

Set these on the **Render backend**, never in frontend environment variables:

```ini
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=your_verified_sender_address
BREVO_SENDER_NAME=Nishaya Jewellery
ADMIN_EMAIL=nishaya.in1111@gmail.com
FRONTEND_URL=https://your-storefront-domain
```

Create/verify the sender (and authenticate its domain where applicable) in Brevo, enable transactional email for the account, and deploy both backend and frontend. This reuses the existing Brevo transport; changing `EMAIL_OTP_PROVIDER` is not required. Brevo quota is shared with other emails sent by the account, including OTPs/reports. No paid plan is enabled automatically.

Open **Admin → Settings → Order notifications** to switch admin/customer email on or off, change the private admin recipient, and view the latest delivery attempts. The email address is not published as the store's public contact address. Save settings before testing. Non-default tenant stores use their own configured recipient or verified owner email, not this deployment's admin address.

Safe test: place a COD order on a staging/test store or finish a Razorpay **test-mode** payment. Check both in-app inboxes, the admin/customer email inboxes (including spam), and Brevo's transactional email logs. Pending/failed online payments do not send booking emails. Replaying the payment callback must not send additional emails. Historical orders are not automatically emailed.

Email failures never fail checkout. A MongoDB-backed queue recovers after restart; temporary failures retry with a fixed limit. Missing configuration/authentication blocks the email and appears in Settings, where it can be retried after correction. `ACCEPTED` means accepted by Brevo, not delivered to an inbox; Brevo logs show actual delivery/bounce status. An uncertain send is not blindly repeated after Brevo's idempotency window expires: check provider logs first. The worker runs in the API process, so a sleeping/free Render instance can delay queued retries until it wakes up. In-app bells refresh while the website is open, not as phone push notifications.

### WhatsApp setup (backend only)

The WhatsApp switches default to **off**. This implementation does not activate any paid plan, buy credits, create templates or send a test message automatically. Meta message charges can apply; using direct Cloud API does not mean messages are free. Local tests use mocks, never actual recipients.

In your Meta Business app, set up the WhatsApp Business Account and register the sending number. Use a system-user access token with `whatsapp_business_messaging` permission and access to that business phone. Temporary dashboard tokens expire; manage token expiry/rotation for production. Fill the following **Render backend** variables; none belong in React:

```ini
WHATSAPP_ACCESS_TOKEN=your_meta_access_token
WHATSAPP_PHONE_NUMBER_ID=your_numeric_meta_phone_number_id
WHATSAPP_API_VERSION=your_supported_graph_version
WHATSAPP_APP_SECRET=your_meta_app_secret
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_own_random_secret
WHATSAPP_TEMPLATE_LANGUAGE=en_US
WHATSAPP_CUSTOMER_ORDER_TEMPLATE=nishaya_customer_order
WHATSAPP_ADMIN_ORDER_TEMPLATE=nishaya_admin_order
```

`PHONE_NUMBER_ID` is Meta's numeric ID, **not** your mobile number or WABA ID. `API_VERSION` must be `vNN.N`, copied from the current supported version in your Meta app; no unversioned fallback. `APP_SECRET` is the app signing secret, not its access token. `WEBHOOK_VERIFY_TOKEN` is a random secret you choose and enter identically in Meta and Render. Never share tokens in chat/screenshots. Match the template language exactly (`en_US` is different from `en`). These variables do not enable voice calls or alter SMS settings.

In WhatsApp Manager, request two approved **Utility**, **positional**, **BODY-only** templates, with no dynamic header/buttons. Use these proposed bodies (Meta must approve/category-check them):

Customer `nishaya_customer_order`:
```text
Thank you for ordering from {{1}}. Order {{2}} has been received. Total: {{3}}. Payment: {{4}}. Sign in to My Orders for details. If COD verification is pending, please complete it before dispatch.
```

Admin `nishaya_admin_order`:
```text
New order for {{1}}. Order reference: {{2}}. Total: {{3}}. Payment: {{4}}. Sign in to your admin Orders page to review it. Check COD verification before dispatch.
```

Both use these four BODY parameters, in this exact order: store name, order/invoice reference, total (e.g. `INR 599.00`), payment status (`Online payment confirmed`, `COD - payment due on delivery`, or `COD - verification pending; payment due on delivery`). Do not use an OTP or marketing template. Already-approved templates with a different parameter layout need a matching adapter; renaming one env variable alone is not sufficient.

Configure the Meta WhatsApp webhook callback:
```text
https://nishaya-jewellery-backend.onrender.com/api/notifications/whatsapp/webhook
```
Enter `WHATSAPP_WEBHOOK_VERIFY_TOKEN` as the verify token, subscribe to the **messages** webhook field and subscribe the app to the sending WABA. POST callbacks are checked against the exact raw-body HMAC using `WHATSAPP_APP_SECRET`. A wrong secret/signature is rejected. Do not use the Razorpay/SMS webhook URL. Meta test numbers require allowed test recipients; production requires your production sender/account setup.

Redeploy backend and frontend. Run `cd backend` then `npm run check:notifications` to check required variable names/formats without exposing values or sending messages. **Configured does not prove account access/template approval/delivery.** Open **Admin → Settings → Order notifications**:

1. Save the private admin email and WhatsApp recipient (with country code). The admin WhatsApp recipient must have agreed to receive these alerts; enabling its switch records the setting through the existing audit flow.
2. Enable both admin and customer email/WhatsApp switches, then save. Provider credentials are not editable in this screen.
3. On desktop/mobile checkout, the customer can check **Send my order confirmation on WhatsApp**. It starts unchecked and uses the verified login number, never a different shipping phone. Email delivery still requires a verified profile email. Checkout opt-in is frozen with the original order; replaying an existing checkout does not create another order or change that consent.

### Verification and failure handling

Use consenting test recipients. A COD test creates a real local/staging order; a Razorpay test payment does not charge money but can still send real notification messages if provider credentials are real. Check stock/order effects and provider costs before using a production order for testing.

- With a verified customer email and checkout WhatsApp opt-in, one eligible order produces 5 jobs: customer+admin in-app fanout, two emails and two WhatsApp messages. No duplicate jobs on payment callbacks/reloads. Online jobs are eligible only after verified payment is Paid; failed/pending payments and cancelled orders are suppressed.
- Check admin/customer inboxes and Brevo transactional logs. Check both WhatsApp recipients and Meta status callbacks. Settings should show EMAIL `ACCEPTED`, then WHATSAPP `ACCEPTED` → `SENT` → `DELIVERED` (optionally `READ`). Acceptance is not delivery. Without subscribed working webhooks, WhatsApp can remain ACCEPTED even if delivered.
- Definitive Meta rejections are BLOCKED/FAILED with safe numeric error codes (e.g. template mismatch, auth, billing, recipient issues). Fix provider setup and use **Retry after fixing setup** for that channel only. A definite 429 retries with a fixed limit. Unknown timeout/5xx/crashed-send outcomes become UNCERTAIN, not automatically resent; a signed later callback can resolve them. Check Meta before any manual follow-up. No calls, provider fallback or email resends caused by WhatsApp failure.
- Disabled channels/no customer opt-in are SKIPPED. Existing/historical orders are not retrospectively sent WhatsApp alerts. Switching on notifications later affects new orders; it does not backfill skipped orders. Queued jobs survive restarts, but free Render sleep still delays worker processing/retries until it wakes.
- Templates/recipients, tokens and raw Meta payloads are not placed in diagnostics. Delivery status is store-scoped. Keep the database and provider logs restricted to authorised admins.

Automated checks (no real email/WhatsApp): `cd backend` then `node --test --test-concurrency=1 tests/orderNotifications.test.js tests/orderWhatsappNotifications.test.js`. Frontend: `npm test -- --watch=false --runInBand --runTestsByPath src/components/admin/OrderNotificationSettings.test.jsx src/pages/customer/Checkout.selection.test.jsx src/pages/customer/Checkout.recovery.test.jsx`.

Provider references: [Meta template messaging](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/template-messages/), [Meta-owned template examples](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/template/), [Meta webhook signature/verification](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/). This implementation uses HTTP directly, not the archived Node SDK.

## Security

No existing `.env` file, database record, upload, Git history, build output or dependency is copied from the source platform. The one-time installation credential is newly generated for this client and can be revoked independently. Production builds omit source maps, deployment headers restrict script sources and framing, private API responses are not cached, CORS accepts only configured origins, and sensitive actions are validated by the backend. Browser JavaScript is public by design, so never put secrets or authorization decisions in frontend code.
