# 🏗️ ARQUITECTURA - Sistema Multi-Rental Mode

## Diagrama de Relaciones

```
┌─────────────────────────────────────────────────────────────┐
│                    ORGANIZACIÓN                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
           PROPERTY               PROPERTY
        (id: "p1")            (id: "p2")
      rentalMode: ?           rentalMode: ?
      (normalized →           (normalized →
       "ENTIRE_UNIT")          "ENTIRE_UNIT")

      ┌─────────────┬────────────────┬──────────────┐
      ▼             ▼                ▼              ▼
    LEASE        ROOM            EXPENSE         LOAN
  (room: ∅)   (active:true)    (recurring)    (principal)
  (entire)    (name:"Hab1")    (ibi, comunidad) (amort)
              (floor:"1º")
              (sizeM2:25)

              ┌──────────────┐
              ▼              ▼
            LEASE          LEASE
         (room: "r1")   (room: "r2")
         (tenant: J)    (tenant: M)
         (rent: 400)    (rent: 350)
```

---

## Estados de rentalMode

```
┌────────────────────────────────────────┐
│  Property.rentalMode (tras getProperty) │
├────────────────────────────────────────┤
│                                         │
│  ANTES (sin normalizar):                │
│  ├─ undefined        → ERROR ❌         │
│  ├─ "ENTIRE_UNIT"    → ✅              │
│  └─ "PER_ROOM"       → ✅              │
│                                         │
│  AHORA (normalizado):                   │
│  ├─ undefined → "ENTIRE_UNIT" ✅       │
│  ├─ "ENTIRE_UNIT" → "ENTIRE_UNIT" ✅  │
│  └─ "PER_ROOM" → "PER_ROOM" ✅        │
│                                         │
└────────────────────────────────────────┘

GARANTÍA: Cualquier Property tiene rentalMode garantizado
```

---

## Flujo de Lectura de Propiedades

```
┌──────────────────────┐
│  Firestore Database  │
│  ─────────────────   │
│  Property {          │
│    id: "p1",         │
│    address: "...",   │
│    rentalMode: undef │ ← Puede estar undefined
│    ...               │
│  }                   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ getProperty(id) / getProperties(org) │
│                                      │
│ const raw = d.data();                │
│ const rentalMode =                   │
│   raw.rentalMode ?? "ENTIRE_UNIT";   │
│                                      │
│ return {                             │
│   id: d.id,                          │
│   ...raw,                            │
│   rentalMode ← GARANTIZADO           │
│ }                                    │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Aplicación (types garantizados)     │
│  ─────────────────────────────────   │
│  Property {                          │
│    id: "p1",                         │
│    address: "...",                   │
│    rentalMode: "ENTIRE_UNIT" ✅      │
│    ...                               │
│  }                                   │
└──────────────────────────────────────┘
```

---

## Operaciones CRUD de Rooms

