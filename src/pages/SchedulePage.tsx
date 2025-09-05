import React, { useState } from "react";
import {
  Layout,
  Card,
  Typography,
  Select,
  Button,
  Space,
  Alert,
  Spin,
  Modal,
  message,
} from "antd";
import {
  ReloadOutlined,
  UserSwitchOutlined,
  SettingOutlined,
  UserAddOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { useSchedule } from "../hooks/useSchedule";
import ScheduleTable from "../components/ScheduleTable";
import ClassForm from "../components/ClassForm";
import { classesApi, timeSlotsApi } from "../services/api";
import { GRADES } from "../types";
import type { Class, TimeSlot } from "../types";
import "./SchedulePage.css";
import { ScheduleService } from "../services/scheduleService";

const { Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

interface SchedulePageProps {
  onNavigate?: (
    page:
      | "schedule"
      | "class-management"
      | "pending-approvals"
      | "user-management"
  ) => void;
}

const SchedulePage: React.FC<SchedulePageProps> = ({ onNavigate }) => {
  const { user, currentRole, userRoles, switchRole, signOut, isAdmin } =
    useAuth();
  const [selectedGrade, setSelectedGrade] = useState<number | undefined>(1);
  const [createClassModalOpen, setCreateClassModalOpen] = useState(false);
  const [createClassTimeSlotId, setCreateClassTimeSlotId] = useState<
    string | null
  >(null);
  const [createClassDayOfWeek, setCreateClassDayOfWeek] = useState<
    number | null
  >(null);
  const [allTimeSlots, setAllTimeSlots] = useState<TimeSlot[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const {
    classes,
    timeSlots,
    userSelections,
    weeklySchedule,
    loading,
    error,
    loadScheduleData,
    selectClass,
    unselectClass,
    isClassSelected,
  } = useSchedule(user?.id);

  const handleRoleSwitch = (roleId: string) => {
    const role = userRoles.find(r => r.id === roleId);
    if (role) {
      switchRole(role);
    }
  };

  const handleClassSelect = async (classId: string) => {
    try {
      if (isClassSelected(classId)) {
        await unselectClass(classId);
      } else {
        await selectClass(classId);
      }
    } catch (err) {
      // Handle error silently or show user feedback
    }
  };

  const handleCreateClass = async (timeSlotId: string, dayOfWeek: number) => {
    // Load all time slots for the form if not already loaded
    let slotsToUse = allTimeSlots;
    if (allTimeSlots.length === 0) {
      try {
        const allSlots = await timeSlotsApi.getTimeSlots();
        setAllTimeSlots(allSlots);
        slotsToUse = allSlots;
      } catch (err) {
        message.error("שגיאה בטעינת נתוני השעות");
        return;
      }
    }

    // Verify the timeSlot exists before setting state
    const foundTimeSlot = slotsToUse.find(slot => slot.id === timeSlotId);

    if (!foundTimeSlot) {
      message.error("שגיאה: לא נמצא זמן השיעור המבוקש");
      return;
    }

    setCreateClassTimeSlotId(timeSlotId);
    setCreateClassDayOfWeek(dayOfWeek);
    setCreateClassModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setCreateClassModalOpen(false);
    setCreateClassTimeSlotId(null);
    setCreateClassDayOfWeek(null);
  };

  const handleFormSubmit = async (
    classData: Omit<Class, "id" | "createdAt" | "updatedAt">
  ) => {
    setModalLoading(true);
    try {
      await classesApi.createClass(classData);
      message.success("השיעור נוצר בהצלחה");
      handleCloseCreateModal();
      // Reload schedule data to show the new class
      await loadScheduleData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "שגיאה ביצירת השיעור");
    } finally {
      setModalLoading(false);
    }
  };

  const selectedClasses = userSelections.map(selection => selection.classId);
  const canSelectClasses =
    currentRole?.role === "child" || currentRole?.role === "parent";

  const canViewClasses =
    canSelectClasses ||
    currentRole?.role === "admin" ||
    currentRole?.role === "staff";

  if (loading) {
    return (
      <div className="page-loading">
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 16, color: "#1890ff" }}>
          טוען את מערכת השעות...
        </Title>
      </div>
    );
  }

  return (
    <Layout className="schedule-page">
      <Content className="schedule-content">
        <div className="schedule-header">
          <div className="header-main">
            <Title level={2}>מערכת שעות</Title>
            <Space>
              {isAdmin() && (
                <>
                  <Button
                    icon={<UserAddOutlined />}
                    onClick={() => onNavigate?.("pending-approvals")}>
                    בקשות ממתינות
                  </Button>
                  <Button
                    icon={<SettingOutlined />}
                    onClick={() => onNavigate?.("class-management")}>
                    ניהול שיעורים
                  </Button>
                  <Button
                    icon={<UserOutlined />}
                    onClick={() => onNavigate?.("user-management")}>
                    ניהול משתמשים
                  </Button>
                </>
              )}
              {userRoles.length > 1 && (
                <Select
                  value={currentRole?.id}
                  onChange={handleRoleSwitch}
                  placeholder="בחר תפקיד"
                  style={{ minWidth: 120 }}
                  suffixIcon={<UserSwitchOutlined />}>
                  {userRoles.map(role => (
                    <Option key={role.id} value={role.id}>
                      {getRoleDisplayName(role.role)}
                    </Option>
                  ))}
                </Select>
              )}
              <Button
                icon={<ReloadOutlined />}
                onClick={loadScheduleData}
                disabled={loading}>
                רענן
              </Button>
              <Button type="primary" danger onClick={signOut}>
                התנתק
              </Button>
            </Space>
          </div>

          <div className="filters-section">
            <Space wrap>
              <span>סנן לפי כיתה:</span>
              <Select
                value={selectedGrade}
                onChange={setSelectedGrade}
                placeholder="כל הכיתות"
                allowClear
                style={{ minWidth: 120 }}>
                {GRADES.map(grade => (
                  <Option key={grade} value={grade}>
                    {ScheduleService.getGradeName(grade)}
                  </Option>
                ))}
              </Select>
            </Space>
          </div>

          {currentRole && (
            <Alert
              message={`תפקיד נוכחי: ${getRoleDisplayName(currentRole.role)}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {!canSelectClasses && (
            <Alert
              message="אין הרשאה לבחירת שיעורים"
              description={
                userRoles.length === 0
                  ? "נדרשת אישור מנהל להפעלת התפקיד. אנא המתן לאישור או פנה למנהל."
                  : currentRole?.role === "admin" ||
                      currentRole?.role === "staff"
                    ? "מנהלים וצוות יכולים לצפות במערכת השעות אך לא לבחור שיעורים."
                    : "רק תלמידים והורים יכולים לבחור שיעורים במערכת השעות."
              }
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              action={
                userRoles.length > 1 &&
                (currentRole?.role === "admin" ||
                  currentRole?.role === "staff") ? (
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                      const childOrParentRole = userRoles.find(
                        role => role.role === "child" || role.role === "parent"
                      );
                      if (childOrParentRole) {
                        switchRole(childOrParentRole);
                      }
                    }}>
                    החלף לתפקיד מתאים
                  </Button>
                ) : undefined
              }
            />
          )}
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

        <Card className="schedule-card">
          <ScheduleTable
            timeSlots={timeSlots}
            classes={classes}
            weeklySchedule={weeklySchedule}
            userGrade={selectedGrade}
            selectedClasses={selectedClasses}
            onClassSelect={handleClassSelect}
            onClassUnselect={handleClassSelect}
            canSelectClasses={canSelectClasses}
            canViewClasses={canViewClasses}
            isAdmin={isAdmin()}
            onCreateClass={handleCreateClass}
          />
        </Card>

        {canSelectClasses && userSelections.length > 0 && (
          <Card title="השיעורים שנבחרו" className="selected-classes-summary">
            <Space wrap>
              {userSelections.map(selection => (
                <Button
                  key={selection.id}
                  type="primary"
                  size="small"
                  onClick={() => handleClassSelect(selection.classId)}>
                  {selection.class.title} - {selection.class.teacher}
                </Button>
              ))}
            </Space>
          </Card>
        )}
      </Content>

      <Modal
        title="צור שיעור חדש"
        open={createClassModalOpen}
        onCancel={handleCloseCreateModal}
        footer={null}
        width={600}
        destroyOnHidden>
        {createClassTimeSlotId &&
          createClassDayOfWeek !== null &&
          allTimeSlots.length > 0 &&
          (() => {
            const selectedTimeSlot = allTimeSlots.find(
              slot => slot.id === createClassTimeSlotId
            );
            if (!selectedTimeSlot) {
              return null; // Don't render if timeSlot not found
            }

            const initialValues = {
              timeSlotId: createClassTimeSlotId,
              title: "",
              description: "",
              teacher: "",
              grades: [],
              isMandatory: false,
              scope: "test" as const,
              id: createClassTimeSlotId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              timeSlot: selectedTimeSlot,
            };

            return (
              <ClassForm
                initialValues={initialValues}
                timeSlots={allTimeSlots}
                onSubmit={handleFormSubmit}
                onCancel={handleCloseCreateModal}
                loading={modalLoading}
                isNewLesson={true}
              />
            );
          })()}
      </Modal>
    </Layout>
  );
};

function getRoleDisplayName(role: string): string {
  const roleNames = {
    admin: "מנהל",
    parent: "הורה",
    child: "תלמיד",
    staff: "צוות",
  };
  return roleNames[role as keyof typeof roleNames] || role;
}

export default SchedulePage;
