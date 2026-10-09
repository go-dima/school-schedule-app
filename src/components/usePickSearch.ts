import { useState } from "react";
import { buildOptions, TEXT_SEARCH_EXTRA_VALUE } from "./textSearchOptions";
import type { TextSearchPickProps } from "./TextSearch";

/**
 * The state and actions every view of a pick-mode search shares: the typed
 * query, the matching rows, the picked item, and what a chosen row does.
 * The dropdown and the bottom sheet render these; neither decides them.
 */
export function usePickSearch<T>(props: TextSearchPickProps<T>) {
  const { items, getKey, getText, value, onSelect, extraOption } = props;
  const [query, setQuery] = useState("");

  const options = buildOptions(
    props,
    query,
    getKey,
    getKey,
    TEXT_SEARCH_EXTRA_VALUE
  );
  const selected = value
    ? items.find(item => getKey(item) === value)
    : undefined;

  /**
   * Runs a chosen row: the extra row (with the trimmed query), a clear
   * (`undefined`), or a pick. Views call this with an option's `value`.
   */
  const choose = (key: string | undefined) => {
    if (key === TEXT_SEARCH_EXTRA_VALUE) {
      extraOption?.onSelect(query.trim());
      return;
    }
    onSelect(
      key === undefined ? undefined : items.find(item => getKey(item) === key)
    );
  };

  return {
    query,
    setQuery,
    options,
    selectedText: selected ? getText(selected) : "",
    hasSelection: selected !== undefined,
    choose,
  };
}
