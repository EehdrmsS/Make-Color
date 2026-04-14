# Production Security Notes

## Deployment

Use `npm run build` for production. The build writes static assets to `dist/`, extracts inline CSS and JavaScript into separate files, and does not generate source maps.

## Secrets

Do not place secrets in `make-color.html` or any frontend JavaScript.

Required server-side environment variable:

- `SCORE_SIGNING_SECRET`: HMAC key used by API routes to sign and verify score sessions.

Optional public build variable:

- `PUBLIC_ADSENSE_CLIENT_ID`: Google AdSense publisher id. This value is public by design, but should still be configured through the deployment environment.

## Score Submission

Client scores are treated as untrusted. The serverless API issues a signed session token from `/api/session`, then validates score payloads at `/api/submit-score`.

Validation includes:

- mode allow-listing
- integer range checks
- session HMAC verification
- session age checks
- Classic mode elapsed-time plausibility checks
- per-IP in-memory rate limits

This is lightweight abuse resistance, not a tamper-proof leaderboard. For real competitive rankings, store server-side game events or replay summaries.

## Content Security Policy

`vercel.json` and `netlify.toml` configure CSP and common secure headers. Production builds avoid inline event handlers and inline script/style blocks so CSP can block unexpected script injection.

## Ads

AdSense loading is asynchronous and only runs when `PUBLIC_ADSENSE_CLIENT_ID` is configured. No ad client id is hard-coded in source.

## Local Secret Hygiene

`.env` and `.env.*` are gitignored. If a token is ever committed or exposed in logs, revoke it and create a new one.
