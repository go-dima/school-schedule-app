import React, { useState } from "react";
import { AutoComplete, Select } from "antd";
import { filterByName } from "@/utils/nameSearch";

/** An extra dropdown row (e.g. "add student") for a query nothing matches. */
export interface NameSearchExtraOption {
  label: (query: string) => React.ReactNode;
  onSelect: (query: string) => void;
}

interface NameSearchCommonProps<T> {
  items: T[];
  getName: (item: T) => string;
  /** Dropdown row content; defaults to the name. */
  renderOption?: (item: T) => React.ReactNode;
  /** Shown only when the trimmed query is non-empty and nothing matches. */
  extraOption?: NameSearchExtraOption;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
}

/** Pick one item: the value is its key. */
export interface NameSearchPickProps<T> extends NameSearchCommonProps<T> {
  mode: "pick";
  value: string | null | undefined;
  getKey: (item: T) => string;
  /** The picked item, or undefined when cleared. */
  onSelect: (item: T | undefined) => void;
  onChange?: never;
}

/** Free text: the value is what was typed; a picked suggestion fills in its name. */
export interface NameSearchFilterProps<T> extends NameSearchCommonProps<T> {
  mode: "filter";
  value: string;
  onChange: (text: string) => void;
  getKey?: never;
  onSelect?: never;
}

export type NameSearchProps<T> =
  | NameSearchPickProps<T>
  | NameSearchFilterProps<T>;

// Pick-mode value of the extra row; never a real key.
const EXTRA_VALUE = "\u0000name-search-extra";

interface NameOption {
  key: string;
  value: string;
  label: React.ReactNode;
  /** Dropdown row content (pick mode keeps `label` as the plain name). */
  content: React.ReactNode;
  isExtra?: boolean;
}

function buildOptions<T>(
  { items, getName, renderOption, extraOption }: NameSearchCommonProps<T>,
  query: string,
  valueOf: (item: T) => string,
  keyOf: (item: T, index: number) => string,
  extraValue: string
): NameOption[] {
  const matches = filterByName(items, query, getName);
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
  return matches.map((item, index) => ({
    key: keyOf(item, index),
    value: valueOf(item),
    label: getName(item),
    content: renderOption ? renderOption(item) : getName(item),
  }));
}

/**
 * The one search box for people's names (students, staff, teachers, users).
 * Matching always goes through `matchesName` (trimmed, case-insensitive
 * substring), and every mode shows the matches as a dropdown.
 *
 * - `mode="pick"` (antd Select): keeps the selection while typing, puts the
 *   selected name back on blur, Enter picks the highlighted row, clear
 *   reports undefined.
 * - `mode="filter"` (antd AutoComplete): the value is the typed text; picking
 *   a suggestion fills in its name. Enter keeps the typed text.
 */
export function NameSearch<T>(props: NameSearchProps<T>) {
  return props.mode === "pick" ? (
    <PickNameSearch {...props} />
  ) : (
    <FilterNameSearch {...props} />
  );
}

function PickNameSearch<T>(props: NameSearchPickProps<T>) {
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
    <Select<string, NameOption>
      showSearch
      allowClear
      value={value ?? undefined}
      searchValue={query}
      onSearch={setQuery}
      // Closing (blur, Escape, a pick) drops the typed text so the selected
      // name shows again; rc-select doesn't report this to onSearch.
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

function FilterNameSearch<T>(props: NameSearchFilterProps<T>) {
  const {
    getName,
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
    getName,
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
