# Razorpay support email

## Goal

Send one branded WallCab thank-you email after a verified India-only Razorpay support payment without storing supporter data.

## Tasks

- [x] Accept only published Razorpay Payment Page URLs in `SUPPORT_URL` -> Verify with URL unit tests.
- [x] Add strict webhook signature and payload validation -> Verify invalid signatures, accounts, currencies, events, and oversized bodies are rejected or ignored.
- [x] Send the thank-you through Resend with the Razorpay payment ID as the idempotency key -> Verify the mocked provider contract and failure retry response.
- [x] Add a public `POST /api/webhooks/razorpay` route with no-cache responses and privacy-safe errors -> Verify integration tests never expose or log supporter data.
- [x] Document the private environment contract, Razorpay webhook setup, Resend DNS setup, and privacy impact -> Verify README, deployment, self-hosting, and privacy pages agree.
- [x] Run lint, strict types, unit/integration tests, audit, and production build -> Verify every required gate passes before commit and push.

## Done when

- [x] A valid captured INR payment sends exactly one custom email through Resend.
- [x] Invalid or unrelated requests cannot trigger email.
- [x] No email address, phone number, API key, or webhook secret enters Git or application logs.
