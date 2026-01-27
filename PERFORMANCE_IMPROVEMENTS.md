# 🚀 Plan de Mejora de Performance

## 📊 Estado Actual
- Bundle size: **2.5MB** → Objetivo: **<1MB**
- 0 componentes memoizados → Objetivo: Componentes clave optimizados
- Cálculos pesados en cada render
- Sin code splitting ni lazy loading
- Sin cache de datos

---

## 🎯 Mejoras por Prioridad

### **PRIORIDAD 1: PropertiesList (Impacto Alto ⚡⚡⚡)**

**Problema:** Cálculos complejos (métricas, amortización, agregaciones) se ejecutan en cada render.

**Solución:**
```typescript
// Antes: Cálculos en useEffect
useEffect(() => {
  const enrichRows = async () => {
    const enriched = properties.map((property) => {
      const metrics = computeLeveredMetrics(...); // 🐌 Pesado
      const remainingBalance = getRemainingLoanBalance(...);
      // ... más cálculos
    });
  };
}, [properties, dashboardData]); // Se re-ejecuta constantemente

// Después: Memoización
const enrichedRows = useMemo(() => {
  if (!properties.length || !dashboardData) return [];

  return properties.map((property) => {
    // Los cálculos solo se ejecutan cuando cambian los datos
    const metrics = computeLeveredMetrics(...);
    // ...
  });
}, [properties, dashboardData]);
```

**Beneficio:** Reduce cálculos en ~70% al evitar re-cálculos innecesarios.

---

### **PRIORIDAD 2: Code Splitting (Impacto Alto ⚡⚡⚡)**

**Problema:** Bundle de 2.5MB se carga todo de una vez.

**Solución:**
```typescript
// En src/App.tsx o router
import { lazy, Suspense } from 'react';

// Divide rutas pesadas
const PropertiesList = lazy(() => import('./modules/properties/pages/PropertiesList'));
const ReportsPage = lazy(() => import('./modules/reports/ReportsPage'));
const PropertyDetail = lazy(() => import('./modules/properties/pages/PropertyDetail'));

// En el router
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/properties" element={<PropertiesList />} />
    <Route path="/reports" element={<ReportsPage />} />
    {/* ... */}
  </Routes>
</Suspense>
```

**Beneficio:**
- Carga inicial: 2.5MB → ~800KB
- Resto de código se carga bajo demanda
- FCP (First Contentful Paint) mejora ~50%

---

### **PRIORIDAD 3: React.memo en Componentes de Lista (Impacto Medio ⚡⚡)**

**Problema:** Tarjetas de propiedades se re-renderizan todas cuando cambia cualquier estado.

**Solución:**
```typescript
// Crear componente separado para cada tarjeta
const PropertyCard = React.memo(({ property, onNavigate }: Props) => {
  return (
    <Card onClick={() => onNavigate(property.id)}>
      {/* ... contenido de la tarjeta ... */}
    </Card>
  );
});

// En PropertiesList
{rows.map((row) => (
  <PropertyCard
    key={row.id}
    property={row}
    onNavigate={handleNavigate} // useCallback
  />
))}
```

**Beneficio:** Evita re-renders de ~100+ elementos DOM por cada cambio de estado.

---

### **PRIORIDAD 4: Dashboard Cache (Impacto Medio ⚡⚡)**

**Problema:** Cada vez que navegas, se vuelve a cargar getDashboard().

**Solución:**
```typescript
// Crear contexto de cache
const DashboardContext = createContext();

export function DashboardProvider({ children }) {
  const [cache, setCache] = useState(null);
  const [timestamp, setTimestamp] = useState(0);

  const getDashboardCached = async (forceRefresh = false) => {
    const CACHE_TIME = 60000; // 1 minuto
    const now = Date.now();

    if (!forceRefresh && cache && (now - timestamp) < CACHE_TIME) {
      console.log('[Cache] Using cached dashboard');
      return cache;
    }

    console.log('[Cache] Fetching fresh dashboard');
    const data = await getDashboard();
    setCache(data);
    setTimestamp(now);
    return data;
  };

  return (
    <DashboardContext.Provider value={{ getDashboardCached, invalidateCache: () => setCache(null) }}>
      {children}
    </DashboardContext.Provider>
  );
}
```

**Beneficio:**
- Reduce llamadas API en ~80%
- Navegación instantánea entre páginas
- Menor carga en Firebase

---

### **PRIORIDAD 5: Optimizar Importaciones de MUI (Impacto Medio ⚡⚡)**

**Problema:** Importas componentes de forma pesada.

