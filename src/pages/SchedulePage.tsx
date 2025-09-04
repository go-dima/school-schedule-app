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
} from "antd";
import {
  ReloadOutlined,
  UserSwitchOutlined,
  SettingOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useAuth } from "../contexts/AuthContext";
import { useSchedule } from "../hooks/useSchedule";
import ScheduleTable from "../components/ScheduleTable";
import { GRADES } from "../types";
import "./SchedulePage.css";
import { ScheduleService } from "../services/scheduleService";

const { Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

interface SchedulePageProps {
  onNavigate?: (page: "schedule" | "class-management" | "pending-approvals") => void;
}

const SchedulePage: React.FC<SchedulePageProps> = ({ onNavigate }) => {
  const { user, currentRole, userRoles, switchRole, signOut, isAdmin } =
    useAuth();
  const [selectedGrade, setSelectedGrade] = useState<number | undefined>(1);

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
    const role = userRoles.find((r) => r.id === roleId);
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

  const selectedClasses = userSelections.map((selection) => selection.classId);
  const canSelectClasses =
    currentRole?.role === "child" || currentRole?.role === "parent";

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
                </>
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

          {userRoles.length > 1 && (
            <div className="role-selector">
              <Space>
                <UserSwitchOutlined />
                <Select
                  value={currentRole?.id}
                  onChange={handleRoleSwitch}
                  placeholder="בחר תפקיד"
                  style={{ minWidth: 120 }}>
                  {userRoles.map((role) => (
                    <Option key={role.id} value={role.id}>
                      {getRoleDisplayName(role.role)}
                    </Option>
                  ))}
                </Select>
              </Space>
            </div>
          )}

          <div className="filters-section">
            <Space wrap>
              <span>סנן לפי כיתה:</span>
              <Select
                value={selectedGrade}
                onChange={setSelectedGrade}
                placeholder="כל הכיתות"
                allowClear
                style={{ minWidth: 120 }}>
                {GRADES.map((grade) => (
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
          />
        </Card>

        {canSelectClasses && userSelections.length > 0 && (
          <Card title="השיעורים שנבחרו" className="selected-classes-summary">
            <Space wrap>
              {userSelections.map((selection) => (
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
