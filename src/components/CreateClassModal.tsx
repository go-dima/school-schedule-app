import React from "react";
import { Modal } from "antd";
import { useTranslation } from "react-i18next";
import ClassForm from "./ClassForm";
import type { Class, TimeSlot } from "../types";

interface CreateClassModalProps {
  open: boolean;
  timeSlotId: string | null;
  dayOfWeek: number | null;
  timeSlots: TimeSlot[];
  loading: boolean;
  onSubmit: (
    classData: Omit<Class, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  onCancel: () => void;
}

// Owns the admin-only "create a new catalog class" modal -- kept next to
// ClassForm rather than inline in SchedulePage. Builds the form's blank
// initialValues (pre-filled from the clicked cell) so SchedulePage only
// needs to track which cell triggered it.
export const CreateClassModal: React.FC<CreateClassModalProps> = ({
  open,
  timeSlotId,
  dayOfWeek,
  timeSlots,
  loading,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();

  const selectedTimeSlot = timeSlots.find(slot => slot.id === timeSlotId);
  const canRenderForm =
    timeSlotId !== null && dayOfWeek !== null && !!selectedTimeSlot;

  return (
    <Modal
      title={t("schedule.page.createNewClassModal")}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnHidden>
      {canRenderForm && (
        <ClassForm
          initialValues={{
            slots: [
              {
                dayOfWeek: dayOfWeek as number,
                timeSlotId: timeSlotId as string,
                timeSlot: selectedTimeSlot as TimeSlot,
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
            scope: "test",
            id: timeSlotId as string,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          timeSlots={timeSlots}
          onSubmit={onSubmit}
          onCancel={onCancel}
          loading={loading}
          isNewLesson={true}
        />
      )}
    </Modal>
  );
};
