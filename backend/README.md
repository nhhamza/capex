# Gestion Backend

Backend with **local Express dev** + **Vercel Serverless** deployment.

## Structure
- `src/app.js` - Express app (no `listen`) used by both local + Vercel
- `server.js` - Local server runner (`app.listen`)
- `api/index.js` - Vercel Serverless entrypoint

> Note: This repo also contains a legacy `functions/` folder (Firebase Functions). It is **not** used for Vercel.

## Local setup

1) Install
```bash
npm install
```

2) Create `serviceAccountKey.json` (local only)
- Firebase Console → Project Settings → Service accounts → Generate new private key
- Save as `serviceAccountKey.json` at project root

3) Configure env
- Copy `.env.example` (if you have one) or edit `.env`
- Required (local):
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET` (should be `whsec_...`)
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_STORAGE_BUCKET` (optional)

4) Run
```bash
npm run dev
```

## Deploy to Vercel (Serverless)

### 1) Deploy
```bash
vercel
```

### 2) Set env vars in Vercel
In Vercel → Project → Settings → Environment Variables:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (must be `whsec_...`)
- `FRONTEND_URL` (your Vercel frontend URL)
- `FIREBASE_SERVICE_ACCOUNT` (the **full JSON** from Firebase admin key)
- `FIREBASE_PROJECT_ID` (optional if included in JSON)
- `FIREBASE_STORAGE_BUCKET` (optional)

Important:
- On Vercel you **must** set `FIREBASE_SERVICE_ACCOUNT`. The serverless runtime should not use `serviceAccountKey.json`.

## API Endpoints
- `GET /` - Health check
- `POST /checkout` - Create Stripe checkout session
- `POST /webhook` - Stripe webhooks (raw body)
- `GET /check-session/:sessionId` - Check session status
- `POST /test-update-plan` - Test endpoint (remove for production)
