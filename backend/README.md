# Gestion Backend

Unified backend with two deployment options:
1. **Express Server** (`index.js`) - Deploy to Vercel/any Node.js host
2. **Firebase Functions** (`functions/`) - Deploy to Firebase Cloud Functions

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Get Firebase Service Account Key:**

   - Go to [Firebase Console](https://console.firebase.google.com/project/immo-hamza/settings/serviceaccounts/adminsdk)
   - Click "Generate new private key"
   - Save the file as `serviceAccountKey.json` in this folder

3. **Configure environment variables:**

   - Edit `.env` file with your Stripe keys
   - Update `STRIPE_WEBHOOK_SECRET` after deploying

4. **Run Express server locally:**
   ```bash
   npm run dev
   ```

5. **Build and test Firebase Functions:**
   ```bash
   npm run build
   npm run serve
   ```

## Deploy to Vercel

1. Install Vercel CLI:

   ```bash
   npm i -g vercel
   ```

2. Deploy:

   ```bash
   vercel
   ```

3. Add environment variables in Vercel dashboard:

   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `FRONTEND_URL`

4. Add Firebase service account as environment variable:
   - Copy content of `serviceAccountKey.json`
   - Add as `FIREBASE_SERVICE_ACCOUNT` in Vercel
   - Update index.js to use `JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)`

## Deploy to Firebase

```bash
npm run deploy
```

This deploys the Firebase Functions from the `functions/` directory.

## API Endpoints

### Express Server (Vercel deployment)
- `GET /` - Health check
- `POST /checkout` - Create Stripe checkout session
- `POST /webhook` - Handle Stripe webhooks
- `GET /check-session/:sessionId` - Check checkout session status
- `POST /test-update-plan` - Test endpoint for manual plan updates

### Firebase Functions
- `createCheckoutSessionFn` - Callable function for creating checkout sessions
- `stripeWebhookFn` - HTTP function for Stripe webhooks
