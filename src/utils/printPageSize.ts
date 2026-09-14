// Physical page dimensions for the print popup, matching the `@page` rule in
// PrintableSchedule.css (A4 landscape, 15mm margins). Keep these in sync if
// that rule ever changes.
const MM_TO_PX = 96 / 25.4;
const PAGE_WIDTH_MM = 297;
const PAGE_HEIGHT_MM = 210;
const PAGE_MARGIN_MM = 15;

export const PRINT_PAGE_CONTENT_WIDTH_PX =
  (PAGE_WIDTH_MM - 2 * PAGE_MARGIN_MM) * MM_TO_PX;
export const PRINT_PAGE_CONTENT_HEIGHT_PX =
  (PAGE_HEIGHT_MM - 2 * PAGE_MARGIN_MM) * MM_TO_PX;

// Portrait page dimensions, matching the `@page` rule in
// PrintableClassRoster.css (A4 portrait, 15mm margins).
const PAGE_PORTRAIT_WIDTH_MM = 210;
const PAGE_PORTRAIT_HEIGHT_MM = 297;

export const PRINT_PAGE_PORTRAIT_CONTENT_WIDTH_PX =
  (PAGE_PORTRAIT_WIDTH_MM - 2 * PAGE_MARGIN_MM) * MM_TO_PX;
export const PRINT_PAGE_PORTRAIT_CONTENT_HEIGHT_PX =
  (PAGE_PORTRAIT_HEIGHT_MM - 2 * PAGE_MARGIN_MM) * MM_TO_PX;
