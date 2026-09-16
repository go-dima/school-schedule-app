import "./ToggleFilterGroup.css";

interface ToggleFilterGroupOption<T extends string> {
  value: T;
  label: string;
}

interface ToggleFilterGroupProps<T extends string> {
  options: ToggleFilterGroupOption<T>[];
  /** Currently-active (ON) values. Every option starts ON -- pass the full
   * option list as the default so "nothing filtered" reads as "all on". */
  value: T[];
  onChange: (value: T[]) => void;
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
}: ToggleFilterGroupProps<T>) {
  const toggle = (optionValue: T) => {
    onChange(
      value.includes(optionValue)
        ? value.filter(v => v !== optionValue)
        : [...value, optionValue]
    );
  };

  return (
    <div className="toggle-filter-group" role="group">
      {options.map(option => {
        const active = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={
              "toggle-filter-group__option" +
              (active ? " toggle-filter-group__option--active" : "")
            }
            aria-pressed={active}
            onClick={() => toggle(option.value)}>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
