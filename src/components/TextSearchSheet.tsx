import { useState } from "react";
import { Button, Input } from "antd";
import { CloseCircleFilled } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "./BottomSheet";
import { buildOptions, TEXT_SEARCH_EXTRA_VALUE } from "./textSearchOptions";
import type { TextOption } from "./textSearchOptions";
import type { TextSearchPickProps } from "./TextSearch";
import "./TextSearchSheet.css";

/**
 * Mobile counterpart of TextSearch mode="pick": a read-only field that opens
 * a bottom sheet with a search box and the matching rows. Same props, same
 * rows (`buildOptions`: matching rule, dedupe by key, extra row) and the same
 * `onSelect` contract (the picked item, or undefined when cleared). Picking a
 * row closes the sheet.
 */
export function TextSearchSheet<T>(props: TextSearchPickProps<T>) {
  const {
    items,
    getText,
    getKey,
    extraOption,
    value,
    onSelect,
    placeholder,
    style,
    disabled,
    loading,
  } = props;
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = value ? items.find(item => getKey(item) === value) : null;
  const options = buildOptions(
    props,
    query,
    getKey,
    getKey,
    TEXT_SEARCH_EXTRA_VALUE
  );

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const pick = (option: TextOption) => {
    const trimmed = query.trim();
    close();
    if (option.isExtra) {
      extraOption?.onSelect(trimmed);
      return;
    }
    onSelect(items.find(item => getKey(item) === option.value));
  };

  // rc-input never shows `allowClear` on a read-only field, so the field
  // gets its own clear button instead (its only clear control).
  const clearButton =
    selected && !disabled ? (
      <Button
        type="text"
        size="small"
        className="text-search-sheet-clear"
        icon={<CloseCircleFilled />}
        aria-label={t("common.clear")}
        onClick={() => onSelect(undefined)}
      />
    ) : (
      // Keeps the affix wrapper mounted, so the field's DOM doesn't change.
      <span />
    );

  return (
    <>
      <Input
        className="text-search-sheet-trigger"
        readOnly
        value={selected ? getText(selected) : ""}
        placeholder={placeholder}
        style={style}
        disabled={disabled}
        suffix={clearButton}
        onClick={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === "Enter") setOpen(true);
        }}
      />
      <BottomSheet
        className="text-search-sheet"
        open={open}
        onClose={close}
        closeIcon={null}
        destroyOnHidden
        title={
          <Input
            autoFocus
            allowClear
            value={query}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={e => setQuery(e.target.value)}
          />
        }
        extra={
          <Button type="link" onClick={close}>
            {t("common.close")}
          </Button>
        }>
        <ul
          className="text-search-sheet-list"
          role="listbox"
          aria-busy={loading}>
          {options.map(option => (
            <li key={option.key}>
              <button
                type="button"
                role={option.isExtra ? undefined : "option"}
                aria-selected={
                  option.isExtra ? undefined : option.value === value
                }
                className="text-search-sheet-option"
                onClick={() => pick(option)}>
                {option.content}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