```
┌──────────────────────────────────────────────────────────────┐
│                   ROOM CRUD OPERATIONS                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  CREATE                                                       │
│  ────────────────────────────────────────────────────────   │
│  createRoom(propertyId, {name, sizeM2, floor, notes, ...})  │
│  ├─ Validación: cleanUndefinedDeep(payload)                 │
│  ├─ Validación: hasInvalidNumbers(payload)                  │
│  ├─ Automático: propertyId += al payload                    │
│  ├─ Automático: createdAt, updatedAt                        │
│  ├─ Escribe: collection("rooms").add(payload)               │
│  └─ Retorna: Room con id generado                           │
│                                                               │
│  READ                                                         │
│  ──────────────────────────────────────────────────────────  │
│  getRooms(propertyId)                                         │
│  ├─ Query: where("propertyId", "==", propertyId)            │
│  └─ Retorna: Room[]                                          │
│                                                               │
│  getRoom(roomId)                                              │
│  ├─ Fetch: doc("rooms", roomId)                              │
│  └─ Retorna: Room | undefined                                │
│                                                               │
│  UPDATE                                                       │
│  ──────────────────────────────────────────────────────────  │
│  updateRoom(propertyId, roomId, {name, sizeM2, ...})        │
│  ├─ Validación: cleanUndefinedDeep(payload)                 │
│  ├─ Validación: hasInvalidNumbers(payload)                  │
│  ├─ Seguridad: Verifica room.propertyId === propertyId      │
│  ├─ Automático: updatedAt                                   │
│  ├─ Escribe: doc("rooms", roomId).update(payload)           │
│  ├─ Fetch: Relectura para confirmar                         │
│  └─ Retorna: Room actualizado                               │
│                                                               │
│  DELETE                                                       │
│  ──────────────────────────────────────────────────────────  │
│  deleteRoom(propertyId, roomId)                              │
│  ├─ Verificación: room existe                               │
│  ├─ Seguridad: room.propertyId === propertyId               │
│  ├─ Escribe: doc("rooms", roomId).delete()                  │
│  └─ Retorna: void                                            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Seguridad por Capas

```
┌─────────────────────────────────────────────────────────┐
│                 SECURITY LAYERS                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ LAYER 1: Input Validation                              │
│ ────────────────────────────────────────────────────  │
│ • cleanUndefinedDeep(payload)                          │
│   └─ Limpia undefined, null, NaN, Infinity            │
│ • hasInvalidNumbers(payload)                           │
│   └─ Rechaza NaN o Infinity                            │
│                                                         │
│ LAYER 2: Property Ownership                            │
│ ────────────────────────────────────────────────────  │
│ • createRoom: Automáticamente añade propertyId         │
│ • updateRoom: Verifica room.propertyId === parameter   │
│ • deleteRoom: Verifica room.propertyId === parameter   │
│   └─ Previene acceso cross-property                    │
│                                                         │
│ LAYER 3: Data Consistency                              │
│ ────────────────────────────────────────────────────  │
│ • cascadeDeleteByProperty: borra rooms asociadas       │
│   └─ No quedan rooms huérfanos                         │
│                                                         │
│ LAYER 4: Database Rules (próximo paso)                 │
│ ────────────────────────────────────────────────────  │
│ • match /databases/{database}/documents/rooms/{roomId} │
│   allow read: if request.auth != null &&              │
│              resource.data.propertyId in               │
│              getUserProperties(request.auth.uid);      │
│   allow write: if verifyOwnership(propertyId, uid);    │
│   └─ Firestore Security Rules (future phase)          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Colecciones en Firestore

```
Firestore Database
├── properties/
│   ├── doc: "p1"
│   │   ├── id: "p1"
│   │   ├── organizationId: "org1"
│   │   ├── address: "Calle Mayor 10"
│   │   ├── purchasePrice: 300000
│   │   ├── rentalMode: "ENTIRE_UNIT" (nuevo)
│   │   └── ...
│   └── doc: "p2"
│       └── ...
│
├── rooms/ (NUEVA COLECCIÓN)
│   ├── doc: "r1"
│   │   ├── id: "r1"
│   │   ├── propertyId: "p2" ← Query key
│   │   ├── name: "Habitación Principal"
│   │   ├── sizeM2: 25
│   │   ├── floor: "1º"
│   │   ├── notes: "Vistas al parque"
│   │   ├── isActive: true
│   │   ├── createdAt: "2025-12-12T10:30:00Z"
│   │   └── updatedAt: "2025-12-12T10:30:00Z"
│   │
│   └── doc: "r2"
│       ├── id: "r2"
│       ├── propertyId: "p2"
│       ├── name: "Habitación Secundaria"
│       └── ...
│
├── leases/
│   ├── doc: "l1"
│   │   ├── id: "l1"
│   │   ├── propertyId: "p1"
│   │   ├── roomId: undefined (NUEVA PROPIEDAD)
│   │   ├── tenantName: "Juan Pérez"
│   │   ├── monthlyRent: 1200
│   │   └── ...
│   │
│   └── doc: "l2"
│       ├── id: "l2"
│       ├── propertyId: "p2"
│       ├── roomId: "r1" (NUEVA PROPIEDAD - future)
│       ├── tenantName: "María García"
│       ├── monthlyRent: 400
│       └── ...
│
├── recurringExpenses/
├── oneOffExpenses/
├── loans/
└── propertyDocs/
```

---

