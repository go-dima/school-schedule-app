import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Radio, Spin, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { ScheduleCatalogProvider } from "../../contexts/ScheduleCatalogContext";
import { ChildTabs } from "../../components/ChildTabs";
import { AddChildButton } from "../../components/AddChildButton";
import { DraftBanner } from "../../elements/DraftBanner";
import { CommittedReadOnlyBanner } from "../../elements/CommittedReadOnlyBanner";
import SchedulePage from "./SchedulePage";
import { useChildScheduleController } from "./useChildScheduleController";
import { buildDayAgenda } from "./dayAgenda";
import { ScheduleDayView } from "./ScheduleDayView";
import "./MobileSchedulePage.css";

// One school day at a time, for parents and children (incl. staff+parent
// users) in mobile UI Mode: a week strip, then the day's slots as a list.
// Swipe or tap the strip to change day. Read only for now (#241 adds draft
// selection).
const MobileScheduleContent: React.FC = () => {
  const { t } = useTranslation();
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
    lockedClassIds,
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

  if (pageLoading) {
    return (
      <div className="mobile-schedule-loading">
        <Spin size="large" />
        <Typography.Text type="secondary">
          {t("schedule.page.loading")}
        </Typography.Text>
      </div>
    );
  }

  const error = scheduleError || selectedScheduleError || childrenError;
  const hasChildren = userChildren.length > 0;

  return (
    <div className="mobile-schedule">
      {canManageChildren && hasChildren && (
        <AddChildButton
          onAdded={handleParentChildAdded}
          renderTrigger={open => (
            <ChildTabs
              childList={userChildren}
              selectedChildId={selectedChild?.id}
              onSelect={handleParentChildSelect}
              onAddClick={open}
              disabled={childrenLoading}
            />
          )}
        />
      )}

      {canPickSchedule && hasChildren && (
        <div className="mobile-schedule-toolbar">
          <Radio.Group
            className="draft-committed-toggle"
            optionType="button"
            value={viewCommitted ? "committed" : "draft"}
            onChange={e => setViewCommitted(e.target.value === "committed")}
            disabled={loading || !selectedChild}>
            <Radio.Button value="draft">
              {t("schedule.page.labels.draftView")}
            </Radio.Button>
            <Radio.Button value="committed">
              {t("schedule.page.labels.committedView")}
            </Radio.Button>
          </Radio.Group>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
            aria-label={t("common.buttons.refresh")}
            className="mobile-schedule-refresh"
          />
        </div>
      )}

      {canManageChildren && !hasChildren && (
        <Alert
          type="info"
          showIcon
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
        />
      )}
      {!canManageChildren && !childrenLoading && !hasChildren && (
        <Alert
          type="info"
          showIcon
          message={t("schedule.page.alerts.childNotLinked.title")}
          description={t("schedule.page.alerts.childNotLinked.description")}
        />
      )}
      {canManageChildren && hasChildren && !selectedChild && (
        <Alert
          type="warning"
          showIcon
          message={t("schedule.page.alerts.noChildSelected.title")}
          description={t("schedule.page.alerts.noChildSelected.description")}
        />
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          closable
          message={t("schedule.page.error.loadData")}
          description={error}
        />
      )}

      {selectedChild && (
        <>
          {viewStatus === "draft" ? (
            <DraftBanner />
          ) : (
            <CommittedReadOnlyBanner />
          )}

          <ScheduleDayView
            now={now}
            entriesForDay={entriesForDay}
            lockedClassIds={lockedClassIds}
            loading={scheduleGridLoading}
          />
        </>
      )}
    </div>
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
