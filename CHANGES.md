# Cambios Realizados - Gestión Inmobiliaria

## 🎯 Objetivos Completados

### 1. ✅ Backend Consolidado (Sin Duplicidades)

**Problema:** Existían 2 archivos duplicados:
- `backend/index.js` (916 líneas) - ❌ ELIMINADO
- `backend/src/app.js` (1075 líneas) - ✅ CONSERVADO

**Solución:**
- Eliminado `backend/index.js` (archivo duplicado)
- Mantenida la estructura limpia:
  - `backend/src/app.js` - Define express app, middlewares, rutas (export default app)
  - `backend/server.js` - Entry point que importa app y hace listen()
  - `backend/package.json` apunta correctamente a `server.js`

### 2. ✅ Stripe Webhook (Raw Body) - CORREGIDO

**Problema:** El webhook recibía body parseado como JSON en lugar de raw buffer.

**Solución aplicada en `backend/src/app.js`:**
```javascript
// ❌ ANTES: express.json() se aplicaba ANTES del webhook
app.use(express.json());
app.post("/webhook", ...); // ❌ Body ya parseado

// ✅ AHORA: Webhook ANTES de express.json()
app.post("/webhook", express.raw({type: "application/json"}), handler);
app.use(express.json()); // Después del webhook
```

**Verificación:**
- Línea 276: `app.post("/webhook", express.raw({...}))`
- Línea 428: `app.use(express.json())` - DESPUÉS del webhook

### 3. ✅ /api/me Endpoint (500 Error) - CORREGIDO

**Problema:** El middleware `requireOrg` podía lanzar 500 si `req.user` no existía.

**Solución en `backend/src/app.js:161-178`:**
```javascript
async function requireOrg(req, res, next) {
  try {
    // ✅ NUEVO: Verifica req.user antes de continuar
    if (!req.user || !req.user.uid) {
      console.error("[org] No user in request");
      return res.status(401).json({ error: "Unauthorized" });
    }
    const u = await getUserDoc(req.user.uid);
    if (!u) return res.status(403).json({ error: "User profile not initialized" });
    const orgId = pickOrgId(u);
    if (!orgId) return res.status(403).json({ error: "User has no organizationId" });
    req.userDoc = u;
    req.orgId = orgId;
    next();
  } catch (err) {
    console.error("[org] failed", err);
    return res.status(500).json({ error: "Failed to load user org" });
  }
}
```

**Códigos de respuesta:**
- `401` - No hay Authorization header o token inválido
- `403` - Usuario no tiene perfil o no tiene orgId
- `200` - Todo OK, retorna `{uid, email, orgId, user}`

### 4. ✅ Frontend - Dependencias Limpias

**Problema:** Frontend tenía dependencias server-only:
- `firebase-admin` ❌ (solo para backend)
- `stripe` ❌ (solo para backend)

**Solución:**
```bash
npm remove firebase-admin stripe
```

**Dependencias correctas:**
- Frontend: `firebase` (client SDK) ✅, `@stripe/stripe-js` (client) ✅
- Backend: `firebase-admin` (admin SDK) ✅, `stripe` (node SDK) ✅

### 5. ✅ API Client con Firebase Tokens (Ya Funcionaba)

**Estado:** El frontend YA tenía correctamente implementado el API client con interceptores.

**Archivo:** `src/lib/backendApi.ts`
```typescript
backendApi.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken(); // ✅ Obtiene ID token
    config.headers.Authorization = `Bearer ${token}`; // ✅ Añade header
  }
  return config;
});

backendApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // ✅ Maneja 403 billing_blocked
    if (error.response?.status === 403 &&
        error.response?.data?.error === "billing_blocked") {
      window.location.assign("/blocked");
    }
    return Promise.reject(error);
  }
);
```

### 6. ✅ Variables de Entorno (.env.example)

**Creados:**
- `backend/.env.example` - Plantilla con todas las variables del backend
- `.env.example` - Actualizado con variables del frontend

**Actualizado:**
- `backend/.env` - STRIPE_WEBHOOK_SECRET corregido (era igual a STRIPE_SECRET_KEY)

