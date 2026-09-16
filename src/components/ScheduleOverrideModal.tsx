import React from "react";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import ScheduleOverrideForm from "./ScheduleOverrideForm";
import type { ScheduleOverrideFormValues } from "./ScheduleOverrideForm";
import type { ScheduleOverrideWithTimeSlot, TimeSlot } from "../types";

interface ScheduleOverrideModalProps {
  open: boolean;
  editingOverride: ScheduleOverrideWithTimeSlot | null;
  overrideDay: number | null;
  overrideTimeSlotId: string | null;
  childId: string | undefined;
  timeSlots: TimeSlot[];
  loading: boolean;
  onSubmit: (values: ScheduleOverrideFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete: () => Promise<void>;
}

// Owns the create/edit modal for a child's schedule overrides -- kept next
// to OverrideCard/ScheduleOverrideForm rather than inline in SchedulePage,
// since all three are the same isolated override flow. Builds the form's
// initialValues (a blank draft pre-filled from the clicked cell, or the
// override being edited) so SchedulePage only needs to track which cell/
// override triggered the modal.
export const ScheduleOverrideModal: React.FC<ScheduleOverrideModalProps> = ({
  open,
  editingOverride,
  overrideDay,
  overrideTimeSlotId,
  childId,
  timeSlots,
  loading,
  onSubmit,
  onCancel,
  onDelete,
}) => {
  const { t } = useTranslation();

  const canRenderForm =
    overrideTimeSlotId !== null && overrideDay !== null && timeSlots.length > 0;

  const initialValues: ScheduleOverrideWithTimeSlot | null =
    editingOverride ??
    (canRenderForm
      ? {
          id: "",
          childId: childId || "",
          title: "",
          teacher: "",
          room: "",
          dayOfWeek: overrideDay as number,
          timeSlotId: overrideTimeSlotId as string,
          scope: "prod",
          createdBy: "",
          createdAt: "",
          updatedAt: "",
          timeSlot: timeSlots.find(
            slot => slot.id === overrideTimeSlotId
          ) as TimeSlot,
        }
      : null);

  return (
    <Modal
      title={
        editingOverride
          ? t("schedule.override.editModalTitle")
          : t("schedule.override.createModalTitle")
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={480}
      destroyOnHidden>
      {canRenderForm && initialValues && (
        <ScheduleOverrideForm
          initialValues={initialValues}
          timeSlots={timeSlots}
          onSubmit={onSubmit}
          onCancel={onCancel}
          onDelete={editingOverride ? onDelete : undefined}
          loading={loading}
          isEdit={!!editingOverride}
        />
      )}
    </Modal>
  );
};
