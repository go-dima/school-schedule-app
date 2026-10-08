import React from "react";
import { DAYS_OF_WEEK } from "../../types";
import "./WeekStrip.css";

// Sunday to Thursday, each as its date number then its name, the selected
// day highlighted and today marked. RTL: Sunday renders rightmost.
export const WeekStrip: React.FC<{
  dates: Date[];
  selectedDay: number;
  /** Today's day, or null when today is not in this school week. */
  today: number | null;
  onSelect: (day: number) => void;
}> = ({ dates, selectedDay, today, onSelect }) => (
  <div className="week-strip" role="tablist">
    {DAYS_OF_WEEK.map(day => {
      const selected = day.key === selectedDay;
      return (
        <button
          key={day.key}
          type="button"
          role="tab"
          aria-selected={selected}
          className={`week-strip-day${selected ? " is-selected" : ""}${
            day.key === today ? " is-today" : ""
          }`}
          onClick={() => onSelect(day.key)}>
          {/* RTL: the date number renders rightmost, then the day name. */}
          <span className="week-strip-date">{dates[day.key]?.getDate()}</span>
          <span className="week-strip-name">{day.name}</span>
        </button>
      );
    })}
  </div>
);
