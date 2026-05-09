export type Dictionary = Record<string, unknown>;

export function translate(dictionary: Dictionary, key: string): string {
  const value = key.split(".").reduce<unknown>((acc, part) => {
    if (typeof acc !== "object" || acc === null) return undefined;

    return (acc as Record<string, unknown>)[part];
  }, dictionary);

  return typeof value === "string" ? value : key;
}