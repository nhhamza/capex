# 🔒 Security Audit Report - PropietarioPlus

**Fecha:** 2026-01-27
**Versión:** Current Production
**Nivel de Riesgo General:** 🟡 MEDIO (requiere atención)

---

## 📋 Executive Summary

### ✅ **Fortalezas de Seguridad:**
1. ✅ Autenticación robusta con Firebase Auth
2. ✅ Tokens JWT verificados en cada request
3. ✅ CORS correctamente configurado
4. ✅ Sin uso de `eval()` o `innerHTML` peligroso
5. ✅ HTTPS enforced (Vercel)
6. ✅ Separación frontend/backend
7. ✅ Role-based access control (admin/user)

### 🔴 **Vulnerabilidades Críticas Detectadas:**
1. 🔴 **jsPDF v3.0.4** - Local File Inclusion/Path Traversal (CRITICAL)
2. 🔴 **React Router ≤1.23.1** - XSS via Open Redirects (HIGH)
3. 🟡 **@capacitor/cli** - Vulnerabilidad en tar (HIGH)

### 🟡 **Áreas de Mejora:**
1. 🟡 Rate limiting no implementado
2. 🟡 No hay CSP (Content Security Policy) headers
3. 🟡 Falta input validation explícita en algunos endpoints
4. 🟡 No hay logging de eventos de seguridad

---

## 🔴 VULNERABILIDADES CRÍTICAS (Acción Inmediata Requerida)

### 1. **jsPDF - Local File Inclusion (CRITICAL)**

**Severidad:** 🔴 CRITICAL
**CVE:** GHSA-f8cm-6447-x5h2
**Versión Actual:** 3.0.4
**Versión Segura:** ≥4.0.0

**Descripción:**
jsPDF ≤3.0.4 tiene una vulnerabilidad de Local File Inclusion/Path Traversal que permite a un atacante leer archivos del sistema.

**Impacto en tu app:**
- Usas jsPDF en `/reports` para exportar PDFs
- Un atacante podría explotar esto si puede controlar los parámetros del PDF

**Solución:**
```bash
npm install jspdf@latest jspdf-autotable@latest
```

**Acción:** 🚨 URGENTE - Actualizar ANTES de producción

---

### 2. **React Router - XSS via Open Redirects (HIGH)**

**Severidad:** 🟠 HIGH
**CVE:** GHSA-2w69-qvjg-hvjx
**Versión Actual:** ≤1.23.1
**Versión Segura:** ≥1.24.0

**Descripción:**
React Router es vulnerable a XSS mediante redirects abiertos.

**Impacto en tu app:**
- Un atacante podría crear URLs maliciosas que redirigen a sitios phishing
- Ejemplo: `propietarioplus.com/properties?redirect=evil.com`

**Solución:**
```bash
npm install react-router-dom@latest
```

**Acción:** 🚨 ALTA PRIORIDAD - Actualizar esta semana

---

### 3. **@capacitor/cli - Vulnerabilidad en tar (HIGH)**

**Severidad:** 🟠 HIGH
**Dependencia:** tar (sub-dependencia)

**Solución:**
```bash
npm install @capacitor/cli@latest
# O si no usas Capacitor en producción:
npm uninstall @capacitor/cli
```

**Acción:** ⚠️ Media prioridad (si no usas Capacitor, desinstalar)

---

## ✅ FORTALEZAS DE SEGURIDAD DETECTADAS

### **1. Autenticación Firebase (Excelente ✅)**

**Implementación:**
```typescript
// backend/src/app.js:413-428
async function requireAuth(req, res, next) {
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing Bearer token" });

  const decoded = await admin.auth().verifyIdToken(token);
  req.user = { uid: decoded.uid, email: decoded.email, claims: decoded };
}
```

**Por qué es seguro:**
- ✅ Tokens JWT verificados con Firebase Admin SDK
- ✅ Tokens expirados rechazados automáticamente
- ✅ No se aceptan tokens manipulados

---

### **2. Authorization Checks (Buena ✅)**

**Implementación:**
```typescript
// Middleware de autorización en cascada
requireAuth → requireOrg → requireBillingOk → requireAdmin
```

**Capas de protección:**
1. ✅ `requireAuth`: Usuario debe estar autenticado
2. ✅ `requireOrg`: Usuario debe tener organización
3. ✅ `requireBillingOk`: Billing debe estar activo
4. ✅ `requireAdmin`: Solo admins pueden acceder (UsersPage)

