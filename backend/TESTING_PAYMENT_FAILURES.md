# Testing Payment Failure Scenarios

This guide helps you test Stripe payment failure scenarios with grace periods.

## Test User Data
```json
{
  "orgId": "K81k78hg6g0M8lrGVUuB",
  "stripeCustomerId": "cus_Td4C8jmEP2HztF",
  "stripeSubscriptionId": "sub_1Sfo4N1Ooy6ryYPnrpOSLJE4",
  "plan": "solo",
  "status": "active"
}
```

## Prerequisites
- Backend server running (default: http://localhost:3000)
- Stripe CLI running with webhook forwarding
- Valid orgId from your test user

## Test Endpoints Available

### 1. Check Current Billing Status
```bash
curl -X POST http://localhost:3000/test-check-billing \
  -H "Content-Type: application/json" \
  -d '{"orgId": "K81k78hg6g0M8lrGVUuB"}'
```

### 2. Simulate Payment Failure (With Grace Period)
This sets status to `past_due` with 7-day grace period:
```bash
curl -X POST http://localhost:3000/test-payment-failed \
  -H "Content-Type: application/json" \
  -d '{"orgId": "K81k78hg6g0M8lrGVUuB", "graceDays": 7}'
```

**Expected Result:**
- Status: `past_due`
- Grace period: 7 days from now
- User CAN still access the app (middleware allows access during grace)
- User sees warning about payment issue

### 3. Simulate Expired Grace Period (Blocked)
This sets grace period to yesterday:
```bash
curl -X POST http://localhost:3000/test-grace-expired \
  -H "Content-Type: application/json" \
  -d '{"orgId": "K81k78hg6g0M8lrGVUuB"}'
```

**Expected Result:**
- Status: `past_due`
- Grace period: Yesterday (expired)
- User CANNOT access the app (middleware blocks)
- User redirected to `/blocked` page

### 4. Simulate Payment Recovery
This restores active status:
```bash
curl -X POST http://localhost:3000/test-payment-recovered \
  -H "Content-Type: application/json" \
  -d '{"orgId": "K81k78hg6g0M8lrGVUuB"}'
```

**Expected Result:**
- Status: `active`
- Grace period: null
- User CAN access the app normally

## Testing Workflow

### Scenario A: Payment Fails, Grace Period Active
1. Start with active subscription
2. Run payment failure simulation with grace period
3. Try to access protected endpoints (should work)
4. Check frontend for payment warning banner
5. Verify grace period shown in UI

### Scenario B: Payment Fails, Grace Period Expired
1. Run expired grace period simulation
2. Try to access protected endpoints (should get 403)
3. Verify redirect to `/blocked` page
4. Check that billing portal button works

### Scenario C: Payment Recovery
1. Start from expired grace (blocked)
2. Run payment recovery simulation
3. Verify access restored
4. Check that warning banner disappears

## Testing with Real Stripe Events (Optional)

If you want to test with actual Stripe webhooks:

### 1. Trigger Invoice Payment Failure
```bash
stripe trigger invoice.payment_failed
```

### 2. Trigger Payment Success
```bash
stripe trigger invoice.payment_succeeded
```

### 3. Watch Webhook Events
```bash
stripe listen --forward-to http://localhost:3000/webhook
```

## Verify Middleware Behavior

Test that protected endpoints respect billing status:

### When Active (Should Work)
```bash
curl -X GET http://localhost:3000/api/properties \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### When Blocked (Should Return 403)
```bash
curl -X GET http://localhost:3000/api/properties \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Expected response when blocked:
```json
{
  "error": "billing_blocked",
  "status": "past_due",
  "reason": "Payment overdue",
  "graceUntil": "2025-12-17T...",
  "message": "Payment overdue"
}
```

## Check Firestore Billing Document

The billing document is stored at:
```
organizations/{orgId}/private/billing
```

Key fields to check:
- `status`: active, past_due, unpaid, canceled
- `graceUntil`: ISO timestamp or null
- `lastPaymentError`: Error message from Stripe
- `plan`: solo, pro, agency, free
- `propertyLimit`, `seatLimit`: Current limits

## Troubleshooting

### Backend not receiving webhook
- Verify Stripe CLI is running and forwarding
- Check webhook secret in .env matches Stripe CLI output
- Look for webhook signature verification errors in logs

### Frontend not showing blocked page
- Check that `requireBillingOk` middleware is applied to protected routes
- Verify frontend error interceptor redirects on 403 billing_blocked
- Check `useBillingStatus` hook is being used

### Grace period not working
- Verify `isBillingAllowed` logic in app.js:100-125
- Check that `graceUntil` is properly set with future timestamp
- Confirm timezone handling (all times should be ISO UTC)

## Clean Up After Testing

To reset to active status:
```bash
curl -X POST http://localhost:3000/test-payment-recovered \
  -H "Content-Type: application/json" \
  -d '{"orgId": "K81k78hg6g0M8lrGVUuB"}'
```

## Important Notes

- These test endpoints should be REMOVED in production
- Real payment failures are handled automatically by webhooks
- Grace period is hardcoded to 7 days in webhook handler
- All times are stored and compared in ISO 8601 UTC format
