import { Tag } from "antd";
import { useTranslation } from "react-i18next";
import type { Scope } from "../types";
import { SCOPE_TAG_COLORS } from "../constants/scopes";

// Read-only scope label, colored the same everywhere a scope is shown or
// picked (ScopeSelect, ScopeFilter).
export function ScopeTag({ scope }: { scope: Scope }) {
  const { t } = useTranslation();
  return <Tag color={SCOPE_TAG_COLORS[scope]}>{t(`scope.${scope}`)}</Tag>;
}
