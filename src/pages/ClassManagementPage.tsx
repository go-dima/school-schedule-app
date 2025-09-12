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
  Popconfirm,
  Tag,
  Select,
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CloseOutlined,
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
  ClassScope,
  AppOnNavigate,
} from "../types";
import { DAYS_OF_WEEK, GRADES } from "../types";
import ClassForm from "../components/ClassForm";
import "./ClassManagementPage.css";
import { GetGradeName, GetGradeNameShort } from "@/utils/grades";
import { GetDayName } from "@/utils/days";

const { Title } = Typography;

interface ClassManagementPageProps {
  onNavigate?: AppOnNavigate;
}

const ClassManagementPage: React.FC<ClassManagementPageProps> = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [classes, setClasses] = useState<ClassWithTimeSlot[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassWithTimeSlot | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  // Filter states
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [selectedScope, setSelectedScope] = useState<ClassScope | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Filter and sort classes based on selected filters
  const filteredClasses = useMemo(() => {
    let filtered = classes;

    if (selectedDay !== null) {
      filtered = filtered.filter(cls => cls.dayOfWeek === selectedDay);
    }

    if (selectedGrade !== null) {
      filtered = filtered.filter(cls => cls.grades?.includes(selectedGrade));
    }

    if (selectedScope !== null) {
      filtered = filtered.filter(cls => cls.scope === selectedScope);
    }

    // Sort by day, then by time slot, then by grade (lowest first)
    return filtered.sort((a, b) => {
      // First sort by day of week
      if (a.dayOfWeek !== b.dayOfWeek) {
        return a.dayOfWeek - b.dayOfWeek;
      }

      // Then sort by time slot (start time)
      if (a.timeSlot.startTime !== b.timeSlot.startTime) {
        return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
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
      const [classesData, timeSlotsData] = await Promise.all([
        classesApi.getClasses(),
        timeSlotsApi.getTimeSlots(),
      ]);

      setClasses(classesData);
      setTimeSlots(timeSlotsData);
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

  const getTimeSlotDisplay = (timeSlot: TimeSlot, cls?: ClassWithTimeSlot) => {
    if (!timeSlot) {
      return t("classManagement.table.noTimeSlot");
    }

    const dayName = cls
      ? GetDayName(cls.dayOfWeek)
      : t("classManagement.table.unknownDay");

    // For double lessons, show combined time range and both slot names
    if (cls?.isDouble) {
      const nextTimeSlot = ScheduleService.getNextConsecutiveTimeSlot(
        timeSlot,
        timeSlots
      );
      if (nextTimeSlot) {
        const combinedTimeRange = ScheduleService.formatTimeRange(
          timeSlot.startTime,
          nextTimeSlot.endTime
        );
        return (
          <span>
            <div>{t("classManagement.table.dayPrefix", { dayName })}</div>
            {combinedTimeRange && <div>{combinedTimeRange}</div>}
            <div style={{ fontSize: "12px", color: "#666" }}>
              {timeSlot.name} + {nextTimeSlot.name}
            </div>
          </span>
        );
      }
    }

    // For regular lessons, show standard time range
    const timeRange = ScheduleService.formatTimeRange(
      timeSlot.startTime,
      timeSlot.endTime
    );

    return (
      <span>
        <div>{t("classManagement.table.dayPrefix", { dayName })}</div>
        {timeRange && <div>{timeRange}</div>}
        <div style={{ fontSize: "12px", color: "#666" }}>{timeSlot.name}</div>
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
      dataIndex: "timeSlot",
      key: "timeSlot",
      width: 150,
      render: (timeSlot: TimeSlot, record: ClassWithTimeSlot) =>
        getTimeSlotDisplay(timeSlot, record),
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
        </Space>
      ),
    },
    {
      title: t("classManagement.table.environmentColumn"),
      dataIndex: "scope",
      key: "scope",
      width: 100,
      render: (scope: ClassScope) => (
        <Tag color={scope === "prod" ? "green" : "orange"}>
          {scope === "prod"
            ? t("classManagement.table.productionEnvironment")
            : t("classManagement.table.testEnvironment")}
        </Tag>
      ),
    },
    {
      title: t("classManagement.table.actionsColumn"),
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space direction="vertical">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditClass(record)}
            size="small">
            {t("classManagement.table.editButton")}
          </Button>
          <Popconfirm
            title={t("classManagement.table.deleteConfirmTitle")}
            description={t("classManagement.table.deleteConfirmDescription")}
            onConfirm={() => handleDeleteClass(record.id)}
            okText={t("classManagement.table.confirmYes")}
            cancelText={t("classManagement.table.confirmNo")}>
            <Button type="link" icon={<DeleteOutlined />} danger size="small">
              {t("classManagement.table.deleteButton")}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!isAdmin()) {
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
                  <label>
                    {t("classManagement.page.environmentFilterLabel")}
                  </label>
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
                  <Select.Option value="test">
                    {t("classManagement.page.testEnvironmentOption")}
                  </Select.Option>
                  <Select.Option value="prod">
                    {t("classManagement.page.productionEnvironmentOption")}
                  </Select.Option>
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
