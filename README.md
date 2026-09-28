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

## Security

No existing `.env` file, database record, upload, Git history, build output or dependency is copied from the source platform. The one-time installation credential is newly generated for this client and can be revoked independently. Production builds omit source maps, deployment headers restrict script sources and framing, private API responses are not cached, CORS accepts only configured origins, and sensitive actions are validated by the backend. Browser JavaScript is public by design, so never put secrets or authorization decisions in frontend code.
