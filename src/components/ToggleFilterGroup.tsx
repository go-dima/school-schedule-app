import { createContext, useContext, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { RoleTagColor } from "../constants/roleColors";
import "./ToggleFilterGroup.css";

// Native dblclick fires after two click events close together, so a naive
// onClick would apply-then-immediately-undo the toggle on every double
// click. Delaying the toggle by this long lets a following dblclick cancel
// it outright instead of visibly flashing through the toggled state.
const DOUBLE_CLICK_GRACE_MS = 250;

// ToggleFilterGroup double-clicks an option to isolate it (deselect the
// rest) by default. Wrap a group in <SingleClickToggle> to opt back out to
// plain single-click toggling -- e.g. for a 2-option group, where isolating
// one option is no different from just toggling the other one off, so the
// double-click affordance is pure overhead. Expressed by wrapping the
// element rather than a boolean prop so it reads at the call site.
const DoubleClickDisabledContext = createContext(false);

export function SingleClickToggle({ children }: { children: ReactNode }) {
  return (
    <DoubleClickDisabledContext.Provider value={true}>
      {children}
    </DoubleClickDisabledContext.Provider>
  );
}

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
  const doubleClickToIsolate = !useContext(DoubleClickDisabledContext);
  const pendingToggle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pendingToggle.current) clearTimeout(pendingToggle.current);
    };
  }, []);

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

  const handleClick = (optionValue: T) => {
    if (!doubleClickToIsolate) {
      toggle(optionValue);
      return;
    }
    if (pendingToggle.current) clearTimeout(pendingToggle.current);
    pendingToggle.current = setTimeout(() => {
      pendingToggle.current = null;
      toggle(optionValue);
    }, DOUBLE_CLICK_GRACE_MS);
  };

  const handleDoubleClick = (optionValue: T) => {
    if (pendingToggle.current) {
      clearTimeout(pendingToggle.current);
      pendingToggle.current = null;
    }
    isolate(optionValue);
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
            onClick={() => handleClick(option.value)}
            onDoubleClick={
              doubleClickToIsolate
                ? () => handleDoubleClick(option.value)
                : undefined
            }>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
