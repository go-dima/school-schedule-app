import React from "react";
import ReactDOM from "react-dom/client";
import PrintableSchedule from "../components/PrintableSchedule";
import type { Child, TimeSlot, WeeklySchedule } from "../types";
import { getPrintStyles } from "./loadPrintStyles";

// HTML encoding function to prevent XSS
const encodeHTML = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

interface PrintScheduleData {
  child: Child;
  timeSlots: TimeSlot[];
  weeklySchedule: WeeklySchedule;
  selectedClasses: string[];
  showDraftMarker: boolean;
}

export const printSchedule = async (data: PrintScheduleData): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a new window for printing
      const printWindow = window.open("", "_blank", "width=1200,height=800");

      if (!printWindow) {
        reject(
          new Error(
            "Unable to open print window. Please check if popups are blocked."
          )
        );
        return;
      }

      // Set up the HTML structure for the print window using secure DOM methods
      // Sanitize child name for title
      const safeFirstName = encodeHTML(data.child.firstName);
      const safeLastName = encodeHTML(data.child.lastName);

      // Use a simpler approach by writing HTML directly to the document
      const titleText = "מערכת של " + safeFirstName + " " + safeLastName;

      const htmlContent = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleText}</title>
  <style>
    body {
      font-family: Arial, Hebrew, sans-serif;
      direction: rtl;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div id="print-root"></div>
</body>
</html>`;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Wait for the window to load and set up React
      printWindow.onload = () => {
        // Get the root element
        const rootElement = printWindow.document.getElementById("print-root");
        if (!rootElement) {
          reject(new Error("Failed to find root element in print window"));
          return;
        }

        // Create React root and render the component
        const root = ReactDOM.createRoot(rootElement);

        // Create the PrintableSchedule element
        const printableScheduleElement = React.createElement(
          PrintableSchedule,
          {
            child: data.child,
            timeSlots: data.timeSlots,
            weeklySchedule: data.weeklySchedule,
            selectedClasses: data.selectedClasses,
            showDraftMarker: data.showDraftMarker,
          }
        );

        root.render(printableScheduleElement);

        // Use requestAnimationFrame for better timing control
        const renderAndPrint = () => {
          try {
            // Load the CSS file content
            const cssContent = getPrintStyles();

            // Add the CSS to the print window
            const style = printWindow.document.createElement("style");
            style.textContent = cssContent;
            printWindow.document.head.appendChild(style);

            // Use requestAnimationFrame to ensure styles are applied
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                printWindow.print();

                let hasResolved = false;
                const cleanupAndResolve = () => {
                  if (hasResolved) return;
                  hasResolved = true;
                  // Don't close the window - let user close it manually
                  resolve();
                };

                // Only resolve after printing (but don't close window)
                printWindow.onafterprint = cleanupAndResolve;

                // Fallback cleanup without closing window
                window.setTimeout(() => {
                  if (!hasResolved) {
                    cleanupAndResolve();
                  }
                }, 3000);
              });
            });
          } catch (error) {
            reject(error);
          }
        };

        // Give React time to render with a controlled delay
        window.setTimeout(renderAndPrint, 800);
      };

      // Handle window load errors
      printWindow.onerror = error => {
        reject(new Error(`Print window error: ${error}`));
      };
    } catch (error) {
      reject(error);
    }
  });
};
