# Running scheduler & workers on Render (quick guide)

This repo uses multiple background processes:
- Web (main server): `node server.js`
- Recurring scheduler: `node src/services/recurringScheduler.js`
- Workers (each): `node src/workers/paymentWorker.js`, `node src/workers/withdrawalWorker.js`, `node src/workers/recurringPaymentWorker.js`, etc.

## Recommended Render setup
Create 4 services on Render:

1) Web Service (Node)
- Start command: `node server.js`
- Instance type: web (auto-scale as needed)
- Env: MONGO_URI, RAPYD_*, REDIS_*, RABBITMQ_URL, SWAPYARD_WALLET_ID, MARKUP_PERCENT, etc.

2) Background Worker - recurring scheduler
- Type: Background Worker
- Start command: `node src/services/recurringScheduler.js`
- This isolates cron logic from web requests.

3) Background Worker(s) - queue workers
- Type: Background Worker
- Start command (one per worker or combine):
  - `node src/workers/paymentWorker.js`
  - `node src/workers/withdrawalWorker.js`
  - `node src/workers/recurringPaymentWorker.js`
- You can run multiple instances for scale.

4) (Optional) Admin/one-off job runner
- Use for maintenance tasks or manual retries.

## Environment variables
Set the following in Render (Dashboard > Environment):
- MONGO_URI
- RABBITMQ_URL (e.g., amqp://user:pass@host/vhost)
- REDIS_URL / UPSTASH_REDIS_REST_URL & token if using Upstash
- RAPYD_ACCESS_KEY, RAPYD_SECRET_KEY, RAPYD_BASE_URL
- SWAPYARD_WALLET_ID
- MARKUP_PERCENT
- SENDGRID_API_KEY, TWILIO_* (if you use notifications)

## Health checks & logs
- Enable readiness/health checks for web.
- Use Render logs to watch workers and scheduler.
- Consider powering autoscale or multiple worker instances for high throughput.

## Tips
- Run the scheduler as a separate background worker to avoid cron duplicate runs across multiple web instances.
- Use alerting (Sentry/Datadog) for failed markup transfers and worker crashes.
- For safety, set low concurrency per worker if you have limited DB or Rapyd rate limits.
