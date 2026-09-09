import React, { useEffect, useRef, useState } from "react";
import { Drawer, Typography, Tag, Empty, Alert, Spin, List } from "antd";
import { useTranslation } from "react-i18next";
import { scheduleApi } from "../services/api";
import type { ClassWithTimeSlot, Child } from "../types";
import { GradesRangeTag } from "@/elements/GradesRangeTag";
import { GetGradeName } from "@/utils/grades";

const { Title, Text } = Typography;

interface ClassEnrollmentDrawerProps {
  open: boolean;
  onClose: () => void;
  classInfo: ClassWithTimeSlot | null;
}

const ClassEnrollmentDrawer: React.FC<ClassEnrollmentDrawerProps> = ({
  open,
  onClose,
  classInfo,
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
  }, [open, classInfo?.id, t]);

  return (
    <Drawer
      title={
        classInfo && (
          <div className="drawer-title">
            <Title level={4} style={{ margin: 0 }}>
              {classInfo.title}
            </Title>
            <div className="time-slot-info">
              <Tag color="blue">{classInfo.teacher}</Tag>
              <GradesRangeTag grades={classInfo.grades} color="green" />
            </div>
          </div>
        )
      }
      placement="left"
      width={400}
      onClose={onClose}
      open={open}
      className="class-enrollment-drawer rtl-drawer"
      styles={{ body: { padding: "16px" } }}>
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
