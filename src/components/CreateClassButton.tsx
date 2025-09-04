import React from "react";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";

interface CreateClassButtonProps {
  onCreateClass: (timeSlotId: string, dayOfWeek: number) => void;
  timeSlotId: string;
  dayOfWeek: number;
  variant?: "full" | "simple";
  style?: React.CSSProperties;
}

const CreateClassButton: React.FC<CreateClassButtonProps> = ({
  onCreateClass,
  timeSlotId,
  dayOfWeek,
  style,
}) => {
  const handleClick = () => {
    onCreateClass(timeSlotId, dayOfWeek);
  };
  return (
    <div className="create-class-section">
      <Button
        block
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleClick}
        style={{ height: "auto", padding: "12px 0", ...style }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 500 }}>צור שיעור חדש</div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: 4 }}>
            הוסף שיעור חדש לזמן זה
          </div>
        </div>
      </Button>
    </div>
  );
};

export default CreateClassButton;
