import React from "react";
import { Form, Select, type SelectProps } from "antd";
import { useTranslation } from "react-i18next";
import type { Scope } from "../types";
import { ALL_SCOPES, SCOPE_TAG_COLORS } from "../constants/scopes";
import { isTestScopeEnabled } from "../utils/env";
import { ScopeTag } from "./ScopeTag";
import { ToggleFilterGroup } from "./ToggleFilterGroup";

type ScopeSelectProps = Omit<
  SelectProps<Scope>,
  "options" | "children" | "mode"
>;

// Single-scope picker whose options are the colored ScopeTags. Use it bare
// (e.g. inline in a table row) or through ScopeSelector inside a form.
export function ScopeSelect(props: ScopeSelectProps) {
  return (
    <Select<Scope>
      {...props}
      options={ALL_SCOPES.map(scope => ({
        value: scope,
        label: <ScopeTag scope={scope} />,
      }))}
    />
  );
}

interface ScopeSelectorProps {
  value?: Scope;
  onChange?: (scope: Scope) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Help text under the field. */
  extra?: React.ReactNode;
}

// The form field for an entity's scope (bound to the form's `scope` name).
// Renders nothing when test data is disabled in this environment.
export function ScopeSelector({
  value = "prod",
  onChange,
  placeholder,
  disabled = false,
  extra,
}: ScopeSelectorProps) {
  const { t } = useTranslation();

  if (!isTestScopeEnabled()) {
    return null;
  }

  return (
    <Form.Item label={t("scope.selector.label")} name="scope" extra={extra}>
      <ScopeSelect
        value={value}
        onChange={onChange}
        placeholder={placeholder || t("scope.selector.placeholder")}
        disabled={disabled}
        style={{ width: "100%" }}
      />
    </Form.Item>
  );
}

interface ScopeFilterProps {
  value: Scope[];
  onChange: (value: Scope[]) => void;
}

// List-page filter: one colored toggle per scope. Renders nothing when test
// data is disabled in this environment; callers add their own role checks.
export function ScopeFilter({ value, onChange }: ScopeFilterProps) {
  const { t } = useTranslation();

  if (!isTestScopeEnabled()) {
    return null;
  }

  return (
    <ToggleFilterGroup<Scope>
      value={value}
      onChange={onChange}
      options={ALL_SCOPES.map(scope => ({
        value: scope,
        label: t(`scope.${scope}`),
        color: SCOPE_TAG_COLORS[scope],
      }))}
      doubleClickToIsolate={false}
    />
  );
}
