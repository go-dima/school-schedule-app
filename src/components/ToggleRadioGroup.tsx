import { useRef } from "react";
import type { KeyboardEvent } from "react";
import type { ToggleFilterGroupOption } from "./ToggleFilterGroup";
import { toggleOptionClassName } from "./toggleOptionClassName";
import "./ToggleFilterGroup.css";

interface ToggleRadioGroupProps<T extends string> {
  options: ToggleFilterGroupOption<T>[];
  /** The selected value, or undefined when nothing is chosen yet. */
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

// Single-select twin of ToggleFilterGroup: same look and colors, but exactly
// one option can be on, and it can start with none on (so the user has to
// choose). Follows the WAI-ARIA radio group pattern: only the checked option
// (or the first, when none is) is in the Tab order, and the arrow keys move
// and select. Left/right follow the reading direction, so in RTL the left
// arrow goes to the next option.
export function ToggleRadioGroup<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: ToggleRadioGroupProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndex = options.findIndex(o => o.value === value);
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex;

  const select = (index: number) => {
    const option = options[index];
    buttons.current[index]?.focus();
    if (option.value !== value) onChange(option.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const count = options.length;
    const current = buttons.current.indexOf(event.currentTarget);
    const rtl =
      event.currentTarget.closest("[dir]")?.getAttribute("dir") === "rtl";
    let next: number | undefined;
    switch (event.key) {
      case "ArrowDown":
        next = current + 1;
        break;
      case "ArrowUp":
        next = current - 1;
        break;
      case "ArrowRight":
        next = rtl ? current - 1 : current + 1;
        break;
      case "ArrowLeft":
        next = rtl ? current + 1 : current - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    select((next + count) % count);
  };

  return (
    <div
      className="toggle-filter-group"
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-disabled={disabled || undefined}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={el => (buttons.current[index] = el)}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === tabStop ? 0 : -1}
            disabled={disabled}
            className={toggleOptionClassName(checked, option.color)}
            onClick={() => select(index)}
            onKeyDown={handleKeyDown}>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
