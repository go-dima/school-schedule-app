import React, { useEffect, useState } from "react";
import { message } from "antd";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useChildContext } from "../../contexts/ChildContext";
import { useAllChildrenContext } from "../../contexts/AllChildrenContext";
import { useScheduleCatalog } from "../../hooks/useScheduleCatalog";
import { useSelectedSchedule } from "../../hooks/useSelectedSchedule";
import { useDraftSelectionAwareness } from "../../hooks/useDraftSelectionAwareness";
import { useScheduleOverrides } from "../../hooks/useScheduleOverrides";
import type { SelectionField } from "../../components/ChildGroupTrackSelector";
import { TrackSelectionService } from "../../services/trackSelectionService";
import { GroupMandatoryLockService } from "../../services/groupMandatoryLockService";
import { ScheduleService } from "../../services/scheduleService";
import type { Child, ScheduleTarget, SelectionStatus } from "../../types";
import { trackWithActor, AnalyticsEvent } from "../../utils/analytics";

// The Schedule page's student view -- whose schedule is shown (a parent's
// or child's own child, or the student staff picked), the draft/committed
// toggle, the catalog and selections, locks, the Group/Mandatory auto-sync
// and select/unselect -- shared by the desktop page and the mobile page so
// selection rules live in one place. Staff View (one staff member's week)
// and the staff-only modals stay in SchedulePage. Must be used inside
// ScheduleCatalogProvider.
export function useChildScheduleController() {
  const { t } = useTranslation();

  const { currentRole, roleFlags, permissions } = useAuth();
  const {
    selectedChild,
    setSelectedChild,
    children: userChildren,
    loading: childrenLoading,
    error: childrenError,
    updateChild: updateChildForParent,
  } = useChildContext();

  // For staff users - get all children and the shared staff-selected-child state
  const {
    children: allChildren,
    loading: allChildrenLoading,
    selectedChild: staffSelectedChild,
    setSelectedChild: setStaffSelectedChild,
    updateChild: updateChildForStaff,
  } = useAllChildrenContext();
  const { isStaff, isAdmin } = roleFlags;
  // Parent and child both pick for `selectedChild` (ChildContext); only a
  // parent has several children to switch between or add.
  const { canPickSchedule, canManageChildren } = permissions;
  // The student view's staff paths. False for a staff+parent user, who acts
  // as a parent here (#192); `isStaff` alone means "holds the role".
  const actsAsStaff = ScheduleService.actsAsStaffInStudentView({
    isStaff,
    canPickSchedule,
  });

  const [selectedGrade, setSelectedGrade] = useState<number | undefined>(1);

  const [viewCommitted, setViewCommitted] = useState(true);

  const { viewStatus, overrideChildId, canCreateOverride } =
    ScheduleService.resolveScheduleView({
      role: currentRole?.role,
      canPickSchedule,
      viewCommitted,
      selectedChildId: selectedChild?.id,
      staffSelectedChildId: staffSelectedChild?.id,
    });

  // Read-only whenever a parent or child has toggled to the committed view. Auto-sync
  // writes (track/group/mandatory changes) must always target the role's
  // real write status (draft, for parents) even while this is true -- never
  // `viewStatus`, since that's just what's being displayed and RLS rejects a
  // parent writing a `committed` row.
  const canEdit = !(canPickSchedule && viewCommitted);
  const writeStatus: SelectionStatus = ScheduleService.resolveSelectionStatus(
    currentRole?.role
  );

  // Snap the toggle back to committed (the default) when the child is
  // cleared, so the next child selected always opens on the committed view.
  useEffect(() => {
    if (!selectedChild) setViewCommitted(true);
  }, [selectedChild]);

  const handleStaffChildSelect = (childId: string | undefined) => {
    if (!childId) {
      setStaffSelectedChild(undefined);
      return;
    }
    const child = allChildren.find(c => c.id === childId);
    if (child) {
      // Use React's batching by updating states together
      setStaffSelectedChild(child);
      setSelectedGrade(child.grade);
    } else {
      setStaffSelectedChild(undefined);
    }
  };

  // Catalog (classes/time slots/weekly grid): staff-only placeholder classes
  // are already excluded here for non-staff/admin viewers.
  const {
    classes,
    timeSlots,
    weeklySchedule,
    loading: scheduleLoading,
    error: scheduleError,
    loadScheduleData,
  } = useScheduleCatalog();

  // Whose selections to read/write: the selected child (a parent's child, or
  // a child user's own linked student), or staff's chosen student. Everyone
  // else (no child chosen yet) gets no target and therefore no selections.
  const target: ScheduleTarget | undefined =
    canPickSchedule && selectedChild
      ? { childId: selectedChild.id }
      : actsAsStaff && staffSelectedChild
        ? { childId: staffSelectedChild.id }
        : undefined;

  const {
    schedule: selectedSchedule,
    loading: selectedScheduleLoading,
    error: selectedScheduleError,
    select: selectSchedule,
    unselect: unselectSchedule,
    isClassSelected,
    refetch: refetchSelectedSchedule,
  } = useSelectedSchedule(target, viewStatus);

  // Staff/admin only: read-only awareness of the child's draft picks, so
  // the drawer can show a heart marker for pending parent intent. Parents
  // get `undefined`, which makes the hook's effect a no-op -- zero extra
  // network activity for them.
  const { draftClassIds } = useDraftSelectionAwareness(
    viewStatus === "committed" ? target : undefined
  );

  // Fourth independent data-flow: staff-authored one-off lessons for the
  // currently displayed child. Fully isolated from classes/schedule_selections
  // -- never merged into the catalog/selection hooks above. `overrideChildId`
  // (from resolveScheduleView above) is undefined whenever the current view
  // is draft, since overrides only ever belong in a committed view.
  const { overrides, createOverride, updateOverride, deleteOverride } =
    useScheduleOverrides(overrideChildId);

  // A parent/child viewer's own selections come from an unfiltered join, so
  // they already carry full data for a committed staff-only class (e.g.
  // חונכות/שילוב) even though the catalog feed above hides it. Merge that
  // in for display only, so the grid shows an already-committed pick
  // read-only without making it pickable anywhere else.
  const selectedWeeklySchedule = React.useMemo(
    () =>
      ScheduleService.buildWeeklySchedule(
        selectedSchedule.map(selection => selection.class)
      ),
    [selectedSchedule]
  );

  const displayWeeklySchedule = React.useMemo(
    () =>
      ScheduleService.mergeWeeklySchedules(
        weeklySchedule,
        selectedWeeklySchedule
      ),
    [weeklySchedule, selectedWeeklySchedule]
  );

  // The class search's suggestions, narrowed to the shown grade: the

  const makeFieldChangeHandler =
    (
      child: Child | undefined,
      updateFn: typeof updateChildForParent,
      setChild: (child: Child) => void
    ) =>
    async (field: SelectionField, value: number | null) => {
      if (!child) return;
      try {
        const updatedChild = await updateFn(child.id, { [field]: value });
        setChild(updatedChild);

        if (field === "trackNumber") {
          // Track has no reactive sync -- unlike Group/Mandatory, which the
          // effect below re-syncs automatically whenever the active child's
          // groupNumber changes -- so apply the class diff explicitly here.
          const changes = TrackSelectionService.computeTrackClassChanges(
            classes,
            selectedSchedule,
            updatedChild.grade,
            value
          );
          await TrackSelectionService.applyTrackClassChanges(
            updatedChild.id,
            changes,
            writeStatus
          );
          await refetchSelectedSchedule();
        }
      } catch (err) {
        message.error(
          err instanceof Error
            ? err.message
            : t(
                field === "groupNumber"
                  ? "schedule.page.error.updateGroup"
                  : "schedule.page.error.updateTrack"
              )
        );
      }
    };

  const handleParentFieldChange = makeFieldChangeHandler(
    selectedChild,
    updateChildForParent,
    setSelectedChild
  );

  const handleStaffFieldChange = makeFieldChangeHandler(
    staffSelectedChild,
    updateChildForStaff,
    setStaffSelectedChild
  );

  // Handler for when a new child is added via StudentSearchSelector
  const handleChildAdded = (newChild: Child) => {
    // Auto-select the newly created student for staff
    setStaffSelectedChild(newChild);
    setSelectedGrade(newChild.grade);
  };

  // Handler for when a parent adds a new child via AddChildButton
  const handleParentChildAdded = (newChild: Child) => {
    setSelectedChild(newChild);
    if (!isAdmin) {
      setSelectedGrade(newChild.grade);
    }
  };

  // Handler for when a parent picks a child tab
  const handleParentChildSelect = (child: Child) => {
    setSelectedChild(child);
    if (!isAdmin) setSelectedGrade(child.grade);
  };

  // Auto-update grade filter when selected child changes (not for admins)
  React.useEffect(() => {
    if (selectedChild && canPickSchedule && !isAdmin) {
      setSelectedGrade(selectedChild.grade);
    }
  }, [selectedChild, canPickSchedule, isAdmin]);

  // Page-level loading: catalog (classes/time slots) and the child roster
  // only load once (or on an explicit refresh), so gating the full-page
  // spinner on these is fine. `selectedScheduleLoading` is deliberately
  // excluded -- it re-fires on every child selection and draft/committed
  // toggle, and including it here would unmount and remount the whole page
  // (filters, selectors, everything) on each of those, instead of just
  // refreshing the schedule grid. See `scheduleGridLoading` below.
  const pageLoading =
    scheduleLoading ||
    (canPickSchedule
      ? childrenLoading
      : actsAsStaff
        ? allChildrenLoading
        : false);
  // Scoped to the schedule grid + selected-classes summary, so switching
  // child/toggle only shows a local loading state over that section.
  const scheduleGridLoading = selectedScheduleLoading;
  const loading = pageLoading || scheduleGridLoading;

  // Classes auto-selected by the active child's track can't be picked apart
  // one at a time -- only changing the track (which re-syncs them) can.
  const currentTrackChild = actsAsStaff ? staffSelectedChild : selectedChild;
  const lockedClassIds = new Set([
    ...(currentTrackChild?.trackNumber
      ? classes
          .filter(cls => cls.trackNumber === currentTrackChild.trackNumber)
          .map(cls => cls.id)
      : []),
    // Must mirror GroupMandatoryLockService.computeChanges's criteria exactly
    // (grade AND locked-match), so "what we lock in the UI" can never drift
    // from "what we actually auto-select in the DB".
    ...(currentTrackChild
      ? classes
          .filter(
            cls =>
              ScheduleService.classMatchesGrade(cls, currentTrackChild.grade) &&
              GroupMandatoryLockService.isLockedMatch(
                cls,
                currentTrackChild.groupNumber
              )
          )
          .map(cls => cls.id)
      : []),
    // Staff-only placeholder classes (e.g. "חונכות", "שילוב") already chosen
    // for this child can only be managed by staff/admin -- lock them here so
    // non-staff/admin viewers can see but never unselect them.
    ...(!permissions.canManageClasses
      ? selectedSchedule
          .map(selection => selection.class)
          .filter(cls => ScheduleService.isStaffOnlyClass(cls))
          .map(cls => cls.id)
      : []),
  ]);

  // Group and Mandatory have no user-driven change event on this page (a
  // child's group is admin-set, mandatory is a fixed class attribute) --
  // unlike Track, which syncs from makeTrackChangeHandler, this syncs
  // whenever the active child or the loaded catalog/schedule changes.
  //
  // Re-entrancy guard: `classes` and `selectedSchedule` load somewhat
  // independently, so this effect can fire twice in close succession
  // (also reliably reproduced by React 18 StrictMode's dev double-invoke)
  // before the first invocation's applyChanges + refetchSelectedSchedule
  // has updated `selectedSchedule`. Both invocations would then compute
  // the same toSelect/toUnselect against identical stale state and both
  // call the API for the same class, tripping the DB's unique constraint.
  // syncInFlightRef guards against starting a second call while one is
  // still running; it's set before the async work begins and cleared in
  // `finally` (not in the cleanup function, which fires on every
  // dependency change, not just unmount). Once the in-flight call's own
  // refetchSelectedSchedule() updates `selectedSchedule`, the effect
  // re-runs and finds nothing further to do.
  //
  // The lock holds the id of the child currently being synced (undefined =
  // no sync in flight) rather than a plain boolean: syncs for two different
  // children touch disjoint schedule_selections rows, so one child's
  // in-flight sync must not suppress another child's. Only a re-entrant
  // firing for the SAME child -- the actual duplicate-insert race -- is
  // blocked.
  const syncInFlightRef = React.useRef<string | undefined>(undefined);
  // activeChildIdRef always tracks the most recently seen child id, updated
  // synchronously on every effect run (before the early-return checks) so
  // that a resolving async call can tell "the child changed" (skip the
  // refetch/error) apart from "the effect re-fired for the same child"
  // (still apply the refetch/error), instead of relying on a `cancelled`
  // closure flag that conflated the two cases.
  const activeChildIdRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    activeChildIdRef.current = currentTrackChild?.id;

    // Never auto-sync while a parent is viewing the read-only committed
    // schedule: `selectedSchedule` reflects committed picks in that mode,
    // not draft, so computing/writing a diff here would be based on the
    // wrong data and would violate RLS (parents may only write draft rows).
    if (!canEdit) return;

    // This effect WRITES for `currentTrackChild` while reading
    // `selectedSchedule`/`refetchSelectedSchedule`, which belong to `target`.
    // Both now resolve through `actsAsStaff` and so name the same child, but
    // if they ever disagreed, computeChanges would never see its own writes
    // land and would loop writes against the wrong child. Only sync when both
    // agree on the same child.
    if (!target || target.childId !== currentTrackChild?.id) {
      return;
    }

    if (!currentTrackChild || classes.length === 0) return;
    // selectedSchedule loads independently of classes (a separate hook,
    // useSelectedSchedule) and starts as `[]` until its own fetch resolves.
    // Without this guard, a fast `classes` load racing a slow
    // `selectedSchedule` fetch would run computeChanges against that empty
    // placeholder -- not because nothing is actually selected, but because
    // the fetch simply hasn't returned yet -- and try to re-insert rows
    // that already exist in the DB, tripping the unique constraint on
    // every fresh page load for an already-synced child.
    if (selectedScheduleLoading) return;
    if (syncInFlightRef.current === currentTrackChild.id) return;

    const changes = GroupMandatoryLockService.computeChanges(
      classes,
      selectedSchedule,
      currentTrackChild
    );

    if (changes.toSelect.length === 0 && changes.toUnselectIds.length === 0) {
      return;
    }

    const syncingChildId = currentTrackChild.id;
    syncInFlightRef.current = syncingChildId;
    (async () => {
      try {
        await GroupMandatoryLockService.applyChanges(
          currentTrackChild.id,
          changes,
          writeStatus
        );
        if (activeChildIdRef.current === syncingChildId) {
          await refetchSelectedSchedule();
        }
      } catch (err) {
        if (activeChildIdRef.current === syncingChildId) {
          message.error(
            err instanceof Error
              ? err.message
              : t("schedule.page.error.updateClassSelection")
          );
        }
      } finally {
        // Only release the lock if it's still ours -- a sync started for a
        // different child in the meantime owns the ref now.
        if (syncInFlightRef.current === syncingChildId) {
          syncInFlightRef.current = undefined;
        }
      }
    })();
    // `refetchSelectedSchedule` is deliberately excluded from the deps: it is
    // not memoized (a new function identity every render), so including it
    // would re-fire this effect on every render and defeat the in-flight
    // guard. `message` and `t` are stable enough to omit for the same reason.
    // `target` is likewise omitted -- it's a fresh object literal every render;
    // it's read only by the mismatch guard above, and any real change to it
    // also changes `selectedSchedule`/`selectedScheduleLoading`, which ARE
    // deps. Do not "fix" any of these with exhaustive-deps.
  }, [
    currentTrackChild?.id,
    currentTrackChild?.grade,
    currentTrackChild?.groupNumber,
    classes,
    selectedSchedule,
    selectedScheduleLoading,
    canEdit,
  ]);

  // handleClassSelect awaits the API call and then a refetch before
  // isClassSelected reflects the new state -- so a second click on the same
  // class while that round-trip is still in flight sees stale state and
  // fires a second insert for the same (child_id, class_id, status),
  // hitting schedule_selections_child_class_status_key as a raw Postgres
  // error instead of a no-op. Guard re-entrancy per class instead.
  const pendingSelectionClassIdsRef = React.useRef<Set<string>>(new Set());

  const handleClassSelect = async (classId: string) => {
    if (!target) return;
    if (pendingSelectionClassIdsRef.current.has(classId)) return;
    pendingSelectionClassIdsRef.current.add(classId);
    try {
      if (isClassSelected(classId)) {
        // Locked classes (track, group, or mandatory match) can't be
        // unselected.
        if (lockedClassIds.has(classId)) {
          message.warning(t("schedule.page.error.lockedClassCannotUnselect"));
          return;
        }
        await unselectSchedule(classId);
        trackWithActor(AnalyticsEvent.ClassUnselected, currentRole?.role, {
          classId,
        });
      } else {
        await selectSchedule(classId);
        trackWithActor(AnalyticsEvent.ClassSelected, currentRole?.role, {
          classId,
        });
      }
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("schedule.page.error.updateClassSelection")
      );
    } finally {
      pendingSelectionClassIdsRef.current.delete(classId);
    }
  };

  // The child whose schedule the print button exports (and names).
  const printChild = canPickSchedule ? selectedChild : staffSelectedChild;
  const printChildName = printChild
    ? `${printChild.firstName} ${printChild.lastName}`
    : "";

  const selectedClasses = selectedSchedule.map(selection => selection.classId);
  const hasSelectableTarget =
    (canPickSchedule && !!selectedChild) ||
    (actsAsStaff && staffSelectedChild !== null);

  // A parent viewing the read-only committed schedule gets no interaction at
  // all -- cells don't open the drawer, not just "opens read-only" -- so
  // canViewClasses is gated by canEdit too, same as canSelectClasses.
  const canSelectClasses = hasSelectableTarget && canEdit;
  const canViewClasses =
    canSelectClasses ||
    currentRole?.role === "admin" ||
    currentRole?.role === "staff";

  return {
    // The child whose schedule a parent or child user sees and edits.
    child: {
      selected: selectedChild,
      list: userChildren,
      loading: childrenLoading,
      canPick: canPickSchedule,
      canManage: canManageChildren,
      select: handleParentChildSelect,
      add: handleParentChildAdded,
      updateField: handleParentFieldChange,
    },
    // The student staff picked (desktop student view; see #192, #266).
    staffStudent: {
      active: actsAsStaff,
      selected: staffSelectedChild,
      list: allChildren,
      loading: allChildrenLoading,
      select: handleStaffChildSelect,
      add: handleChildAdded,
      updateField: handleStaffFieldChange,
    },
    // Draft/committed and the grade filter.
    view: {
      committed: viewCommitted,
      setCommitted: setViewCommitted,
      status: viewStatus,
      canEdit,
      grade: selectedGrade,
      setGrade: setSelectedGrade,
    },
    catalog: {
      classes,
      timeSlots,
      weekly: displayWeeklySchedule,
      reload: loadScheduleData,
    },
    // The shown child's picks and what the viewer may do with them.
    selection: {
      ids: selectedClasses,
      schedule: selectedSchedule,
      draftIds: draftClassIds,
      lockedIds: lockedClassIds,
      trackChild: currentTrackChild,
      shownChild: printChild,
      shownChildName: printChildName,
      canSelect: canSelectClasses,
      canView: canViewClasses,
      toggle: handleClassSelect,
      refetch: refetchSelectedSchedule,
    },
    overrides: {
      list: overrides,
      canCreate: canCreateOverride,
      create: createOverride,
      update: updateOverride,
      remove: deleteOverride,
    },
    status: {
      pageLoading,
      gridLoading: scheduleGridLoading,
      loading,
      catalogError: scheduleError,
      // The student view's error: catalog, selections or children.
      error: scheduleError || selectedScheduleError || childrenError,
    },
  };
}

export type ChildScheduleController = ReturnType<
  typeof useChildScheduleController
>;
