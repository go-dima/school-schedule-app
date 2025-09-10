import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ChildProvider } from "./contexts/ChildContext";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import ProfileSetupPage from "./pages/ProfileSetupPage";
import SchedulePage from "./pages/SchedulePage";
import ClassManagementPage from "./pages/ClassManagementPage";
import PendingApprovalsPage from "./pages/PendingApprovalsPage";
import UserManagementPage from "./pages/UserManagementPage";
import UserListPage from "./pages/UserListPage";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import SharedChildPage from "./pages/SharedChildPage";
import AppLayout from "./layouts/AppLayout";
import { Spin } from "antd";
import "./App.css";

type Page =
  | "schedule"
  | "class-management"
  | "pending-approvals"
  | "user-management"
  | "user-list"
  | "profile-settings";

function AppContent() {
  const { user, userRoles, loading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>("schedule");
  const [sharedChildToken, setSharedChildToken] = useState<string | null>(null);

  // Simple routing based on URL path
  useEffect(() => {
    const path = window.location.pathname;
    const sharedChildMatch = path.match(/^\/shared-child\/(.+)$/);

    if (sharedChildMatch) {
      setSharedChildToken(sharedChildMatch[1]);
    }
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}>
        <Spin size="large" />
      </div>
    );
  }

  // Handle shared child page
  if (sharedChildToken) {
    return <SharedChildPage token={sharedChildToken} />;
  }

  if (!user) {
    if (showSignup) {
      return <SignupPage onSwitchToLogin={() => setShowSignup(false)} />;
    }
    return <LoginPage onSwitchToSignup={() => setShowSignup(true)} />;
  }

  // If user is authenticated but hasn't completed profile setup, show profile setup page first
  if (user && (!user.firstName || !user.lastName)) {
    return <ProfileSetupPage />;
  }

  // If user has profile but no approved roles, show pending approval page
  if (user && userRoles.length === 0) {
    return <PendingApprovalPage />;
  }

  // Render current page with AppLayout wrapper
  const renderPage = () => {
    switch (currentPage) {
      case "class-management":
        return <ClassManagementPage />;
      case "pending-approvals":
        return <PendingApprovalsPage />;
      case "user-management":
        return <UserManagementPage />;
      case "user-list":
        return <UserListPage />;
      case "profile-settings":
        return <ProfileSettingsPage />;
      default:
        return <SchedulePage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <AppLayout onNavigate={setCurrentPage} currentPage={currentPage}>
      {renderPage()}
    </AppLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <ChildProvider>
        <AppContent />
      </ChildProvider>
    </AuthProvider>
  );
}

export default App;
