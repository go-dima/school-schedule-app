import { Select, Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { FilterField } from "./FilterField";
import "./FilterSelect.css";

interface FilterSelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface FilterSelectProps<T extends string | number> {
  /** Shown after the control. Pass it without a colon; FilterField adds one. */
  label: string;
  placeholder?: string;
  value: T | null;
  onChange: (value: T | null) => void;
  options: FilterSelectOption<T>[];
  disabled?: boolean;
}

// Shared narrow filter Select used by Class Management (grade, day, track)
// and the Schedule page (grade), so every closed-list filter shares one look:
// an explicit clear (X) button, the Select, then the trailing label from
// FilterField. The X is shown only while a value is set; it's the visible
// clear on touch screens, where the Select's own allowClear icon (also kept)
// only appears on hover.
//
// DOM order is [X][Select][label]. The pair is a nested Space, which follows
// the app-wide `.ant-space { direction: ltr }` rule, so it renders left to
// right: the label is rightmost and the X leftmost.
export function FilterSelect<T extends string | number>({
  label,
  placeholder,
  value,
  onChange,
  options,
  disabled = false,
}: FilterSelectProps<T>) {
  return (
    <FilterField label={label}>
      {value !== null ? (
        <Button
          className="filter-select__clear"
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={() => onChange(null)}
          disabled={disabled}
        />
      ) : null}
      <Select
        className="filter-select"
        aria-label={label}
        placeholder={placeholder}
        allowClear
        value={value ?? undefined}
        onChange={v => onChange(v ?? null)}
        disabled={disabled}>
        {options.map(option => (
          <Select.Option key={option.value} value={option.value}>
            {option.label}
          </Select.Option>
        ))}
      </Select>
    </FilterField>
  );
}
