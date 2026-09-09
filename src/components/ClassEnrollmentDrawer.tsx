import React, { useEffect, useRef, useState } from "react";
import {
  Drawer,
  Typography,
  Tag,
  Empty,
  Alert,
  Spin,
  List,
  Descriptions,
  Space,
  Button,
  Divider,
} from "antd";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { scheduleApi } from "../services/api";
import { ScheduleService } from "../services/scheduleService";
import type { ClassWithTimeSlot, Child } from "../types";
import { GradesRangeTag } from "@/elements/GradesRangeTag";
import { GetGradeName } from "@/utils/grades";
import { GetDayName } from "@/utils/days";
import { GroupTrackTags } from "./GroupTrackTags";
import "./ClassEnrollmentDrawer.css";

const { Title, Text } = Typography;

interface ClassEnrollmentDrawerProps {
  open: boolean;
  onClose: () => void;
  classInfo: ClassWithTimeSlot | null;
  onEdit: (classInfo: ClassWithTimeSlot) => void;
  onDelete: (classId: string) => void;
}

const ClassEnrollmentDrawer: React.FC<ClassEnrollmentDrawerProps> = ({
  open,
  onClose,
  classInfo,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedClassId = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !classInfo) return;

    const classId = classInfo.id;
    requestedClassId.current = classId;
    setLoading(true);
    setError(null);

    scheduleApi
      .getClassEnrolledChildren(classId)
      .then(result => {
        if (requestedClassId.current !== classId) return;
        setChildren(result);
      })
      .catch((err: unknown) => {
        if (requestedClassId.current !== classId) return;
        setError(
          err instanceof Error
            ? err.message
            : t("classManagement.page.dataLoadingError")
        );
      })
      .finally(() => {
        if (requestedClassId.current !== classId) return;
        setLoading(false);
      });
  }, [open, classInfo?.id]);

  const renderTimeSlots = (cls: ClassWithTimeSlot) => {
    if (!cls.slots || cls.slots.length === 0) {
      return t("classManagement.table.noTimeSlot");
    }

    return (
      <Space direction="vertical" size={2}>
        {cls.slots.map(slot => {
          const timeRange = ScheduleService.formatTimeRange(
            slot.timeSlot.startTime,
            slot.timeSlot.endTime
          );
          return (
            <div key={`${slot.dayOfWeek}-${slot.timeSlotId}`}>
              {t("classManagement.table.dayPrefix", {
                dayName: GetDayName(slot.dayOfWeek),
              })}
              {timeRange && ` · ${timeRange}`} ({slot.timeSlot.name})
            </div>
          );
        })}
      </Space>
    );
  };

  return (
    <Drawer
      title={
        classInfo && (
          <div className="enrollment-drawer-title">
            <Title level={4} style={{ margin: 0 }}>
              {classInfo.title}
            </Title>
            <div className="enrollment-time-slot-info">
              <GradesRangeTag grades={classInfo.grades} color="green" />
            </div>
          </div>
        )
      }
      extra={
        classInfo && (
          <Space>
            <Button
              icon={<EditOutlined />}
              title={t("classManagement.table.editButton")}
              onClick={() => onEdit(classInfo)}
            />
            <Button
              danger
              icon={<DeleteOutlined />}
              title={t("classManagement.table.deleteButton")}
              onClick={() => onDelete(classInfo.id)}
            />
          </Space>
        )
      }
      placement="left"
      width={400}
      onClose={onClose}
      open={open}
      className="class-enrollment-drawer"
      styles={{ body: { padding: "16px" } }}>
      {classInfo && (
        <>
          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              {
                key: "teacher",
                label: t("classManagement.table.teacherColumn"),
                children: classInfo.teacher,
              },
              ...(classInfo.description
                ? [
                    {
                      key: "description",
                      label: t("classManagement.table.descriptionColumn"),
                      children: classInfo.description,
                    },
                  ]
                : []),
              {
                key: "room",
                label: t("classManagement.table.roomColumn"),
                children:
                  classInfo.room || t("classManagement.table.roomNotSpecified"),
              },
              {
                key: "time",
                label: t("classManagement.table.timeColumn"),
                children: renderTimeSlots(classInfo),
              },
              {
                key: "type",
                label: t("classManagement.table.typeColumn"),
                children: (
                  <Space size="small" wrap>
                    <Tag color={classInfo.isMandatory ? "red" : "blue"}>
                      {classInfo.isMandatory
                        ? t("classManagement.table.mandatoryType")
                        : t("classManagement.table.electiveType")}
                    </Tag>
                    {classInfo.isDouble && (
                      <Tag color="orange">
                        {t("classManagement.table.doubleLessonLabel")}
                      </Tag>
                    )}
                    <GroupTrackTags
                      groupNumber={classInfo.groupNumber}
                      trackNumber={classInfo.trackNumber}
                    />
                  </Space>
                ),
              },
              {
                key: "scope",
                label: t("classManagement.table.environmentColumn"),
                children: (
                  <Tag color={classInfo.scope === "prod" ? "green" : "orange"}>
                    {t(`scope.${classInfo.scope}`)}
                  </Tag>
                ),
              },
            ]}
          />
          <Divider style={{ margin: "16px 0" }} />
        </>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "20px" }}>
          <Spin />
        </div>
      ) : error ? (
        <Alert
          message={t("classManagement.page.dataLoadingError")}
          description={error}
          type="error"
          showIcon
        />
      ) : children.length === 0 ? (
        <Empty
          description={t("classManagement.enrollmentDrawer.noChildren")}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <>
          <Text style={{ display: "block", marginBottom: 12 }}>
            {t("schedule.enrollment.students", { count: children.length })}
          </Text>
          <List
            bordered
            dataSource={children}
            renderItem={child => (
              <List.Item key={child.id}>
                <Text>
                  {child.firstName} {child.lastName}
                </Text>
                <Tag>{GetGradeName(child.grade)}</Tag>
              </List.Item>
            )}
          />
        </>
      )}
    </Drawer>
  );
};

export default ClassEnrollmentDrawer;
