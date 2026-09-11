import React from "react";
import { Card, Button, Tag, Alert, Typography, Tooltip } from "antd";
import {
  CheckOutlined,
  ExclamationCircleOutlined,
  HeartFilled,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { ScheduleService } from "../services/scheduleService";
import type { TimeSlot, ClassWithTimeSlot } from "../types";
import "./ClassSelectionDrawer.css";
import { GradesRangeTag } from "@/elements/GradesRangeTag";
import { TrackTag } from "@/elements/TrackTag";

const { Title, Text } = Typography;

// Helper function to get combined time range for double lessons
export const getDoubleTimeRange = (
  cls: ClassWithTimeSlot,
  allTimeSlots: TimeSlot[]
): string => {
  const primaryTimeSlot = ScheduleService.getPrimarySlot(cls).timeSlot;

  if (!cls.isDouble)
    return ScheduleService.formatTimeRange(
      primaryTimeSlot.startTime,
      primaryTimeSlot.endTime
    );

  // Find the next consecutive time slot
  const nextTimeSlot = ScheduleService.getNextConsecutiveTimeSlot(
    primaryTimeSlot,
    allTimeSlots
  );
  if (nextTimeSlot) {
    return ScheduleService.formatTimeRange(
      primaryTimeSlot.startTime,
      nextTimeSlot.endTime
    );
  }

  // Fallback to original time if next slot not found
  return ScheduleService.formatTimeRange(
    primaryTimeSlot.startTime,
    primaryTimeSlot.endTime
  );
};

interface ClassSelectionCardProps {
  cls: ClassWithTimeSlot;
  isGrayedOut?: boolean;
  isSelected: boolean;
  isLocked: boolean;
  hasConflict: boolean;
  canSelectClasses: boolean;
  onToggle: () => void;
  allTimeSlots: TimeSlot[];
  isDraftPick?: boolean;
}

const ClassSelectionCard: React.FC<ClassSelectionCardProps> = ({
  cls,
  isGrayedOut = false,
  isSelected,
  isLocked,
  hasConflict,
  canSelectClasses,
  onToggle,
  allTimeSlots,
  isDraftPick = false,
}) => {
  const { t } = useTranslation();

  const toggleButton = (
    <Button
      key="toggle"
      type={isSelected ? "default" : "primary"}
      icon={isSelected ? <CheckOutlined /> : undefined}
      onClick={onToggle}
      disabled={isGrayedOut || isLocked}
      block>
      {isSelected
        ? t("schedule.drawer.unselectButton")
        : t("schedule.drawer.selectButton")}
    </Button>
  );

  return (
    <Card
      key={cls.id}
      className={`class-selection-card ${isSelected ? "selected" : ""} ${
        hasConflict ? "conflict" : ""
      } ${isGrayedOut ? "grayed-out" : ""}`}
      size="small"
      hoverable={!isGrayedOut}
      actions={
        canSelectClasses
          ? [
              <div className="select-class-button">
                {isLocked ? (
                  <Tooltip
                    title={t(
                      isSelected
                        ? "schedule.drawer.lockedClassTooltip"
                        : "schedule.drawer.lockedClassUnselectableTooltip"
                    )}>
                    <span style={{ display: "block" }}>{toggleButton}</span>
                  </Tooltip>
                ) : (
                  toggleButton
                )}
              </div>,
            ]
          : undefined
      }>
      <div className="class-card-content">
        {isDraftPick && (
          <Tooltip title={t("schedule.drawer.draftPickTooltip")}>
            <HeartFilled className="draft-pick-marker" />
          </Tooltip>
        )}
        <div className="class-card-body">
          <div className="class-main">
            <Title level={5} className="class-title">
              {cls.title} <Text className="class-teacher">({cls.teacher})</Text>
            </Title>

            <div className="class-details class-details-inline">
              <span>
                <Text strong>{t("schedule.drawer.timeLabel")}</Text>{" "}
                <Text>{getDoubleTimeRange(cls, allTimeSlots)}</Text>
              </span>
              {cls.room && (
                <>
                  <span className="class-details-sep">•</span>
                  <span>
                    <Text strong>{t("schedule.drawer.roomLabel")}</Text>{" "}
                    <Text>{cls.room}</Text>
                  </span>
                </>
              )}
            </div>

            {cls.isDouble && (
              <div className="class-details class-details-secondary">
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  ({t("schedule.drawer.doubleLessonTag")} -{" "}
                  {ScheduleService.getPrimarySlot(cls).timeSlot.name} +{" "}
                  {ScheduleService.getNextConsecutiveTimeSlot(
                    ScheduleService.getPrimarySlot(cls).timeSlot,
                    allTimeSlots
                  )?.name || t("common.next")}
                  )
                </Text>
              </div>
            )}
          </div>

          <div className="class-header-tags">
            <GradesRangeTag grades={cls.grades} color="blue" />
            {cls.trackNumber !== null && <TrackTag track={cls.trackNumber} />}
            {cls.isDouble && (
              <Tag color="orange">{t("schedule.drawer.doubleLessonTag")}</Tag>
            )}
          </div>
        </div>

        {cls.description && (
          <div className="class-description">
            <Text>{cls.description}</Text>
          </div>
        )}

        {hasConflict && (
          <Alert
            message={t("schedule.drawer.timeConflictTitle")}
            description={t("schedule.drawer.timeConflictDescription")}
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            className="conflict-alert"
          />
        )}
      </div>
    </Card>
  );
};

export default ClassSelectionCard;
