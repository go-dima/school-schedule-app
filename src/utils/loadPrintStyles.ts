import scheduleColorsCss from "../styles/schedule-colors.css?raw";
import printTableBaseCss from "../styles/print-table-base.css?raw";
import printableScheduleCss from "../components/PrintableSchedule.css?raw";

// The print popup is a bare document with none of the app's bundled CSS, so
// its styles are assembled from the same source files the app itself uses
// (raw-imported as text) rather than a hand-maintained duplicate. Any change
// to the shared palette or to PrintableSchedule.css is picked up here too.
export const getPrintStyles = (): string =>
  [scheduleColorsCss, printTableBaseCss, printableScheduleCss].join("\n");
