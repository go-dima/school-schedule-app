import React, { useState, useEffect, useMemo } from "react";
import {
  Layout,
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
  ArrowLeftOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useAuth } from "../contexts/AuthContext";
import { classesApi, timeSlotsApi } from "../services/api";
import { ScheduleService } from "../services/scheduleService";
import type { ClassWithTimeSlot, TimeSlot, Class, ClassScope } from "../types";
import { DAYS_OF_WEEK, GRADES } from "../types";
import ClassForm from "../components/ClassForm";
import "./ClassManagementPage.css";

const { Content } = Layout;
const { Title } = Typography;

interface ClassManagementPageProps {
  onNavigate?: (
    page:
      | "schedule"
      | "class-management"
      | "pending-approvals"
      | "user-management"
  ) => void;
}

const ClassManagementPage: React.FC<ClassManagementPageProps> = ({
  onNavigate,
}) => {
  const { isAdmin, signOut } = useAuth();
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
      setError(err instanceof Error ? err.message : "Failed to load data");
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
      message.success("השיעור נמחק בהצלחה");
      await loadData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "שגיאה במחיקת השיעור");
    }
  };

  const handleFormSubmit = async (
    classData: Omit<Class, "id" | "createdAt" | "updatedAt">
  ) => {
    setSubmitting(true);
    try {
      if (editingClass) {
        await classesApi.updateClass(editingClass.id, classData);
        message.success("השיעור עודכן בהצלחה");
      } else {
        await classesApi.createClass(classData);
        message.success("השיעור נוצר בהצלחה");
      }

      setModalVisible(false);
      await loadData();
    } catch (err) {
      console.error("ClassManagementPage submission error:", err);
      message.error(err instanceof Error ? err.message : "שגיאה בשמירת השיעור");
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
      return "No Time Slot";
    }

    const dayName = cls
      ? ScheduleService.getDayName(cls.dayOfWeek)
      : "Unknown Day";

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
            <div>יום {dayName}</div>
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
        <div>יום {dayName}</div>
        {timeRange && <div>{timeRange}</div>}
        <div style={{ fontSize: "12px", color: "#666" }}>{timeSlot.name}</div>
      </span>
    );
  };

  const columns: ColumnsType<ClassWithTimeSlot> = [
    {
      title: "שם השיעור",
      dataIndex: "title",
      key: "title",
      width: 200,
    },
    {
      title: "תיאור",
      dataIndex: "description",
      key: "description",
      width: 250,
      ellipsis: true,
    },
    {
      title: "מורה",
      dataIndex: "teacher",
      key: "teacher",
      width: 150,
    },
    {
      title: "כיתה",
      dataIndex: "room",
      key: "room",
      width: 120,
      render: (room: string) => room || "לא צוין",
    },
    {
      title: "כיתות",
      dataIndex: "grades",
      key: "grades",
      width: 150,
      render: (grades: number[]) => (
        <Space size="small">
          {grades
            ?.sort((a, b) => b - a)
            .map(grade => (
              <Tag key={grade} color="geekblue">
                {ScheduleService.getGradeNameShort(grade)}
              </Tag>
            ))}
        </Space>
      ),
    },
    {
      title: "זמן השיעור",
      dataIndex: "timeSlot",
      key: "timeSlot",
      width: 150,
      render: (timeSlot: TimeSlot, record: ClassWithTimeSlot) =>
        getTimeSlotDisplay(timeSlot, record),
    },
    {
      title: "סוג",
      key: "classType",
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size="small">
          <Tag color={record.isMandatory ? "red" : "blue"}>
            {record.isMandatory ? "ליבה" : "בחירה"}
          </Tag>
          {record.isDouble && <Tag color="orange">שיעור כפול</Tag>}
        </Space>
      ),
    },
    {
      title: "סביבה",
      dataIndex: "scope",
      key: "scope",
      width: 100,
      render: (scope: ClassScope) => (
        <Tag color={scope === "prod" ? "green" : "orange"}>
          {scope === "prod" ? "מערכת" : "בדיקות"}
        </Tag>
      ),
    },
    {
      title: "פעולות",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space direction="vertical">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditClass(record)}
            size="small">
            ערוך
          </Button>
          <Popconfirm
            title="האם אתה בטוח שברצונך למחוק את השיעור?"
            description="פעולה זו תמחק את השיעור ואת כל הבחירות הקשורות אליו"
            onConfirm={() => handleDeleteClass(record.id)}
            okText="כן"
            cancelText="לא">
            <Button type="link" icon={<DeleteOutlined />} danger size="small">
              מחק
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!isAdmin()) {
    return (
      <Layout className="class-management-page">
        <Content className="class-management-content">
          <Alert
            message="אין הרשאה"
            description="רק מנהלים יכולים לגשת לדף זה"
            type="error"
            showIcon
          />
        </Content>
      </Layout>
    );
  }

  if (loading) {
    return (
      <div className="page-loading">
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 16, color: "#1890ff" }}>
          טוען נתוני שיעורים...
        </Title>
      </div>
    );
  }

  return (
    <Layout className="class-management-page">
      <Content className="class-management-content">
        <div className="class-management-header">
          <div className="header-main">
            <Title level={2}>ניהול שיעורים</Title>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => onNavigate?.("schedule")}>
                חזרה למערכת השעות
              </Button>
              <Button onClick={() => onNavigate?.("pending-approvals")}>
                אישורי הרשמה
              </Button>
              <Button onClick={() => onNavigate?.("user-management")}>
                ניהול משתמשים
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddClass}>
                הוסף שיעור חדש
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadData}
                disabled={loading}>
                רענן
              </Button>
              <Button type="primary" danger onClick={signOut}>
                התנתק
              </Button>
            </Space>
          </div>

          <Alert
            message="ניהול שיעורים"
            description="כאן תוכל להוסיף, לערוך ולמחוק שיעורים. שים לב שמחיקת שיעור תמחק גם את כל הבחירות הקשורות אליו."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          {/* Filters */}
          <Card title="מסננים" style={{ marginBottom: 24 }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={8} md={6}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Space
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      width: "100%",
                    }}>
                    <label>יום בשבוע:</label>
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
                    placeholder="בחר יום"
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
                    <label>כיתה:</label>
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
                    placeholder="בחר כיתה"
                    allowClear
                    style={{ width: "100%" }}
                    value={selectedGrade}
                    onChange={setSelectedGrade}>
                    {GRADES.map(grade => (
                      <Select.Option key={grade} value={grade}>
                        {ScheduleService.getGradeName(grade)}
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
                    <label>סביבה:</label>
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
                    placeholder="בחר סביבה"
                    allowClear
                    style={{ width: "100%" }}
                    value={selectedScope}
                    onChange={setSelectedScope}>
                    <Select.Option value="test">בדיקות</Select.Option>
                    <Select.Option value="prod">מערכת</Select.Option>
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
                  נקה מסננים
                </Button>
              </Col>
            </Row>
          </Card>
        </div>

        {error && (
          <Alert
            message="שגיאה בטעינת הנתונים"
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
                  ? `${range[0]}-${range[1]} מתוך ${total} שיעורים`
                  : `${range[0]}-${range[1]} מתוך ${total} שיעורים (${totalClasses} סה"כ)`;
              },
            }}
            scroll={{ x: 1000 }}
            size="small"
          />
        </Card>

        <Modal
          title={editingClass ? "ערוך שיעור" : "הוסף שיעור חדש"}
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
      </Content>
    </Layout>
  );
};

export default ClassManagementPage;
