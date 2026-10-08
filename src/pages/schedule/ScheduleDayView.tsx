import React, { useMemo, useState } from "react";
import { Spin } from "antd";
import { useSwipe } from "../../hooks/useSwipe";
import type { AgendaEntry } from "./dayAgenda";
import {
  LAST_SCHOOL_DAY,
  initialScheduleDay,
  schoolWeekDates,
  stepSchoolDay,
} from "./scheduleDays";
import { WeekStrip } from "./WeekStrip";
import { DayAgendaList } from "./DayAgendaList";
import "./ScheduleDayView.css";

// The week strip and one school day's agenda. Opens on today (Sunday on
// Friday and Saturday); swipe or tap the strip to change day.
export const ScheduleDayView: React.FC<{
  /** The current time; a prop so stories and tests can pin the week. */
  now: Date;
  entriesForDay: (day: number) => AgendaEntry[];
  loading?: boolean;
}> = ({ now, entriesForDay, loading = false }) => {
  const weekDates = useMemo(() => schoolWeekDates(now), [now]);
  const today = now.getDay() <= LAST_SCHOOL_DAY ? now.getDay() : null;
  const [day, setDay] = useState(() => initialScheduleDay(now));
  // Which side the new day slides in from. RTL: the next day is to the left.
  const [slideFrom, setSlideFrom] = useState<"left" | "right" | null>(null);

  const goTo = (next: number) => {
    if (next === day) return;
    setSlideFrom(next > day ? "left" : "right");
    setDay(next);
  };

  // RTL: the next day lies to the left, so dragging the page to the right
  // brings it in (the mirror of an LTR calendar).
  const swipe = useSwipe({
    onSwipeRight: () => goTo(stepSchoolDay(day, 1)),
    onSwipeLeft: () => goTo(stepSchoolDay(day, -1)),
  });

  return (
    <>
      <div className="mobile-schedule-strip">
        <WeekStrip
          dates={weekDates}
          selectedDay={day}
          today={today}
          onSelect={goTo}
        />
      </div>
      <Spin spinning={loading}>
        <div className="mobile-schedule-day" {...swipe}>
          <div
            key={day}
            className={
              slideFrom ? `day-agenda-slide-from-${slideFrom}` : undefined
            }>
            <DayAgendaList entries={entriesForDay(day)} />
          </div>
        </div>
      </Spin>
    </>
  );
};
