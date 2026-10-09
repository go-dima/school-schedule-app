import React from "react";
import { AutoComplete, Select } from "antd";
import { buildOptions } from "./textSearchOptions";
import type { TextOption } from "./textSearchOptions";
import { usePickSearch } from "./usePickSearch";
import { TextSearchSheet } from "./TextSearchSheet";

/** An extra dropdown row (e.g. "add student") for a query nothing matches. */
export interface TextSearchExtraOption {
  label: (query: string) => React.ReactNode;
  onSelect: (query: string) => void;
}

/** How a pick-mode search opens: an antd dropdown, or a bottom sheet (mobile). */
export type TextSearchPresentation = "dropdown" | "sheet";

export interface TextSearchCommonProps<T> {
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
  /** Defaults to the dropdown. */
  presentation?: TextSearchPresentation;
  value: string | null | undefined;
  getKey: (item: T) => string;
  /** The picked item, or undefined when cleared. */
  onSelect: (item: T | undefined) => void;
  onChange?: never;
}

/** Free text: the value is what was typed; a picked suggestion fills in its text. */
export interface TextSearchFilterProps<T> extends TextSearchCommonProps<T> {
  mode: "filter";
  presentation?: never;
  value: string;
  onChange: (text: string) => void;
  getKey?: never;
  onSelect?: never;
}

export type TextSearchProps<T> =
  | TextSearchPickProps<T>
  | TextSearchFilterProps<T>;

/**
 * The one search box over a closed list (people's names, class titles).
 * Matching always goes through `matchesText` (trimmed, case-insensitive
 * substring).
 *
 * - `mode="pick"`: the picked item is the value. `presentation` picks the
 *   view: the antd Select dropdown (default), or a bottom sheet on mobile.
 *   Both views run on `usePickSearch`, so they match and pick the same way.
 * - `mode="filter"` (antd AutoComplete): the value is the typed text; picking
 *   a suggestion fills in its text. Enter keeps the typed text.
 */
export function TextSearch<T>(props: TextSearchProps<T>) {
  if (props.mode === "filter") return <FilterTextSearch {...props} />;
  return props.presentation === "sheet" ? (
    <TextSearchSheet {...props} />
  ) : (
    <PickTextSearch {...props} />
  );
}

function PickTextSearch<T>(props: TextSearchPickProps<T>) {
  const { value, placeholder, style, disabled, loading, autoFocus, onBlur } =
    props;
  const { query, setQuery, options, choose } = usePickSearch(props);

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
      onChange={(key: string | undefined) => {
        setQuery("");
        choose(key);
      }}
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
