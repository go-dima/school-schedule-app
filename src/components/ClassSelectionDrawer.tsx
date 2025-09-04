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
  Divider,
} from "antd";
import { CheckOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { ScheduleService } from "../services/scheduleService";
import type { TimeSlot, ClassWithTimeSlot } from "../types";
import "./ClassSelectionDrawer.css";

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
}) => {
  const dayName = ScheduleService.getDayName(dayOfWeek);
  const timeRange = ScheduleService.formatTimeRange(
    timeSlot.startTime,
    timeSlot.endTime
  );

  const handleClassToggle = (classId: string) => {
    const isSelected = selectedClasses.includes(classId);

    if (isSelected && onClassUnselect) {
      onClassUnselect(classId);
    } else if (!isSelected && onClassSelect) {
      onClassSelect(classId);
    }
  };

  const renderClassCard = (cls: ClassWithTimeSlot) => {
    const isSelected = selectedClasses.includes(cls.id);
    const hasConflict = conflictingClasses.some(
      (conflict) => conflict.id === cls.id
    );

    return (
      <Card
        key={cls.id}
        className={`class-selection-card ${isSelected ? "selected" : ""} ${
          hasConflict ? "conflict" : ""
        }`}
        size="small"
        hoverable
        actions={
          canSelectClasses
            ? [
                <Button
                  key="toggle"
                  type={isSelected ? "default" : "primary"}
                  icon={isSelected ? <CheckOutlined /> : undefined}
                  onClick={() => handleClassToggle(cls.id)}
                  block>
                  {isSelected ? "בטל בחירה" : "בחר שיעור"}
                </Button>,
              ]
            : undefined
        }>
        <div className="class-card-content">
          <div className="class-header">
            <Title level={5} className="class-title">
              {cls.title}
            </Title>
            <div className="class-header-tags">
              {cls.grades?.map((grade) => (
                <Tag key={grade} color="blue">
                  {ScheduleService.getGradeName(grade)}
                </Tag>
              ))}
              {cls.isMandatory && <Tag color="red">חובה</Tag>}
            </div>
          </div>

          <div className="class-details">
            <Text strong>מורה: </Text>
            <Text>{cls.teacher}</Text>
          </div>

          {cls.description && (
            <div className="class-description">
              <Text>{cls.description}</Text>
            </div>
          )}

          {hasConflict && (
            <Alert
              message="קיים חפיפה בזמן"
              description="שיעור זה חופף עם שיעור אחר שנבחר"
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

  const selectedClassesInTimeSlot = classes.filter((cls) =>
    selectedClasses.includes(cls.id)
  );
  const availableClasses = classes.filter(
    (cls) => !selectedClasses.includes(cls.id)
  );

  return (
    <Drawer
      title={
        <div className="drawer-title">
          <Title level={4} style={{ margin: 0 }}>
            {canSelectClasses ? "בחירת שיעורים" : "צפייה בשיעורים"}
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
            description="אין שיעורים זמינים בזמן זה"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {selectedClassesInTimeSlot.length > 0 && (
              <div className="selected-classes-section">
                <Title level={5}>שיעורים שנבחרו:</Title>
                <Space
                  direction="vertical"
                  size="small"
                  style={{ width: "100%" }}>
                  {selectedClassesInTimeSlot.map(renderClassCard)}
                </Space>
                <Divider />
              </div>
            )}

            {availableClasses.length > 0 && (
              <div className="available-classes-section">
                <Title level={5}>
                  {selectedClassesInTimeSlot.length > 0
                    ? "שיעורים אחרים זמינים:"
                    : "שיעורים זמינים:"}
                </Title>
                <Space
                  direction="vertical"
                  size="small"
                  style={{ width: "100%" }}>
                  {availableClasses.map(renderClassCard)}
                </Space>
              </div>
            )}

            {conflictingClasses.length > 0 && (
              <div className="conflict-warning">
                <Alert
                  message="שים לב לחפיפות"
                  description={`ישנם ${conflictingClasses.length} שיעורים עם חפיפה בזמן. בחירת שיעור חדש תבטל אוטומטית את השיעורים החופפים.`}
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