**Validación en cada endpoint:**
```javascript
// Ejemplo: backend/src/app.js:780
app.get("/api/properties", requireAuth, requireOrg, requireBillingOk, ...);
app.delete("/api/properties/:id", requireAuth, requireOrg, requireBillingOk, ...);
```

---

### **3. CORS Configuration (Excelente ✅)**

**Implementación:**
```javascript
// backend/src/app.js:152-162
const allowedOrigins = new Set([
  "https://propietarioplus.com",
  "https://www.propietarioplus.com",
  // ... localhost para dev
]);
```

**Por qué es seguro:**
- ✅ Whitelist específica de origins
- ✅ No usa wildcard `*`
- ✅ Credentials enabled solo para origins permitidos

---

### **4. Firestore Security (Buena ✅)**

**Validación de organizationId:**
```javascript
// Todos los queries filtran por organizationId
const snap = await db.collection("properties")
  .where("organizationId", "==", req.orgId)
  .get();

// Al eliminar, verifica ownership
if (snap.data().organizationId !== req.orgId) {
  return res.status(403).json({ error: "forbidden" });
}
```

**Por qué es seguro:**
- ✅ Multi-tenancy: cada org solo ve sus datos
- ✅ Validación de ownership antes de modificar/eliminar
- ✅ No hay queries sin filtro de organizationId

---

### **5. No XSS Vulnerabilities (Excelente ✅)**

**Análisis:**
```bash
# Búsqueda de patrones peligrosos
grep -r "innerHTML" → ❌ No encontrado
grep -r "dangerouslySetInnerHTML" → ❌ No encontrado
grep -r "eval(" → ❌ No encontrado
```

**React escapa automáticamente:**
- ✅ Todos los renders usan JSX (escapado por defecto)
- ✅ No hay interpolación manual de HTML
- ✅ No se usa `eval()` en ningún lugar

---

## 🟡 ÁREAS DE MEJORA (Recomendaciones)

### **1. Rate Limiting (Recomendado 🟡)**

**Problema:**
No hay límite de requests por IP/usuario. Un atacante podría hacer:
- Brute force de login
- DoS (Denial of Service)
- Spam de API calls

**Solución:**
```javascript
// backend/src/app.js - agregar después de CORS
import rateLimit from 'express-rate-limit';

// Rate limiter general
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por ventana
  message: { error: 'Too many requests, please try again later.' }
});

// Rate limiter para auth endpoints (más estricto)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Solo 5 intentos de login
  skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/api/login', authLimiter);
app.post('/api/signup/initialize', authLimiter, ...);
```

**Prioridad:** 🟡 Media (implementar en próximo sprint)

---

### **2. Content Security Policy (CSP) Headers (Recomendado 🟡)**

**Problema:**
No hay headers CSP, permitiendo scripts inline de cualquier origen.

**Solución:**
```javascript
// backend/src/app.js - agregar middleware
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://capex-xl77.vercel.app", "https://*.firebaseapp.com"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

**Prioridad:** 🟡 Media-Baja

---

### **3. Input Validation (Recomendado 🟡)**

**Problema:**
No hay validación explícita de inputs en algunos endpoints.

**Ejemplo actual:**
```javascript
// Sin validación de formato
app.post("/api/properties", async (req, res) => {
  const payload = req.body || {}; // Acepta cualquier cosa
  payload.organizationId = req.orgId;
  await ref.set(payload);
});
```

**Solución:**
```javascript
import Joi from 'joi';

const propertySchema = Joi.object({
  address: Joi.string().required().max(500),
  purchasePrice: Joi.number().positive().required(),
  currentValue: Joi.number().positive(),
  rentalMode: Joi.string().valid('ENTIRE_UNIT', 'PER_ROOM'),
  // ... más validaciones
});

app.post("/api/properties", async (req, res) => {
  const { error, value } = propertySchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  value.organizationId = req.orgId;
  await ref.set(value);
});
```

**Prioridad:** 🟡 Media

---

### **4. Security Logging (Recomendado 🟡)**

**Problema:**
No hay logs de eventos de seguridad importantes.

**Eventos a loguear:**
- ❌ Intentos de login fallidos
- ❌ Accesos denegados (403)
- ❌ Cambios de roles
- ❌ Eliminación de recursos

**Solución:**
```javascript
// Agregar logging middleware
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(data) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      console.warn('[SECURITY]', {
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userId: req.user?.uid,
        method: req.method,
        path: req.path,
        status: res.statusCode
      });
    }
    originalSend.call(this, data);
  };
  next();
});
```

**Prioridad:** 🟡 Baja

---

### **5. Secrets Management (Mejorable 🟡)**

**Análisis actual:**
```javascript
// ✅ BUENO: Usa variables de entorno
const stripeKey = process.env.STRIPE_SECRET_KEY;
const firebaseAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

