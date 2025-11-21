// Firestore payload guards for lite SDK
export function hasInvalidNumbers(x: any): boolean {
  if (x == null) return false;
  if (typeof x === "number") return !Number.isFinite(x);
  if (Array.isArray(x)) return x.some(hasInvalidNumbers);
  if (typeof x === "object") return Object.values(x).some(hasInvalidNumbers);
  return false;
}

export function cleanUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cleanUndefinedDeep) as any;
  if (value && typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = cleanUndefinedDeep(v as any);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return (value === undefined ? undefined : value) as T;
}
