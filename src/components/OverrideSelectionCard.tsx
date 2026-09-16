import React from "react";
import { Button, Card, Modal, Typography } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { ScheduleOverrideWithTimeSlot } from "../types";
import "./ClassSelectionDrawer.css";

const { Title, Text } = Typography;

interface OverrideSelectionCardProps {
  override: ScheduleOverrideWithTimeSlot;
  onEdit?: (override: ScheduleOverrideWithTimeSlot) => void;
  onDelete?: (override: ScheduleOverrideWithTimeSlot) => void;
}

// Shown at the top of ClassSelectionDrawer for the clicked slot's override,
// ahead of any catalog classes -- a staff override always takes precedence
// over whatever is/was selected there (see ScheduleTable's cellOverrides
// short-circuit), so it's presented first here too. Deleting it here does
// not touch the underlying schedule_selections row: whatever was selected
// in this slot before the override existed becomes visible again once it's
// gone. The card body opens the same edit modal the grid card used to open
// directly; the delete button stops that click from bubbling so it can
// remove the override without leaving the drawer.
export const OverrideSelectionCard: React.FC<OverrideSelectionCardProps> = ({
  override,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();

  const handleDeleteClick: React.MouseEventHandler = e => {
    e.stopPropagation();
    if (!onDelete) return;
    Modal.confirm({
      title: t("schedule.override.deleteConfirmTitle"),
      content: t("schedule.override.deleteConfirmDescription"),
      okText: t("schedule.override.confirmDelete"),
      cancelText: t("schedule.override.confirmCancel"),
      okButtonProps: { danger: true },
      onOk: () => onDelete(override),
    });
  };

  return (
    <Card
      size="small"
      className="class-selection-card override-selection-card"
      hoverable={!!onEdit}
      onClick={onEdit ? () => onEdit(override) : undefined}>
      <div className="class-card-content">
        <div className="class-card-body">
          <div className="class-main">
            <Title level={5} className="class-title">
              {override.title}{" "}
              <Text className="class-teacher">({override.teacher})</Text>
            </Title>
            {override.room && (
              <div className="class-details class-details-inline">
                <span>
                  <Text strong>{t("schedule.drawer.roomLabel")}</Text>{" "}
                  <Text>{override.room}</Text>
                </span>
              </div>
            )}
          </div>
        </div>
        {onDelete && (
          <div className="override-selection-footer">
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={handleDeleteClick}>
              {t("schedule.override.deleteButton")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
