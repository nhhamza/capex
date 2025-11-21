# Firebase Auth + Multi-Tenant Implementation

## Overview

This project now uses Firebase Authentication with multi-tenant support. Each organization is isolated, and users can only access data for their organization.

## Architecture

### Firebase Client (src/firebase/client.ts)

- Single Firebase initialization using Firestore Lite SDK
- Uses environment variables for configuration
- Exports: `auth`, `db`, `storage`
- **No WebChannel** - uses REST API only (Firestore Lite)

### Authentication Flow

1. **Sign Up** (`/signup`)

   - Creates Firebase Auth user
   - Creates `organizations/{orgId}` document
   - Creates `users/{uid}` document with `orgId` reference

2. **Login** (`/login`)

   - Signs in with Firebase Auth
   - AuthProvider loads user document from Firestore
   - Redirects to dashboard if user has orgId

3. **Auth Guards**
   - `RequireAuth`: Ensures user is signed in
   - `RequireOrg`: Ensures user has an organization

### Multi-Tenancy

#### Data Structure

```
users/{uid}
  - email: string
  - orgId: string
  - role: "owner" | "member"
  - createdAt: string

organizations/{orgId}
  - name: string
  - ownerUid: string
  - createdAt: string

properties/{id}
  - organizationId: string
  - ... (other fields)

leases/{id}
  - organizationId: string
  - ... (other fields)
```

#### Security Rules (firestore.rules)

- All app data (properties, leases, expenses, loans) must include `organizationId`
- Users can only read/write docs where `data.organizationId == users/{uid}.orgId`
- Users can only access their own user document
- Organizations can only be read by members

#### CRUD Operations

All CRUD functions already filter by `organizationId`:

```typescript
// Example: getting properties
const { userDoc } = useAuth();
const props = await getProperties(userDoc!.orgId);
```

## Environment Variables

Required in `.env.local`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
```

## Routes

- `/login` - Public login page
- `/signup` - Public signup page
- `/setup-org` - Organization setup (if user has no org)
- `/` - Protected app routes (requires auth + org)

## Using Auth in Components

```typescript
import { useAuth } from "@/auth/authContext";

function MyComponent() {
  const { user, userDoc, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!userDoc?.orgId) return <Navigate to="/setup-org" />;

  // Access organization ID
  const orgId = userDoc.orgId;

  return <div>Hello {user.email}</div>;
}
```

## Deployment Checklist

1. ✅ Deploy Firestore rules: `firebase deploy --only firestore:rules`
2. ✅ Set environment variables in hosting
3. ✅ Test signup flow creates org + user docs
4. ✅ Test login flow loads user doc
5. ✅ Test data isolation between orgs
6. ✅ Verify no WebChannel calls in Network tab

## Key Benefits

- **No WebChannel errors** - Firestore Lite uses REST API only
- **Tenant isolation** - Organizations cannot access each other's data
- **Simple auth** - Standard Firebase Auth patterns
- **Scalable** - Easy to add team members to organizations later
