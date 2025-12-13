# 🎮 GUÍA PRÁCTICA - Cómo Usar el Sistema Multi-Rental

## 🚀 Quick Start

### Scenario 1: Propiedad con Alquiler Completo (ENTIRE_UNIT)

```typescript
// 1. Cargar propiedad
const property = await getProperty("prop_123");
console.log(property.rentalMode); // "ENTIRE_UNIT" ✅

// 2. Crear un lease para toda la vivienda
const lease = await createLease({
  propertyId: "prop_123",
  // roomId: undefined (vivienda completa)
  tenantName: "Juan Pérez",
  monthlyRent: 1200,
  startDate: "2025-01-01",
  endDate: "2026-12-31"
});

console.log(lease);
// {
//   id: "lease_456",
//   propertyId: "prop_123",
//   roomId: undefined,
//   tenantName: "Juan Pérez",
//   monthlyRent: 1200,
//   ...
// }
```

**¿Cómo afecta a cálculos?**
- Dashboard: Muestra 1200€/mes de ingresos por esta propiedad
- Cashflow: Incluye 1200€/mes en ingresos totales
- Yield: Calcula basado en 1200€/mes

---

### Scenario 2: Propiedad con Alquiler por Habitaciones (PER_ROOM) - [PRÓXIMA FASE]

```typescript
// 1. Cambiar modo de la propiedad
const updated = await updateProperty("prop_456", {
  rentalMode: "PER_ROOM"
});
console.log(updated.rentalMode); // "PER_ROOM"

// 2. Crear habitaciones
const rooms = await Promise.all([
  createRoom("prop_456", {
    name: "Master Bedroom",
    sizeM2: 30,
    floor: "1º",
    isActive: true
  }),
  createRoom("prop_456", {
    name: "Habitación 2",
    sizeM2: 20,
    floor: "1º",
    isActive: true
  }),
  createRoom("prop_456", {
    name: "Habitación 3",
    sizeM2: 18,
    floor: "2º",
    isActive: false  // Actualmente no disponible
  })
]);

// 3. Crear leases por habitación
const lease1 = await createLease({
  propertyId: "prop_456",
  roomId: rooms[0].id,  // AQUÍ está la diferencia
  tenantName: "María García",
  monthlyRent: 500,
  startDate: "2025-01-01"
});

const lease2 = await createLease({
  propertyId: "prop_456",
  roomId: rooms[1].id,
  tenantName: "Pedro López",
  monthlyRent: 400,
  startDate: "2025-01-15"
});

console.log(lease1.roomId); // rooms[0].id ✅
console.log(lease2.roomId); // rooms[1].id ✅
```

**¿Cómo afecta a cálculos?**
- Dashboard: Muestra 500€ + 400€ = 900€/mes (de 3 habitaciones)
- Cashflow: Suma ingresos por room (no por propiedad completa)
- Yield: Calcula basado en ocupación de rooms
- KPIs: Rendimiento por habitación

---

## 📋 OPERACIONES CRUD DISPONIBLES

### 🔍 LECTURA

```typescript
// Obtener todas las propiedades (con normalización automática)
const allProps = await getProperties(organizationId);
allProps.forEach(prop => {
  console.log(prop.rentalMode); // ✅ Garantizado
});

// Obtener propiedad específica (con normalización)
const prop = await getProperty(propertyId);
if (prop.rentalMode === "PER_ROOM") {
  const rooms = await getRooms(propertyId);
  // Mostrar habitaciones
}

// Obtener todas las habitaciones de una propiedad
const rooms = await getRooms(propertyId);
rooms.forEach(room => {
  console.log(`${room.name}: ${room.sizeM2}m²`);
});

// Obtener habitación específica
const room = await getRoom(roomId);
if (room) {
  console.log(`Habitación: ${room.name}`);
  console.log(`Piso: ${room.floor}`);
  console.log(`Activa: ${room.isActive}`);
}
```

### ➕ CREACIÓN

```typescript
// Crear habitación
const newRoom = await createRoom(propertyId, {
  name: "Habitación Principal",
  sizeM2: 25,
  floor: "Planta Baja",
  notes: "Baño ensuite",
  isActive: true
});

// La función automáticamente:
// ✅ Añade propertyId al documento
// ✅ Añade createdAt y updatedAt
// ✅ Valida que no haya NaN/Infinity
// ✅ Genera un ID único

console.log(newRoom);
// {
//   id: "auto_generated_id",
//   propertyId: "prop_123",
//   name: "Habitación Principal",
//   sizeM2: 25,
//   floor: "Planta Baja",
//   notes: "Baño ensuite",
//   isActive: true,
//   createdAt: "2025-12-12T15:30:00Z",
//   updatedAt: "2025-12-12T15:30:00Z"
// }
```

### ✏️ ACTUALIZACIÓN

```typescript
// Actualizar habitación
const updated = await updateRoom(propertyId, roomId, {
  name: "Master Suite",
  sizeM2: 30,
  notes: "Recientemente reformada"
});

// La función:
// ✅ Verifica que room.propertyId === propertyId (seguridad)
// ✅ Actualiza solo los campos enviados
// ✅ Mantiene otros campos intactos
// ✅ Añade updatedAt automáticamente
// ✅ Valida NaN/Infinity
// ✅ Devuelve el documento actualizado

console.log(updated);
// {
//   id: "room_id",
//   propertyId: "prop_123",
//   name: "Master Suite",  // ← Actualizado
//   sizeM2: 30,            // ← Actualizado
//   floor: "Planta Baja",  // ← Mantenido
//   notes: "Recientemente reformada",  // ← Actualizado
//   isActive: true,        // ← Mantenido
//   updatedAt: "2025-12-12T16:45:00Z"  // ← Auto-actualizado
// }
```