### 7. ✅ Documentación Completa

**Creado:** `SETUP.md` - Guía completa de setup local con:
- Estructura del proyecto
- Setup backend + frontend
- Configuración de Stripe CLI para webhooks
- Tests de verificación (health check, /api/me, webhooks)
- Solución de problemas comunes
- Lista completa de endpoints

## 📊 Archivos Modificados

### Eliminados:
- ❌ `backend/index.js` (duplicado, 916 líneas)

### Modificados:
- ✅ `backend/src/app.js` - Mejorado error handling en requireOrg
- ✅ `backend/.env` - STRIPE_WEBHOOK_SECRET corregido
- ✅ `package.json` - Eliminadas dependencias: firebase-admin, stripe
- ✅ `.env.example` - Actualizado con todas las variables

### Creados:
- ✅ `backend/.env.example` - Plantilla de variables backend
- ✅ `SETUP.md` - Guía de setup completa
- ✅ `CHANGES.md` - Este archivo

## 🧪 Comandos de Testing

### 1. Backend Health
```bash
curl http://localhost:3001/
# ✅ Debe retornar: {"status":"ok",...}
```

### 2. /api/me (con autenticación)
```bash
# Obtén token desde browser console:
# const token = await firebase.auth().currentUser.getIdToken()

curl -H "Authorization: Bearer <TOKEN>" http://localhost:3001/api/me
# ✅ 200: {"uid":"...","email":"...","orgId":"...","user":{...}}
# ⚠️ 401: Token inválido o ausente
# ⚠️ 403: Usuario sin perfil o sin orgId
```

### 3. Stripe Webhook
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Stripe CLI
stripe listen --forward-to localhost:3001/webhook

# Terminal 3: Trigger evento
stripe trigger checkout.session.completed
# ✅ Backend debe mostrar: "✅ Plan updated to: ..."
```

## 🎯 Estructura Final del Backend

```
backend/
├── src/
│   └── app.js           # Express app (1075 líneas)
│       ├── Firebase Admin init
│       ├── Stripe init
│       ├── Auth middlewares (requireAuth, requireOrg, requireAdmin)
│       ├── CORS config
│       ├── Webhook route (RAW BODY) ← ANTES de express.json()
│       ├── express.json() ← DESPUÉS del webhook
│       ├── Stripe endpoints (/checkout, /check-session/:id)
│       ├── API endpoints (/api/me, /api/properties, etc.)
│       └── export default app
├── server.js            # Entry point (212 bytes)
│   └── import app + app.listen(PORT)
├── package.json
│   └── scripts: { dev: "node --watch server.js", start: "node server.js" }
├── .env                 # Variables reales (NO commitear)
└── .env.example         # Plantilla

❌ backend/index.js      # ELIMINADO (duplicado)
```

## 🚀 Para Ejecutar Localmente

```bash
# 1. Backend
cd backend
npm install
npm run dev   # http://localhost:3001

# 2. Stripe Webhooks (terminal separado)
stripe login
stripe listen --forward-to localhost:3001/webhook
# Copia el webhook secret (whsec_...) y actualiza backend/.env

# 3. Frontend (terminal separado)
npm install
npm run dev   # http://localhost:5173
```

## ✨ Mejoras Implementadas

1. **Sin duplicidades** - Un solo archivo de backend (src/app.js)
2. **Webhook funcional** - Raw body correctamente configurado
3. **Error handling robusto** - /api/me con códigos HTTP correctos (401/403/500)
4. **Dependencias limpias** - Frontend sin server-only packages
5. **API client correcto** - Ya existía con interceptores Firebase token
6. **Variables documentadas** - .env.example completos
7. **Documentación completa** - SETUP.md con guía paso a paso

## 🔒 Seguridad

- ✅ Todos los endpoints (excepto `/`, `/webhook`) requieren autenticación Firebase
- ✅ CORS configurado para localhost + production
- ✅ Webhook verifica firma de Stripe
- ✅ Middleware requireOrg valida permisos de organización
- ✅ .env y serviceAccountKey.json en .gitignore
