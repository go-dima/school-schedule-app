import { Space, Tag } from "antd";
import { useTranslation } from "react-i18next";
import type { UserRole } from "../types";
import { ROLE_TAG_COLORS } from "../constants/roleColors";
import "./RoleTagPicker.css";

interface RoleTagPickerProps {
  roles: UserRole[];
  selected: UserRole[];
  onToggle: (role: UserRole, checked: boolean) => void;
}

// Clickable role tags colored the same as the read-only role Tags shown
// elsewhere (e.g. the user-management table), so picking a role and seeing
// it applied use one consistent color scheme.
export function RoleTagPicker({
  roles,
  selected,
  onToggle,
}: RoleTagPickerProps) {
  const { t } = useTranslation();

  return (
    <Space wrap>
      {roles.map(role => {
        const checked = selected.includes(role);
        return (
          <Tag
            key={role}
            color={ROLE_TAG_COLORS[role]}
            onClick={() => onToggle(role, !checked)}
            className={`role-picker-tag${checked ? " role-picker-tag-checked" : ""}`}>
            {t(`roles.${role}`, role)}
          </Tag>
        );
      })}
    </Space>
  );
}
