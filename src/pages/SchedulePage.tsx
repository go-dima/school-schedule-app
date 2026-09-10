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
  AutoComplete,
  Tooltip,
} from "antd";
import { useTranslation } from "react-i18next";
import {
  ReloadOutlined,
  UserSwitchOutlined,
  PrinterOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { useChildContext } from "../contexts/ChildContext";
import { useSchedule } from "../hooks/useSchedule";
import { useChildSchedule } from "../hooks/useChildSchedule";
import { useAllChildren } from "../hooks/useAllChildren";
import ScheduleTable from "../components/ScheduleTable";
import ClassForm from "../components/ClassForm";
import { ChildSelector } from "../components/ChildSelector";
import { StudentSearchSelector } from "../components/StudentSearchSelector";
import { ChildTrackSelector } from "../components/ChildTrackSelector";
import { classesApi, timeSlotsApi } from "../services/api";
import { TrackSelectionService } from "../services/trackSelectionService";
import { ScheduleService } from "../services/scheduleService";
import { DraftBanner } from "../elements/DraftBanner";
import { GRADES } from "../types";
import type { AppOnNavigate, Class, TimeSlot, Child } from "../types";
import "./SchedulePage.css";
import { GetGradeName } from "@/utils/grades";
import { printSchedule } from "../utils/printSchedule";

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
    updateChild: updateChildForParent,
  } = useChildContext();

  // For staff users - get all children and manage separate selected child state
  const {
    children: allChildren,
    loading: allChildrenLoading,
    updateChild: updateChildForStaff,
  } = useAllChildren();
  const [staffSelectedChild, setStaffSelectedChild] = useState<
    Child | undefined
  >(undefined);
  const isStaff = hasRole("staff");

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
  const [searchTerm, setSearchTerm] = useState<string>("");

  const isParent = hasRole("parent");
  const viewStatus = ScheduleService.resolveSelectionStatus(currentRole?.role);

  const handleStaffChildSelect = (childId: string | undefined) => {
    if (!childId) {
      setStaffSelectedChild(undefined);
      return;
    }
    const child = allChildren.find(c => c.id === childId);
    if (child) {
      // Use React's batching by updating states together
      setStaffSelectedChild(child);
      setSelectedGrade(child.grade);
    } else {
      setStaffSelectedChild(undefined);
    }
  };

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
  } = useSchedule(currentRole?.role === "child" ? user?.id : null);

  const {
    schedule: childSchedule,
    loading: childScheduleLoading,
    error: childScheduleError,
    selectClassForChild,
    unselectClassForChild,
    isClassSelected: isChildClassSelected,
    refetch: refetchChildSchedule,
  } = useChildSchedule(
    isStaff ? staffSelectedChild : selectedChild,
    viewStatus
  );

  const makeTrackChangeHandler =
    (
      child: Child | undefined,
      updateFn: typeof updateChildForParent,
      setChild: (child: Child) => void
    ) =>
    async (trackNumber: number | null) => {
      if (!child) return;
      try {
        const updatedChild = await updateFn(child.id, { trackNumber });
        setChild(updatedChild);
        const changes = TrackSelectionService.computeTrackClassChanges(
          classes,
          childSchedule,
          updatedChild.grade,
          trackNumber
        );
        await TrackSelectionService.applyTrackClassChanges(
          updatedChild.id,
          changes,
          viewStatus
        );
        await refetchChildSchedule();
      } catch (err) {
        message.error(
          err instanceof Error
            ? err.message
            : t("schedule.page.error.updateTrack")
        );
      }
    };

  const handleParentTrackChange = makeTrackChangeHandler(
    selectedChild,
    updateChildForParent,
    setSelectedChild
  );

  const handleStaffTrackChange = makeTrackChangeHandler(
    staffSelectedChild,
    updateChildForStaff,
    setStaffSelectedChild
  );

  // Handler for when a new child is added via StudentSearchSelector
  const handleChildAdded = (newChild: Child) => {
    // Auto-select the newly created student for staff
    setStaffSelectedChild(newChild);
    setSelectedGrade(newChild.grade);
  };

  // Auto-update grade filter when selected child changes (only for non-admin parents)
  React.useEffect(() => {
    if (selectedChild && isParent && !isAdmin()) {
      setSelectedGrade(selectedChild.grade);
    }
  }, [selectedChild, isParent, isAdmin]);

  const loading = isParent
    ? scheduleLoading || childScheduleLoading || childrenLoading
    : isStaff
      ? scheduleLoading || childScheduleLoading || allChildrenLoading
      : scheduleLoading;
  const error = scheduleError || childScheduleError || childrenError;

  const handleRoleSwitch = (roleId: string) => {
    const role = userRoles.find(r => r.id === roleId);
    if (role) {
      switchRole(role);
    }
  };

  // Classes auto-selected by the active child's track can't be picked apart
  // one at a time -- only changing the track (which re-syncs them) can.
  const currentTrackChild = isStaff ? staffSelectedChild : selectedChild;
  const lockedClassIds = new Set(
    currentTrackChild?.trackNumber
      ? classes
          .filter(cls => cls.trackNumber === currentTrackChild.trackNumber)
          .map(cls => cls.id)
      : []
  );

  type SelectionContext =
    | {
        kind: "child";
        isSelected: (classId: string) => boolean;
        select: (classId: string) => Promise<void>;
        unselect: (classId: string) => Promise<void>;
      }
    | {
        kind: "legacy";
        isSelected: (classId: string) => boolean;
        select: (classId: string) => Promise<void>;
        unselect: (classId: string) => Promise<void>;
      }
    | { kind: "none" };

  const selectionContext: SelectionContext =
    isParent && selectedChild
      ? {
          kind: "child",
          isSelected: isChildClassSelected,
          select: selectClassForChild,
          unselect: unselectClassForChild,
        }
      : isStaff && staffSelectedChild
        ? {
            kind: "child",
            isSelected: isChildClassSelected,
            select: selectClassForChild,
            unselect: unselectClassForChild,
          }
        : currentRole?.role === "child" && user?.id
          ? {
              kind: "legacy",
              isSelected: isUserClassSelected,
              select: selectClass,
              unselect: unselectClass,
            }
          : { kind: "none" };

  const handleClassSelect = async (classId: string) => {
    if (selectionContext.kind === "none") return;
    try {
      if (selectionContext.isSelected(classId)) {
        if (selectionContext.kind === "child" && lockedClassIds.has(classId)) {
          message.warning(t("schedule.page.error.trackClassLocked"));
          return;
        }
        await selectionContext.unselect(classId);
      } else {
        await selectionContext.select(classId);
      }
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("schedule.page.error.updateClassSelection")
      );
    }
  };

  const getSelectedSchedule = () => {
    if (isParent || (isStaff && staffSelectedChild)) {
      return childSchedule;
    }
    if (currentRole?.role === "child") {
      return userSelections;
    }
    return [];
  };

  const getSelectedClasses = () =>
    getSelectedSchedule().map(selection => selection.classId);

  const handleExportSchedule = async () => {
    const currentChild = isParent ? selectedChild : staffSelectedChild;

    if (!currentChild) {
      message.error(t("schedule.page.error.noChildSelected"));
      return;
    }

    try {
      await printSchedule({
        child: currentChild,
        timeSlots,
        weeklySchedule,
        selectedClasses: getSelectedClasses(),
        showDraftMarker: viewStatus === "draft",
      });
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("schedule.page.error.exportFailed")
      );
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
    ((currentRole?.role === "child" || currentRole?.role === "parent") &&
      (!isParent || selectedChild !== null)) ||
    (isStaff && staffSelectedChild !== null);

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
                <ChildTrackSelector
                  child={selectedChild}
                  onChange={handleParentTrackChange}
                  disabled={childrenLoading}
                />
                <Space size="small">
                  <ChildSelector
                    children={userChildren}
                    selectedChildId={selectedChild?.id || null}
                    onChildSelect={childId => {
                      if (!childId) {
                        // Handle clear selection
                        setSelectedChild(undefined);
                        return;
                      }
                      const child = userChildren.find(c => c.id === childId);
                      setSelectedChild(child || undefined);
                      // Auto-update grade filter based on selected child (only for non-admin parents)
                      if (child && !isAdmin()) {
                        setSelectedGrade(child.grade);
                      }
                    }}
                    style={{ minWidth: 200 }}
                    disabled={childrenLoading}
                  />
                  <span>{t("schedule.page.labels.selectChild")}:</span>
                </Space>
              </>
            )}
            {isStaff && (
              <>
                <ChildTrackSelector
                  child={staffSelectedChild}
                  onChange={handleStaffTrackChange}
                  disabled={allChildrenLoading}
                />
                <Space size="small">
                  <StudentSearchSelector
                    children={allChildren}
                    selectedChildId={staffSelectedChild?.id || null}
                    onChildSelect={handleStaffChildSelect}
                    onChildAdded={handleChildAdded}
                    placeholder={t(
                      "schedule.page.placeholders.selectChildForStaff"
                    )}
                    style={{ minWidth: 200 }}
                    disabled={allChildrenLoading}
                    defaultGrade={selectedGrade || 1}
                    mode="select"
                    isCreateAllowed={isStaff}
                  />
                  <span>{t("schedule.page.labels.selectChildForStaff")}:</span>
                </Space>
              </>
            )}
            {(!isParent || !userChildren.length || isAdmin()) && (
              <>
                <Select
                  value={selectedGrade}
                  onChange={setSelectedGrade}
                  placeholder={t("schedule.page.placeholders.allGrades")}
                  allowClear
                  style={{ minWidth: 120 }}
                  disabled={isStaff && !!staffSelectedChild}>
                  {GRADES.map(grade => (
                    <Option key={grade} value={grade}>
                      {GetGradeName(grade)}
                    </Option>
                  ))}
                </Select>
                <span>{t("schedule.page.labels.filterByGrade")}:</span>
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
            {((isParent && selectedChild) ||
              (isStaff && staffSelectedChild)) && (
              <Button
                icon={<PrinterOutlined />}
                onClick={handleExportSchedule}
                disabled={loading}>
                {t("schedule.page.exportButton")}
              </Button>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={loadScheduleData}
              disabled={loading}>
              {t("common.buttons.refresh")}
            </Button>
            <Space size="small">
              <AutoComplete
                value={searchTerm}
                onChange={setSearchTerm}
                options={(() => {
                  if (!searchTerm) return [];

                  const uniqueClassNames = Array.from(
                    new Set(
                      classes
                        .filter(cls => {
                          // For staff with selected child, filter by child's grade only
                          if (isStaff && staffSelectedChild) {
                            if (
                              !cls.grades?.includes(staffSelectedChild.grade)
                            ) {
                              return false;
                            }
                          } else {
                            // Apply grade filter if set
                            if (
                              selectedGrade &&
                              !cls.grades?.includes(selectedGrade)
                            ) {
                              return false;
                            }
                          }
                          // Apply class name filter
                          return cls.title
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase());
                        })
                        .map(cls => cls.title)
                    )
                  ).sort();

                  return uniqueClassNames.map(title => ({ value: title }));
                })()}
                placeholder={t("schedule.page.placeholders.searchClass")}
                style={{ minWidth: 200 }}
                allowClear
                filterOption={false}
              />
              <span>{t("schedule.page.labels.searchClass")}:</span>
            </Space>
          </Space>
        </div>
      </div>

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

      {viewStatus === "draft" && <DraftBanner />}

      <Card className="schedule-card">
        <ScheduleTable
          timeSlots={timeSlots}
          classes={classes}
          weeklySchedule={weeklySchedule}
          userGrade={selectedGrade}
          selectedClasses={selectedClasses}
          userSelections={getSelectedSchedule()}
          onClassSelect={handleClassSelect}
          onClassUnselect={handleClassSelect}
          canSelectClasses={canSelectClasses}
          canViewClasses={canViewClasses}
          isAdmin={isAdmin()}
          onCreateClass={handleCreateClass}
          searchTerm={searchTerm}
        />
      </Card>

      {canSelectClasses && getSelectedSchedule().length > 0 && (
        <Card
          title={
            (isParent && selectedChild) || (isStaff && staffSelectedChild)
              ? t("schedule.page.selectedClassesForChild", {
                  firstName: (isParent ? selectedChild : staffSelectedChild)
                    ?.firstName,
                  lastName: (isParent ? selectedChild : staffSelectedChild)
                    ?.lastName,
                })
              : t("schedule.page.selectedClassesTitle")
          }
          className="selected-classes-summary">
          <Space wrap>
            {getSelectedSchedule().map(selection => {
              const isLocked = lockedClassIds.has(selection.classId);
              const button = (
                <Button
                  key={selection.id}
                  type="primary"
                  size="small"
                  disabled={isLocked}
                  icon={isLocked ? <LockOutlined /> : undefined}
                  onClick={() => handleClassSelect(selection.classId)}>
                  {selection.class.title} - {selection.class.teacher}
                </Button>
              );
              return isLocked ? (
                <Tooltip
                  key={selection.id}
                  title={t("schedule.drawer.trackLockedTooltip")}>
                  <span style={{ display: "inline-block" }}>{button}</span>
                </Tooltip>
              ) : (
                button
              );
            })}
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
              slots: [
                {
                  dayOfWeek: createClassDayOfWeek,
                  timeSlotId: createClassTimeSlotId,
                  timeSlot: selectedTimeSlot,
                },
              ],
              title: "",
              description: "",
              teacher: "",
              grades: [],
              isMandatory: false,
              isDouble: false,
              groupNumber: null,
              trackNumber: null,
              room: "",
              scope: "test" as const,
              id: createClassTimeSlotId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
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
