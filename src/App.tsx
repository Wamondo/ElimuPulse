import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { LearnersAndParentsView } from './components/LearnersAndParentsView';
import { TuitionFeesView } from './components/TuitionFeesView';
import { AutomatedRemindersView } from './components/AutomatedRemindersView';
import { ScoreCardsView } from './components/ScoreCardsView';
import { AttendanceRegisterView } from './components/AttendanceRegisterView';
import { MonthlyReportsView } from './components/MonthlyReportsView';
import { SchoolAcademicSetupView } from './components/SchoolAcademicSetupView';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { EnrollLearnerModal } from './components/EnrollLearnerModal';
import { SecurityModal, AuditLogModal } from './components/SecurityModals';
import { OfficialProductionCenterModal } from './components/OfficialProductionCenterModal';
import { LoginScreen } from './components/LoginScreen';
import { LearnerLearningAreasView } from './components/LearnerLearningAreasView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ShieldCheck, Lock, User, RefreshCw, KeyRound, LogOut, Database, Sparkles } from 'lucide-react';

const MainLayout: React.FC = () => {
  const {
    currentUser,
    resetToDefault,
    isAuthenticated,
    isOwner,
    logout,
    schoolProfile,
    isCloudConnected,
    isCloudLoaded,
    isSyncingToCloud,
    syncAllDataToFirestore,
    firestoreDbId,
    currentSchoolId,
    teachers,
    learners,
    parents,
    grades,
    restoreRegistrySnapshot,
  } = useApp();

  const isOwnerAccountActive = Boolean(
    isOwner && (!currentUser?.ownerDesignation || currentUser?.ownerDesignation === 'owner')
  );

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isProductionCenterOpen, setIsProductionCenterOpen] = useState(false);
  const [isStaffApprovalsOpen, setIsStaffApprovalsOpen] = useState(false);
  const [targetLearnerId, setTargetLearnerId] = useState<string | undefined>(undefined);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [isRestoringSnapshot, setIsRestoringSnapshot] = useState<boolean>(false);

  const handleDownloadBackupJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      schoolId: currentSchoolId || 'sch-001',
      teachers,
      learners,
      parents,
      grades,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elimupulse-registry-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupNotice(
      `Downloaded backup (${teachers.length} teachers, ${learners.length} learners, ${parents.length} parents).`
    );
  };

  const handleRestoreFromRtdbOrLocal = async () => {
    setIsRestoringSnapshot(true);
    try {
      const schoolKey = currentSchoolId || 'sch-001';
      let snap = await get(ref(rtdb, `schools/${schoolKey}/backups/latestSnapshot`));
      if (!snap.exists() && schoolKey !== 'sch-001') {
        snap = await get(ref(rtdb, 'schools/sch-001/backups/latestSnapshot'));
      }
      let data = snap.exists() ? snap.val() : null;
      if (!data) {
        const localRaw = localStorage.getItem('academias_safe_registry_backup_v1');
        if (localRaw) data = JSON.parse(localRaw);
      }
      if (!data) {
        setBackupNotice('No saved snapshot found yet in RTDB or local backup.');
        return;
      }
      const res = restoreRegistrySnapshot(data);
      setBackupNotice(
        `Restored snapshot (${res.teachersCount} teachers, ${res.learnersCount} learners, ${res.parentsCount} parents).`
      );
    } catch {
      setBackupNotice('Could not restore snapshot right now. Please try again.');
    } finally {
      setIsRestoringSnapshot(false);
    }
  };

  const handleRestoreFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = restoreRegistrySnapshot(parsed);
      setBackupNotice(
        `Restored from file (${res.teachersCount} teachers, ${res.learnersCount} learners, ${res.parentsCount} parents).`
      );
    } catch {
      setBackupNotice('Invalid backup JSON file selected.');
    } finally {
      e.target.value = '';
    }
  };

  // If user is not authenticated, display the Login Screen
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setActiveTab('dashboard')} />;
  }

  if (currentUser?.role === 'learner') {
    return <LearnerLearningAreasView />;
  }

  const handleOpenRecordPayment = (learnerId?: string) => {
    setTargetLearnerId(learnerId);
    setIsRecordPaymentOpen(true);
  };

  const handleNavigateToFees = (learnerId: string) => {
    setTargetLearnerId(learnerId);
    setActiveTab('fees');
  };

  const handleNavigateToScorecard = (learnerId: string) => {
    setTargetLearnerId(learnerId);
    setActiveTab('scorecards');
  };

  const handleNavigateToAttendance = (learnerId: string) => {
    setTargetLearnerId(learnerId);
    setActiveTab('attendance');
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-slate-50 text-slate-900">
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuditLog={() => setIsAuditLogOpen(true)}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onOpenProductionCenter={() => setIsProductionCenterOpen(true)}
      />

      {/* Role Notice & Security Breadcrumb (Visible exclusively to the Owner Account) */}
      {isOwnerAccountActive && (
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600 flex-wrap">
              <span className="font-semibold text-slate-900">Active Login:</span>
              <span className="capitalize font-mono px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-800">
                {currentUser?.role?.toUpperCase() || ''}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-900 font-semibold">{currentUser?.name || ''}</span>
              <span className="inline-flex items-center gap-1.5 text-amber-900 font-bold bg-amber-100 px-2 py-0.5 rounded border border-amber-300 font-mono text-[11px]">
                <span>👑 App Owner</span>
                <span className="text-amber-400">·</span>
                <span className="text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-300">📱 1-Phone Locked</span>
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Install PWA Button */}
              <PWAInstallButton variant="compact" />

              {/* Live System Production Badge */}
              <button
                onClick={() => setIsProductionCenterOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer shadow-xs"
                title={`Application Launch Status: Fully Operational in Production (${schoolProfile?.name || 'Comprehensive School'})`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>🚀 Production: Live &amp; Operational</span>
              </button>
              <span className="text-slate-300">|</span>

              {/* Live Firestore Connection Badge */}
              <button
                onClick={() => syncAllDataToFirestore()}
                disabled={isSyncingToCloud}
                title={`Live Firestore Database (${firestoreDbId}). Fully persistent cloud storage. Click to manually re-sync.`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors cursor-pointer ${
                  isCloudConnected
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-xs'
                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-xs'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isCloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <Database className={`w-3 h-3 ${isCloudConnected ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span>
                  {isSyncingToCloud
                    ? 'Syncing Cloud...'
                    : isCloudConnected
                    ? isCloudLoaded
                      ? 'Firestore: Live & Synced'
                      : 'Firestore: Connected'
                    : 'Cloud DB: Connecting'}
                </span>
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => setIsSecurityModalOpen(true)}
                className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-700 transition-colors cursor-pointer"
              >
                <Lock className="w-3 h-3 text-slate-500" />
                <span>AES-256 Storage Protected</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* School, Department & Title Header (Visible to Teachers) */}
      {currentUser?.role === 'teacher' && (() => {
        const matchedRegTeacher = (teachers || []).find(
          (t) =>
            (currentUser.teacherId && t.id === currentUser.teacherId) ||
            (currentUser.email && t.email && t.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            (currentUser.phone && t.phone && t.phone.replace(/[^0-9]/g, '').slice(-9) === currentUser.phone.replace(/[^0-9]/g, '').slice(-9))
        );
        const teacherDept =
          matchedRegTeacher?.department ||
          (matchedRegTeacher?.registeredSubjects && matchedRegTeacher.registeredSubjects[0]) ||
          (currentUser?.registeredSubjects && currentUser.registeredSubjects[0]) ||
          'Teaching Staff';
        const isClassTeacher =
          matchedRegTeacher?.teacherType === 'class_teacher' ||
          currentUser?.teacherType === 'class_teacher';
        const assignedGrade = matchedRegTeacher?.assignedGrade || currentUser?.teacherGrade || '';
        const teacherTitle = isClassTeacher
          ? `Class Teacher${assignedGrade ? ` · ${assignedGrade}` : ''}`
          : 'Subject Teacher';

        return (
          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-2.5">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-slate-900 text-sm">
                  {schoolProfile?.name || 'Comprehensive School'}
                </span>
                <span className="text-slate-300">|</span>
                <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Department: {teacherDept}
                </span>
                <span className="text-slate-300">|</span>
                <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {teacherTitle}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {schoolProfile?.primaryWingName || 'Primary Wing'} &amp; {schoolProfile?.juniorWingName || 'Junior Wing'}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Registry Backup & Restore Bar */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <Database className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>
              Registry Safety: <strong>{teachers.length}</strong> Teachers · <strong>{learners.length}</strong> Learners · <strong>{parents.length}</strong> Parents
            </span>
            {backupNotice && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                {backupNotice}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleDownloadBackupJson}
              className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer"
            >
              Download Backup JSON
            </button>
            <button
              type="button"
              disabled={isRestoringSnapshot}
              onClick={handleRestoreFromRtdbOrLocal}
              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer disabled:opacity-60"
            >
              {isRestoringSnapshot ? 'Restoring...' : 'Restore RTDB Snapshot'}
            </button>
            <label className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer">
              <span>Restore Backup File</span>
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleRestoreFromFile}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigateTab={setActiveTab}
            onOpenRecordPayment={() => handleOpenRecordPayment()}
            onOpenAddLearner={() => setIsEnrollModalOpen(true)}
          />
        )}

        {activeTab === 'school' && <SchoolAcademicSetupView />}

        {activeTab === 'learners' && (
          <LearnersAndParentsView
            onOpenAddModal={() => setIsEnrollModalOpen(true)}
            onNavigateToFees={handleNavigateToFees}
            onNavigateToScorecard={handleNavigateToScorecard}
            onNavigateToAttendance={handleNavigateToAttendance}
          />
        )}

        {activeTab === 'fees' && (
          <TuitionFeesView
            onOpenRecordPaymentModal={handleOpenRecordPayment}
            selectedLearnerFilter={targetLearnerId}
          />
        )}

        {activeTab === 'reminders' && <AutomatedRemindersView />}

        {activeTab === 'scorecards' && (
          <ScoreCardsView initialLearnerId={targetLearnerId} />
        )}

        {activeTab === 'attendance' && (
          <AttendanceRegisterView initialLearnerId={targetLearnerId} />
        )}

        {activeTab === 'reports' && <MonthlyReportsView />}
      </main>

      {/* Modals */}
      <RecordPaymentModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        initialLearnerId={targetLearnerId}
        onPaymentSuccess={(payment) => {
          setActiveTab('fees');
        }}
      />

      <EnrollLearnerModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
      />

      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />

      <AuditLogModal
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
      />

      <OfficialProductionCenterModal
        isOpen={isProductionCenterOpen}
        onClose={() => setIsProductionCenterOpen(false)}
        onOpenSmsConfig={() => {}}
        onOpenMpesaConfig={() => {}}
      />
      {(currentUser?.role === 'admin' || currentUser?.isOwner) && (
        <>
          <button
            type="button"
            onClick={() => setIsStaffApprovalsOpen(true)}
            className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold shadow-xl border border-indigo-400/30 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            <span>Staff Approvals</span>
          </button>

          <StaffApprovalsModal
            isOpen={isStaffApprovalsOpen}
            onClose={() => setIsStaffApprovalsOpen(false)}
          />
        </>
      )}
      {/* Production Grade System Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-indigo-950 tracking-tight">ElimuPulse</span>
            <span>·</span>
            <span className="font-bold text-slate-900">{schoolProfile?.name || 'Comprehensive School'}</span>
            <span>·</span>
            <span className="text-slate-600">
              {schoolProfile?.primaryWingName || `${schoolProfile?.name || ''} Primary`} &amp; {schoolProfile?.juniorWingName || `${schoolProfile?.name || ''} Junior`} Management Portal
            </span>
            {isOwnerAccountActive && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  STATUS: LIVE PRODUCTION · ACTIVE SYSTEM
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-slate-400 text-[11px] flex-wrap">
            <span>Compliant with Kenya Data Protection Act 2019</span>
            {isOwnerAccountActive && (
              <>
                <span>·</span>
                <span className="font-mono">Security: AES-GCM-256</span>
              </>
            )}
          </div>
        </div>
      </footer>
      {/* Offline Connectivity Status Toast */}
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
