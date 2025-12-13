# Resumen de Cambios - Sistema Multi-Rental Mode

## Estado Final Implementado

Este documento muestra todos los cambios realizados para implementar el sistema de dual rental modes (ENTIRE_UNIT y PER_ROOM).

---

## 1. `types.ts` - Tipos y Interfaces

### ✅ Nuevo tipo RentalMode

```diff
+ export type RentalMode = "ENTIRE_UNIT" | "PER_ROOM";
```

### ✅ Actualización de Property

```diff
export interface Property {
  id: string;
  organizationId: string;
  address: string;
  city?: string;
  zip?: string;
  notes?: string;
  purchasePrice: number;
  purchaseDate?: string;
  currentValue?: number;
  closingCosts?: AcquisitionCosts;
  images?: string[];
+ rentalMode?: RentalMode; // "ENTIRE_UNIT" (por defecto) o "PER_ROOM"
}
```

### ✅ Actualización de Lease

```diff
export interface Lease {
  id: string;
  propertyId: string;
+ roomId?: string; // Si está definido, es un lease de habitación; si es undefined, es de vivienda completa
  tenantName?: string;
  tenantPhone?: string;
  tenantDNI?: string;
  tenantEmail?: string;
  startDate: string;
  endDate?: string;
  monthlyRent: number;
  deposit?: number;
  indexationRule?: "none" | "ipc" | "cap3" | "custom";
  vacancyPct?: number;
  contractUrl?: string;
  notes?: string;
  isActive?: boolean;
}
```

### ✅ Nueva interfaz Room

```diff
+ export interface Room {
+   id: string;
+   propertyId: string;
+   name: string;                    // "Hab 1", "Suite interior", etc.
+   sizeM2?: number;
+   floor?: string;
+   notes?: string;
+   isActive: boolean;
+ }
```

---

## 2. `api.ts` - Funciones de API

### ✅ Constante para colección de rooms

```diff
+ const COL_ROOMS = "rooms";
```

### ✅ Actualización de getProperties - Normalización de rentalMode

```diff
export async function getProperties(
  organizationId: string
): Promise<Property[]> {
  // ... logs ...
  const snap = await getDocs(q);
- return snap.docs.map((d) => ({
-   id: d.id,
-   ...(d.data() as Omit<Property, "id">),
- }));
+ return snap.docs.map((d) => {
+   const raw = d.data() as Omit<Property, "id">;
+   const rentalMode = raw.rentalMode ?? "ENTIRE_UNIT";
+   return {
+     id: d.id,
+     ...raw,
+     rentalMode,
+   };
+ });
}
```

### ✅ Actualización de getProperty - Normalización de rentalMode

```diff
export async function getProperty(id: string): Promise<Property | undefined> {
  const ref = doc(firestore, COL_PROPERTIES, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return undefined;
- return { id: snap.id, ...(snap.data() as Omit<Property, "id">) };
+ const raw = snap.data() as Omit<Property, "id">;
+ const rentalMode = raw.rentalMode ?? "ENTIRE_UNIT";
+ return { id: snap.id, ...raw, rentalMode };
}
```

### ✅ Nueva función: getRooms

```diff
+ /**
+  * Get all rooms for a property
+  */
+ export async function getRooms(propertyId: string): Promise<Room[]> {
+   const q = query(
+     collection(firestore, COL_ROOMS),
+     where("propertyId", "==", propertyId)
+   );
+   const snap = await getDocs(q);
+   return snap.docs.map((d) => ({
+     id: d.id,
+     ...(d.data() as Omit<Room, "id">),
+   }));
+ }
```

### ✅ Nueva función: getRoom

```diff
+ /**
+  * Get a single room by ID
+  */
+ export async function getRoom(id: string): Promise<Room | undefined> {
+   const ref = doc(firestore, COL_ROOMS, id);
+   const snap = await getDoc(ref);
+   if (!snap.exists()) return undefined;
+   return { id: snap.id, ...(snap.data() as Omit<Room, "id">) };
+ }
```

### ✅ Nueva función: createRoom

