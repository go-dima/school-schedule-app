import { useState } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import SchedulePage from "./pages/SchedulePage";
import ClassManagementPage from "./pages/ClassManagementPage";
import PendingApprovalsPage from "./pages/PendingApprovalsPage";
import UserManagementPage from "./pages/UserManagementPage";
import { Spin } from "antd";
import "./App.css";

type Page =
  | "schedule"
  | "class-management"
  | "pending-approvals"
  | "user-management";

function AppContent() {
  const { user, loading } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>("schedule");

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

  if (!user) {
    if (showSignup) {
      return <SignupPage onSwitchToLogin={() => setShowSignup(false)} />;
    }
    return <LoginPage onSwitchToSignup={() => setShowSignup(true)} />;
  }

  // Render current page
  switch (currentPage) {
    case "class-management":
      return <ClassManagementPage onNavigate={setCurrentPage} />;
    case "pending-approvals":
      return <PendingApprovalsPage onNavigate={setCurrentPage} />;
    case "user-management":
      return <UserManagementPage onNavigate={setCurrentPage} />;
    default:
      return <SchedulePage onNavigate={setCurrentPage} />;
  }
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
