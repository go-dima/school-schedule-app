import { useState, type ReactNode } from "react";
import { Button, Modal } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { ChildForm } from "./ChildForm";
import { useChildContext } from "../contexts/ChildContext";
import type { Child } from "../types";

interface AddChildButtonProps {
  onAdded?: (child: Child) => void;
  renderTrigger?: (open: () => void) => ReactNode;
}

export function AddChildButton({
  onAdded,
  renderTrigger,
}: AddChildButtonProps) {
  const { t } = useTranslation();
  const { createChild } = useChildContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const openModal = () => setIsModalOpen(true);

  const handleSubmit = async (data: {
    firstName: string;
    lastName: string;
    grade: number;
    groupNumber: number | null;
  }) => {
    setLoading(true);
    try {
      const newChild = await createChild(
        data.firstName,
        data.lastName,
        data.grade,
        data.groupNumber
      );
      setIsModalOpen(false);
      onAdded?.(newChild);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openModal)
      ) : (
        <Button icon={<PlusOutlined />} onClick={openModal}>
          {t("schedule.page.addChildButton")}
        </Button>
      )}
      <Modal
        title={t("child.management.addModalTitle")}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnHidden>
        <ChildForm
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          loading={loading}
          showScope={false}
        />
      </Modal>
    </>
  );
}
