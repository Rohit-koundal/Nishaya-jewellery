# Store-managed delivery guide

The owner uses the existing admin account. No extra owner, driver or delivery-agent role is required. This feature does not change image storage, OTP settings, checkout pricing or payment collection.

## Enable and use

1. Deploy the backend and frontend together (backend first). In admin store settings, select **Self delivery / Manual courier** under Delivery method and save. No courier API key is needed. Keep the required delivery charges/free-shipping settings below it.
2. Confirm the order and complete any required COD/packing checks. Open its order details and the **Self delivery / Manual courier** section.
3. Choose **Self delivery** when delivering yourself. No AWB is required. Or choose **Manual courier** and enter the courier name and real AWB/tracking number. The optional link must be the courier's public HTTPS tracking page. You can add an expected date, a customer-facing business contact and a public note.
4. Save the details. Advance the normal order actions: **Packed → Shipped → Out for Delivery → Delivered**. Confirm the recipient's name on delivery; a receipt/handover reference and note are optional. This records staff confirmation, not a verified delivery OTP.
5. For COD, use **Record COD** separately, only once money is actually collected. Marking delivered never marks payment paid.

Customers see tracking in **My Orders → Order details**, including the courier link, copyable tracking number, expected date, delivery contact and update history. Details refresh every minute while the page is visible, when the window regains focus, or with Refresh tracking. Manual updates create in-app notifications; this feature does not send SMS/WhatsApp, poll an unconnected courier, or provide live GPS.

## Exceptions and safety

- After an unsuccessful attempt, post **Delivery attempt unsuccessful**. Completion is blocked until you schedule another attempt with a new date and note.
- If delivery cannot be completed, post **Return undelivered parcel to store**. Once physically received, post **Parcel received back at store**. Existing RTO inspection and refund review controls remain responsible for stock and refunds; receiving an RTO does not automatically restore stock or refund money.
- Cancelling an eligible pre-dispatch order also closes its manual shipment. Dispatched orders use RTO/return workflows, not cancellation.
- Mode changes are blocked after dispatch. Correcting an AWB after dispatch requires a public explanatory note. Delivery updates and payment actions retain audit history and order revision checks; reload after a conflict before retrying.
- Private information belongs in Staff notes, not the customer-visible delivery note/contact. Only the owning customer and authorized store staff can read tracking.
- Existing integrated shipments keep their original provider, booking, pickup and refresh flow even if the store changes its default. Saving a self/manual courier shipment prevents a second integrated booking for that order.
- Old manual shipments default to manual courier. No destructive data migration or new environment variable is required. MongoDB transactions are used when supported (including Atlas); retain the existing database indexes.

## Verification

Backend integration tests: `cd backend` then `node --test --test-concurrency=1 tests/manualDelivery.test.js`. These tests use an isolated test database and a test-only license fixture and reject external network calls during manual delivery scenarios.

Frontend tests: `npm test -- --watchAll=false --runInBand --runTestsByPath src/components/admin/ManualDeliveryPanel.test.jsx src/components/order/DeliveryTracking.test.jsx src/pages/admin/AdminOperations.test.jsx src/pages/customer/CustomerOrders.test.jsx`.

Before a client demo, test one real self-delivery order and one manual courier order using the deployed admin/customer accounts. Confirm saved tracking, delivery completion and separate COD collection. Automated tests do not verify a real courier tracking website or a production deployment.
