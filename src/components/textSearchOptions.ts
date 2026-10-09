import type React from "react";
import { filterByText } from "@/utils/textSearch";
import type { TextSearchCommonProps } from "./TextSearch";

// Pick-mode value of the extra row; never a real key.
export const TEXT_SEARCH_EXTRA_VALUE = "\u0000text-search-extra";

/** One row of a closed-list search: a match, or the extra row. */
export interface TextOption {
  key: string;
  value: string;
  label: React.ReactNode;
  /** Row content (pick mode keeps `label` as the plain text). */
  content: React.ReactNode;
  isExtra?: boolean;
}

/**
 * The rows for `query`: the matching items (`filterByText`), one row per
 * value, or only the extra row when the trimmed query matches nothing.
 * Shared by TextSearch and any other view of the same closed list.
 */
export function buildOptions<T>(
  {
    items,
    getText,
    renderOption,
    extraOption,
  }: Pick<
    TextSearchCommonProps<T>,
    "items" | "getText" | "renderOption" | "extraOption"
  >,
  query: string,
  valueOf: (item: T) => string,
  keyOf: (item: T, index: number) => string,
  extraValue: string
): TextOption[] {
  const matches = filterByText(items, query, getText);
  const trimmed = query.trim();
  if (matches.length === 0 && trimmed && extraOption) {
    const label = extraOption.label(trimmed);
    return [
      {
        key: TEXT_SEARCH_EXTRA_VALUE,
        value: extraValue,
        label,
        content: label,
        isExtra: true,
      },
    ];
  }
  // One row per value: a repeated pick key breaks the dropdown's row
  // identity (stale, duplicated rows), and a repeated text is noise.
  const seen = new Set<string>();
  const unique = matches.filter(item => {
    const value = valueOf(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
  return unique.map((item, index) => ({
    key: keyOf(item, index),
    value: valueOf(item),
    label: getText(item),
    content: renderOption ? renderOption(item) : getText(item),
  }));
}