### 🗑️ ELIMINACIÓN

```typescript
// Eliminar habitación
await deleteRoom(propertyId, roomId);

// La función:
// ✅ Verifica que room existe
// ✅ Verifica que room.propertyId === propertyId (seguridad)
// ✅ Elimina el documento
// ✅ Lanza error si no pertenece a la propiedad

// Caso de error:
try {
  await deleteRoom("property_A", "room_from_property_B");
} catch (e) {
  console.error(e.message);
  // "Room does not belong to this property"
}
```

---

## 🛡️ MANEJO DE ERRORES

```typescript
// Habitación no existe
try {
  const room = await getRoom("invalid_id");
  if (!room) {
    console.log("Habitación no encontrada");
  }
} catch (e) {
  console.error("Error al leer:", e);
}

// Habitación no pertenece a propiedad
try {
  await updateRoom("property_A", "room_from_property_B", {name: "Test"});
} catch (e) {
  // Error: "Room does not belong to this property"
}

// Validación de datos
try {
  await createRoom(propertyId, {
    name: "Test",
    sizeM2: NaN,  // ❌ Inválido
    isActive: true
  });
} catch (e) {
  // Error: "Payload contains NaN/Infinity"
}
```

---

## 📊 INTEGRACIÓN CON LEASES

### AHORA (ENTIRE_UNIT)

```typescript
// Lease sin roomId = vivienda completa
const lease = await createLease({
  propertyId: "prop_A",
  // roomId: undefined ← No especificado
  tenantName: "Juan",
  monthlyRent: 1200,
  startDate: "2025-01-01"
});

// Cálculos:
// - Ingresos: 1200€/mes (toda la vivienda)
// - Dashboard muestra esta propiedad con 1200€/mes
// - Yield calculado sobre 1200€/mes
```

### FUTURO (PER_ROOM) - [FASE 3]

```typescript
// Lease con roomId = habitación específica
const lease = await createLease({
  propertyId: "prop_B",
  roomId: "room_1",  // ← Especificado
  tenantName: "María",
  monthlyRent: 500,
  startDate: "2025-01-01"
});

// Cálculos:
// - Ingresos: 500€/mes (habitación específica)
// - Dashboard suma todos los rooms ocupados: 500€ + 400€ + ... = X€/mes
// - Yield calculado sobre suma de habitaciones
// - Se puede reportar por room individual
```

---

## 🔄 MIGRACIÓN DE DATOS

### Propiedad Antigua (sin rentalMode)

```typescript
// En Firestore (documento antiguo)
{
  id: "old_prop",
  organizationId: "org1",
  address: "Calle Mayor 10",
  purchasePrice: 300000,
  // ❌ No tiene rentalMode
}

// Al cargar con getProperty():
const prop = await getProperty("old_prop");
console.log(prop.rentalMode);  // ✅ "ENTIRE_UNIT" (normalizado)

// ¿Qué pasa?
// - La lectura normaliza automáticamente
// - No modifica el documento en Firestore
// - La siguiente lectura sigue normalizando
// - Cero migraciones necesarias
```

### Actualizar a PER_ROOM

```typescript
// Cuando quieras cambiar a PER_ROOM:
const updated = await updateProperty("old_prop", {
  rentalMode: "PER_ROOM"
});

console.log(updated.rentalMode);  // "PER_ROOM"

// Ahora puedes:
// 1. Crear habitaciones
// 2. Crear leases por room
// 3. El sistema maneja todo el cambio
```

---

## 📈 CAMBIOS EN MÉTRICAS

### Con ENTIRE_UNIT

```typescript
const property = await getProperty(id);
// rentalMode: "ENTIRE_UNIT"

// Cálculo de ingresos:
const leases = await getLeases(id);
// lease1: {roomId: undefined, rent: 1200}
// leases2: {roomId: undefined, rent: 1000}
// Total: 2200€/mes (dos contratos de vivienda completa)
```

### Con PER_ROOM (Futuro)

```typescript
const property = await getProperty(id);
// rentalMode: "PER_ROOM"

const rooms = await getRooms(id);
// room1: {name: "Master", isActive: true}
// room2: {name: "Room 2", isActive: true}
// room3: {name: "Room 3", isActive: false}

const leases = await getLeases(id);
// lease1: {roomId: room1.id, rent: 500}
// lease2: {roomId: room2.id, rent: 400}
// lease3: {roomId: room3.id, rent: null} (vacía)
// Total: 900€/mes (de 3 rooms, 1 vacía)
```

---

## ✅ CHECKLIST DE GARANTÍAS

```
✅ rentalMode siempre está definido
✅ Puede ser "ENTIRE_UNIT" o "PER_ROOM"
✅ Room CRUD funcional y seguro
✅ Validaciones de propertyId en lugar
✅ Backward compatible con datos antiguos
✅ Cero impacto en pantallas actuales
✅ Cero cambios en lógica de cálculos (aún)
✅ Build verifica sin errores
✅ Documentación completa
```

---

## 🎯 Próximas Funciones (Fase 3+)

```typescript
// FUTURO: Filter de leases por room
const roomLeases = leases.filter(l => l.roomId === roomId);

// FUTURO: Ocupación por room
const occupancy = (activeLeases.length / totalRooms.length) * 100;

// FUTURO: Ingresos por modo
const entireUnitIncome = getIncomeByMode("ENTIRE_UNIT", property);
const perRoomIncome = getIncomeByMode("PER_ROOM", property);

// FUTURO: Rendimiento por room
const roomYield = calculateRoomYield(room, activeLeases);
```

---

**Sistema Listo para Producción** ✅  
**Documentación Completa** ✅  
**Próximo Step: Fase 2 - UI** ⏳
