import { useState } from "react";
import { Drawer, Input } from "antd";
import { useTranslation } from "react-i18next";
import { filterByText } from "@/utils/textSearch";
import type { TextSearchPickProps } from "./TextSearch";
import "./TextSearchSheet.css";

/**
 * Mobile counterpart of TextSearch mode="pick": a read-only field that opens
 * a bottom sheet with a search box and the matching rows. Same props, same
 * matching rule (`filterByText`) and the same `onSelect` contract (the picked
 * item, or undefined when cleared). Picking a row closes the sheet.
 */
export function TextSearchSheet<T>({
  items,
  getText,
  getKey,
  renderOption,
  extraOption,
  value,
  onSelect,
  placeholder,
  style,
  disabled,
  loading,
}: TextSearchPickProps<T>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = value ? items.find(item => getKey(item) === value) : null;
  const trimmed = query.trim();
  const matches = filterByText(items, query, getText);
  const showExtra = matches.length === 0 && trimmed !== "" && !!extraOption;

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <Input
        className="text-search-sheet-trigger"
        readOnly
        allowClear
        value={selected ? getText(selected) : ""}
        placeholder={placeholder}
        style={style}
        disabled={disabled}
        onClick={() => setOpen(true)}
        onChange={e => {
          // Only the clear icon changes a read-only field.
          if (e.target.value === "") onSelect(undefined);
        }}
      />
      <Drawer
        className="text-search-sheet"
        placement="bottom"
        height="85dvh"
        open={open}
        onClose={close}
        closeIcon={null}
        destroyOnHidden
        title={
          <Input
            className="text-search-sheet-input"
            autoFocus
            allowClear
            value={query}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={e => setQuery(e.target.value)}
          />
        }
        extra={
          <button
            type="button"
            className="ant-btn ant-btn-link"
            onClick={close}>
            {t("common.close")}
          </button>
        }>
        <ul
          className="text-search-sheet-list"
          role="listbox"
          aria-busy={loading}>
          {showExtra && extraOption ? (
            <li>
              <button
                type="button"
                className="text-search-sheet-option"
                onClick={() => {
                  close();
                  extraOption.onSelect(trimmed);
                }}>
                {extraOption.label(trimmed)}
              </button>
            </li>
          ) : (
            matches.map(item => (
              <li key={getKey(item)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={getKey(item) === value}
                  className="text-search-sheet-option"
                  onClick={() => {
                    close();
                    onSelect(item);
                  }}>
                  {renderOption ? renderOption(item) : getText(item)}
                </button>
              </li>
            ))
          )}
        </ul>
      </Drawer>
    </>
  );
}
