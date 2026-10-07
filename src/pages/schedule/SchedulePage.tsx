import React, { useState } from "react";
import {
  Card,
  Typography,
  Button,
  Space,
  Alert,
  Spin,
  message,
  Tooltip,
  Radio,
} from "antd";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  PrinterOutlined,
  ReloadOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { ScheduleCatalogProvider } from "../../contexts/ScheduleCatalogContext";
import { useStaffSchedule } from "../../hooks/useStaffSchedule";
import {
  parseStaffKey,
  staffKeyToParam,
} from "../../services/staffScheduleService";
import type { StaffKey } from "../../services/staffScheduleService";
import ScheduleTable from "../../components/ScheduleTable";
import { CreateClassModal } from "../../components/CreateClassModal";
import { ScheduleOverrideModal } from "../../components/ScheduleOverrideModal";
import type { ScheduleOverrideFormValues } from "../../components/ScheduleOverrideForm";
import { FiltersBar } from "../../components/FiltersBar";
import { FilterField } from "../../components/FilterField";
import { FilterSelect } from "../../components/FilterSelect";
import { ChildTabs } from "../../components/ChildTabs";
import { ScheduleTabsBar } from "../../components/ScheduleTabsBar";
import { AddChildButton } from "../../components/AddChildButton";
import { StudentSearchSelector } from "../../components/StudentSearchSelector";
import { StaffPicker } from "../../components/StaffPicker";
import { TextSearch } from "../../components/TextSearch";
import { ChildGroupTrackSelector } from "../../components/ChildGroupTrackSelector";
import { classesApi, timeSlotsApi } from "../../services/api";
import { ScheduleService } from "../../services/scheduleService";
import { DraftBanner } from "../../elements/DraftBanner";
import { CommittedReadOnlyBanner } from "../../elements/CommittedReadOnlyBanner";
import { GRADES } from "../../types";
import type {
  Class,
  TimeSlot,
  ScheduleOverrideWithTimeSlot,
} from "../../types";
import "./SchedulePage.css";
import { useChildScheduleController } from "./useChildScheduleController";
import { GetGradeName } from "@/utils/grades";
import { printSchedule } from "../../utils/printSchedule";
import {
  trackEvent,
  trackWithActor,
  AnalyticsEvent,
} from "../../utils/analytics";

const { Title } = Typography;

