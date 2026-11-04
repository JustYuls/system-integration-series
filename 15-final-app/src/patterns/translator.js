// Message translator: turn an upstream payload into our internal model, field by field.
// The mapping says where each internal field comes from: a path ("rates.PHP") or a function.
export class TranslationError extends Error {
  constructor(missing) {
    super(`upstream payload changed: missing ${missing.join(", ")}`);
    this.name = "TranslationError";
    this.code = "BAD_SHAPE";
    this.missing = missing;
  }
}

export const readPath = (payload, path) => path.split(".").reduce((value, key) => value?.[key], payload);

export function translate(payload, mapping) {
  const result = {};
  const missing = [];
  for (const [field, source] of Object.entries(mapping)) {
    const value = typeof source === "function" ? source(payload) : readPath(payload, source);
    if (value === undefined) missing.push(typeof source === "string" ? source : field);
    result[field] = value;
  }
  if (missing.length) throw new TranslationError(missing); // do not let a changed API leak in silently
  return result;
}
