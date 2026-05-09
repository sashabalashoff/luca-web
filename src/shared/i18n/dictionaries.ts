import "server-only";

import { Locale, defaultLocale, isLocale } from "@/shared/config/locales";
import yaml from "js-yaml";
import fs from "node:fs/promises";
import path from "node:path";
import type { Dictionary } from "./translate";

const cache = new Map<Locale, Dictionary>();

export async function getDictionary(locale: string): Promise<Dictionary> {
  const safeLocale = isLocale(locale) ? locale : defaultLocale;

  if (cache.has(safeLocale)) {
    return cache.get(safeLocale)!;
  }

  const filePath = path.join(
    process.cwd(),
    "src",
    "locales",
    `${safeLocale}.yaml`
  );

  const file = await fs.readFile(filePath, "utf8");
  const dictionary = yaml.load(file) as Dictionary;

  cache.set(safeLocale, dictionary);

  return dictionary;
}