## Patrones de Uso

### 📖 Leer Propiedades (con normalización garantizada)

```typescript
// ANTES: Podía ser undefined
const props = await getProperties(orgId);
if (props[0].rentalMode) {
  /* algo */
}

// AHORA: Garantizado
const props = await getProperties(orgId);
console.log(props[0].rentalMode); // ✅ "ENTIRE_UNIT" | "PER_ROOM"
```

### 🏠 Gestionar Rooms

```typescript
// Crear room
const newRoom = await createRoom(propertyId, {
  name: "Master Bedroom",
  sizeM2: 30,
  isActive: true,
});

// Listar rooms
const rooms = await getRooms(propertyId);
rooms.forEach((r) => console.log(r.name));

// Actualizar room
await updateRoom(propertyId, roomId, {
  name: "Master Suite",
  sizeM2: 35,
});

// Eliminar room
await deleteRoom(propertyId, roomId);
```

### 📋 Leases (preparado para future)

```typescript
// AHORA: Lease de vivienda completa
const wholeLease = await createLease({
  propertyId: "p1",
  // roomId: undefined (vivienda completa)
  tenantName: "Juan",
  monthlyRent: 1200,
});

// FUTURO: Lease de habitación específica
// const roomLease = await createLease({
//   propertyId: "p2",
//   roomId: "r1",
//   tenantName: "María",
//   monthlyRent: 400
// });
```

---

## Estado de Compatibilidad

```
┌─────────────────────────────────────────────────────┐
│           BACKWARD COMPATIBILITY                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ✅ Property sin rentalMode → carga como ENTIRE_UNIT │
│ ✅ Lease sin roomId → vivienda completa            │
│ ✅ Todas las pantallas funcionan sin cambios       │
│ ✅ Cálculos intactos (sin cambios en lógica)       │
│ ✅ Migración sin scripts necesarios                │
│                                                     │
│ ❌ Ninguna pantalla se rompió                       │
│ ❌ Ningún dato se perdió                            │
│ ❌ Ninguna incompatibilidad introducida             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Roadmap Visual

```
┌─────────────────────────────────────────────────────────────┐
│                    MULTI-RENTAL ROADMAP                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1 ✅ COMPLETE                                        │
│  ────────────────────────────────────────────────────────  │
│  ├─ Types: RentalMode, Room                               │
│  ├─ API: Room CRUD (getRooms, getRoom, create, update, delete)
│  ├─ Normalization: getProperties(), getProperty()         │
│  └─ Security: propertyId validation in all Room ops       │
│                                                             │
│  Phase 2 ⏳ READY (UI Components)                           │
│  ────────────────────────────────────────────────────────  │
│  ├─ RoomManager component (modal/drawer)                  │
│  ├─ PropertyDetail extension (show rooms list)            │
│  ├─ Room CRUD buttons (add/edit/delete)                   │
│  └─ Room form validation                                   │
│                                                             │
│  Phase 3 ⏳ READY (Lease Integration)                       │
│  ────────────────────────────────────────────────────────  │
│  ├─ OnboardingWizard: room selector                       │
│  ├─ Lease creation with roomId                            │
│  ├─ Room activity validation                              │
│  └─ Per-room lease UI                                      │
│                                                             │
│  Phase 4 ⏳ READY (Multi-Mode Calculations)                │
│  ────────────────────────────────────────────────────────  │
│  ├─ Dashboard: ENTIRE_UNIT vs PER_ROOM metrics            │
│  ├─ Cashflow: per-room income aggregation                 │
│  ├─ KPIs: mode-specific calculations                      │
│  └─ Yield by rental mode                                   │
│                                                             │
│  Phase 5 ⏳ READY (Analytics)                               │
│  ────────────────────────────────────────────────────────  │
│  ├─ Room occupancy rates                                  │
│  ├─ Per-room profitability                                │
│  ├─ Comparative analysis (ENTIRE_UNIT vs PER_ROOM)        │
│  └─ Room-level forecasting                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

**Estado Actual**: Phase 1 ✅ COMPLETE  
**Próximo Step**: Phase 2 (cuando sea necesario)  
**Fundación**: 100% lista para escalado
