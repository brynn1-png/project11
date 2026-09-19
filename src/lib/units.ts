const SYMBOL_UNITS = new Set(["g", "kg", "mg", "ml", "l", "cl", "dl", "oz", "lb", "lbs", "pc", "pcs"]);

export function pluralizeUnit(quantity: number, unit: string) {
  const clean = unit.trim();
  if (quantity === 1 || !clean || SYMBOL_UNITS.has(clean.toLowerCase())) return clean;
  if (/[^aeiou]y$/i.test(clean)) return `${clean.slice(0, -1)}ies`;
  if (/(?:s|x|z|ch|sh)$/i.test(clean)) return `${clean}es`;
  return `${clean}s`;
}

export function formatQuantity(quantity: number, unit: string) {
  return `${quantity} ${pluralizeUnit(quantity, unit)}`.trim();
}
