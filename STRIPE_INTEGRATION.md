# Stripe Integration - Complete Setup Guide

## ✅ Completed Implementation

Your React + Vite + TypeScript + Firebase app now has full Stripe subscription integration:

### 1. **Backend** (`backend/`)

- **Express Server** (`index.js`): Direct HTTP endpoints for Stripe billing
- **Firebase Cloud Functions** (`functions/`): Callable functions for Firebase integration
  - **`createCheckoutSessionFn`**: Callable function creates Stripe Checkout sessions
  - **`stripeWebhookFn`**: HTTP endpoint syncs subscription state to Firestore
- Handles: checkout completion, subscription updates, cancellations
- Writes to `orgs/{orgId}`: `plan`, `status`, `propertyLimit`, `seatLimit`

### 2. **Client Integration**

- **useOrgLimits hook**: Reads `orgs/{orgId}` for plan + limits
- **BillingPage** (`/billing`): Plan cards with Stripe Checkout redirect
- **Success/Cancel pages**: Post-checkout redirects
- **Feature gating**: Properties, exports disabled based on limits
- **Header CTA**: "Mejorar Plan" button for free users

### 3. **Plan Limits**

```
Free:   2 properties, 1 seat
Solo:   10 properties, 1 seat  (€9/mo)
Pro:    50 properties, 3 seats (€29/mo)
Agency: 200 properties, 10 seats (€99/mo)
```

---

## 📋 Deployment Steps

### Step 1: Install Backend Dependencies

```powershell
cd backend
npm install
```

### Step 2: Build Functions

```powershell
npm run build
```

### Step 3: Create Stripe Products & Prices

1. Go to https://dashboard.stripe.com/test/products
2. Create 3 products:

   - **Solo** → Create recurring price €9/month → Copy Price ID (e.g., `price_1ABC...`)
   - **Pro** → Create recurring price €29/month → Copy Price ID
   - **Agency** → Create recurring price €99/month → Copy Price ID

3. Update `.env.local`:

```env
VITE_STRIPE_SOLO_PRICE_ID=price_1ABC...
VITE_STRIPE_PRO_PRICE_ID=price_2DEF...
VITE_STRIPE_AGENCY_PRICE_ID=price_3GHI...
```

### Step 4: Deploy Functions

```powershell
cd backend
npm run deploy
```

Note the deployed URLs:

```
✔ functions[us-central1-createCheckoutSessionFn]
✔ functions[us-central1-stripeWebhookFn]
```

### Step 5: Configure Stripe Webhook

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **Add endpoint**
3. URL: `https://us-central1-YOUR_PROJECT.cloudfunctions.net/stripeWebhookFn`
4. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy **Signing secret** (starts with `whsec_...`)
6. Update `backend/.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_YOUR_REAL_SECRET
```

7. Redeploy functions: `cd backend && npm run deploy`

### Step 6: Update BillingPage Price IDs

Edit `src/modules/billing/BillingPage.tsx` around line 95:

```typescript
const planToPrice: Record<string, string> = {
  solo: "price_1ABC...", // Replace with real Price ID
  pro: "price_2DEF...", // Replace with real Price ID
  agency: "price_3GHI...", // Replace with real Price ID
};
```

### Step 7: Test the Flow

1. Start dev server: `npm run dev`
2. Navigate to `/billing`
3. Click "Mejorar Plan" on any paid plan
4. Complete checkout with Stripe test card: `4242 4242 4242 4242`
5. Verify redirect to `/billing/success`
6. Check Firestore `orgs/{orgId}` - should show new `plan` and `propertyLimit`

---

## 🔍 Verification Checklist

- [ ] Functions deployed successfully
- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] Real Price IDs added to BillingPage
- [ ] Test checkout works with test card
- [ ] Firestore updates after successful payment
- [ ] Property limit enforcement works
- [ ] Export restrictions work for free plan
- [ ] "Mejorar Plan" button navigates to `/billing`

---

## 🚀 Production Deployment

1. Replace test keys with live keys in `.env.local`:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

2. Update `backend/.env` with live keys:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

3. Update success/cancel URLs for production domain:

```env
VITE_CHECKOUT_SUCCESS_URL=https://yourdomain.com/billing/success
VITE_CHECKOUT_CANCEL_URL=https://yourdomain.com/billing/cancel
```

4. Create live webhook endpoint in Stripe Dashboard pointing to production Functions URL

5. Deploy:

```powershell
npm run build
firebase deploy
```

---

## 📚 Key Files Modified

### Backend

- `backend/package.json` - Dependencies, scripts
- `backend/tsconfig.json` - TypeScript config (ES2022 modules)
- `backend/index.js` - Express server with HTTP endpoints
- `backend/functions/index.ts` - Firebase Functions exports
- `backend/functions/billing.ts` - Checkout + webhook logic for Firebase Functions
- `backend/.env` - Stripe secrets

### Client (Frontend)

- `src/hooks/useOrgLimits.ts` - Read plan + limits
- `src/firebase/client.ts` - Export functions instance
- `src/modules/billing/BillingPage.tsx` - Plan cards + checkout
- `src/modules/billing/BillingSuccessPage.tsx` - Post-checkout success
- `src/modules/billing/BillingCancelPage.tsx` - Post-checkout cancel
- `src/modules/properties/pages/PropertyCreate.tsx` - Limit enforcement
- `src/modules/properties/pages/PropertiesList.tsx` - Button gating
- `src/modules/reports/ReportsPage.tsx` - Export restrictions
- `src/components/Layout.tsx` - Plan chip + upgrade button
- `src/app/routes.tsx` - Billing routes

### Configuration

- `firebase.json` - Functions runtime config
- `.env.local` - Stripe publishable key, URLs

---

## 🛠️ Troubleshooting

**Functions won't deploy?**

```powershell
cd functions
npm install
npm run build
firebase deploy --only functions --debug
```

**Webhook not working?**

- Check webhook URL matches deployed function URL
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check Cloud Functions logs: `firebase functions:log`

**Checkout redirects to blank page?**

- Verify `VITE_CHECKOUT_SUCCESS_URL` and `VITE_CHECKOUT_CANCEL_URL` are correct
- Check browser console for errors

**Plan not updating after payment?**

- Check Stripe Dashboard → Events for webhook delivery status
- Check Cloud Functions logs for errors
- Verify webhook events are being sent

---

## 🎯 Next Steps

1. **Deploy functions** (see Step 4)
2. **Configure webhook** (see Step 5)
3. **Test** with Stripe test cards
4. **Go live** when ready

The integration is complete and ready to deploy! 🎉
