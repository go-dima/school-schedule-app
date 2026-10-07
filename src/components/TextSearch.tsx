import React, { useState } from "react";
import { AutoComplete, Select } from "antd";
import { filterByText } from "@/utils/textSearch";

/** An extra dropdown row (e.g. "add student") for a query nothing matches. */
export interface TextSearchExtraOption {
  label: (query: string) => React.ReactNode;
  onSelect: (query: string) => void;
}

interface TextSearchCommonProps<T> {
  items: T[];
  getText: (item: T) => string;
  /** Dropdown row content; defaults to the text. */
  renderOption?: (item: T) => React.ReactNode;
  /** Shown only when the trimmed query is non-empty and nothing matches. */
  extraOption?: TextSearchExtraOption;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
}

/** Pick one item: the value is its key. */
export interface TextSearchPickProps<T> extends TextSearchCommonProps<T> {
  mode: "pick";
  value: string | null | undefined;
  getKey: (item: T) => string;
  /** The picked item, or undefined when cleared. */
  onSelect: (item: T | undefined) => void;
  onChange?: never;
}

/** Free text: the value is what was typed; a picked suggestion fills in its text. */
export interface TextSearchFilterProps<T> extends TextSearchCommonProps<T> {
  mode: "filter";
  value: string;
  onChange: (text: string) => void;
  getKey?: never;
  onSelect?: never;
}

export type TextSearchProps<T> =
  | TextSearchPickProps<T>
  | TextSearchFilterProps<T>;

// Pick-mode value of the extra row; never a real key.
const EXTRA_VALUE = "\u0000text-search-extra";

interface TextOption {
  key: string;
  value: string;
  label: React.ReactNode;
  /** Dropdown row content (pick mode keeps `label` as the plain text). */
  content: React.ReactNode;
  isExtra?: boolean;
}

function buildOptions<T>(
  { items, getText, renderOption, extraOption }: TextSearchCommonProps<T>,
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
        key: EXTRA_VALUE,
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

/**
 * The one search box over a closed list (people's names, class titles).
 * Matching always goes through `matchesText` (trimmed, case-insensitive
 * substring), and every mode shows the matches as a dropdown.
 *
 * - `mode="pick"` (antd Select): keeps the selection while typing, puts the
 *   selected text back on blur, Enter picks the highlighted row, clear
 *   reports undefined.
 * - `mode="filter"` (antd AutoComplete): the value is the typed text; picking
 *   a suggestion fills in its text. Enter keeps the typed text.
 */
export function TextSearch<T>(props: TextSearchProps<T>) {
  return props.mode === "pick" ? (
    <PickTextSearch {...props} />
  ) : (
    <FilterTextSearch {...props} />
  );
}

function PickTextSearch<T>(props: TextSearchPickProps<T>) {
  const {
    items,
    getKey,
    extraOption,
    value,
    onSelect,
    placeholder,
    style,
    disabled,
    loading,
    autoFocus,
    onBlur,
  } = props;
  const [query, setQuery] = useState("");

  const options = buildOptions(props, query, getKey, getKey, EXTRA_VALUE);

  const handleChange = (key: string | undefined) => {
    setQuery("");
    if (key === EXTRA_VALUE) {
      extraOption?.onSelect(query.trim());
      return;
    }
    onSelect(
      key === undefined ? undefined : items.find(item => getKey(item) === key)
    );
  };

  return (
    <Select<string, TextOption>
      showSearch
      allowClear
      value={value ?? undefined}
      searchValue={query}
      onSearch={setQuery}
      // Closing (blur, Escape, a pick) drops the typed text so the selected
      // text shows again; rc-select doesn't report this to onSearch.
      onOpenChange={open => {
        if (!open) setQuery("");
      }}
      onChange={handleChange}
      filterOption={false}
      options={options}
      optionRender={option => option.data.content}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      loading={loading}
      autoFocus={autoFocus}
      onBlur={onBlur}
    />
  );
}

function FilterTextSearch<T>(props: TextSearchFilterProps<T>) {
  const {
    getText,
    extraOption,
    value,
    onChange,
    placeholder,
    style,
    disabled,
    loading,
    autoFocus,
    onBlur,
  } = props;

  // The extra row's value is the query itself, so arrowing onto it shows
  // the typed text rather than an internal marker.
  const options = buildOptions(
    props,
    value,
    getText,
    (_item, index) => String(index),
    value.trim()
  ).map(({ content, ...option }) => ({ ...option, label: content }));

  return (
    <AutoComplete
      value={value}
      onChange={text => onChange(text ?? "")}
      onSelect={(_text, option) => {
        if (option.isExtra) {
          extraOption?.onSelect(value.trim());
          onChange("");
        }
      }}
      filterOption={false}
      options={options}
      allowClear
      notFoundContent={loading ? undefined : null}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      autoFocus={autoFocus}
      onBlur={onBlur}
    />
  );
}
