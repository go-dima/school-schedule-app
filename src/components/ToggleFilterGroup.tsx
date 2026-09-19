import type { RoleTagColor } from "../constants/roleColors";
import "./ToggleFilterGroup.css";

interface ToggleFilterGroupOption<T extends string> {
  value: T;
  label: string;
  /** Active-state color, matching antd's preset Tag colors (e.g. from
   * ROLE_TAG_COLORS). Defaults to the component's neutral blue when omitted. */
  color?: RoleTagColor;
}

interface ToggleFilterGroupProps<T extends string> {
  options: ToggleFilterGroupOption<T>[];
  /** Currently-active (ON) values. Every option starts ON -- pass the full
   * option list as the default so "nothing filtered" reads as "all on". */
  value: T[];
  onChange: (value: T[]) => void;
  /** Double-click an option to select only it, deselecting the rest.
   * Defaults to true; pass false to disable. */
  doubleClickToIsolate?: boolean;
}

// Segmented-look button row where every option is independently toggled
// on/off by clicking it, unlike antd's Segmented (single-select, one value
// at a time) or a multi-select dropdown (state hidden until opened). Shared
// by the user-management role filter and the class/child-management scope
// filter so both get one consistent look and behavior.
export function ToggleFilterGroup<T extends string>({
  options,
  value,
  onChange,
  doubleClickToIsolate = true,
}: ToggleFilterGroupProps<T>) {
  const toggle = (optionValue: T) => {
    onChange(
      value.includes(optionValue)
        ? value.filter(v => v !== optionValue)
        : [...value, optionValue]
    );
  };

  const isolate = (optionValue: T) => {
    onChange([optionValue]);
  };

  return (
    <div className="toggle-filter-group" role="group">
      {options.map(option => {
        const active = value.includes(option.value);
        const activeClass = option.color
          ? `toggle-filter-group__option--active-${option.color}`
          : "toggle-filter-group__option--active";
        return (
          <button
            key={option.value}
            type="button"
            className={
              "toggle-filter-group__option" + (active ? ` ${activeClass}` : "")
            }
            aria-pressed={active}
            onClick={() => toggle(option.value)}
            onDoubleClick={
              doubleClickToIsolate ? () => isolate(option.value) : undefined
            }>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