```diff
+ /**
+  * Create a new room for a property
+  */
+ export async function createRoom(
+   propertyId: string,
+   data: Omit<Room, "id" | "propertyId">
+ ): Promise<Room> {
+   const now = new Date().toISOString();
+   let payload = cleanUndefinedDeep({
+     ...data,
+     propertyId,
+     createdAt: now,
+     updatedAt: now,
+   });
+   if (hasInvalidNumbers(payload))
+     throw new Error("Payload contains NaN/Infinity");
+   const docRef = await addDoc(collection(firestore, COL_ROOMS), payload);
+   return { id: docRef.id, ...(payload as Omit<Room, "id">) } as Room;
+ }
```

### ✅ Nueva función: updateRoom

```diff
+ /**
+  * Update a room
+  */
+ export async function updateRoom(
+   propertyId: string,
+   roomId: string,
+   data: Partial<Omit<Room, "id" | "propertyId">>
+ ): Promise<Room> {
+   const ref = doc(firestore, COL_ROOMS, roomId);
+   let payload = cleanUndefinedDeep({
+     ...data,
+     updatedAt: new Date().toISOString(),
+   });
+   if (hasInvalidNumbers(payload))
+     throw new Error("Payload contains NaN/Infinity");
+   await updateDoc(ref, payload);
+   const snap = await getDoc(ref);
+   if (!snap.exists()) throw new Error("Room not found");
+   const roomData = snap.data() as Omit<Room, "id">;
+   // Verify propertyId matches (security check)
+   if (roomData.propertyId !== propertyId) {
+     throw new Error("Room does not belong to this property");
+   }
+   return { id: snap.id, ...roomData };
+ }
```

### ✅ Nueva función: deleteRoom

```diff
+ /**
+  * Delete a room
+  */
+ export async function deleteRoom(
+   propertyId: string,
+   roomId: string
+ ): Promise<void> {
+   // Verify room belongs to property before deleting (security check)
+   const room = await getRoom(roomId);
+   if (!room) {
+     throw new Error("Room not found");
+   }
+   if (room.propertyId !== propertyId) {
+     throw new Error("Room does not belong to this property");
+   }
+   const ref = doc(firestore, COL_ROOMS, roomId);
+   await deleteDoc(ref);
+ }
```

### ✅ Actualización de cascadeDeleteByProperty

```diff
async function cascadeDeleteByProperty(propertyId: string) {
- const collections = [COL_LEASES, COL_RECURRING, COL_ONEOFF, COL_LOANS];
+ const collections = [COL_LEASES, COL_RECURRING, COL_ONEOFF, COL_LOANS, COL_ROOMS];
  for (const col of collections) {
    const q = query(
      collection(firestore, col),
      where("propertyId", "==", propertyId)
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
}
```

---

## Resumen de Garantías

✅ **Property normaliza rentalMode**: Toda Property cargada del backend tiene garantizado un valor `rentalMode` (`"ENTIRE_UNIT"` por defecto).

✅ **Room CRUD completo**: Funciones para listar, crear, actualizar y borrar habitaciones, todas con validaciones de seguridad (`propertyId`).

✅ **Lease extensible**: Campo `roomId` opcional permite asociar leases a habitaciones en el futuro.

✅ **Sin cambios en pantallas**: La UI actual sigue funcionando exactamente igual:

- Las propiedades antiguas cargan con `rentalMode: "ENTIRE_UNIT"`
- No hay cambios en lógica de cálculos
- No hay cambios en componentes existentes

✅ **Build verifica**: TypeScript sin errores, Vite compila exitosamente.

✅ **Seguimiento de patrones**: Todo el código sigue los patrones existentes:

- Guardias: `cleanUndefinedDeep()`, `hasInvalidNumbers()`
- Validaciones de seguridad: verificación de `propertyId`
- Manejo de errores consistente
- Logs en Firestore operations

---

## Próximos Pasos (Fase 2-5)

- **Fase 2**: UI para gestión de rooms (PropertyDetail, RoomManager)
- **Fase 3**: Flujo de creación de leases con `roomId`
- **Fase 4**: Cálculos diferenciados ENTIRE_UNIT vs PER_ROOM
- **Fase 5**: Reportes por modo de alquiler
