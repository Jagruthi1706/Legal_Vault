import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';
import { AppLayout } from '../components/layout/AppLayout';

// Public Pages
import { LandingPage } from '../pages/public/LandingPage';
import { FeaturesPage } from '../pages/public/FeaturesPage';
import { AboutPage } from '../pages/public/AboutPage';
import { ContactPage } from '../pages/public/ContactPage';
import { DocumentationPage } from '../pages/public/DocumentationPage';
import { LoginPage } from '../pages/public/LoginPage';
import { OAuthCallbackPage } from '../pages/public/OAuthCallbackPage';
import { RegisterPage } from '../pages/public/RegisterPage';
import { ForgotPasswordPage } from '../pages/public/ForgotPasswordPage';
import RoleSelectionPage from '../pages/public/RoleSelectionPage';
import { PrivacyPolicyPage } from '../pages/public/PrivacyPolicyPage';
import { TermsPage } from '../pages/public/TermsPage';

// App Pages
import { DashboardPage } from '../pages/app/DashboardPage';
import { CasesPage } from '../pages/app/CasesPage';
import { CaseWorkspacePage } from '../pages/app/CaseWorkspacePage';
import { DocumentsPage } from '../pages/app/DocumentsPage';
import { DocumentViewerPage } from '../pages/app/DocumentViewerPage';
import { LegalResearchPage } from '../pages/app/LegalResearchPage';
import { AICopilotPage } from '../pages/app/AICopilotPage';
import { BlockchainPage } from '../pages/app/BlockchainPage';
import { BlockchainLogsPage } from '../pages/app/BlockchainLogsPage';
import { AnalyticsPage } from '../pages/app/AnalyticsPage';
import { NotificationsPage } from '../pages/app/NotificationsPage';
import { SettingsPage } from '../pages/app/SettingsPage';
import { CalendarPage } from '../pages/app/CalendarPage';
import { UsersPage } from '../pages/app/UsersPage';
import { RolesPage } from '../pages/app/RolesPage';
import { AIMonitoringPage } from '../pages/app/AIMonitoringPage';
import { DraftGeneratorPage } from '../pages/app/DraftGeneratorPage';
import { EvidenceUploadPage } from '../pages/app/EvidenceUploadPage';
import { JudgmentDraftPage } from '../pages/app/JudgmentDraftPage';
import { useAuth } from '../contexts/AuthContext';
import { can, hasRole, type Permission } from '../utils/permissions';
import type { UserRole } from '../types';

const ProtectedAppRoute: React.FC = () => {
  const { isAuthenticated, isLoading, role } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return role === 'invalid' ? <Navigate to="/app/forbidden" replace /> : <AppLayout />;
};

const PermissionRoute: React.FC<{ permission: Permission; children: React.ReactNode }> = ({ permission, children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return can(user, permission) ? <>{children}</> : <Navigate to="/app/forbidden" replace />;
};

const RoleRoute: React.FC<{ roles: Exclude<UserRole, 'invalid'>[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return hasRole(user, ...roles) ? <>{children}</> : <Navigate to="/app/forbidden" replace />;
};

const ForbiddenPage: React.FC = () => (
  <div className="mx-auto max-w-xl space-y-2 p-8 text-center">
    <h1 className="text-xl font-extrabold font-heading">Access restricted</h1>
    <p className="text-xs text-foreground-muted">Your authenticated role is not authorized for this workspace.</p>
  </div>
);

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes Shell */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/documentation" element={<DocumentationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/role-selection" element={<RoleSelectionPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Route>

      {/* Internal Application Routes Shell */}
      <Route path="/app" element={<ProtectedAppRoute />}>
        <Route index element={<DashboardPage />} />
        {/* Legal research is a read-only shared knowledge base: lawyers and
            judges both perform research; the backend enforces the same pair. */}
        <Route path="research" element={<RoleRoute roles={['lawyer', 'judge']}><LegalResearchPage /></RoleRoute>} />
        <Route path="client" element={<RoleRoute roles={['client']}><DashboardPage /></RoleRoute>} />
        <Route path="lawyer" element={<RoleRoute roles={['lawyer']}><DashboardPage /></RoleRoute>} />
        <Route path="judge" element={<RoleRoute roles={['judge']}><DashboardPage /></RoleRoute>} />
        <Route path="admin" element={<RoleRoute roles={['admin']}><DashboardPage /></RoleRoute>} />
        <Route path="forbidden" element={<ForbiddenPage />} />
        <Route path="cases" element={<CasesPage />} />
        <Route path="cases/:caseId" element={<CaseWorkspacePage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="documents/:docId" element={<DocumentViewerPage />} />
        <Route path="research" element={<RoleRoute roles={['lawyer', 'judge']}><LegalResearchPage /></RoleRoute>} />
        <Route path="copilot" element={<RoleRoute roles={['client', 'lawyer', 'judge']}><AICopilotPage /></RoleRoute>} />
        <Route path="ai-copilot" element={<RoleRoute roles={['client', 'lawyer', 'judge']}><AICopilotPage /></RoleRoute>} />
        <Route path="blockchain" element={<BlockchainPage />} />
        <Route path="blockchain/logs" element={<BlockchainLogsPage />} />
        <Route path="blockchain-logs" element={<BlockchainLogsPage />} />
        <Route path="analytics" element={<RoleRoute roles={['lawyer', 'judge', 'admin']}><AnalyticsPage /></RoleRoute>} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="users" element={<PermissionRoute permission="manageUsers"><UsersPage /></PermissionRoute>} />
        <Route path="roles" element={<RoleRoute roles={['admin']}><RolesPage /></RoleRoute>} />
        <Route path="ai-monitoring" element={<RoleRoute roles={['admin']}><AIMonitoringPage /></RoleRoute>} />
        <Route path="drafts/generate" element={<RoleRoute roles={['lawyer']}><DraftGeneratorPage /></RoleRoute>} />
        <Route path="draft-generator" element={<RoleRoute roles={['lawyer']}><DraftGeneratorPage /></RoleRoute>} />
        <Route path="evidence/upload" element={<RoleRoute roles={['client', 'lawyer']}><EvidenceUploadPage /></RoleRoute>} />
        <Route path="evidence" element={<RoleRoute roles={['client', 'lawyer']}><EvidenceUploadPage /></RoleRoute>} />
        <Route path="judgment/draft" element={<RoleRoute roles={['judge']}><JudgmentDraftPage /></RoleRoute>} />
        <Route path="judgment-draft" element={<RoleRoute roles={['judge']}><JudgmentDraftPage /></RoleRoute>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
