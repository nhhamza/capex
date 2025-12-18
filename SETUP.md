# Setup Guide - Gestión Inmobiliaria

## 📋 Estructura del Proyecto

```
gestion/
├── backend/              # Backend Express + Firebase Admin + Stripe
│   ├── src/
│   │   └── app.js       # Express app (middlewares + rutas)
│   ├── server.js        # Entry point (app.listen)
│   ├── .env             # Variables de entorno (NO commitear)
│   └── .env.example     # Plantilla de variables
├── src/                 # Frontend React + Vite + Firebase Client
│   ├── lib/
│   │   └── backendApi.ts  # API client con interceptores
│   └── ...
├── .env.local           # Variables frontend (NO commitear)
└── .env.example         # Plantilla frontend
```

## 🚀 Setup Local

### 1. Prerequisites

- Node.js 20+
- npm
- Stripe CLI (para webhooks): `npm install -g stripe`
- Firebase project with Firestore + Storage + Auth enabled

### 2. Backend Setup

```bash
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Editar backend/.env con tus valores:
# - STRIPE_SECRET_KEY: desde https://dashboard.stripe.com/test/apikeys
# - FIREBASE_PROJECT_ID: tu project ID de Firebase
# - FIREBASE_STORAGE_BUCKET: tu bucket de Storage
# - Dejar STRIPE_WEBHOOK_SECRET como está (se actualizará en paso 4)

# Crear serviceAccountKey.json
# 1. Ve a Firebase Console > Project Settings > Service Accounts
# 2. Click "Generate new private key"
# 3. Guarda el archivo como backend/serviceAccountKey.json
```

### 3. Frontend Setup

```bash
# Desde la raíz del proyecto
npm install

# Configurar variables de entorno
cp .env.example .env.local

# Editar .env.local con tus valores de Firebase Client
# Obtén estos valores de: Firebase Console > Project Settings > General > Your apps
```

### 4. Ejecutar en Local

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Backend corriendo en http://localhost:3001
```

**Terminal 2 - Stripe Webhooks:**
```bash
stripe login
stripe listen --forward-to localhost:3001/webhook

# ⚠️ IMPORTANTE: Copia el webhook signing secret que muestra (whsec_...)
# y actualiza STRIPE_WEBHOOK_SECRET en backend/.env
# Luego reinicia el backend (Ctrl+C y npm run dev)
```

**Terminal 3 - Frontend:**
```bash
npm run dev
# Frontend corriendo en http://localhost:5173
```

## ✅ Verificar Setup

### 1. Test Backend Health
```bash
curl http://localhost:3001/
# Debe retornar: {"status":"ok","message":"Billing API is running",...}
```

### 2. Test /api/me (requiere autenticación)

Primero, registra un usuario en el frontend (http://localhost:5173/register) y obtén el ID token.

```bash
# Obtener token desde la consola del navegador (F12):
# const user = firebase.auth().currentUser
# const token = await user.getIdToken()
# console.log(token)

curl -H "Authorization: Bearer YOUR_ID_TOKEN" http://localhost:3001/api/me

# Respuesta esperada:
# - 401 si no hay token o es inválido
# - 403 si el usuario no tiene perfil/orgId
# - 200 con {uid, email, orgId, user} si todo está bien
```

### 3. Test Stripe Webhook

```bash
# Trigger un evento de prueba
stripe trigger checkout.session.completed

# Verifica en los logs del backend que el evento se procesó correctamente
# Debe mostrar: "✅ Plan updated to: ..."
```

### 4. Test Frontend End-to-End

1. Abre http://localhost:5173
2. Registra un usuario nuevo
3. Verifica que se cree el perfil y organización
4. Navega a /billing
5. Selecciona un plan y completa checkout (usa tarjeta de prueba: 4242 4242 4242 4242)
6. Verifica que el plan se actualice en Firestore

## 🔧 Solución de Problemas

### Error: "Webhook Error: No signatures found"
- Verifica que STRIPE_WEBHOOK_SECRET en backend/.env sea el correcto (debe empezar con `whsec_`)
- Asegúrate de reiniciar el backend después de actualizar el secret

### Error 500 en /api/me
- Verifica que el usuario tenga documento en Firestore collection `users`
- Verifica que el documento tenga campo `orgId` o `organizationId`
- Revisa los logs del backend para ver el error específico

### Error: "firebase-admin" no encontrado en frontend
- Ejecuta `npm remove firebase-admin stripe` en la raíz del proyecto
- Estas dependencias solo deben estar en backend

### CORS error en frontend
- Verifica que FRONTEND_URL en backend/.env incluya http://localhost:5173
- El backend acepta múltiples orígenes separados por coma

## 📚 Endpoints Disponibles

### Backend (http://localhost:3001)

**Públicos:**
- `GET /` - Health check
- `POST /webhook` - Stripe webhook (raw body)

**Autenticados (requieren Bearer token):**
- `POST /api/bootstrap` - Crear usuario + org (signup)
- `GET /api/me` - Perfil del usuario actual
- `GET /api/org/limits` - Límites de la organización
- `GET /api/properties` - Listar propiedades
- `POST /api/properties` - Crear propiedad
- `PUT /api/properties/:id` - Actualizar propiedad
- `DELETE /api/properties/:id` - Eliminar propiedad
- `GET /api/collection/:col?propertyId=x` - Listar items de colección
- `POST /api/collection/:col` - Crear item
- `PUT /api/collection/:col/:id` - Actualizar item
- `DELETE /api/collection/:col/:id` - Eliminar item
- `POST /checkout` - Crear sesión de checkout de Stripe
- `GET /check-session/:sessionId` - Verificar estado de checkout

Colecciones permitidas: `leases`, `loans`, `rooms`, `recurringExpenses`, `oneOffExpenses`, `propertyDocs`, `dealScenarios`

## 🎯 Próximos Pasos

1. ✅ Obtener el webhook secret real ejecutando `stripe listen`
2. ✅ Actualizar STRIPE_WEBHOOK_SECRET en backend/.env
3. ✅ Reiniciar el backend
4. ✅ Probar un flujo completo de checkout
5. ✅ Verificar que los webhooks actualicen correctamente el plan en Firestore

## 📝 Notas Importantes

- **NO commitear archivos .env** (ya están en .gitignore)
- El frontend usa `@stripe/stripe-js` (client-side)
- El backend usa `stripe` (server-side)
- El frontend usa `firebase` (client SDK)
- El backend usa `firebase-admin` (admin SDK)
- Todos los endpoints de API excepto `/`, `/webhook`, `/check-session` requieren autenticación
- El webhook DEBE recibir raw body (ya está configurado correctamente)
