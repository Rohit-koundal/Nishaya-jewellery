# Nishaya admin identity

The existing admin account is also the store owner. Production login continues to require a real mobile OTP. Email is profile/contact information, not a password-login shortcut.

Set these on the **backend Render service**, not just in the frontend or local `.env`:

```env
ADMIN_PHONE_NUMBERS=7988634769
ADMIN_EMAIL=nishaya.in1111@gmail.com
```

Deploy the backend changes and restart/redeploy the service after changing its environment. Then sign out and log in with the new mobile number, verify its OTP and switch to admin mode. The first entry in `ADMIN_PHONE_NUMBERS` is the deployment owner. Further comma-separated numbers, when intentionally added, are ordinary admins. The primary entry must be valid; a blank configuration does not grant owner privileges.

## Why the old number kept working

Previously the owner number was hardcoded, and saved database admin roles were retained on every login. Changing the allowlist did not demote existing accounts or invalidate their access/refresh tokens.

The backend now reconciles access before starting background workers and when reading a session. The old deployment number `9816978086` is demoted unless explicitly included in the new allowlist. Previous owner privileges and env-managed admin grants removed from the configuration are revoked, and their existing sessions are invalidated. Customer accounts, order history, addresses and unrelated manually granted admin/seller permissions are preserved. No account is deleted or merged.

The configured email is assigned on verified owner login when the owner has no email or an automatically generated placeholder. A verified/custom email is not silently overwritten, and an email already attached to another account is never taken over. Such a profile requires an intentional email change through the existing profile/OTP flow. Setting `ADMIN_EMAIL` never marks email verified; an unverified configured email can be verified from Profile → email Change → Send OTP.

Changes to this local workspace do not update Render environment variables or deploy production automatically. The account reconciliation is applied when the updated backend is started or handles a session; the coding task itself does not connect to the production database.

Tests use an isolated MongoDB replica set and simulated SMS provider responses. Run `node --test --test-concurrency=1 tests/deploymentAdmin.test.js` from `backend`.
