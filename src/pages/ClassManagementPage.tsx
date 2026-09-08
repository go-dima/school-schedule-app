import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Typography,
  Table,
  Button,
  Space,
  Alert,
  Spin,
  Modal,
  message,
  Tag,
  Select,
  Row,
  Col,
  Dropdown,
  MenuProps,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CloseOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { classesApi, timeSlotsApi } from "../services/api";
import { ScheduleService } from "../services/scheduleService";
import type {
  ClassWithTimeSlot,
  TimeSlot,
  Class,
  Scope,
  AppOnNavigate,
} from "../types";
import { DAYS_OF_WEEK, GRADES } from "../types";
import ClassForm from "../components/ClassForm";
import { GroupTrackTags } from "../components/GroupTrackTags";
import "./ClassManagementPage.css";
import { GetGradeName, GetGradeNameShort } from "@/utils/grades";
import { GetDayName } from "@/utils/days";
import { EnrollmentCount } from "@/elements/EnrollmentCount";
import { EnrollmentService } from "../services/enrollmentService";

const { Title } = Typography;

interface ClassManagementPageProps {
  onNavigate?: AppOnNavigate;
}

const ClassManagementPage: React.FC<ClassManagementPageProps> = () => {
  const { t } = useTranslation();
  const { canManageClasses } = useAuth();
  const [classes, setClasses] = useState<ClassWithTimeSlot[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassWithTimeSlot | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Map<string, number>>(
    new Map()
  );

  // Filter states
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedScope, setSelectedScope] = useState<Scope | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Filter and sort classes based on selected filters
  const filteredClasses = useMemo(() => {
    let filtered = classes;

    if (selectedDay !== null) {
      filtered = filtered.filter(cls =>
        cls.slots.some(slot => slot.dayOfWeek === selectedDay)
      );
    }

    if (selectedGrade !== null) {
      filtered = filtered.filter(cls => cls.grades?.includes(selectedGrade));
    }

    if (selectedScope !== null) {
      filtered = filtered.filter(cls => cls.scope === selectedScope);
    }

    // Sort by primary slot's day, then start time, then by grade (lowest first)
    return filtered.sort((a, b) => {
      const aPrimary = ScheduleService.getPrimarySlot(a);
      const bPrimary = ScheduleService.getPrimarySlot(b);

      if (aPrimary.dayOfWeek !== bPrimary.dayOfWeek) {
        return aPrimary.dayOfWeek - bPrimary.dayOfWeek;
      }

      if (aPrimary.timeSlot.startTime !== bPrimary.timeSlot.startTime) {
        return aPrimary.timeSlot.startTime.localeCompare(
          bPrimary.timeSlot.startTime
        );
      }

      // Finally sort by lowest grade in the grades array
      const aMinGrade = Math.min(...(a.grades || []));
      const bMinGrade = Math.min(...(b.grades || []));
      return aMinGrade - bMinGrade;
    });
  }, [classes, selectedDay, selectedGrade, selectedScope]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [classesData, timeSlotsData, enrollmentData] = await Promise.all([
        classesApi.getClasses(),
        timeSlotsApi.getTimeSlots(),
        EnrollmentService.getClassEnrollmentCounts(true), // Force refresh
      ]);

      setClasses(classesData);
      setTimeSlots(timeSlotsData);
      setEnrollmentCounts(enrollmentData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("classManagement.page.loadDataError")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = () => {
    setEditingClass(null);
    setModalVisible(true);
  };

  const handleEditClass = (cls: ClassWithTimeSlot) => {
    setEditingClass(cls);
    setModalVisible(true);
  };

  const handleDeleteClass = async (classId: string) => {
    try {
      await classesApi.deleteClass(classId);
      message.success(t("classManagement.page.classDeletedSuccess"));
      await loadData();
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("classManagement.page.classDeleteError")
      );
    }
  };

  const handleFormSubmit = async (
    classData: Omit<Class, "id" | "createdAt" | "updatedAt">
  ) => {
    setSubmitting(true);
    try {
      if (editingClass) {
        await classesApi.updateClass(editingClass.id, classData);
        message.success(t("classManagement.page.classUpdatedSuccess"));
      } else {
        await classesApi.createClass(classData);
        message.success(t("classManagement.page.classCreatedSuccess"));
      }

      setModalVisible(false);
      await loadData();
    } catch (err) {
      console.error("ClassManagementPage submission error:", err);
      message.error(
        err instanceof Error
          ? err.message
          : t("classManagement.page.classSaveError")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingClass(null);
  };

  const getTimeSlotDisplay = (cls: ClassWithTimeSlot) => {
    if (!cls.slots || cls.slots.length === 0) {
      return t("classManagement.table.noTimeSlot");
    }

    // Find the actual (day, time) pair a Double Lesson occupies by adjacency
    // — not by array position, since a class can also carry other, unrelated
    // slots that happen to sort earlier.
    const doublePair = ScheduleService.getDoubleLessonPair(cls, timeSlots);

    if (doublePair) {
      const [first, second] = doublePair;
      const combinedTimeRange = ScheduleService.formatTimeRange(
        first.timeSlot.startTime,
        second.timeSlot.endTime
      );
      const otherSlots = cls.slots.filter(
        slot => slot !== first && slot !== second
      );
      return (
        <span>
          <div>
            {t("classManagement.table.dayPrefix", {
              dayName: GetDayName(first.dayOfWeek),
            })}
          </div>
          {combinedTimeRange && <div>{combinedTimeRange}</div>}
          <div style={{ fontSize: "12px", color: "#666" }}>
            {first.timeSlot.name} + {second.timeSlot.name}
          </div>
          {otherSlots.map(slot => (
            <div
              key={`${slot.dayOfWeek}-${slot.timeSlotId}`}
              style={{ fontSize: "12px", color: "#666" }}>
              {GetDayName(slot.dayOfWeek)}{" "}
              {ScheduleService.formatTimeRange(
                slot.timeSlot.startTime,
                slot.timeSlot.endTime
              )}
            </div>
          ))}
        </span>
      );
    }

    return (
      <span>
        {cls.slots.map(slot => {
          const timeRange = ScheduleService.formatTimeRange(
            slot.timeSlot.startTime,
            slot.timeSlot.endTime
          );
          return (
            <div key={`${slot.dayOfWeek}-${slot.timeSlotId}`}>
              <div>
                {t("classManagement.table.dayPrefix", {
                  dayName: GetDayName(slot.dayOfWeek),
                })}
              </div>
              {timeRange && <div>{timeRange}</div>}
              <div style={{ fontSize: "12px", color: "#666" }}>
                {slot.timeSlot.name}
              </div>
            </div>
          );
        })}
      </span>
    );
  };

  const columns: ColumnsType<ClassWithTimeSlot> = [
    {
      title: t("classManagement.table.nameColumn"),
      dataIndex: "title",
      key: "title",
      width: 200,
    },
    {
      title: t("classManagement.table.descriptionColumn"),
      dataIndex: "description",
      key: "description",
      width: 250,
      ellipsis: true,
    },
    {
      title: t("classManagement.table.teacherColumn"),
      dataIndex: "teacher",
      key: "teacher",
      width: 150,
    },
    {
      title: t("classManagement.table.roomColumn"),
      dataIndex: "room",
      key: "room",
      width: 120,
      render: (room: string) =>
        room || t("classManagement.table.roomNotSpecified"),
    },
    {
      title: t("classManagement.table.gradesColumn"),
      dataIndex: "grades",
      key: "grades",
      width: 150,
      render: (grades: number[]) => (
        <Space size="small">
          {grades
            ?.sort((a, b) => b - a)
            .map(grade => (
              <Tag key={grade} color="geekblue">
                {GetGradeNameShort(grade)}
              </Tag>
            ))}
        </Space>
      ),
    },
    {
      title: t("classManagement.table.timeColumn"),
      key: "timeSlot",
      width: 150,
      render: (_, record: ClassWithTimeSlot) => getTimeSlotDisplay(record),
    },
    {
      title: t("classManagement.table.enrollmentColumn"),
      key: "enrollment",
      width: 100,
      align: "center" as const,
      render: (_, record) => (
        <EnrollmentCount count={enrollmentCounts.get(record.id) || 0} />
      ),
    },
    {
      title: t("classManagement.table.typeColumn"),
      key: "classType",
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Tag color={record.isMandatory ? "red" : "blue"}>
            {record.isMandatory
              ? t("classManagement.table.mandatoryType")
              : t("classManagement.table.electiveType")}
          </Tag>
          {record.isDouble && (
            <Tag color="orange">
              {t("classManagement.table.doubleLessonLabel")}
            </Tag>
          )}
          <GroupTrackTags
            groupNumber={record.groupNumber}
            trackNumber={record.trackNumber}
          />
        </Space>
      ),
    },
    {
      title: t("classManagement.table.environmentColumn"),
      dataIndex: "scope",
      key: "scope",
      width: 100,
      render: (scope: Scope) => (
        <Tag color={scope === "prod" ? "green" : "orange"}>
          {t(`scope.${scope}`)}
        </Tag>
      ),
    },
    {
      title: t("classManagement.table.actionsColumn"),
      key: "actions",
      width: 60,
      render: (_, record) => {
        const menuItems: MenuProps["items"] = [
          {
            key: "edit",
            label: t("classManagement.table.editButton"),
            icon: <EditOutlined />,
            onClick: () => handleEditClass(record),
          },
          {
            type: "divider",
          },
          {
            key: "delete",
            label: t("classManagement.table.deleteButton"),
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: t("classManagement.table.deleteConfirmTitle"),
                content: t("classManagement.table.deleteConfirmDescription"),
                okText: t("classManagement.table.confirmYes"),
                cancelText: t("classManagement.table.confirmNo"),
                onOk: () => handleDeleteClass(record.id),
              });
            },
          },
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={["click"]}
            placement="bottomLeft">
            <Button
              type="text"
              icon={<MoreOutlined />}
              size="small"
              title={t("classManagement.table.actions.more")}
            />
          </Dropdown>
        );
      },
    },
  ];

  if (!canManageClasses()) {
    return (
      <div className="page-content">
        <Alert
          message={t("classManagement.page.noPermissionTitle")}
          description={t("classManagement.page.adminOnlyAccess")}
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="page-loading">
          <Spin size="large" />
          <Title level={4} style={{ marginTop: 16, color: "#1890ff" }}>
            {t("classManagement.page.loading")}
          </Title>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="class-management-header">
        <div className="header-main">
          <Title level={2}>{t("classManagement.page.title")}</Title>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddClass}>
              {t("classManagement.page.addNewClass")}
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              disabled={loading}>
              {t("common.buttons.refresh")}
            </Button>
          </Space>
        </div>

        <Alert
          message={t("classManagement.page.managementAlertTitle")}
          description={t("classManagement.page.managementDescription")}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {/* Filters */}
        <Card
          title={t("classManagement.page.filtersTitle")}
          style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={8} md={6}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                  }}>
                  <label>{t("classManagement.page.dayFilterLabel")}</label>
                  {selectedDay !== null && (
                    <Button
                      type="text"
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => setSelectedDay(null)}
                      style={{ padding: 0 }}
                    />
                  )}
                </Space>
                <Select
                  placeholder={t("classManagement.page.dayFilterPlaceholder")}
                  allowClear
                  style={{ width: "100%" }}
                  value={selectedDay}
                  onChange={setSelectedDay}>
                  {DAYS_OF_WEEK.map(day => (
                    <Select.Option key={day.key} value={day.key}>
                      {day.name}
                    </Select.Option>
                  ))}
                </Select>
              </Space>
            </Col>

            <Col xs={24} sm={8} md={6}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                  }}>
                  <label>{t("classManagement.page.gradeFilterLabel")}</label>
                  {selectedGrade !== null && (
                    <Button
                      type="text"
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => setSelectedGrade(null)}
                      style={{ padding: 0 }}
                    />
                  )}
                </Space>
                <Select
                  placeholder={t("classManagement.page.gradeFilterPlaceholder")}
                  allowClear
                  style={{ width: "100%" }}
                  value={selectedGrade}
                  onChange={setSelectedGrade}>
                  {GRADES.map(grade => (
                    <Select.Option key={grade} value={grade}>
                      {GetGradeName(grade)}
                    </Select.Option>
                  ))}
                </Select>
              </Space>
            </Col>

            <Col xs={24} sm={8} md={6}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <Space
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                  }}>
                  <label>{t("scope.selector.label")}</label>
                  {selectedScope !== null && (
                    <Button
                      type="text"
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => setSelectedScope(null)}
                      style={{ padding: 0 }}
                    />
                  )}
                </Space>
                <Select
                  placeholder={t(
                    "classManagement.page.environmentFilterPlaceholder"
                  )}
                  allowClear
                  style={{ width: "100%" }}
                  value={selectedScope}
                  onChange={setSelectedScope}>
                  <Select.Option value="test">{t("scope.test")}</Select.Option>
                  <Select.Option value="prod">{t("scope.prod")}</Select.Option>
                </Select>
              </Space>
            </Col>

            <Col xs={24} sm={24} md={6}>
              <Button
                onClick={() => {
                  setSelectedDay(null);
                  setSelectedGrade(null);
                  setSelectedScope(null);
                }}>
                {t("classManagement.page.clearFiltersButton")}
              </Button>
            </Col>
          </Row>
        </Card>
      </div>

      {error && (
        <Alert
          message={t("classManagement.page.dataLoadingError")}
          description={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 24 }}
        />
      )}

      <Card className="classes-table-card">
        <Table<ClassWithTimeSlot>
          columns={columns}
          dataSource={filteredClasses}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => {
              const totalClasses = classes.length;
              return total === totalClasses
                ? t("classManagement.table.paginationText", {
                    start: range[0],
                    end: range[1],
                    total,
                  })
                : t("classManagement.table.paginationFilteredText", {
                    start: range[0],
                    end: range[1],
                    total,
                    totalClasses,
                  });
            },
          }}
          scroll={{ x: 1000 }}
          size="small"
        />
      </Card>

      <Modal
        title={
          editingClass
            ? t("classManagement.table.editModalTitle")
            : t("classManagement.table.addModalTitle")
        }
        open={modalVisible}
        onCancel={handleModalCancel}
        footer={null}
        width={600}
        destroyOnHidden>
        <ClassForm
          initialValues={editingClass}
          timeSlots={timeSlots}
          onSubmit={handleFormSubmit}
          onCancel={handleModalCancel}
          loading={submitting}
          isNewLesson={!editingClass}
        />
      </Modal>
    </div>
  );
};

export default ClassManagementPage;
