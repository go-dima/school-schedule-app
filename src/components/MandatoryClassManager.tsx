import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Switch,
  Tag,
  Alert,
  Space,
  Typography,
  message,
  Button,
  Select,
  Divider,
} from "antd";
import { SaveOutlined, ReloadOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { ScheduleService } from "../services/scheduleService";
import { classesApi } from "../services/api";
import type { ClassWithTimeSlot } from "../types";
import type { ColumnsType } from "antd/es/table";
import { GetGradeName } from "@/utils/grades";
import "./MandatoryClassManager.css";

const { Title, Text } = Typography;
const { Option } = Select;

interface MandatoryClassManagerProps {
  onUpdate?: () => void;
}

interface ClassMandatoryStatus extends ClassWithTimeSlot {
  isMandatoryOriginal: boolean;
  isDirty: boolean;
}

const MandatoryClassManager: React.FC<MandatoryClassManagerProps> = ({
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [classes, setClasses] = useState<ClassMandatoryStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const allClasses = await classesApi.getClasses();
      const classesWithStatus: ClassMandatoryStatus[] = allClasses.map(cls => ({
        ...cls,
        isMandatoryOriginal: cls.isMandatory,
        isDirty: false,
      }));
      setClasses(classesWithStatus);
    } catch (error) {
      console.error("Error loading classes:", error);
      message.error(t("mandatoryClassManager.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleMandatoryToggle = (classId: string, isMandatory: boolean) => {
    setClasses(prevClasses =>
      prevClasses.map(cls => {
        if (cls.id === classId) {
          const isDirty = cls.isMandatoryOriginal !== isMandatory;
          return {
            ...cls,
            isMandatory,
            isDirty,
          };
        }
        return cls;
      })
    );

    // Check if there are any unsaved changes
    const hasChanges = classes.some(cls =>
      cls.id === classId ? cls.isMandatoryOriginal !== isMandatory : cls.isDirty
    );
    setHasUnsavedChanges(hasChanges);
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const changedClasses = classes.filter(cls => cls.isDirty);

      for (const cls of changedClasses) {
        await classesApi.updateClass(cls.id, {
          title: cls.title,
          description: cls.description,
          teacher: cls.teacher,
          timeSlotId: cls.timeSlotId,
          grades: cls.grades,
          isMandatory: cls.isMandatory,
        });
      }

      message.success(
        t("mandatoryClassManager.saveSuccess", { count: changedClasses.length })
      );

      // Reset dirty status
      setClasses(prevClasses =>
        prevClasses.map(cls => ({
          ...cls,
          isMandatoryOriginal: cls.isMandatory,
          isDirty: false,
        }))
      );
      setHasUnsavedChanges(false);

      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error("Error saving changes:", error);
      message.error(t("mandatoryClassManager.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleResetChanges = () => {
    setClasses(prevClasses =>
      prevClasses.map(cls => ({
        ...cls,
        isMandatory: cls.isMandatoryOriginal,
        isDirty: false,
      }))
    );
    setHasUnsavedChanges(false);
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const filteredClasses = selectedGrade
    ? classes.filter(cls => cls.grades?.includes(selectedGrade))
    : classes;

  const gradeOptions = Array.from(
    new Set(classes.flatMap(cls => cls.grades || []))
  ).sort((a, b) => a - b);

  const columns: ColumnsType<ClassMandatoryStatus> = [
    {
      title: t("mandatoryClassManager.table.nameColumn"),
      dataIndex: "title",
      key: "title",
      render: (text: string, record: ClassMandatoryStatus) => (
        <Space direction="vertical" size="small">
          <Text
            strong={record.isDirty}
            style={{ color: record.isDirty ? "#1890ff" : undefined }}>
            {text}
          </Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t("mandatoryClassManager.table.teacherColumn"),
      dataIndex: "teacher",
      key: "teacher",
      width: 120,
    },
    {
      title: t("mandatoryClassManager.table.gradeColumn"),
      dataIndex: "grade",
      key: "grade",
      width: 80,
      render: (grade: number) => <Tag color="blue">{GetGradeName(grade)}</Tag>,
    },
    {
      title: t("mandatoryClassManager.table.timeColumn"),
      key: "timeSlot",
      width: 120,
      render: (_, record: ClassMandatoryStatus) => (
        <Space direction="vertical" size="small">
          <Text style={{ fontSize: "12px" }}>
            {ScheduleService.formatTimeRange(
              record.timeSlot.startTime,
              record.timeSlot.endTime
            )}
          </Text>
          <Text type="secondary" style={{ fontSize: "11px" }}>
            {record.timeSlot.name}
          </Text>
        </Space>
      ),
    },
    {
      title: t("mandatoryClassManager.table.mandatoryColumn"),
      key: "mandatory",
      width: 100,
      render: (_, record: ClassMandatoryStatus) => (
        <Space
          direction="vertical"
          size="small"
          style={{ alignItems: "center" }}>
          <Switch
            checked={record.isMandatory}
            onChange={checked => handleMandatoryToggle(record.id, checked)}
            size="small"
          />
          {record.isDirty && (
            <Tag color="orange">{t("mandatoryClassManager.changedTag")}</Tag>
          )}
        </Space>
      ),
    },
  ];

  const mandatoryCount = filteredClasses.filter(cls => cls.isMandatory).length;
  const dirtyCount = filteredClasses.filter(cls => cls.isDirty).length;

  return (
    <Card
      className="mandatory-class-manager"
      title={
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            {t("mandatoryClassManager.title")}
          </Title>
          <ReloadOutlined
            onClick={loadClasses}
            style={{ cursor: "pointer", color: "#1890ff" }}
            title={t("mandatoryClassManager.refreshTitle")}
          />
        </Space>
      }>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {hasUnsavedChanges && (
          <Alert
            message={t("mandatoryClassManager.unsavedChangesTitle")}
            description={t("mandatoryClassManager.unsavedChangesDescription", {
              count: dirtyCount,
            })}
            type="warning"
            showIcon
            action={
              <Space>
                <Button size="small" onClick={handleResetChanges}>
                  {t("mandatoryClassManager.cancelChangesButton")}
                </Button>
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={handleSaveChanges}>
                  {t("common.buttons.saveChanges")}
                </Button>
              </Space>
            }
          />
        )}

        <Space wrap>
          <Text>{t("mandatoryClassManager.gradeFilterLabel")}</Text>
          <Select
            style={{ width: 120 }}
            placeholder={t("mandatoryClassManager.allGradesPlaceholder")}
            value={selectedGrade}
            onChange={setSelectedGrade}
            allowClear>
            {gradeOptions.map(grade => (
              <Option key={grade} value={grade}>
                {GetGradeName(grade)}
              </Option>
            ))}
          </Select>

          <Divider type="vertical" />

          <Text>
            {t("mandatoryClassManager.totalMandatoryClasses")}{" "}
            <Tag color="red">{mandatoryCount}</Tag>
          </Text>

          {selectedGrade && (
            <Text type="secondary">
              {t("mandatoryClassManager.filteredClassesText", {
                count: filteredClasses.length,
                gradeName: GetGradeName(selectedGrade),
              })}
            </Text>
          )}
        </Space>

        <Table<ClassMandatoryStatus>
          columns={columns}
          dataSource={filteredClasses}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          size="small"
          bordered
          scroll={{ x: 800 }}
        />

        {hasUnsavedChanges && (
          <Space style={{ width: "100%", justifyContent: "center" }}>
            <Button onClick={handleResetChanges}>
              {t("mandatoryClassManager.cancelChangesButton")}
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSaveChanges}>
              {t("common.buttons.saveAllChanges", {
                count: dirtyCount,
              })}
            </Button>
          </Space>
        )}
      </Space>
    </Card>
  );
};

export default MandatoryClassManager;
