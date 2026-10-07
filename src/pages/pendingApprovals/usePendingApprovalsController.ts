import { useEffect, useState } from "react";
import { Form, message } from "antd";
import type { FormInstance } from "antd";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { childrenApi, usersApi } from "../../services/api";
import type { Child, PendingApproval, Scope, UserRole } from "../../types";
import {
  EMPTY_CHILD_LINK_DRAFT,
  childLinkValue,
  type ChildLinkDraft,
} from "../../components/childAccountLink";
import { trackEvent, AnalyticsEvent } from "../../utils/analytics";
import { isTestScopeEnabled } from "../../utils/env";

export interface ApprovalFormValues {
  role: UserRole;
  // Only present when the scope field is shown (non-prod); new users are
  // always approved as "prod" otherwise.
  scope?: Scope;
}

// State of the approve-with-role form (desktop modal / mobile bottom sheet).
export interface ApprovalFormController {
  selectedApproval: PendingApproval | null;
  open: boolean;
  form: FormInstance<ApprovalFormValues>;
  // A child account must be linked to a student record at approval.
  needsChildLink: boolean;
  childLink: ChildLinkDraft;
  setChildLink: (draft: ChildLinkDraft) => void;
  childLinkComplete: boolean;
  unlinkedStudents: Child[];
  unlinkedLoading: boolean;
  canChooseScope: boolean;
  submitting: boolean;
  close: () => void;
  confirm: (values: ApprovalFormValues) => Promise<void>;
}

export interface PendingApprovalsController {
  canApproveSignups: boolean;
  pendingApprovals: PendingApproval[];
  loading: boolean;
  // True only until the first load resolves. Gates the full-page spinner;
  // subsequent reloads (refresh, after approve/reject) use `loading` so the
  // page shows a local overlay instead of unmounting.
  initialLoading: boolean;
  error: string | null;
  actionLoading: string | null;
  lastRefresh: Date | null;
  loadData: () => Promise<void>;
  startApproval: (approval: PendingApproval) => void;
  reject: (approval: PendingApproval) => Promise<void>;
  approvalForm: ApprovalFormController;
}

// Data, state and actions of the Pending Approvals page, shared by its
// desktop and mobile views so approval rules live in one place.
export function usePendingApprovalsController(): PendingApprovalsController {
  const { t } = useTranslation();
  const { permissions } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [selectedApproval, setSelectedApproval] =
    useState<PendingApproval | null>(null);
  const [form] = Form.useForm<ApprovalFormValues>();
  const chosenRole = Form.useWatch<UserRole | undefined>("role", form);
  const [childLink, setChildLink] = useState<ChildLinkDraft>(
    EMPTY_CHILD_LINK_DRAFT
  );
  const [unlinkedStudents, setUnlinkedStudents] = useState<Child[]>([]);
  const [unlinkedLoading, setUnlinkedLoading] = useState(false);
  const needsChildLink = chosenRole === "child";
  const childLinkComplete = childLinkValue(childLink) !== undefined;
  // Admin-only (this page is admin-gated) and never in production.
  const canChooseScope = permissions.canApproveSignups && isTestScopeEnabled();

  useEffect(() => {
    if (!roleModalVisible || !needsChildLink) return;
    let cancelled = false;
    setUnlinkedLoading(true);
    childrenApi
      .getUnlinkedChildren()
      .then(students => {
        if (!cancelled) setUnlinkedStudents(students);
      })
      .catch(err => {
        if (!cancelled) {
          message.error(
            err instanceof Error
              ? err.message
              : t("pendingApprovals.childLink.loadError")
          );
        }
      })
      .finally(() => {
        if (!cancelled) setUnlinkedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roleModalVisible, needsChildLink, t]);

  const closeRoleModal = () => {
    setRoleModalVisible(false);
    setSelectedApproval(null);
    setChildLink(EMPTY_CHILD_LINK_DRAFT);
    form.resetFields();
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await usersApi.getPendingApprovalsWithUsers();
      setPendingApprovals(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("pendingApprovals.page.loadErrorFallback")
      );
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const startApproval = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    // Default to the requested role; new users are always "prod" by default.
    form.setFieldsValue({ role: approval.role, scope: "prod" });
    setRoleModalVisible(true);
  };

  const confirm = async (values: ApprovalFormValues) => {
    if (!selectedApproval) return;

    const link = childLinkValue(childLink);
    if (values.role === "child" && !link) return;

    setActionLoading(selectedApproval.id);
    try {
      // Set the scope first: if it fails, nothing has been approved yet and
      // the admin can simply retry.
      if (canChooseScope && values.scope === "test") {
        await usersApi.adminSetUserScope(selectedApproval.userId, "test");
      }
      if (values.role === "child" && link) {
        await usersApi.approveChildUser(selectedApproval.userId, link);
      } else {
        await usersApi.approveUserWithRole(
          selectedApproval.userId,
          values.role
        );
      }
      message.success(
        t("pendingApprovals.page.approveSuccess", {
          email: selectedApproval.user.email,
          role: t(`roles.${values.role}`, values.role),
        })
      );
      trackEvent(AnalyticsEvent.SignupApproved, { role: values.role });
      await loadData();
      closeRoleModal();
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("pendingApprovals.page.approveError")
      );
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async (approval: PendingApproval) => {
    const { id, role } = approval;
    setActionLoading(id);
    try {
      await usersApi.rejectRole(id);
      message.success(
        t("pendingApprovals.page.rejectSuccess", {
          role: t(`roles.${role}`, role),
          email: approval.user.email,
        })
      );
      trackEvent(AnalyticsEvent.SignupRejected, { role });
      await loadData();
    } catch (err) {
      message.error(
        err instanceof Error
          ? err.message
          : t("pendingApprovals.page.rejectError")
      );
    } finally {
      setActionLoading(null);
    }
  };

  return {
    canApproveSignups: permissions.canApproveSignups,
    pendingApprovals,
    loading,
    initialLoading,
    error,
    actionLoading,
    lastRefresh,
    loadData,
    startApproval,
    reject,
    approvalForm: {
      selectedApproval,
      open: roleModalVisible,
      form,
      needsChildLink,
      childLink,
      setChildLink,
      childLinkComplete,
      unlinkedStudents,
      unlinkedLoading,
      canChooseScope,
      submitting:
        selectedApproval !== null && actionLoading === selectedApproval.id,
      close: closeRoleModal,
      confirm,
    },
  };
}

export function formatApprovalDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
