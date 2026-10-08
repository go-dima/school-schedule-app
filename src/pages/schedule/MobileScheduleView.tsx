import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Radio, Spin, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { ChildTabs } from "../../components/ChildTabs";
import { AddChildButton } from "../../components/AddChildButton";
import { DraftBanner } from "../../elements/DraftBanner";
import { CommittedReadOnlyBanner } from "../../elements/CommittedReadOnlyBanner";
import type { Child, SelectionStatus } from "../../types";
import type { AgendaEntry } from "./dayAgenda";
import { ScheduleDayView } from "./ScheduleDayView";
import type { ScheduleCapabilities } from "./scheduleCapabilities";
import "./MobileSchedulePage.css";

export interface MobileScheduleViewProps {
  caps: ScheduleCapabilities;
  now: Date;
  userChildren: Child[];
  selectedChild: Child | undefined | null;
  childrenLoading: boolean;
  canManageChildren: boolean;
  canPickSchedule: boolean;
  viewCommitted: boolean;
  viewStatus: SelectionStatus;
  pageLoading: boolean;
  scheduleGridLoading: boolean;
  loading: boolean;
  error: string | null | undefined;
  entriesForDay: (day: number) => AgendaEntry[];
  setViewCommitted: (committed: boolean) => void;
  handleRefresh: () => void;
  handleParentChildAdded: (child: Child) => void;
  handleParentChildSelect: (child: Child) => void;
}

// The mobile Schedule page's layout, from plain props, so Storybook can
// render the real page without the app's contexts. MobileSchedulePage
// feeds it from useChildScheduleController.
export const MobileScheduleView: React.FC<MobileScheduleViewProps> = ({
  caps,
  now,
  userChildren,
  selectedChild,
  childrenLoading,
  canManageChildren,
  canPickSchedule,
  viewCommitted,
  viewStatus,
  pageLoading,
  scheduleGridLoading,
  loading,
  error,
  entriesForDay,
  setViewCommitted,
  handleRefresh,
  handleParentChildAdded,
  handleParentChildSelect,
}) => {
  const { t } = useTranslation();

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

  const hasChildren = userChildren.length > 0;

  const childTabs = (onAddClick?: () => void) => (
    <ChildTabs
      childList={userChildren}
      selectedChildId={selectedChild?.id}
      onSelect={handleParentChildSelect}
      onAddClick={onAddClick}
      disabled={childrenLoading}
    />
  );

  return (
    <div className="mobile-schedule">
      {canManageChildren &&
        hasChildren &&
        (caps.canAddChild ? (
          <AddChildButton
            onAdded={handleParentChildAdded}
            renderTrigger={open => childTabs(open)}
          />
        ) : (
          childTabs()
        ))}

      {canPickSchedule &&
        hasChildren &&
        (caps.canChooseDraft || caps.canRefresh) && (
          <div className="mobile-schedule-toolbar">
            {caps.canChooseDraft && (
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
            )}
            {caps.canRefresh && (
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
                aria-label={t("common.buttons.refresh")}
                className="mobile-schedule-refresh"
              />
            )}
          </div>
        )}

      {canManageChildren && !hasChildren && (
        <Alert
          type="info"
          showIcon
          message={t("schedule.page.alerts.noChildrenFound.title")}
          description={
            caps.canAddChild ? (
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
            ) : undefined
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
          {viewStatus === "draft" && <DraftBanner />}
          {viewStatus === "committed" && caps.showReadOnlyNotice && (
            <CommittedReadOnlyBanner />
          )}
          <ScheduleDayView
            now={now}
            entriesForDay={entriesForDay}
            loading={scheduleGridLoading}
          />
        </>
      )}
    </div>
  );
};