const SchedulePageContent: React.FC = () => {
  const { t } = useTranslation();

  const { user, currentRole, userRoles, permissions } = useAuth();
  const {
    actsAsStaff,
    allChildren,
    allChildrenLoading,
    canCreateOverride,
    canEdit,
    canManageChildren,
    canPickSchedule,
    canSelectClasses,
    canViewClasses,
    childrenError,
    childrenLoading,
    classes,
    createOverride,
    currentTrackChild,
    deleteOverride,
    displayWeeklySchedule,
    draftClassIds,
    handleChildAdded,
    handleClassSelect,
    handleParentChildAdded,
    handleParentChildSelect,
    handleParentFieldChange,
    handleStaffChildSelect,
    handleStaffFieldChange,
    isAdmin,
    loadScheduleData,
    loading,
    lockedClassIds,
    overrides,
    pageLoading,
    printChild,
    printChildName,
    refetchSelectedSchedule,
    scheduleError,
    scheduleGridLoading,
    selectedChild,
    selectedClasses,
    selectedGrade,
    selectedSchedule,
    selectedScheduleError,
    setSelectedGrade,
    setViewCommitted,
    staffSelectedChild,
    timeSlots,
    updateOverride,
    userChildren,
    viewCommitted,
    viewStatus,
  } = useChildScheduleController();

  // Staff View: one staff member's week instead of a student's. URL-backed
  // so it survives refresh and can be linked:
  // - `?view=staff&selected=<user id | name>`: any staff member (צוות tab)
  // - `?view=mine`: the signed-in staff member's own week (המערכת שלי tab),
  //   offered only once they have a display name
  // Only class managers (admin/staff/moderator) may enter either; the param
  // is ignored for everyone else.
  const [searchParams, setSearchParams] = useSearchParams();
  const canUseStaffView = permissions.canManageClasses;
  const canUseMyView = canUseStaffView && !!user?.displayName;
  const viewParam = searchParams.get("view");
  const isStaffTab = canUseStaffView && viewParam === "staff";
  const isMyView = canUseMyView && viewParam === "mine";
  // Either tab shows one staff member's read-only week.
  const isStaffView = isStaffTab || isMyView;
  const selectedStaffParam = isStaffTab
    ? searchParams.get("selected") || undefined
    : undefined;
  const staffKey: StaffKey | undefined = isMyView
    ? { kind: "user", id: user.id }
    : parseStaffKey(selectedStaffParam);
  const {
    staff: staffMembers,
    staffLoading: staffMembersLoading,
    view: staffView,
    loading: staffViewLoading,
    error: staffViewError,
    refetch: refetchStaffView,
  } = useStaffSchedule(isStaffView, staffKey, { loadStaffList: isStaffTab });
  // Whose week is shown, for the print title/button.
  const staffName: string | undefined = isMyView
    ? user.displayName
    : (staffMembers.find(m => staffKeyToParam(m.key) === selectedStaffParam)
        ?.label ?? (staffKey?.kind === "name" ? staffKey.name : undefined));

  const handleViewModeChange = (mode: "student" | "mine" | "staff") => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (mode === "student") {
          next.delete("view");
        } else {
          next.set("view", mode);
        }
        if (mode !== "staff") next.delete("selected");
        return next;
      },
      { replace: true }
    );
    trackWithActor(AnalyticsEvent.StaffViewToggled, currentRole?.role, {
      view: mode,
    });
  };

  // `param` is staffKeyToParam(member.key): a user id or a name.
  const handleStaffSelect = (param: string | undefined) => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (param) next.set("selected", param);
        else next.delete("selected");
        return next;
      },
      { replace: true }
    );
    if (param) {
      trackWithActor(AnalyticsEvent.StaffViewStaffSelected, currentRole?.role);
    }
  };

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

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideDay, setOverrideDay] = useState<number | null>(null);
  const [overrideTimeSlotId, setOverrideTimeSlotId] = useState<string | null>(
    null
  );
  const [editingOverride, setEditingOverride] =
    useState<ScheduleOverrideWithTimeSlot | null>(null);
  const [overrideModalLoading, setOverrideModalLoading] = useState(false);

  // selected student's for staff, else the grade filter's.
  const searchGrade =
    actsAsStaff && staffSelectedChild
      ? staffSelectedChild.grade
      : selectedGrade;
  const classTitles = React.useMemo(
    () => ScheduleService.classTitles(classes, searchGrade),
    [classes, searchGrade]
  );

  const error = isStaffView
    ? scheduleError || staffViewError
    : scheduleError || selectedScheduleError || childrenError;

  const handleExportStaffSchedule = async () => {
    if (!staffName) return;
    try {
      // Same feed as the Staff View grid below.
      await printSchedule({
        title: t("schedule.print.staffTitle", { name: staffName }),
        timeSlots,
        weeklySchedule: staffView.weeklySchedule,
        selectedClasses: staffView.selectedClasses,
        overrides: [],
        showDraftMarker: false,
      });
      trackWithActor(AnalyticsEvent.SchedulePrinted, currentRole?.role, {
        view: "staff",
      });
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("schedule.page.error.exportFailed")
      );
    }
  };

  const handleExportSchedule = async () => {
    const currentChild = printChild;

    if (!currentChild) {
      message.error(t("schedule.page.error.noChildSelected"));
      return;
    }

    try {
      // Reuse the exact feed the live grid renders (see the <ScheduleTable>
      // below) so print can never diverge from what's on screen: same
      // catalog+selections merge, same selection ids, same overrides.
      await printSchedule({
        title: t("schedule.print.childTitle", {
          firstName: currentChild.firstName,
          lastName: currentChild.lastName,
          grade: GetGradeName(currentChild.grade),
        }),
        grade: currentChild.grade,
        timeSlots,
        weeklySchedule: displayWeeklySchedule,
        selectedClasses,
        overrides,
        showDraftMarker: viewStatus === "draft",
      });
      trackWithActor(AnalyticsEvent.SchedulePrinted, currentRole?.role, {
        grade: currentChild.grade,
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
      trackEvent(AnalyticsEvent.StaffOverrideApplied, {
        mode: editingOverride ? "update" : "create",
      });
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

  const handleRefresh = () => {
    loadScheduleData();
    if (isStaffView) {
      refetchStaffView();
    } else {
      refetchSelectedSchedule();
    }
  };
  const refreshing = isStaffView ? staffViewLoading : loading;

  // Names whose schedule it prints: the chosen staff member, or the child.
  const printButton = isStaffView
    ? staffName && (
        <Button
          icon={<PrinterOutlined />}
          onClick={handleExportStaffSchedule}
          disabled={staffViewLoading}>
          {isMyView
            ? t("schedule.page.exportMyButton")
            : t("schedule.page.exportButtonFor", { name: staffName })}
        </Button>
      )
    : ((canPickSchedule && selectedChild) ||
        (actsAsStaff && staffSelectedChild)) && (
        <Button
          icon={<PrinterOutlined />}
          onClick={handleExportSchedule}
          disabled={loading}>
          {t("schedule.page.exportButtonFor", { name: printChildName })}
        </Button>
      );

  // Which tab bars show, top to bottom. Each is hidden when it would offer
  // only one choice (e.g. no staff/student tabs for non-managers).
  const showViewTabs = canUseStaffView;
  const showChildTabs = !isStaffView && canManageChildren;
  const hasTabBar = showViewTabs || showChildTabs;
  const tabBarActions = (
    <Space>
      <Button
        icon={<ReloadOutlined />}
        onClick={handleRefresh}
        loading={refreshing}
        disabled={refreshing}>
        {t("common.buttons.refresh")}
      </Button>
      {printButton}
    </Space>
  );

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
      {/* Tab bars above the filters bar, sharing ScheduleTabsBar: the
          staff/student view tabs (class managers) and the per-child tabs
          (parents, student view). Refresh/print sit at the end of the
          top-most bar; with no tab bar they stay in the filters bar. */}
      {showViewTabs && (
        <ScheduleTabsBar
          activeKey={isMyView ? "mine" : isStaffTab ? "staff" : "student"}
          onChange={key =>
            handleViewModeChange(key as "student" | "mine" | "staff")
          }
          // RTL: first item renders rightmost. Check the on-screen order.
          items={[
            { key: "student", label: t("schedule.page.labels.studentView") },
            ...(canUseMyView
              ? [{ key: "mine", label: t("schedule.page.labels.myView") }]
              : []),
            { key: "staff", label: t("schedule.page.labels.staffView") },
          ]}
          extra={tabBarActions}
        />
      )}
      {showChildTabs && (
        <AddChildButton
          onAdded={handleParentChildAdded}
          renderTrigger={open => (
            <ChildTabs
              childList={userChildren}
              selectedChildId={selectedChild?.id}
              onSelect={handleParentChildSelect}
              onAddClick={open}
              disabled={childrenLoading}
              extra={showViewTabs ? undefined : tabBarActions}
            />
          )}
        />
      )}

      <FiltersBar
        variant="flat"
        canRefresh={!hasTabBar}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        disabled={refreshing}
        actions={
          <>
            {!hasTabBar && printButton}
            {!isStaffView && canPickSchedule && userChildren.length > 0 && (
              <Radio.Group
                className="draft-committed-toggle"
                optionType="button"
                value={viewCommitted ? "committed" : "draft"}
                onChange={e => setViewCommitted(e.target.value === "committed")}
                disabled={refreshing || !selectedChild}>
                <Radio.Button value="draft">
                  {t("schedule.page.labels.draftView")}
                </Radio.Button>
                <Radio.Button value="committed">
                  {t("schedule.page.labels.committedView")}
                </Radio.Button>
              </Radio.Group>
            )}
          </>
        }>
        {isStaffTab && (
          <FilterField label={t("schedule.page.labels.selectStaff")}>
            <StaffPicker
              members={staffMembers}
              loading={staffMembersLoading}
              value={selectedStaffParam}
              onChange={handleStaffSelect}
              disabled={refreshing}
              placeholder={t("schedule.page.placeholders.selectStaff")}
              style={{ minWidth: 200 }}
            />
          </FilterField>
        )}
        {/* The bar's groups are ltr: the first child is leftmost. On screen,
            right to left: grade, student picker, group/track, class search
            | refresh, draft/committed, print. Class search sits next to the
            group/track dropdown; the draft/committed toggle is on the
            actions side. */}
        {!isStaffView && (
          <FilterField label={t("schedule.page.labels.searchClass")}>
            <TextSearch<string>
              mode="filter"
              items={classTitles}
              getText={title => title}
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={t("schedule.page.placeholders.searchClass")}
              style={{ minWidth: 200 }}
              disabled={refreshing}
            />
          </FilterField>
        )}
        {!isStaffView && canPickSchedule && userChildren.length > 0 && (
          <>
            <ChildGroupTrackSelector
              child={selectedChild}
              onChange={handleParentFieldChange}
              disabled={refreshing || childrenLoading || !canEdit}
              canEditGroup={canManageChildren}
            />
          </>
        )}
        {!isStaffView && actsAsStaff && (
          <>
            <ChildGroupTrackSelector
              child={staffSelectedChild}
              onChange={handleStaffFieldChange}
              disabled={refreshing || allChildrenLoading}
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
                disabled={refreshing || allChildrenLoading}
                defaultGrade={selectedGrade || 1}
                mode="pick"
              />
            </FilterField>
          </>
        )}
        {/* Last child, so the rightmost filter (the bar's groups are ltr).
            Inside the pair the label is rightmost.
            Clearing means "all grades" (undefined). */}
        {!isStaffView && (actsAsStaff || isAdmin) && (
          <FilterSelect<number>
            label={t("schedule.page.labels.filterByGrade")}
            placeholder={t("schedule.page.placeholders.allGrades")}
            value={selectedGrade ?? null}
            onChange={grade => setSelectedGrade(grade ?? undefined)}
            options={GRADES.map(grade => ({
              value: grade,
              label: GetGradeName(grade),
            }))}
            disabled={refreshing || (actsAsStaff && !!staffSelectedChild)}
          />
        )}
      </FiltersBar>

      {isStaffTab && !selectedStaffParam && (
        <Alert
          message={t("schedule.page.alerts.noStaffSelected.title")}
          description={t("schedule.page.alerts.noStaffSelected.description")}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {!isStaffView && canManageChildren && userChildren.length === 0 && (
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

      {!isStaffView &&
        canManageChildren &&
        userChildren.length > 0 &&
        !selectedChild && (
          <Alert
            message={t("schedule.page.alerts.noChildSelected.title")}
            description={t("schedule.page.alerts.noChildSelected.description")}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

      {!isStaffView && !canSelectClasses && !canPickSchedule && (
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
        />
      )}

      {!isStaffView &&
        canPickSchedule &&
        !canManageChildren &&
        !childrenLoading &&
        userChildren.length === 0 && (
          <Alert
            message={t("schedule.page.alerts.childNotLinked.title")}
            description={t("schedule.page.alerts.childNotLinked.description")}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
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

      {!isStaffView && viewStatus === "draft" && <DraftBanner />}
      {!isStaffView && canPickSchedule && viewCommitted && (
        <CommittedReadOnlyBanner />
      )}

      <Spin spinning={isStaffView ? staffViewLoading : scheduleGridLoading}>
        <Card className="schedule-card">
          {isStaffView ? (
            // Same table, different feed: view-only, every lesson rendered
            // as a selected card, conflicts flagged via userSelections.
            <ScheduleTable
              timeSlots={timeSlots}
              classes={staffView.classes}
              weeklySchedule={staffView.weeklySchedule}
              selectedClasses={staffView.selectedClasses}
              userSelections={staffView.userSelections}
              canSelectClasses={false}
              canViewClasses={false}
              showEnrollmentCount
              extraEnrollmentCounts={staffView.extraEnrollmentCounts}
            />
          ) : (
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
              canAssignNonLessonSlots={permissions.canManageRoster}
              isAdmin={permissions.canCreateClasses}
              showEnrollmentCount={actsAsStaff || isAdmin}
              onCreateClass={handleCreateClass}
              searchTerm={searchTerm}
              childGroupNumber={currentTrackChild?.groupNumber}
              lockedClassIds={Array.from(lockedClassIds)}
              overrides={overrides}
              canCreateOverride={canCreateOverride}
              onCreateOverride={handleCreateOverride}
              onOverrideClick={
                actsAsStaff ? handleOverrideCardClick : undefined
              }
              onOverrideDelete={
                actsAsStaff ? handleDrawerOverrideDelete : undefined
              }
            />
          )}
        </Card>

        {!isStaffView && canSelectClasses && selectedSchedule.length > 0 && (
          <Card
            title={
              printChild
                ? t("schedule.page.selectedClassesForChild", {
                    firstName: printChild.firstName,
                    lastName: printChild.lastName,
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
