import React, { useState } from "react";
import {
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
import { useTranslation } from "react-i18next";
import { ReloadOutlined, UserSwitchOutlined } from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { useChildContext } from "../contexts/ChildContext";
import { useSchedule } from "../hooks/useSchedule";
import { useChildSchedule } from "../hooks/useChildSchedule";
import ScheduleTable from "../components/ScheduleTable";
import ClassForm from "../components/ClassForm";
import { ChildSelector } from "../components/ChildSelector";
import { classesApi, timeSlotsApi } from "../services/api";
import { GRADES } from "../types";
import type { AppOnNavigate, Class, TimeSlot } from "../types";
import "./SchedulePage.css";
import { GetGradeName } from "@/utils/grades";

const { Title } = Typography;
const { Option } = Select;

interface SchedulePageProps {
  onNavigate?: AppOnNavigate;
}

const SchedulePage: React.FC<SchedulePageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  const getRoleDisplayName = (role: string): string => {
    const roleKey = `roles.${role}`;
    return t(roleKey, role); // fallback to role if translation not found
  };
  const { user, currentRole, userRoles, switchRole, isAdmin, hasRole } =
    useAuth();
  const {
    selectedChild,
    setSelectedChild,
    children: userChildren,
    loading: childrenLoading,
    error: childrenError,
  } = useChildContext();

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

  const isParent = hasRole("parent");

  // Auto-update grade filter when selected child changes (only for non-admin parents)
  React.useEffect(() => {
    if (selectedChild && isParent && !isAdmin()) {
      setSelectedGrade(selectedChild.grade);
    }
  }, [selectedChild, isParent, isAdmin]);

  // For parents, use child schedule; for others, use user schedule
  const {
    classes,
    timeSlots,
    userSelections,
    weeklySchedule,
    loading: scheduleLoading,
    error: scheduleError,
    loadScheduleData,
    selectClass,
    unselectClass,
    isClassSelected: isUserClassSelected,
  } = useSchedule(isParent ? null : user?.id);

  const {
    schedule: childSchedule,
    loading: childScheduleLoading,
    error: childScheduleError,
    selectClassForChild,
    unselectClassForChild,
    isClassSelected: isChildClassSelected,
  } = useChildSchedule(selectedChild);

  const loading = isParent
    ? scheduleLoading || childScheduleLoading || childrenLoading
    : scheduleLoading;
  const error = scheduleError || childScheduleError || childrenError;

  const handleRoleSwitch = (roleId: string) => {
    const role = userRoles.find(r => r.id === roleId);
    if (role) {
      switchRole(role);
    }
  };

  const handleClassSelect = async (classId: string) => {
    try {
      if (isParent && selectedChild) {
        if (isChildClassSelected(classId)) {
          await unselectClassForChild(classId);
        } else {
          await selectClassForChild(classId);
        }
      } else if (!isParent && user?.id) {
        if (isUserClassSelected(classId)) {
          await unselectClass(classId);
        } else {
          await selectClass(classId);
        }
      }
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("schedule.page.error.updateClassSelection")
      );
    }
  };

  const getSelectedClasses = () => {
    return isParent
      ? childSchedule.map(selection => selection.classId)
      : userSelections.map(selection => selection.classId);
  };

  const getSelectedSchedule = () => {
    return isParent ? childSchedule : userSelections;
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
        message.error(t("schedule.page.error.loadTimeSlots"));
        return;
      }
    }

    // Verify the timeSlot exists before setting state
    const foundTimeSlot = slotsToUse.find(slot => slot.id === timeSlotId);

    if (!foundTimeSlot) {
      message.error(t("schedule.page.error.timeSlotNotFound"));
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
      message.success(t("schedule.page.success.classCreated"));
      handleCloseCreateModal();
      // Reload schedule data to show the new class
      await loadScheduleData();
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("schedule.page.error.createClass")
      );
    } finally {
      setModalLoading(false);
    }
  };

  const selectedClasses = getSelectedClasses();
  const canSelectClasses =
    (currentRole?.role === "child" || currentRole?.role === "parent") &&
    (!isParent || selectedChild !== null);

  const canViewClasses =
    canSelectClasses ||
    currentRole?.role === "admin" ||
    currentRole?.role === "staff";

  if (loading) {
    return (
      <div className="page-loading">
        <Spin size="large" />
        <Title level={4} style={{ marginTop: 16, color: "#1890ff" }}>
          {t("schedule.page.loading")}
        </Title>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="filters-section">
        <div className="filters-row">
          <Space wrap>
            {isParent && userChildren.length > 0 && (
              <>
                <span>{t("schedule.page.labels.selectChild")}:</span>
                <ChildSelector
                  children={userChildren}
                  selectedChildId={selectedChild?.id || null}
                  onChildSelect={childId => {
                    const child = userChildren.find(c => c.id === childId);
                    setSelectedChild(child || null);
                    // Auto-update grade filter based on selected child (only for non-admin parents)
                    if (child && !isAdmin()) {
                      setSelectedGrade(child.grade);
                    }
                  }}
                  style={{ minWidth: 200 }}
                  disabled={childrenLoading}
                />
              </>
            )}
            {(!isParent || !userChildren.length || isAdmin()) && (
              <>
                <span>{t("schedule.page.labels.filterByGrade")}:</span>
                <Select
                  value={selectedGrade}
                  onChange={setSelectedGrade}
                  placeholder={t("schedule.page.placeholders.allGrades")}
                  allowClear
                  style={{ minWidth: 120 }}>
                  {GRADES.map(grade => (
                    <Option key={grade} value={grade}>
                      {GetGradeName(grade)}
                    </Option>
                  ))}
                </Select>
              </>
            )}
          </Space>

          <Space>
            {userRoles.length > 1 && (
              <Select
                value={currentRole?.id}
                onChange={handleRoleSwitch}
                placeholder={t("schedule.page.placeholders.selectRole")}
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
              {t("common.buttons.refresh")}
            </Button>
          </Space>
        </div>
      </div>

      {currentRole && (
        <Alert
          message={t("schedule.page.currentRoleAlert", {
            role: getRoleDisplayName(currentRole.role),
          })}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {isParent && userChildren.length === 0 && (
        <Alert
          message={t("schedule.page.alerts.noChildrenFound.title")}
          description={t("schedule.page.alerts.noChildrenFound.description")}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button
              size="small"
              onClick={() => onNavigate?.("profile-settings")}>
              {t("schedule.page.addChildButton")}
            </Button>
          }
        />
      )}

      {isParent && userChildren.length > 0 && !selectedChild && (
        <Alert
          message={t("schedule.page.alerts.noChildSelected.title")}
          description={t("schedule.page.alerts.noChildSelected.description")}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {!canSelectClasses && !isParent && (
        <Alert
          message={t("schedule.page.alerts.noPermission.title")}
          description={
            userRoles.length === 0
              ? t("schedule.page.alerts.noPermission.needsApproval")
              : currentRole?.role === "admin" || currentRole?.role === "staff"
                ? t("schedule.page.alerts.noPermission.adminStaffViewOnly")
                : t("schedule.page.alerts.noPermission.studentsParentsOnly")
          }
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            userRoles.length > 1 &&
            (currentRole?.role === "admin" || currentRole?.role === "staff") ? (
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
                {t("schedule.page.buttons.switchToAppropriateRole")}
              </Button>
            ) : undefined
          }
        />
      )}

      {error && (
        <Alert
          message={t("schedule.page.error.loadData")}
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

      {canSelectClasses && getSelectedSchedule().length > 0 && (
        <Card
          title={
            isParent && selectedChild
              ? t("schedule.page.selectedClassesForChild", {
                  firstName: selectedChild.firstName,
                  lastName: selectedChild.lastName,
                })
              : t("schedule.page.selectedClassesTitle")
          }
          className="selected-classes-summary">
          <Space wrap>
            {getSelectedSchedule().map(selection => (
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

      <Modal
        title={t("schedule.page.createNewClassModal")}
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
              dayOfWeek: createClassDayOfWeek,
              title: "",
              description: "",
              teacher: "",
              grades: [],
              isMandatory: false,
              isDouble: false,
              room: "",
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
    </div>
  );
};

export default SchedulePage;
