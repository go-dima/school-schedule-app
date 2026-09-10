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
  Select,
  message,
} from "antd";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { scheduleApi, classesApi } from "../services/api";
import { ScheduleService } from "../services/scheduleService";
import type { ClassWithTimeSlot, Child, ClassSlotWithTimeSlot } from "../types";
import { GRADES } from "../types";
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
  onUpdated: (updatedClass: ClassWithTimeSlot) => void;
}

const ClassEnrollmentDrawer: React.FC<ClassEnrollmentDrawerProps> = ({
  open,
  onClose,
  classInfo,
  onEdit,
  onDelete,
  onUpdated,
}) => {
  const { t } = useTranslation();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedClassId = useRef<string | null>(null);

  // Mirrors `classInfo`, but updated optimistically by the inline-edit
  // fields below so the drawer reflects a save immediately instead of
  // waiting on the round trip through the parent's onUpdated callback.
  // Resynced whenever the parent hands us a different class (or a fresh
  // copy of the same one, e.g. after loadData()).
  const [localClassInfo, setLocalClassInfo] =
    useState<ClassWithTimeSlot | null>(classInfo);

  // Grades has no Typography-editable equivalent for a multi-select, so it
  // keeps its own row-local edit toggle; teacher/room use Text's built-in
  // `editable` prop instead.
  const [editingGrades, setEditingGrades] = useState(false);
  const [draftGrades, setDraftGrades] = useState<number[]>([]);

  useEffect(() => {
    setLocalClassInfo(classInfo);
    setEditingGrades(false);
  }, [classInfo]);

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

  // Shared save path for every inline-editable field: optimistic update,
  // persist, and either propagate the merged record up (on success) or
  // roll the optimistic change back and surface the error (on failure).
  const saveField = async (
    updates: Partial<
      Pick<ClassWithTimeSlot, "title" | "teacher" | "room" | "grades">
    >
  ) => {
    if (!localClassInfo) return;
    const previous = localClassInfo;
    const optimistic = { ...previous, ...updates };
    setLocalClassInfo(optimistic);
    try {
      await classesApi.updateClass(previous.id, updates);
      onUpdated(optimistic);
    } catch (err) {
      setLocalClassInfo(previous);
      message.error(
        err instanceof Error
          ? err.message
          : t("classManagement.page.classSaveError")
      );
    }
  };

  const handleTitleChange = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      message.error(t("form.class.nameRequired"));
      return;
    }
    saveField({ title: trimmed });
  };

  const handleTeacherChange = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      message.error(t("form.class.teacherRequired"));
      return;
    }
    saveField({ teacher: trimmed });
  };

  const handleRoomChange = (value: string) => {
    saveField({ room: value.trim() });
  };

  const startEditingGrades = () => {
    if (!localClassInfo) return;
    setDraftGrades(localClassInfo.grades);
    setEditingGrades(true);
  };

  const handleGradesSave = () => {
    if (!localClassInfo) return;

    const sortedGrades = [...draftGrades].sort((a, b) => a - b);
    if (sortedGrades.length === 0) {
      message.error(t("form.class.gradesRequired"));
      return;
    }

    setEditingGrades(false);

    const previousSorted = [...localClassInfo.grades].sort((a, b) => a - b);
    const unchanged =
      sortedGrades.length === previousSorted.length &&
      sortedGrades.every((grade, index) => grade === previousSorted[index]);
    if (unchanged) return;

    saveField({ grades: sortedGrades });
  };

  // Earliest day/time first, matching the sort ClassManagementPage's own
  // table already uses for the class list itself.
  const sortedSlots = (cls: ClassWithTimeSlot): ClassSlotWithTimeSlot[] =>
    [...cls.slots].sort((a, b) =>
      a.dayOfWeek !== b.dayOfWeek
        ? a.dayOfWeek - b.dayOfWeek
        : a.timeSlot.startTime.localeCompare(b.timeSlot.startTime)
    );

  const renderTimeSlots = (cls: ClassWithTimeSlot) => {
    if (!cls.slots || cls.slots.length === 0) {
      return t("classManagement.table.noTimeSlot");
    }

    return (
      <Space direction="vertical" size={2}>
        {sortedSlots(cls).map(slot => {
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
        localClassInfo && (
          <Title
            level={4}
            style={{ margin: 0 }}
            editable={{ onChange: handleTitleChange }}>
            {localClassInfo.title}
          </Title>
        )
      }
      extra={
        localClassInfo && (
          <Space>
            <Button
              danger
              icon={<DeleteOutlined />}
              title={t("classManagement.table.deleteButton")}
              onClick={() => onDelete(localClassInfo.id)}
            />
            <Button
              icon={<EditOutlined />}
              title={t("classManagement.table.editButton")}
              onClick={() => onEdit(localClassInfo)}
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
      {localClassInfo && (
        <>
          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              {
                key: "teacher",
                label: t("classManagement.table.teacherColumn"),
                children: (
                  <Text editable={{ onChange: handleTeacherChange }}>
                    {localClassInfo.teacher}
                  </Text>
                ),
              },
              {
                key: "grades",
                label: t("classManagement.table.gradesColumn"),
                children: editingGrades ? (
                  <Select
                    mode="multiple"
                    autoFocus
                    style={{ width: "100%" }}
                    value={draftGrades}
                    onChange={setDraftGrades}
                    onBlur={handleGradesSave}
                    options={GRADES.map(grade => ({
                      value: grade,
                      label: GetGradeName(grade),
                    }))}
                  />
                ) : (
                  <Space size="small">
                    <GradesRangeTag
                      grades={localClassInfo.grades}
                      color="green"
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={startEditingGrades}
                    />
                  </Space>
                ),
              },
              ...(localClassInfo.description
                ? [
                    {
                      key: "description",
                      label: t("classManagement.table.descriptionColumn"),
                      children: localClassInfo.description,
                    },
                  ]
                : []),
              {
                key: "room",
                label: t("classManagement.table.roomColumn"),
                children: (
                  <Text
                    editable={{
                      text: localClassInfo.room,
                      onChange: handleRoomChange,
                    }}>
                    {localClassInfo.room ||
                      t("classManagement.table.roomNotSpecified")}
                  </Text>
                ),
              },
              {
                key: "time",
                label: t("classManagement.table.timeColumn"),
                children: renderTimeSlots(localClassInfo),
              },
              {
                key: "type",
                label: t("classManagement.table.typeColumn"),
                children: (
                  <Space size="small" wrap>
                    <Tag color={localClassInfo.isMandatory ? "red" : "blue"}>
                      {localClassInfo.isMandatory
                        ? t("classManagement.table.mandatoryType")
                        : t("classManagement.table.electiveType")}
                    </Tag>
                    {localClassInfo.isDouble && (
                      <Tag color="orange">
                        {t("classManagement.table.doubleLessonLabel")}
                      </Tag>
                    )}
                    <GroupTrackTags
                      groupNumber={localClassInfo.groupNumber}
                      trackNumber={localClassInfo.trackNumber}
                    />
                  </Space>
                ),
              },
              {
                key: "scope",
                label: t("classManagement.table.environmentColumn"),
                children: (
                  <Tag
                    color={
                      localClassInfo.scope === "prod" ? "green" : "orange"
                    }>
                    {t(`scope.${localClassInfo.scope}`)}
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