// ✅ BUENO: No hay secrets hardcodeados
```

**Recomendación adicional:**
- Usar Vercel Environment Variables (ya lo haces ✅)
- Considerar rotación periódica de Firebase Service Account
- Usar diferentes keys para test/production

**Prioridad:** ✅ Ya está bien implementado

---

## 📊 SECURITY SCORING

| Categoría | Score | Estado |
|-----------|-------|--------|
| **Authentication** | 9/10 | ✅ Excelente |
| **Authorization** | 8/10 | ✅ Buena |
| **Input Validation** | 6/10 | 🟡 Mejorable |
| **CORS/CSP** | 7/10 | 🟡 Buena, CSP falta |
| **Dependencies** | 4/10 | 🔴 Vulnerabilidades críticas |
| **Rate Limiting** | 0/10 | 🔴 No implementado |
| **Logging** | 5/10 | 🟡 Básico |
| **Data Protection** | 9/10 | ✅ Excelente (Firestore) |
| **HTTPS/TLS** | 10/10 | ✅ Perfecto (Vercel) |
| **Secrets Management** | 8/10 | ✅ Buena |

**Overall Security Score: 6.6/10** 🟡 MEDIUM

---

## 🚨 PLAN DE ACCIÓN INMEDIATO

### **Prioridad CRÍTICA (Hacer HOY):**
```bash
# 1. Actualizar dependencias vulnerables
npm install jspdf@latest jspdf-autotable@latest
npm install react-router-dom@latest

# 2. Verificar que todo funciona
npm run build
npm run dev # Probar exports PDF y navegación

# 3. Commit y deploy
git add package*.json
git commit -m "security: fix critical vulnerabilities in jspdf and react-router"
git push
```

### **Prioridad ALTA (Esta Semana):**
```bash
# Instalar y configurar rate limiting
npm install express-rate-limit
# Implementar según código en sección "Rate Limiting"
```

### **Prioridad MEDIA (Próximas 2 semanas):**
- Implementar input validation con Joi
- Agregar CSP headers con Helmet
- Mejorar security logging

### **Prioridad BAJA (Cuando tengas tiempo):**
- Auditoría completa de Firestore Security Rules
- Implementar 2FA (opcional)
- Agregar CAPTCHA en signup (si hay spam)

---

## 🔍 TESTING DE SEGURIDAD

### **1. Test de Autenticación:**
```bash
# Sin token → debe fallar
curl https://capex-xl77.vercel.app/api/properties

# Con token inválido → debe fallar
curl -H "Authorization: Bearer fake-token" \
  https://capex-xl77.vercel.app/api/properties

# Con token válido → debe funcionar
# (obtener token desde Firebase Auth)
```

### **2. Test de Authorization:**
```bash
# Intentar acceder a datos de otra org → debe fallar (403)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://capex-xl77.vercel.app/api/properties/OTHER_ORG_PROPERTY_ID
```

### **3. Test de CORS:**
```bash
# Desde origin no permitido → debe bloquear
curl -H "Origin: https://evil.com" \
  https://capex-xl77.vercel.app/api/properties
```

---

## 📚 RECURSOS Y REFERENCIAS

### **Security Best Practices:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

### **Herramientas Recomendadas:**
- `npm audit` - Vulnerabilidades en dependencias
- [Snyk](https://snyk.io/) - Monitoreo continuo de seguridad
- [OWASP ZAP](https://www.zaproxy.org/) - Penetration testing
- Lighthouse Security Audit (Chrome DevTools)

---

## ✅ CONCLUSIÓN

Tu aplicación tiene **buenos fundamentos de seguridad**:
- ✅ Autenticación sólida con Firebase
- ✅ Authorization bien implementada
- ✅ HTTPS y CORS configurados
- ✅ Sin vulnerabilidades XSS/injection obvias

**Pero necesita atención URGENTE en:**
- 🔴 Actualizar jsPDF y React Router (vulnerabilidades críticas)
- 🟡 Implementar rate limiting
- 🟡 Mejorar input validation

**Con los fixes propuestos, tu score subiría de 6.6/10 a 8.5/10** 🎯

---

**Última actualización:** 2026-01-27
**Próxima auditoría recomendada:** Cada 3 meses o después de cambios mayores
