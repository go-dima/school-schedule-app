import React, { useCallback, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { ScheduleCatalogProvider } from "../../contexts/ScheduleCatalogContext";
import SchedulePage from "./SchedulePage";
import { useChildScheduleController } from "./useChildScheduleController";
import { buildDayAgenda } from "./dayAgenda";
import { scheduleCapabilities } from "./scheduleCapabilities";
import { MobileScheduleView } from "./MobileScheduleView";

// The mobile page's controls: a read-only view of the committed schedule.
const caps = scheduleCapabilities("mobile");

// One school day at a time, for parents and children (incl. staff+parent
// users) in mobile UI Mode: a week strip, then the day's slots as a list.
// Swipe or tap the strip to change day. Read only for now (#241 adds draft
// selection).
const MobileScheduleContent: React.FC = () => {
  const {
    selectedChild,
    userChildren,
    childrenLoading,
    canManageChildren,
    canPickSchedule,
    viewCommitted,
    setViewCommitted,
    viewStatus,
    timeSlots,
    displayWeeklySchedule,
    selectedClasses,
    selectedSchedule,
    overrides,
    selectedGrade,
    currentTrackChild,
    pageLoading,
    scheduleGridLoading,
    loading,
    scheduleError,
    selectedScheduleError,
    childrenError,
    loadScheduleData,
    refetchSelectedSchedule,
    handleParentChildAdded,
    handleParentChildSelect,
  } = useChildScheduleController();

  const [now] = useState(() => new Date());
  const entriesForDay = useCallback(
    (day: number) =>
      buildDayAgenda({
        day,
        timeSlots,
        weeklySchedule: displayWeeklySchedule,
        selectedClassIds: selectedClasses,
        userSelections: selectedSchedule,
        overrides,
        userGrade: selectedGrade,
        childGroupNumber: currentTrackChild?.groupNumber,
      }),
    [
      timeSlots,
      displayWeeklySchedule,
      selectedClasses,
      selectedSchedule,
      overrides,
      selectedGrade,
      currentTrackChild?.groupNumber,
    ]
  );

  const handleRefresh = () => {
    loadScheduleData();
    refetchSelectedSchedule();
  };

  return (
    <MobileScheduleView
      caps={caps}
      now={now}
      userChildren={userChildren}
      selectedChild={selectedChild}
      childrenLoading={childrenLoading}
      canManageChildren={canManageChildren}
      canPickSchedule={canPickSchedule}
      viewCommitted={viewCommitted}
      viewStatus={viewStatus}
      pageLoading={pageLoading}
      scheduleGridLoading={scheduleGridLoading}
      loading={loading}
      error={scheduleError || selectedScheduleError || childrenError}
      entriesForDay={entriesForDay}
      setViewCommitted={setViewCommitted}
      handleRefresh={handleRefresh}
      handleParentChildAdded={handleParentChildAdded}
      handleParentChildSelect={handleParentChildSelect}
    />
  );
};

// Parents and children (incl. staff+parent users) get the day view; pure
// staff and admins keep the desktop schedule (Staff View, filters, modals)
// inside the mobile shell.
const MobileSchedulePage: React.FC = () => {
  const { permissions } = useAuth();
  if (!permissions.canPickSchedule) return <SchedulePage />;
  return (
    <ScheduleCatalogProvider>
      <MobileScheduleContent />
    </ScheduleCatalogProvider>
  );
};

export default MobileSchedulePage;
