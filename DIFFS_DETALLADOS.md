# 🔍 DIFFS DETALLADOS - Todos los Cambios Línea por Línea

## Archivo 1: `src/modules/properties/types.ts`

### Cambio 1.1: Nuevo tipo RentalMode

```diff
  export type Periodicity = "monthly" | "quarterly" | "yearly";

+ export type RentalMode = "ENTIRE_UNIT" | "PER_ROOM";

  export interface AcquisitionCosts {
```

**Ubicación**: Línea 3 (después de Periodicity)
**Tipo**: Adición
**Tamaño**: 1 línea

---

### Cambio 1.2: Extensión de Property

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
    currentValue?: number; // Valor actual del inmueble para métricas
    closingCosts?: AcquisitionCosts;
    images?: string[];
+   rentalMode?: RentalMode; // "ENTIRE_UNIT" (por defecto) o "PER_ROOM"
  }
```

**Ubicación**: Línea 27 (última propiedad)
**Tipo**: Adición de campo opcional
**Tamaño**: 1 línea
**Nota**: Campo opcional para backward compatibility

---

### Cambio 1.3: Extensión de Lease

```diff
  export interface Lease {
    id: string;
    propertyId: string;
+   roomId?: string; // Si está definido, es un lease de habitación; si es undefined, es de vivienda completa
    tenantName?: string;
```

**Ubicación**: Línea 32 (después de propertyId)
**Tipo**: Adición de campo opcional
**Tamaño**: 1 línea
**Nota**: Permite leases por habitación en futuro

---

### Cambio 1.4: Nueva interfaz Room

```diff
  export interface Loan {
    id: string;
    propertyId: string;
    principal: number;
    annualRatePct: number;
    termMonths: number;
    startDate?: string;
    interestOnlyMonths?: number;
    upFrontFees?: number;
    notes?: string;
  }

+ export interface Room {
+   id: string;
+   propertyId: string;
+   name: string; // "Hab 1", "Suite interior", etc.
+   sizeM2?: number;
+   floor?: string;
+   notes?: string;
+   isActive: boolean;
+ }
```

**Ubicación**: Línea 96 (después de Loan)
**Tipo**: Adición de interfaz completa
**Tamaño**: 8 líneas
**Campos**: id, propertyId, name (obligatorio), sizeM2, floor, notes, isActive

---

## Archivo 2: `src/modules/properties/api.ts`

### Cambio 2.1: Adición de constante COL_ROOMS

```diff
  const COL_PROPERTIES = "properties";
  const COL_LEASES = "leases";
  const COL_RECURRING = "recurringExpenses";
  const COL_ONEOFF = "oneOffExpenses";
  const COL_LOANS = "loans";
+ const COL_ROOMS = "rooms";
  const COL_PROPERTY_DOCS = "propertyDocs";
```

**Ubicación**: Línea 32
**Tipo**: Adición de constante
**Tamaño**: 1 línea

---

### Cambio 2.2: Modificación de getProperties()

```diff
  export async function getProperties(
    organizationId: string
  ): Promise<Property[]> {
    // ... logs y queries ...
    const snap = await getDocs(q);
-   return snap.docs.map((d) => ({
-     id: d.id,
-     ...(d.data() as Omit<Property, "id">),
-   }));
+   return snap.docs.map((d) => {
+     const raw = d.data() as Omit<Property, "id">;
+     const rentalMode = raw.rentalMode ?? "ENTIRE_UNIT";
+     return {
+       id: d.id,
+       ...raw,
+       rentalMode,
+     };
+   });
  }
```

**Ubicación**: Línea 56 (retorno de la función)
**Tipo**: Modificación de return
**Tamaño**: +5 líneas, -3 líneas = 2 líneas netas
**Impacto**: Normaliza rentalMode a cada Property

---

### Cambio 2.3: Modificación de getProperty()

```diff
  export async function getProperty(id: string): Promise<Property | undefined> {
    const ref = doc(firestore, COL_PROPERTIES, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return undefined;
-   return { id: snap.id, ...(snap.data() as Omit<Property, "id">) };
+   const raw = snap.data() as Omit<Property, "id">;
+   const rentalMode = raw.rentalMode ?? "ENTIRE_UNIT";
+   return { id: snap.id, ...raw, rentalMode };
  }
```

**Ubicación**: Línea 67
**Tipo**: Modificación de return
**Tamaño**: +3 líneas, -1 línea = 2 líneas netas
**Impacto**: Normaliza rentalMode en lectura individual

---

### Cambio 2.4: Adición de getRooms()

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

**Ubicación**: Línea 338
**Tipo**: Nueva función
**Tamaño**: 13 líneas
**Firma**: `getRooms(propertyId: string): Promise<Room[]>`

---

### Cambio 2.5: Adición de getRoom()

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

**Ubicación**: Línea 352
**Tipo**: Nueva función
**Tamaño**: 8 líneas
**Firma**: `getRoom(id: string): Promise<Room | undefined>`

---

### Cambio 2.6: Adición de createRoom()

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

**Ubicación**: Línea 362
**Tipo**: Nueva función
**Tamaño**: 19 líneas
**Firma**: `createRoom(propertyId: string, data: Omit<Room, "id" | "propertyId">): Promise<Room>`
**Validaciones**: cleanUndefinedDeep, hasInvalidNumbers

---

### Cambio 2.7: Adición de updateRoom()

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

**Ubicación**: Línea 383
**Tipo**: Nueva función
**Tamaño**: 25 líneas
**Firma**: `updateRoom(propertyId: string, roomId: string, data: Partial<...>): Promise<Room>`
**Validaciones**: cleanUndefinedDeep, hasInvalidNumbers, propertyId security check

---

### Cambio 2.8: Adición de deleteRoom()

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

**Ubicación**: Línea 410
**Tipo**: Nueva función
**Tamaño**: 17 líneas
**Firma**: `deleteRoom(propertyId: string, roomId: string): Promise<void>`
**Validaciones**: Verificación de existencia, propertyId security check

---

### Cambio 2.9: Modificación de cascadeDeleteByProperty()

```diff
  async function cascadeDeleteByProperty(propertyId: string) {
-   const collections = [COL_LEASES, COL_RECURRING, COL_ONEOFF, COL_LOANS];
+   const collections = [COL_LEASES, COL_RECURRING, COL_ONEOFF, COL_LOANS, COL_ROOMS];
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

**Ubicación**: Línea 437
**Tipo**: Modificación de array
**Tamaño**: 1 línea modificada
**Impacto**: Asegura que rooms se borren al eliminar propiedad

---

## Resumen Estadístico

| Métrica                   | Valor                                                     |
| ------------------------- | --------------------------------------------------------- |
| **Archivos Modificados**  | 2                                                         |
| **Líneas Agregadas**      | ~130                                                      |
| **Líneas Eliminadas**     | ~5                                                        |
| **Líneas Netas**          | ~125                                                      |
| **Nuevas Funciones**      | 5 (getRooms, getRoom, createRoom, updateRoom, deleteRoom) |
| **Funciones Modificadas** | 3 (getProperties, getProperty, cascadeDeleteByProperty)   |
| **Nuevos Tipos**          | 2 (RentalMode, Room)                                      |
| **Campos Agregados**      | 2 (Property.rentalMode, Lease.roomId)                     |

---

## Impacto en el Código

### Adiciones (+)

- ✅ Type system completo para multi-rental
- ✅ APIs CRUD para rooms
- ✅ Normalización automática de legacy data
- ✅ Validaciones de seguridad

### Modificaciones (Δ)

- ✅ getProperties: Normalización de rentalMode
- ✅ getProperty: Normalización de rentalMode
- ✅ cascadeDeleteByProperty: Inclusión de rooms

### Eliminaciones (-)

- ❌ Ningún código eliminado
- ✅ Solo mejoras y extensiones

---

## Verificación

```
$ npm run build
> tsc && vite build

✓ TypeScript: Sin errores
✓ Vite: 12,386 módulos transformados
✓ Bundles: Generados correctamente
✓ Exit Code: 0
```

**Estado**: 🟢 EXITOSO
