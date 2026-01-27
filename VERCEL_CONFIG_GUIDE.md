# Guía de Configuración Vercel - Solución de Problemas de Conexión

## 🎯 Problema Resuelto

Cuando la aplicación está inactiva por mucho tiempo, aparecía el error: **"[Auth] Network error - backend unreachable"**

### Causas Identificadas:
1. **Token de Firebase expirado** - Los tokens expiran después de 1 hora
2. **Vercel Cold Start** - El backend se "duerme" después de 5-15 minutos de inactividad
3. **Logout agresivo** - El frontend hacía logout inmediatamente en errores de red
4. **Timeouts cortos** - No había tiempo suficiente para que el backend despertara

---

## ✅ Soluciones Implementadas

### 1. **Token Refresh Automático** (backendApi.ts)
- ✅ Verifica expiración del token antes de cada llamada
- ✅ Refresca automáticamente si expira en menos de 5 minutos
- ✅ Fallback a token sin refresh en caso de error

### 2. **Timeout Aumentado** (backendApi.ts)
- ✅ Timeout aumentado de 2s a 15s para cold starts
- ✅ Permite que Vercel despierte el backend sin errores

### 3. **Reintentos Inteligentes** (authContext.tsx)
- ✅ Hasta 2 reintentos automáticos con backoff progresivo
- ✅ Espera adicional de 3s para cold starts
- ✅ No hace logout en errores de red temporales

### 4. **Manejo de Errores Mejorado** (authContext.tsx)
- ✅ Solo hace logout en token inválido (401)
- ✅ Mantiene sesión en errores de red temporales
- ✅ Permite al usuario reintentar manualmente

---

## 🔧 Configuración Requerida en Vercel

### **Frontend (propietarioplus.com)**

#### Variables de Entorno:
```env
VITE_BACKEND_URL=https://capex-xl77.vercel.app
VITE_FIREBASE_API_KEY=tu-api-key
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
VITE_FIREBASE_APP_ID=tu-app-id
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_STRIPE_PRICE_SOLO=price_...
VITE_STRIPE_PRICE_PRO=price_...
VITE_STRIPE_PRICE_AGENCY=price_...
VITE_CHECKOUT_SUCCESS_URL=https://propietarioplus.com/billing/success
VITE_CHECKOUT_CANCEL_URL=https://propietarioplus.com/billing/cancel
```

#### Configuración de Dominio:
1. Ve a **Settings → Domains** en tu proyecto frontend
2. Añade `propietarioplus.com` y `www.propietarioplus.com`
3. Configura el DNS según las instrucciones de Vercel

---

### **Backend (capex-xl77.vercel.app)**

#### Variables de Entorno:
```env
FRONTEND_URL=https://propietarioplus.com,https://www.propietarioplus.com
FIREBASE_PROJECT_ID=tu-proyecto-id
FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_SOLO=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_AGENCY=price_...
```

#### CORS ya está configurado correctamente en app.js:
```javascript
const allowedOrigins = new Set([
  "https://propietarioplus.com",
  "https://www.propietarioplus.com",
  // ... otros origins
]);
```

---

## 📋 Checklist de Despliegue

### Frontend:
- [ ] Variables de entorno configuradas en Vercel
- [ ] `VITE_BACKEND_URL` apunta a `https://capex-xl77.vercel.app`
- [ ] Dominio `propietarioplus.com` configurado
- [ ] DNS configurado correctamente
- [ ] Build y deploy exitoso

### Backend:
- [ ] Variables de entorno configuradas en Vercel
- [ ] `FRONTEND_URL` incluye `https://propietarioplus.com`
- [ ] `FIREBASE_SERVICE_ACCOUNT` es un JSON válido
- [ ] Firebase Storage Bucket configurado
- [ ] Stripe webhook configurado
- [ ] Build y deploy exitoso

### Testing:
- [ ] Login funciona desde `propietarioplus.com`
- [ ] No hay errores CORS en la consola
- [ ] Después de 10 minutos de inactividad, las llamadas funcionan (cold start)
- [ ] Token se refresca automáticamente después de 1 hora

---

## 🚀 Cómo Verificar que Todo Funciona

### 1. **Verificar CORS**
```bash
curl -H "Origin: https://propietarioplus.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Authorization" \
     -X OPTIONS \
     https://capex-xl77.vercel.app/api/health/firestore

# Debe retornar headers:
# Access-Control-Allow-Origin: https://propietarioplus.com
# Access-Control-Allow-Credentials: true
```

### 2. **Verificar Cold Start**
- Espera 15 minutos sin usar la app
- Haz login o refresca la página
- Debería cargar correctamente (puede tardar 3-5 segundos)
- Verifica en la consola: no debe haber "[Auth] Network error - backend unreachable"

### 3. **Verificar Token Refresh**
- Usa la app normalmente
- Después de 1 hora, haz cualquier operación
- El token debería refrescarse automáticamente sin hacer logout

---

## 🔍 Debugging

### Si sigues teniendo problemas:

1. **Check Frontend Logs** (Vercel Dashboard → tu-proyecto-frontend → Deployments → Logs)
   - Busca: "Network error", "backend unreachable", "CORS"

2. **Check Backend Logs** (Vercel Dashboard → tu-proyecto-backend → Deployments → Logs)
   - Busca: "CORS BLOCKED", "verifyIdToken failed", "firebase_not_configured"

3. **Check Browser Console**
   ```javascript
   // Ver configuración actual
   console.log('Backend URL:', import.meta.env.VITE_BACKEND_URL);

   // Ver si CORS está funcionando
   fetch('https://capex-xl77.vercel.app/api/health/firestore', {
     method: 'GET',
     headers: { 'Origin': 'https://propietarioplus.com' }
   }).then(r => console.log('CORS OK:', r.ok));
   ```

4. **Verificar Firebase Auth Token**
   ```javascript
   // En la consola del navegador
   import { auth } from '@/firebase/client';
   const token = await auth.currentUser?.getIdToken();
   console.log('Token:', token);

   const tokenResult = await auth.currentUser?.getIdTokenResult();
   console.log('Token expira:', new Date(tokenResult.expirationTime));
   ```

---

## 📞 Contacto

Si después de seguir esta guía sigues teniendo problemas:
1. Verifica los logs de Vercel (frontend y backend)
2. Comprueba que las variables de entorno están correctamente configuradas
3. Asegúrate de que el dominio DNS está propagado (puede tardar hasta 48h)

---

## 🎉 Resultado Esperado

Después de aplicar estas correcciones:
- ✅ La app funciona incluso después de estar inactiva por horas
- ✅ Los tokens se refrescan automáticamente
- ✅ Los cold starts del backend se manejan correctamente
- ✅ No hay logouts inesperados por errores de red temporales
- ✅ La experiencia del usuario es fluida y sin interrupciones
