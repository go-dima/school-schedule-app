import scheduleColorsCss from "../styles/schedule-colors.css?raw";
import printTableBaseCss from "../styles/print-table-base.css?raw";
import printableScheduleCss from "../components/PrintableSchedule.css?raw";
import printableClassRosterCss from "../components/PrintableClassRoster.css?raw";

// The print popup is a bare document with none of the app's bundled CSS, so
// its styles are assembled from the same source files the app itself uses
// (raw-imported as text) rather than a hand-maintained duplicate. Any change
// to the shared palette or to PrintableSchedule.css is picked up here too.
// PrintableSchedule.css is black & white by design and no longer uses
// class-card-text.css (that's the shared on-screen class card, not the
// print one), so it isn't included here.
export const getPrintStyles = (): string =>
  [scheduleColorsCss, printTableBaseCss, printableScheduleCss].join("\n");

export const getClassRosterPrintStyles = (): string =>
  [scheduleColorsCss, printableClassRosterCss].join("\n");