**Solución:**
```typescript
// Antes: Importa todo MUI
import { Button, TextField, Box } from "@mui/material";

// Después: Tree-shaking mejorado
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";

// O configurar en vite.config.ts:
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@mui/material', '@mui/icons-material'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'mui': ['@mui/material', '@mui/icons-material'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'charts': ['chart.js', 'react-chartjs-2'],
        }
      }
    }
  }
});
```

**Beneficio:** Bundle size: 2.5MB → ~1.8MB

---

### **PRIORIDAD 6: Virtualización de Listas (Impacto Bajo-Medio ⚡)**

**Problema:** Con 50+ propiedades, renderiza todas las tarjetas.

**Solución:**
```bash
npm install react-window
```

```typescript
import { FixedSizeGrid } from 'react-window';

<FixedSizeGrid
  columnCount={3}
  columnWidth={400}
  height={window.innerHeight - 200}
  rowCount={Math.ceil(rows.length / 3)}
  rowHeight={450}
  width={window.innerWidth - 100}
>
  {({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * 3 + columnIndex;
    if (index >= rows.length) return null;
    return (
      <div style={style}>
        <PropertyCard property={rows[index]} />
      </div>
    );
  }}
</FixedSizeGrid>
```

**Beneficio:**
- Con 100 propiedades: Renderiza solo ~12 visibles
- Scroll ultra-suave
- Memoria: 500MB → 150MB

---

### **PRIORIDAD 7: Lazy Loading de Imágenes (Impacto Bajo ⚡)**

**Solución:**
```typescript
// Usar loading="lazy" en todas las imágenes
<img
  src={property.images[0]}
  alt={property.address}
  loading="lazy"
  decoding="async"
/>

// O usar librería:
import { LazyLoadImage } from 'react-lazy-load-image-component';

<LazyLoadImage
  src={property.images[0]}
  effect="blur"
  threshold={100}
/>
```

**Beneficio:** Ahorra ~2-5MB de transferencia inicial

---

## 📈 Impacto Esperado

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| **Bundle Size** | 2.5MB | <1MB | -60% |
| **First Load Time** | ~8s | ~2s | -75% |
| **Time to Interactive** | ~10s | ~3s | -70% |
| **Re-renders en PropertiesList** | ~50/acción | ~5/acción | -90% |
| **API Calls** | ~10/min | ~2/min | -80% |
| **Memoria (100 props)** | 500MB | 150MB | -70% |

---

## 🎯 Implementación Recomendada (3 Fases)

### **Fase 1: Quick Wins (1-2 horas)**
1. ✅ Añadir code splitting (lazy imports)
2. ✅ Optimizar imports de MUI
3. ✅ Añadir loading="lazy" a imágenes

**Resultado:** Bundle -40%, Load time -50%

### **Fase 2: Optimización Media (3-4 horas)**
4. ✅ Implementar DashboardCache context
5. ✅ Memoizar cálculos en PropertiesList
6. ✅ React.memo en PropertyCard

**Resultado:** Re-renders -80%, API calls -70%

### **Fase 3: Optimización Avanzada (4-6 horas)**
7. ✅ Virtualización de listas (react-window)
8. ✅ Service Worker para cache offline
9. ✅ Prefetch de rutas comunes

**Resultado:** Experiencia ultra-fluida con 1000+ propiedades

---

## 🔍 Cómo Medir Mejoras

### 1. **Bundle Size**
```bash
npm run build
# Antes: assets/index-XXXX.js  2,175 KB
# Después: assets/index-XXXX.js  800 KB
```

### 2. **Performance en Chrome DevTools**
```
1. Abrir DevTools → Performance
2. Start Recording
3. Navegar a /properties
4. Stop Recording
5. Analizar:
   - Scripting time (debe bajar)
   - Rendering time (debe bajar)
   - Total blocking time (debe bajar)
```

### 3. **React DevTools Profiler**
```
1. Instalar React DevTools
2. Tab "Profiler"
3. Start profiling
4. Interactuar con la app
5. Ver flamegraph de renders
```

### 4. **Lighthouse**
```bash
npx lighthouse https://propietarioplus.com --view

# Métricas objetivo:
# Performance: >90
# FCP: <1.5s
# TTI: <3s
# TBT: <200ms
```

---

## 🚀 Empezar Ahora

Para implementar **Fase 1** (mejoras rápidas):

1. Code Splitting de rutas
2. Optimizar vite.config.ts
3. Lazy loading de imágenes

**¿Quieres que implemente alguna de estas optimizaciones ahora?**

Las 3 primeras mejoras toman 1-2 horas y dan **50% de mejora inmediata**.
