# Production Security Notes

## Deployment

Use `npm run build` for production. The build writes static assets to `dist/`, extracts inline CSS and JavaScript into separate files, and does not generate source maps.

## Secrets

Do not place secrets in `make-color.html` or any frontend JavaScript.

Required server-side environment variable:

- `SCORE_SECRET_CURRENT`: HMAC key used by API routes to sign new score sessions.

Optional server-side environment variables:

- `SCORE_SECRET_PREVIOUS`: previous HMAC key accepted only for verification during rotation.
- `REDIS_URL` and `REDIS_TOKEN`: Upstash Redis REST settings for shared serverless rate limits and replay protection. Without Redis, APIs fall back to in-memory limits for local/dev usage.

Optional public build variable:

- `PUBLIC_ADSENSE_CLIENT_ID`: Google AdSense publisher id. This value is public by design, but should still be configured through the deployment environment.

## Score Submission

Client scores are treated as untrusted. The serverless API issues a signed session token from `/api/session`, then validates score payloads at `/api/submit-score`.

Validation includes:

- mode allow-listing
- integer range checks
- session HMAC verification
- current/previous secret rotation
- signed score checksums bound to score, elapsed time, mode, and session id
- session age checks
- Classic mode elapsed-time plausibility checks
- conservative server-side score ceiling recalculation
- replay detection for duplicate score submissions
- composite IP, user-agent, and session-token sliding-window rate limits

This is lightweight abuse resistance, not a tamper-proof leaderboard. For real competitive rankings, store server-side game events or replay summaries.

## Content Security Policy

`vercel.json` and `netlify.toml` configure CSP and common secure headers. Production builds avoid inline event handlers and inline script/style blocks so CSP can block unexpected script injection.

## Ads

AdSense loading is asynchronous and only runs when `PUBLIC_ADSENSE_CLIENT_ID` is configured. No ad client id is hard-coded in source.

## Local Secret Hygiene

`.env` and `.env.*` are gitignored. If a token is ever committed or exposed in logs, revoke it and create a new one.
