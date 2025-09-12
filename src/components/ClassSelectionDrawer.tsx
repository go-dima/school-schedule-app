import React from "react";
import {
  Drawer,
  Card,
  Button,
  Tag,
  Empty,
  Alert,
  Space,
  Typography,
} from "antd";
import { CheckOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { ScheduleService } from "../services/scheduleService";
import type { TimeSlot, ClassWithTimeSlot } from "../types";
import CreateClassButton from "./CreateClassButton";
import "./ClassSelectionDrawer.css";
import { GradesRangeTag } from "@/elements/GradesRangeTag";

const { Title, Text } = Typography;

interface ClassSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  timeSlot: TimeSlot;
  dayOfWeek: number;
  classes: ClassWithTimeSlot[];
  selectedClasses?: string[];
  onClassSelect?: (classId: string) => void;
  onClassUnselect?: (classId: string) => void;
  conflictingClasses?: ClassWithTimeSlot[];
  canSelectClasses?: boolean;
  isAdmin?: boolean;
  onCreateClass?: (timeSlotId: string, dayOfWeek: number) => void;
  timeSlots?: TimeSlot[]; // Add timeSlots for calculating double lesson ranges
}

const ClassSelectionDrawer: React.FC<ClassSelectionDrawerProps> = ({
  open,
  onClose,
  timeSlot,
  dayOfWeek,
  classes,
  selectedClasses = [],
  onClassSelect,
  onClassUnselect,
  conflictingClasses = [],
  canSelectClasses = false,
  isAdmin = false,
  onCreateClass,
  timeSlots = [],
}) => {
  const { t } = useTranslation();
  const dayName = ScheduleService.getDayName(dayOfWeek);
  const timeRange = ScheduleService.formatTimeRange(
    timeSlot.startTime,
    timeSlot.endTime
  );

  // Helper function to get combined time range for double lessons
  const getDoubleTimeRange = (
    cls: ClassWithTimeSlot,
    allTimeSlots: TimeSlot[]
  ): string => {
    if (!cls.isDouble)
      return ScheduleService.formatTimeRange(
        cls.timeSlot.startTime,
        cls.timeSlot.endTime
      );

    // Find the next consecutive time slot
    const nextTimeSlot = ScheduleService.getNextConsecutiveTimeSlot(
      cls.timeSlot,
      allTimeSlots
    );
    if (nextTimeSlot) {
      return ScheduleService.formatTimeRange(
        cls.timeSlot.startTime,
        nextTimeSlot.endTime
      );
    }

    // Fallback to original time if next slot not found
    return ScheduleService.formatTimeRange(
      cls.timeSlot.startTime,
      cls.timeSlot.endTime
    );
  };

  // Use passed timeSlots or extract from classes as fallback
  const allTimeSlots =
    timeSlots.length > 0
      ? timeSlots.sort((a, b) => a.startTime.localeCompare(b.startTime))
      : classes
          .map(cls => cls.timeSlot)
          .filter(
            (slot, index, self) =>
              self.findIndex(s => s.id === slot.id) === index
          )
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const handleClassToggle = (classId: string) => {
    const isSelected = selectedClasses.includes(classId);

    if (isSelected && onClassUnselect) {
      onClassUnselect(classId);
    } else if (!isSelected && onClassSelect) {
      onClassSelect(classId);
    }
  };

  const renderClassCard = (
    cls: ClassWithTimeSlot,
    isGrayedOut: boolean = false
  ) => {
    const isSelected = selectedClasses.includes(cls.id);
    const hasConflict = conflictingClasses.some(
      conflict => conflict.id === cls.id
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
                  <Button
                    key="toggle"
                    type={isSelected ? "default" : "primary"}
                    icon={isSelected ? <CheckOutlined /> : undefined}
                    onClick={() => handleClassToggle(cls.id)}
                    disabled={isGrayedOut}
                    block>
                    {isSelected
                      ? t("schedule.drawer.unselectButton")
                      : t("schedule.drawer.selectButton")}
                  </Button>
                </div>,
              ]
            : undefined
        }>
        <div className="class-card-content">
          <div className="class-header">
            <Title level={5} className="class-title">
              {cls.title}
              <Text className="class-teacher">({cls.teacher})</Text>
            </Title>
            <div className="class-header-tags">
              <GradesRangeTag grades={cls.grades} color="blue" />
              {cls.isMandatory && (
                <Tag color="red">{t("schedule.drawer.mandatoryTag")}</Tag>
              )}
              {cls.isDouble && (
                <Tag color="orange">{t("schedule.drawer.doubleLessonTag")}</Tag>
              )}
            </div>
          </div>

          <div className="class-details">
            <Text strong style={{ marginRight: "8px" }}>
              {t("schedule.drawer.timeLabel")}
            </Text>
            <Text>{getDoubleTimeRange(cls, allTimeSlots)}</Text>
            {cls.isDouble && (
              <Text
                type="secondary"
                style={{ fontSize: "12px", marginRight: "8px" }}>
                ({t("schedule.drawer.doubleLessonTag")} - {cls.timeSlot.name} +{" "}
                {ScheduleService.getNextConsecutiveTimeSlot(
                  cls.timeSlot,
                  allTimeSlots
                )?.name || t("common.next")}
                )
              </Text>
            )}
          </div>

          {cls.room && (
            <div className="class-details">
              <Text strong>{t("schedule.drawer.roomLabel")}</Text>
              <Text>{cls.room}</Text>
            </div>
          )}

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

  const selectedClassesInTimeSlot = classes.filter(cls =>
    selectedClasses.includes(cls.id)
  );
  const availableClasses = classes.filter(
    cls => !selectedClasses.includes(cls.id)
  );

  return (
    <Drawer
      title={
        <div className="drawer-title">
          <Title level={4} style={{ margin: 0 }}>
            {canSelectClasses
              ? t("schedule.drawer.selectionTitle")
              : t("schedule.drawer.viewTitle")}
          </Title>
          <div className="time-slot-info">
            <Tag color="blue">{dayName}</Tag>
            <Tag color="green">{timeRange}</Tag>
            <Tag>{timeSlot.name}</Tag>
          </div>
        </div>
      }
      placement="left"
      width={400}
      onClose={onClose}
      open={open}
      className="class-selection-drawer rtl-drawer"
      styles={{ body: { padding: "16px" } }}>
      <div className="drawer-content">
        {classes.length === 0 ? (
          <Empty
            description={t("schedule.drawer.noClassesAvailable")}
            image={Empty.PRESENTED_IMAGE_SIMPLE}>
            {isAdmin && onCreateClass && (
              <CreateClassButton
                onCreateClass={onCreateClass}
                timeSlotId={timeSlot.id}
                dayOfWeek={dayOfWeek}
                style={{ marginTop: 16 }}
              />
            )}
          </Empty>
        ) : (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {selectedClassesInTimeSlot.length > 0 && (
              <div className="selected-classes-section">
                <Title level={5}>
                  {t("schedule.drawer.selectedClassesSection")}
                </Title>
                <Space
                  direction="vertical"
                  size="small"
                  style={{ width: "100%" }}>
                  {selectedClassesInTimeSlot.map(cls =>
                    renderClassCard(cls, false)
                  )}
                </Space>
              </div>
            )}

            {availableClasses.length > 0 && (
              <div className="available-classes-section">
                <Title level={5}>
                  {selectedClassesInTimeSlot.length > 0
                    ? t("schedule.drawer.otherAvailableClasses")
                    : t("schedule.drawer.availableClasses")}
                </Title>
                <Space
                  direction="vertical"
                  size="small"
                  style={{ width: "100%" }}>
                  {availableClasses.map(cls =>
                    renderClassCard(cls, selectedClassesInTimeSlot.length > 0)
                  )}
                </Space>
              </div>
            )}

            {isAdmin && onCreateClass && (
              <CreateClassButton
                onCreateClass={onCreateClass}
                timeSlotId={timeSlot.id}
                dayOfWeek={dayOfWeek}
              />
            )}

            {conflictingClasses.length > 0 && (
              <div className="conflict-warning">
                <Alert
                  message={t("schedule.drawer.conflictWarningTitle")}
                  description={t("schedule.drawer.conflictDescription", {
                    count: conflictingClasses.length,
                  })}
                  type="info"
                  showIcon
                  closable
                />
              </div>
            )}
          </Space>
        )}
      </div>
    </Drawer>
  );
};

export default ClassSelectionDrawer;
