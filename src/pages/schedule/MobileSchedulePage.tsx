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
  const { child, view, catalog, selection, overrides, status } =
    useChildScheduleController();

  const [now] = useState(() => new Date());
  const entriesForDay = useCallback(
    (day: number) =>
      buildDayAgenda({
        day,
        timeSlots: catalog.timeSlots,
        weeklySchedule: catalog.weekly,
        selectedClassIds: selection.ids,
        userSelections: selection.schedule,
        overrides: overrides.list,
        userGrade: view.grade,
        childGroupNumber: selection.trackChild?.groupNumber,
      }),
    [
      catalog.timeSlots,
      catalog.weekly,
      selection.ids,
      selection.schedule,
      overrides.list,
      view.grade,
      selection.trackChild?.groupNumber,
    ]
  );

  const handleRefresh = () => {
    catalog.reload();
    selection.refetch();
  };

  return (
    <MobileScheduleView
      caps={caps}
      now={now}
      userChildren={child.list}
      selectedChild={child.selected}
      childrenLoading={child.loading}
      canManageChildren={child.canManage}
      canPickSchedule={child.canPick}
      viewCommitted={view.committed}
      viewStatus={view.status}
      pageLoading={status.pageLoading}
      scheduleGridLoading={status.gridLoading}
      loading={status.loading}
      error={status.error}
      entriesForDay={entriesForDay}
      setViewCommitted={view.setCommitted}
      handleRefresh={handleRefresh}
      handleParentChildAdded={child.add}
      handleParentChildSelect={child.select}
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
