// Shared jsdom helpers for tests that drive antd Select/AutoComplete.
import { fireEvent } from "@testing-library/react";

/** antd's responsive observers call window.matchMedia, which jsdom lacks. */
export const stubMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
};

/** rc-select reads `keyCode`/`which`, not just `key`. */
export const pressEnter = (el: Element) =>
  fireEvent.keyDown(el, {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
  });

/**
 * Options of the most recently opened dropdown that isn't hidden. jsdom runs
 * no close animation, so an earlier dropdown on the page (e.g. a grade
 * filter just used) can linger; antd portals each dropdown to the end of
 * <body> on first open, so the last one is the newest.
 */
export const visibleOptionElements = () => {
  const open = document.querySelectorAll<HTMLElement>(
    ".ant-select-dropdown:not(.ant-select-dropdown-hidden)"
  );
  const last = open[open.length - 1];
  return last
    ? Array.from(last.querySelectorAll<HTMLElement>(".ant-select-item-option"))
    : [];
};

/**
 * What the (only) select on screen shows: the selected item's label for a
 * Select, else the input's own text (AutoComplete keeps its value there).
 */
export const shownText = () =>
  document.querySelector(".ant-select-selection-item")?.textContent ??
  (document.querySelector(".ant-select input") as HTMLInputElement | null)
    ?.value ??
  "";

/** Text of each option of the open dropdown, in order. */
export const visibleOptions = () =>
  visibleOptionElements().map(o => o.textContent);
