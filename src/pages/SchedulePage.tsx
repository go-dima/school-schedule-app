import React, { useEffect, useState } from "react";
import {
  Card,
  Typography,
  Select,
  Button,
  Space,
  Alert,
  Spin,
  message,
  AutoComplete,
  Tooltip,
  Radio,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  UserSwitchOutlined,
  PrinterOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { useChildContext } from "../contexts/ChildContext";
import {
  ScheduleCatalogProvider,
  useScheduleCatalog,
} from "../contexts/ScheduleCatalogContext";
import { useSelectedSchedule } from "../hooks/useSelectedSchedule";
import { useDraftSelectionAwareness } from "../hooks/useDraftSelectionAwareness";
import { useScheduleOverrides } from "../hooks/useScheduleOverrides";
import { useAllChildrenContext } from "../contexts/AllChildrenContext";
import ScheduleTable from "../components/ScheduleTable";
import { CreateClassModal } from "../components/CreateClassModal";
import { ScheduleOverrideModal } from "../components/ScheduleOverrideModal";
import type { ScheduleOverrideFormValues } from "../components/ScheduleOverrideForm";
import { FiltersBar } from "../components/FiltersBar";
import { FilterField } from "../components/FilterField";
import { ChildSelector } from "../components/ChildSelector";
import { AddChildButton } from "../components/AddChildButton";
import { StudentSearchSelector } from "../components/StudentSearchSelector";
import { ChildGroupTrackSelector } from "../components/ChildGroupTrackSelector";
import type { SelectionField } from "../components/ChildGroupTrackSelector";
import { classesApi, timeSlotsApi } from "../services/api";
import { TrackSelectionService } from "../services/trackSelectionService";
import { GroupMandatoryLockService } from "../services/groupMandatoryLockService";
import { ScheduleService } from "../services/scheduleService";
import { DraftBanner } from "../elements/DraftBanner";
import { CommittedReadOnlyBanner } from "../elements/CommittedReadOnlyBanner";
import { GRADES } from "../types";
import type {
  Class,
  TimeSlot,
  Child,
  ScheduleOverrideWithTimeSlot,
  ScheduleTarget,
  SelectionStatus,
} from "../types";
import "./SchedulePage.css";
import { GetGradeName } from "@/utils/grades";
import { printSchedule } from "../utils/printSchedule";

const { Title } = Typography;
const { Option } = Select;

const SchedulePageContent: React.FC = () => {
  const { t } = useTranslation();

  const getRoleDisplayName = (role: string): string => {
    const roleKey = `roles.${role}`;
    return t(roleKey, role); // fallback to role if translation not found
  };
  const {
    user,
    currentRole,
    userRoles,
    switchRole,
    isAdmin,
    hasRole,
    canCreateClasses,
    canManageClasses,
  } = useAuth();
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
  const isStaff = hasRole("staff");

  const [selectedGrade, setSelectedGrade] = useState<number | undefined>(1);
  const [createClassModalOpen, setCreateClassModalOpen] = useState(false);
  const [createClassTimeSlotId, setCreateClassTimeSlotId] = useState<
    string | null
  >(null);
  const [createClassDayOfWeek, setCreateClassDayOfWeek] = useState<
    number | null
  >(null);
  const [allTimeSlots, setAllTimeSlots] = useState<TimeSlot[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [viewCommitted, setViewCommitted] = useState(false);

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideDay, setOverrideDay] = useState<number | null>(null);
  const [overrideTimeSlotId, setOverrideTimeSlotId] = useState<string | null>(
    null
  );
  const [editingOverride, setEditingOverride] =
    useState<ScheduleOverrideWithTimeSlot | null>(null);
  const [overrideModalLoading, setOverrideModalLoading] = useState(false);

  const isParent = hasRole("parent");
  const { viewStatus, overrideChildId, canCreateOverride } =
    ScheduleService.resolveScheduleView({
      role: currentRole?.role,
      viewCommitted,
      parentSelectedChildId: selectedChild?.id,
      staffSelectedChildId: staffSelectedChild?.id,
    });

  // Read-only whenever a parent has toggled to the committed view. Auto-sync
  // writes (track/group/mandatory changes) must always target the role's
  // real write status (draft, for parents) even while this is true -- never
  // `viewStatus`, since that's just what's being displayed and RLS rejects a
  // parent writing a `committed` row.
  const canEdit = !(isParent && viewCommitted);
  const writeStatus: SelectionStatus = ScheduleService.resolveSelectionStatus(
    currentRole?.role
  );

  // Snap the toggle back to draft when the child is cleared, so a disabled
  // toggle never looks visually "stuck on" for the next child selected.
  useEffect(() => {
    if (!selectedChild) setViewCommitted(false);
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

  // Whose selections to read/write: a parent's or staff's chosen student, or
  // (for the "child" role only) the logged-in user's own picks. Everyone
  // else (no child chosen yet, or a role with no self-select concept) gets
  // no target and therefore no selections.
  const target: ScheduleTarget | undefined =
    isParent && selectedChild
      ? { childId: selectedChild.id }
      : isStaff && staffSelectedChild
        ? { childId: staffSelectedChild.id }
        : currentRole?.role === "child" && user?.id
          ? { userId: user.id }
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
    if (!isAdmin()) {
      setSelectedGrade(newChild.grade);
    }
  };

  // Auto-update grade filter when selected child changes (only for non-admin parents)
  React.useEffect(() => {
    if (selectedChild && isParent && !isAdmin()) {
      setSelectedGrade(selectedChild.grade);
    }
  }, [selectedChild, isParent, isAdmin]);

  // Page-level loading: catalog (classes/time slots) and the child roster
  // only load once (or on an explicit refresh), so gating the full-page
  // spinner on these is fine. `selectedScheduleLoading` is deliberately
  // excluded -- it re-fires on every child selection and draft/committed
  // toggle, and including it here would unmount and remount the whole page
  // (filters, selectors, everything) on each of those, instead of just
  // refreshing the schedule grid. See `scheduleGridLoading` below.
  const pageLoading =
    scheduleLoading ||
    (isParent ? childrenLoading : isStaff ? allChildrenLoading : false);
  // Scoped to the schedule grid + selected-classes summary, so switching
  // child/toggle only shows a local loading state over that section.
  const scheduleGridLoading = selectedScheduleLoading;
  const loading = pageLoading || scheduleGridLoading;
  const error = scheduleError || selectedScheduleError || childrenError;

  const handleRoleSwitch = (roleId: string) => {
    const role = userRoles.find(r => r.id === roleId);
    if (role) {
      switchRole(role);
    }
  };

  // Classes auto-selected by the active child's track can't be picked apart
  // one at a time -- only changing the track (which re-syncs them) can.
  const currentTrackChild = isStaff ? staffSelectedChild : selectedChild;
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
              cls.grades.includes(currentTrackChild.grade) &&
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
    ...(!canManageClasses()
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

    // `target` (parent-role precedence) and `currentTrackChild` (staff-role
    // precedence) can disagree for a user who holds BOTH the parent and staff
    // roles: ChildContext auto-selects their own first child, so `target`
    // stays on that child while `currentTrackChild` follows the staff student
    // selector. Track only ever read `currentTrackChild`, so the divergence was
    // harmless there -- but this effect WRITES for `currentTrackChild` while
    // reading `selectedSchedule`/`refetchSelectedSchedule`, which belong to
    // `target`. Mismatched, computeChanges would never see its own writes land,
    // looping writes against the wrong child forever. Only sync when both
    // agree on the same child.
    if (
      !target ||
      !("childId" in target) ||
      target.childId !== currentTrackChild?.id
    ) {
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

  const handleClassSelect = async (classId: string) => {
    if (!target) return;
    try {
      if (isClassSelected(classId)) {
        // Locked classes (track, group, or mandatory match) only apply to
        // the child-entity flows (parent/staff); the "child" role's own
        // selections aren't tied to a Child record with these attributes.
        if ("childId" in target && lockedClassIds.has(classId)) {
          message.warning(t("schedule.page.error.lockedClassCannotUnselect"));
          return;
        }
        await unselectSchedule(classId);
      } else {
        await selectSchedule(classId);
      }
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("schedule.page.error.updateClassSelection")
      );
    }
  };

  const handleExportSchedule = async () => {
    const currentChild = isParent ? selectedChild : staffSelectedChild;

    if (!currentChild) {
      message.error(t("schedule.page.error.noChildSelected"));
      return;
    }

    try {
      // Reuse the exact feed the live grid renders (see the <ScheduleTable>
      // below) so print can never diverge from what's on screen: same
      // catalog+selections merge, same selection ids, same overrides.
      await printSchedule({
        child: currentChild,
        timeSlots,
        weeklySchedule: displayWeeklySchedule,
        selectedClasses,
        overrides,
        showDraftMarker: viewStatus === "draft",
      });
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("schedule.page.error.exportFailed")
      );
    }
  };

  // Shared by both the class-creation and override-creation entry points --
  // `allTimeSlots` only needs to be fetched once per page visit.
  const ensureAllTimeSlotsLoaded = async (): Promise<TimeSlot[]> => {
    if (allTimeSlots.length > 0) return allTimeSlots;
    const allSlots = await timeSlotsApi.getTimeSlots();
    setAllTimeSlots(allSlots);
    return allSlots;
  };

  const handleCreateClass = async (timeSlotId: string, dayOfWeek: number) => {
    let slotsToUse: TimeSlot[];
    try {
      slotsToUse = await ensureAllTimeSlotsLoaded();
    } catch (err) {
      message.error(t("schedule.page.error.loadTimeSlots"));
      return;
    }

    // Verify the timeSlot exists before setting state
    const foundTimeSlot = slotsToUse.find(slot => slot.id === timeSlotId);

    if (!foundTimeSlot) {
      message.error(t("schedule.page.error.timeSlotNotFound"));
      return;
    }

    setCreateClassTimeSlotId(timeSlotId);
    setCreateClassDayOfWeek(dayOfWeek);
    setCreateClassModalOpen(true);
  };

  const handleCreateOverride = async (
    timeSlotId: string,
    dayOfWeek: number
  ) => {
    try {
      await ensureAllTimeSlotsLoaded();
    } catch (err) {
      message.error(t("schedule.page.error.loadTimeSlots"));
      return;
    }

    setEditingOverride(null);
    setOverrideTimeSlotId(timeSlotId);
    setOverrideDay(dayOfWeek);
    setOverrideModalOpen(true);
  };

  const handleOverrideCardClick = async (
    override: ScheduleOverrideWithTimeSlot
  ) => {
    try {
      await ensureAllTimeSlotsLoaded();
    } catch (err) {
      message.error(t("schedule.page.error.loadTimeSlots"));
      return;
    }

    setEditingOverride(override);
    setOverrideTimeSlotId(override.timeSlotId);
    setOverrideDay(override.dayOfWeek);
    setOverrideModalOpen(true);
  };

  const handleCloseOverrideModal = () => {
    setOverrideModalOpen(false);
    setOverrideTimeSlotId(null);
    setOverrideDay(null);
    setEditingOverride(null);
  };

  const handleOverrideSubmit = async (values: ScheduleOverrideFormValues) => {
    if (!staffSelectedChild) return;
    setOverrideModalLoading(true);
    try {
      if (editingOverride) {
        await updateOverride(editingOverride.id, values);
        message.success(t("schedule.override.updateSuccess"));
      } else {
        await createOverride({
          ...values,
          childId: staffSelectedChild.id,
        });
        message.success(t("schedule.override.createSuccess"));
      }
      handleCloseOverrideModal();
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t(
              editingOverride
                ? "schedule.override.updateError"
                : "schedule.override.createError"
            )
      );
    } finally {
      setOverrideModalLoading(false);
    }
  };

  // Shared by both delete entry points below. The confirm dialog itself is
  // wired in the caller (ScheduleOverrideForm for the edit-modal path,
  // matching ClassManagementPage.tsx's confirmDeleteClass pattern; the
  // drawer's own OverrideSelectionCard for the other) -- this only runs
  // after the staff member has already confirmed. Only removes the
  // schedule_overrides row -- the underlying schedule_selections pick (if
  // any) was never touched, so it becomes visible again once this resolves.
  const deleteOverrideById = async (id: string) => {
    try {
      await deleteOverride(id);
      message.success(t("schedule.override.deleteSuccess"));
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("schedule.override.deleteError")
      );
    }
  };

  const handleOverrideDelete = async () => {
    if (!editingOverride) return;
    await deleteOverrideById(editingOverride.id);
    handleCloseOverrideModal();
  };

  const handleDrawerOverrideDelete = async (
    override: ScheduleOverrideWithTimeSlot
  ) => {
    await deleteOverrideById(override.id);
  };

  const handleCloseCreateModal = () => {
    setCreateClassModalOpen(false);
    setCreateClassTimeSlotId(null);
    setCreateClassDayOfWeek(null);
  };

  const handleFormSubmit = async (
    classData: Omit<Class, "id" | "createdAt" | "updatedAt">
  ) => {
    setModalLoading(true);
    try {
      await classesApi.createClass(classData);
      message.success(t("schedule.page.success.classCreated"));
      handleCloseCreateModal();
      // Reload schedule data to show the new class
      await Promise.all([loadScheduleData(), refetchSelectedSchedule()]);
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("schedule.page.error.createClass")
      );
    } finally {
      setModalLoading(false);
    }
  };

  const selectedClasses = selectedSchedule.map(selection => selection.classId);
  const hasSelectableTarget =
    ((currentRole?.role === "child" || currentRole?.role === "parent") &&
      (!isParent || selectedChild !== null)) ||
    (isStaff && staffSelectedChild !== null);

  // A parent viewing the read-only committed schedule gets no interaction at
  // all -- cells don't open the drawer, not just "opens read-only" -- so
  // canViewClasses is gated by canEdit too, same as canSelectClasses.
  const canSelectClasses = hasSelectableTarget && canEdit;
  const canViewClasses =
    canSelectClasses ||
    currentRole?.role === "admin" ||
    currentRole?.role === "staff";

  if (pageLoading) {
    return (
      <div className="page-loading">
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 16, color: "#1890ff" }}>
          {t("schedule.page.loading")}
        </Title>
      </div>
    );
  }

  return (
    <div className="page-content">
      <FiltersBar
        variant="flat"
        canRefresh
        onRefresh={() => {
          loadScheduleData();
          refetchSelectedSchedule();
        }}
        refreshing={loading}
        disabled={loading}
        actions={
          <>
            {userRoles.length > 1 && (
              <Select
                value={currentRole?.id}
                onChange={handleRoleSwitch}
                placeholder={t("schedule.page.placeholders.selectRole")}
                style={{ minWidth: 120 }}
                suffixIcon={<UserSwitchOutlined />}>
                {userRoles.map(role => (
                  <Option key={role.id} value={role.id}>
                    {getRoleDisplayName(role.role)}
                  </Option>
                ))}
              </Select>
            )}
            {((isParent && selectedChild) ||
              (isStaff && staffSelectedChild)) && (
              <Button
                icon={<PrinterOutlined />}
                onClick={handleExportSchedule}
                disabled={loading}>
                {t("schedule.page.exportButton")}
              </Button>
            )}
            <FilterField label={t("schedule.page.labels.searchClass")}>
              <AutoComplete
                value={searchTerm}
                onChange={setSearchTerm}
                options={(() => {
                  if (!searchTerm) return [];

                  const uniqueClassNames = Array.from(
                    new Set(
                      classes
                        .filter(cls => {
                          // For staff with selected child, filter by child's grade only
                          if (isStaff && staffSelectedChild) {
                            if (
                              !cls.grades?.includes(staffSelectedChild.grade)
                            ) {
                              return false;
                            }
                          } else {
                            // Apply grade filter if set
                            if (
                              selectedGrade &&
                              !cls.grades?.includes(selectedGrade)
                            ) {
                              return false;
                            }
                          }
                          // Apply class name filter
                          return cls.title
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase());
                        })
                        .map(cls => cls.title)
                    )
                  ).sort();

                  return uniqueClassNames.map(title => ({ value: title }));
                })()}
                placeholder={t("schedule.page.placeholders.searchClass")}
                style={{ minWidth: 200 }}
                allowClear
                filterOption={false}
              />
            </FilterField>
          </>
        }>
        {isParent && userChildren.length > 0 && (
          <>
            <Radio.Group
              className="draft-committed-toggle"
              optionType="button"
              value={viewCommitted ? "committed" : "draft"}
              onChange={e => setViewCommitted(e.target.value === "committed")}
              disabled={!selectedChild}>
              <Radio.Button value="draft">
                {t("schedule.page.labels.draftView")}
              </Radio.Button>
              <Radio.Button value="committed">
                {t("schedule.page.labels.committedView")}
              </Radio.Button>
            </Radio.Group>
            <ChildGroupTrackSelector
              child={selectedChild}
              onChange={handleParentFieldChange}
              disabled={childrenLoading || !canEdit}
            />
            <FilterField label={t("schedule.page.labels.selectChild")}>
              <ChildSelector
                children={userChildren}
                selectedChildId={selectedChild?.id || null}
                onChildSelect={childId => {
                  if (!childId) {
                    // Handle clear selection
                    setSelectedChild(undefined);
                    return;
                  }
                  const child = userChildren.find(c => c.id === childId);
                  setSelectedChild(child || undefined);
                  // Auto-update grade filter based on selected child (only for non-admin parents)
                  if (child && !isAdmin()) {
                    setSelectedGrade(child.grade);
                  }
                }}
                style={{ minWidth: 200 }}
                disabled={childrenLoading}
              />
            </FilterField>
          </>
        )}
        {isParent && <AddChildButton onAdded={handleParentChildAdded} />}
        {isStaff && (
          <>
            <ChildGroupTrackSelector
              child={staffSelectedChild}
              onChange={handleStaffFieldChange}
              disabled={allChildrenLoading}
            />
            <FilterField label={t("schedule.page.labels.selectChildForStaff")}>
              <StudentSearchSelector
                children={allChildren}
                selectedChildId={staffSelectedChild?.id || null}
                onChildSelect={handleStaffChildSelect}
                onChildAdded={handleChildAdded}
                placeholder={t(
                  "schedule.page.placeholders.selectChildForStaff"
                )}
                style={{ minWidth: 200 }}
                disabled={allChildrenLoading}
                defaultGrade={selectedGrade || 1}
                mode="select"
                isCreateAllowed={isStaff}
              />
            </FilterField>
          </>
        )}
        {(isStaff || isAdmin()) && (
          <FilterField label={t("schedule.page.labels.filterByGrade")}>
            <Select
              value={selectedGrade}
              onChange={setSelectedGrade}
              placeholder={t("schedule.page.placeholders.allGrades")}
              allowClear
              style={{ minWidth: 120 }}
              disabled={isStaff && !!staffSelectedChild}>
              {GRADES.map(grade => (
                <Option key={grade} value={grade}>
                  {GetGradeName(grade)}
                </Option>
              ))}
            </Select>
          </FilterField>
        )}
      </FiltersBar>

      {isParent && userChildren.length === 0 && (
        <Alert
          message={t("schedule.page.alerts.noChildrenFound.title")}
          description={
            <>
              {t("schedule.page.alerts.noChildrenFound.descriptionPrefix")}
              <AddChildButton
                onAdded={handleParentChildAdded}
                renderTrigger={open => (
                  <Typography.Link onClick={open}>
                    {t("schedule.page.addChildButton")}
                  </Typography.Link>
                )}
              />
              {t("schedule.page.alerts.noChildrenFound.descriptionSuffix")}
            </>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {isParent && userChildren.length > 0 && !selectedChild && (
        <Alert
          message={t("schedule.page.alerts.noChildSelected.title")}
          description={t("schedule.page.alerts.noChildSelected.description")}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {!canSelectClasses && !isParent && (
        <Alert
          message={t("schedule.page.alerts.noPermission.title")}
          description={
            userRoles.length === 0
              ? t("schedule.page.alerts.noPermission.needsApproval")
              : currentRole?.role === "admin" || currentRole?.role === "staff"
                ? t("schedule.page.alerts.noPermission.adminStaffViewOnly")
                : t("schedule.page.alerts.noPermission.studentsParentsOnly")
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            userRoles.length > 1 &&
            (currentRole?.role === "admin" || currentRole?.role === "staff") ? (
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  const childOrParentRole = userRoles.find(
                    role => role.role === "child" || role.role === "parent"
                  );
                  if (childOrParentRole) {
                    switchRole(childOrParentRole);
                  }
                }}>
                {t("schedule.page.buttons.switchToAppropriateRole")}
              </Button>
            ) : undefined
          }
        />
      )}

      {error && (
        <Alert
          message={t("schedule.page.error.loadData")}
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 24 }}
        />
      )}

      {viewStatus === "draft" && <DraftBanner />}
      {isParent && viewCommitted && <CommittedReadOnlyBanner />}

      <Spin spinning={scheduleGridLoading}>
        <Card className="schedule-card">
          <ScheduleTable
            timeSlots={timeSlots}
            classes={classes}
            weeklySchedule={displayWeeklySchedule}
            userGrade={selectedGrade}
            selectedClasses={selectedClasses}
            draftPickedClassIds={Array.from(draftClassIds)}
            userSelections={selectedSchedule}
            onClassSelect={handleClassSelect}
            onClassUnselect={handleClassSelect}
            canSelectClasses={canSelectClasses}
            canViewClasses={canViewClasses}
            isAdmin={canCreateClasses()}
            showEnrollmentCount={isStaff || isAdmin()}
            onCreateClass={handleCreateClass}
            searchTerm={searchTerm}
            childGroupNumber={currentTrackChild?.groupNumber}
            lockedClassIds={Array.from(lockedClassIds)}
            overrides={overrides}
            canCreateOverride={canCreateOverride}
            onCreateOverride={handleCreateOverride}
            onOverrideClick={isStaff ? handleOverrideCardClick : undefined}
            onOverrideDelete={isStaff ? handleDrawerOverrideDelete : undefined}
          />
        </Card>

        {canSelectClasses && selectedSchedule.length > 0 && (
          <Card
            title={
              (isParent && selectedChild) || (isStaff && staffSelectedChild)
                ? t("schedule.page.selectedClassesForChild", {
                    firstName: (isParent ? selectedChild : staffSelectedChild)
                      ?.firstName,
                    lastName: (isParent ? selectedChild : staffSelectedChild)
                      ?.lastName,
                  })
                : t("schedule.page.selectedClassesTitle")
            }
            className="selected-classes-summary">
            <Space wrap>
              {selectedSchedule.map(selection => {
                const isLocked = lockedClassIds.has(selection.classId);
                const button = (
                  <Button
                    key={selection.id}
                    type="primary"
                    size="small"
                    disabled={isLocked}
                    icon={isLocked ? <LockOutlined /> : undefined}
                    onClick={() => handleClassSelect(selection.classId)}>
                    {selection.class.title} - {selection.class.teacher}
                  </Button>
                );
                return isLocked ? (
                  <Tooltip
                    key={selection.id}
                    title={t("schedule.drawer.lockedClassTooltip")}>
                    <span style={{ display: "inline-block" }}>{button}</span>
                  </Tooltip>
                ) : (
                  button
                );
              })}
            </Space>
          </Card>
        )}
      </Spin>

      <CreateClassModal
        open={createClassModalOpen}
        timeSlotId={createClassTimeSlotId}
        dayOfWeek={createClassDayOfWeek}
        timeSlots={allTimeSlots}
        loading={modalLoading}
        onSubmit={handleFormSubmit}
        onCancel={handleCloseCreateModal}
      />

      <ScheduleOverrideModal
        open={overrideModalOpen}
        editingOverride={editingOverride}
        overrideDay={overrideDay}
        overrideTimeSlotId={overrideTimeSlotId}
        childId={staffSelectedChild?.id}
        timeSlots={allTimeSlots}
        loading={overrideModalLoading}
        onSubmit={handleOverrideSubmit}
        onCancel={handleCloseOverrideModal}
        onDelete={handleOverrideDelete}
      />
    </div>
  );
};

const SchedulePage: React.FC = () => (
  <ScheduleCatalogProvider>
    <SchedulePageContent />
  </ScheduleCatalogProvider>
);

export default SchedulePage;
