import { type Tag } from "../types";
import { normalize } from "./strings";

const SPECIAL_TAG_META: Record<string, { icon: string; classes: string }> = {
  [normalize("Untested")]: {
    icon: "🧪",
    classes: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100",
  },
  [normalize("Broken")]: {
    icon: "⛔",
    classes: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100",
  },
  [normalize("Tested & Functional")]: {
    icon: "✅",
    classes: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100",
  },
  [normalize("Recommended")]: {
    icon: "⭐",
    classes: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100",
  },
};

const SPECIAL_TAG_ORDER = [normalize("Untested"), normalize("Broken"), normalize("Tested & Functional"), normalize("Recommended")];

export function getSpecialTagMeta(name: string) {
  return SPECIAL_TAG_META[normalize(name)];
}

export function sortTagsForDisplay(names: string[]) {
  const firstByNorm: Record<string, string> = {};
  names.forEach((n) => {
    const norm = normalize(n);
    if (!firstByNorm[norm]) firstByNorm[norm] = n;
  });
  const specials = SPECIAL_TAG_ORDER.map((norm) => firstByNorm[norm]).filter(Boolean) as string[];
  const rest = Object.entries(firstByNorm)
    .filter(([norm]) => !SPECIAL_TAG_ORDER.includes(norm))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, original]) => original);
  return [...specials, ...rest];
}

export function sortTagObjectsForDisplay(tags: Tag[]) {
  const byNorm = new Map<string, Tag>();
  tags.forEach((tag) => {
    const norm = normalize(tag.name);
    if (!byNorm.has(norm)) byNorm.set(norm, tag);
  });
  const specials = SPECIAL_TAG_ORDER.map((norm) => byNorm.get(norm)).filter(Boolean) as Tag[];
  const rest = Array.from(byNorm.entries())
    .filter(([norm]) => !SPECIAL_TAG_ORDER.includes(norm))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, tag]) => tag);
  return [...specials, ...rest];
}
