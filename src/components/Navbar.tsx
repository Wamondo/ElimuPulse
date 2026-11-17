import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  FileText,
  LogOut,
  Crown,
  ChevronDown,
  Check,
  User,
  Award,
  BookOpen,
  GraduationCap,
  Users,
  Smartphone,
  Building,
  Lock,
  Unlock,
  Plus,
  Trash2
} from 'lucide-react';
import crestImage from '../assets/images/school_crest_emblem_1792317813141.jpg';
import { resolveComprehensiveSeal } from '../utils/schoolResolvers';
import { UserSession, OwnerDesignation, SchoolProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { NewSchoolRegistrationModal } from './NewSchoolRegistrationModal';
import { SchoolLockModal } from './SchoolLockModal';
import { DeleteSchoolModal } from './DeleteSchoolModal';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuditLog: () => void;
  onOpenSecurityModal: () => void;
  onOpenProductionCenter?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAuditLog,
  onOpenSecurityModal,
  onOpenProductionCenter,
}) => {
  const {
    currentUser,
    logout,
    schoolProfile,
    isOwner,
    switchOwnerResponsibility,
    registeredSchools,
    currentSchoolId,
    registerNewSchool,
    toggleSchoolLock,
    switchActiveSchool,
    teachers,
    grades,
  } = useApp();
  const [showOwnerSwitcher, setShowOwnerSwitcher] = useState(false);
  const isOwnerAccountActive = Boolean(
    isOwner && (!currentUser.ownerDesignation || currentUser.ownerDesignation === 'owner')
  );

  const ownerRegisteredTeacher = teachers.find((t) => {
    const cleanPhone = (t.phone || '').replace(/[^0-9]/g, '');
    const tEmail = (t.email || '').trim().toLowerCase();
    return cleanPhone.endsWith('716235185') || tEmail === 'dwnwmnd@gmail.com';
  });
  const ownerRegisteredGrade =
    (ownerRegisteredTeacher?.assignedGrade || '').trim() ||
    grades.find((g) => g.classTeacherId === ownerRegisteredTeacher?.id)?.name ||
    currentUser.teacherGrade ||
    grades[0]?.name ||
    'Grade 7A';
  const [showSchoolSwitcher, setShowSchoolSwitcher] = useState(false);
  const [isRegisterSchoolOpen, setIsRegisterSchoolOpen] = useState(false);
  const [isSchoolLockModalOpen, setIsSchoolLockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [schoolToDelete, setSchoolToDelete] = useState<SchoolProfile | null>(null);

  // Dynamic Navigation Links based on logged-in role
  const getNavLinks = () => {
    if (currentUser.role === 'parent') {
      return [
        { id: 'dashboard', label: 'Learner Dashboard' },
        { id: 'scorecards', label: 'Learner Score Card' },
        { id: 'attendance', label: 'Attendance' },
        { id: 'fees', label: 'Tuition & Receipts' },
      ];
    }
    if (currentUser.role === 'teacher') {
      if (currentUser.teacherType === 'class_teacher') {
        const gradeLabel = currentUser.teacherGrade || 'Class';
        return [
          { id: 'dashboard', label: `Dashboard (${gradeLabel})` },
          { id: 'learners', label: `Class Learners (${gradeLabel})` },
          { id: 'attendance', label: `Roll Call (${gradeLabel})` },
          { id: 'scorecards', label: `Class Broadsheet & Scores` },
          { id: 'fees', label: 'Class Fees Standing' },
        ];
      }
      return [
        { id: 'dashboard', label: 'Teacher Dashboard' },
        { id: 'scorecards', label: 'Subject Scoresheet' },
        { id: 'learners', label: 'Enrolled Learners' },
        { id: 'attendance', label: 'Attendance' },
      ];
    }
    return [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'school', label: 'School & Academic Setup' },
      { id: 'learners', label: 'Learners & Parents' },
      { id: 'fees', label: 'Tuition & Fees' },
      { id: 'reminders', label: 'Automated Reminders' },
      { id: 'scorecards', label: 'Broadsheets & Scores' },
      { id: 'attendance', label: 'Attendance' },
      { id: 'reports', label: 'Monthly Reports' },
    ];
  };

  const OWNER_RESPONSIBILITIES: {
    id: OwnerDesignation;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: string;
  }[] = [
    {
      id: 'owner',
      label: 'App Owner & Director',
      description: 'Master control, persistent storage, security audit & institutional settings',
      icon: Crown,
      badge: 'Super Admin',
    },
    {
      id: 'hoi',
      label: 'HOI (Head of Institution)',
      description: 'Overall school oversight, principal remarks & institutional governance',
      icon: Award,
      badge: 'HOI / Principal',
    },
    {
      id: 'deputy_hoi',
      label: 'Deputy HOI',
      description: 'Academic coordination, discipline & student attendance oversight',
      icon: Award,
      badge: 'Deputy HOI',
    },
    {
      id: 'exam_council',
      label: 'Coordinator / Exam Council',
      description: 'Examination council oversight, grade broadsheets & academic standards',
      icon: Award,
      badge: 'Exam Council',
    },
    {
      id: 'senior_teacher',
      label: 'Senior Teacher',
      description: 'Senior faculty lead, curriculum monitoring & staff mentorship',
      icon: GraduationCap,
      badge: 'Senior Faculty',
    },
    {
      id: 'class_teacher',
      label: `Class Teacher (${ownerRegisteredGrade})`,
      description: 'Daily roll call, conduct remarks, class fees standing & scorecards',
      icon: Users,
      badge: 'Class Teacher',
    },
    {
      id: 'subject_teacher',
      label: 'Teacher / Subject Teacher',
      description: 'Enter subject assessments, custom test marks & CBC rubrics',
      icon: BookOpen,
      badge: 'Subject Teacher',
    },
    {
      id: 'parent',
      label: 'Parent / Guardian Portal',
      description: 'Live parent portal: track child attendance, score card, fees & M-Pesa',
      icon: User,
      badge: 'Parent Portal',
    },
  ];

  const getOwnerDesignationLabel = (user: UserSession) => {
    switch (user.ownerDesignation) {
      case 'hoi':
        return 'HOI (Principal)';
      case 'deputy_hoi':
        return 'Deputy HOI';
      case 'exam_council':
        return 'Coordinator / Exam Council';
      case 'senior_teacher':
        return 'Senior Teacher';
      case 'class_teacher':
        return `Class Teacher (${user.teacherGrade || ownerRegisteredGrade})`;
      case 'subject_teacher':
        return 'Subject Teacher';
      case 'parent':
        return 'Parent Portal';
      case 'owner':
      default:
        return 'App Owner & Director';
    }
  };

  const navLinks = getNavLinks();

  const getRoleBadge = (user: UserSession) => {
    if (user.isOwner) {
      return getOwnerDesignationLabel(user);
    }
    if (user.role === 'admin') return 'Head of School';
    if (user.role === 'bursar') return 'Bursar / Finance';
    if (user.role === 'parent') return 'Parent Portal';
    if (user.role === 'teacher') {
      if (user.teacherType === 'class_teacher') {
        return `Class Teacher (${user.teacherGrade})`;
      }
      return `Subject Teacher (${user.registeredSubjects?.[0] ? user.registeredSubjects[0].slice(0, 16) + '...' : 'Faculty'})`;
    }
    return user.role;
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      {/* Institutional Lock Alert Banner */}
      {schoolProfile?.isLocked && (
        <div className="bg-linear-to-r from-rose-700 via-amber-700 to-rose-700 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-200 shrink-0 animate-bounce" />
            <span>
              <strong>School Portal Locked:</strong> {schoolProfile.name} is currently locked by the Institution Director. Teachers and school administrators cannot log in. Director management features remain fully active.
            </span>
          </div>
          {isOwner && (
            <button
              onClick={() => setIsSchoolLockModalOpen(true)}
              className="px-2.5 py-0.5 bg-white text-rose-800 hover:bg-rose-50 rounded text-[11px] font-bold cursor-pointer transition-colors shrink-0 ml-2 shadow-xs"
            >
              Unlock School Now
            </button>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Bar 3-Zone Contract */}
        <div className="flex items-center justify-between gap-8 h-16">
          
          {/* Zone 1: Single text element wordmark + School Crest & Multi-School Switcher */}
          <div className="flex items-center gap-3 shrink-0 relative">
            <img
              src={resolveComprehensiveSeal(schoolProfile, crestImage)}
              alt={`${schoolProfile?.name || 'School'} Official Seal`}
              className="w-10 h-10 object-contain rounded-full border border-amber-200/70 bg-white shadow-2xs"
              referrerPolicy="no-referrer"
            />
            <div className="relative">
              {isOwner ? (
                <button
                  onClick={() => setShowSchoolSwitcher(!showSchoolSwitcher)}
                  className="text-left cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-1.5 group"
                  title="App Owner: Click to view registered schools, switch institution, or manage locks"
                >
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-base tracking-tight text-indigo-700 leading-tight">
                        ElimuPulse
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-extrabold text-sm tracking-tight text-slate-900 leading-tight truncate max-w-[170px] sm:max-w-none">
                        {schoolProfile?.name || 'Comprehensive School'}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform ${showSchoolSwitcher ? 'rotate-180' : ''}`} />
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                      <span className="text-emerald-700 font-semibold">{schoolProfile?.primaryWingName || `${schoolProfile?.name || ''} Primary Wing`}</span>
                      <span>&</span>
                      <span className="text-indigo-700 font-semibold">{schoolProfile?.juniorWingName || `${schoolProfile?.name || ''} Junior Wing`}</span>
                      <span className="text-slate-300">·</span>
                      {schoolProfile?.isLocked ? (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-800 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-300 font-mono text-[9px]">
                          <Lock className="w-2.5 h-2.5 text-rose-600" />
                          LOCKED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-300 font-mono text-[9px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          LIVE SYSTEM
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ) : (
                <div className="text-left flex items-center gap-1.5">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-base tracking-tight text-indigo-700 leading-tight">
                        ElimuPulse
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-extrabold text-sm tracking-tight text-slate-900 leading-tight truncate max-w-[170px] sm:max-w-none">
                        {schoolProfile?.name || 'Comprehensive School'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                      <span className="text-emerald-700 font-semibold">{schoolProfile?.primaryWingName || `${schoolProfile?.name || ''} Primary Wing`}</span>
                      <span>&</span>
                      <span className="text-indigo-700 font-semibold">{schoolProfile?.juniorWingName || `${schoolProfile?.name || ''} Junior Wing`}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-400 font-mono text-[10px]">{schoolProfile?.registrationNumber || schoolProfile?.county}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* School Switcher & Management Dropdown - Owner Access Only */}
              {isOwner && showSchoolSwitcher && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 text-xs">
                  <div className="p-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      Registered Institutions ({registeredSchools?.length || 1})
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Multi-Tenancy</span>
                  </div>

                  <div className="max-h-56 overflow-y-auto py-1 space-y-1">
                    {(registeredSchools || []).map((sch) => {
                      const isCurrent = sch.id === currentSchoolId;
                      return (
                        <div
                          key={sch.id}
                          className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                            isCurrent
                              ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              switchActiveSchool(sch.id);
                              setShowSchoolSwitcher(false);
                            }}
                            className="flex-1 text-left truncate pr-2 cursor-pointer"
                          >
                            <div className="font-medium truncate">{sch.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {sch.registrationNumber || sch.county}
                            </div>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            {sch.isLocked ? (
                              <span className="p-1 rounded bg-rose-100 text-rose-700" title="School is locked (faculty logins blocked)">
                                <Lock className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className="p-1 rounded bg-emerald-100 text-emerald-700" title="School is unlocked">
                                <Unlock className="w-3 h-3" />
                              </span>
                            )}
                            {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-600 font-bold" />}

                            {/* Owner Delete Button */}
                            {isOwnerAccountActive && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowSchoolSwitcher(false);
                                  setSchoolToDelete(sch);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded transition-colors cursor-pointer ml-0.5"
                                title={`Delete ${sch.name} (Owner Only)`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {isOwnerAccountActive && (
                    <div className="pt-2 border-t border-slate-100 mt-1 space-y-1">
                      <button
                        onClick={() => {
                          setShowSchoolSwitcher(false);
                          setIsRegisterSchoolOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-semibold transition-colors cursor-pointer text-[11px]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Register New School (Owner Approval)</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowSchoolSwitcher(false);
                          setIsSchoolLockModalOpen(true);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer text-[11px] ${
                          schoolProfile.isLocked
                            ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            : 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                        }`}
                      >
                        {schoolProfile.isLocked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Unlock School Portal</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Lock School Portal</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setShowSchoolSwitcher(false);
                          setSchoolToDelete(schoolProfile);
                          setIsDeleteModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer text-[11px] text-rose-700 bg-rose-50 hover:bg-rose-100"
                        title="Permanently delete current school (Owner Only)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Current School (Owner Only)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Zone 2: Navigation Links (single-line, clean hover underline) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto py-1">
            {navLinks.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => setActiveTab(link.id)}
                  className={`whitespace-nowrap transition-colors pb-0.5 cursor-pointer ${
                    isActive
                      ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Active Role Switcher */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Quick School Register & Lock Buttons for Owner */}
            {isOwnerAccountActive && (
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  onClick={() => setIsRegisterSchoolOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-md border border-emerald-200 transition-colors cursor-pointer shadow-xs"
                  title="App Owner: Review and approve new school registration"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ Register School (Owner Approval)</span>
                </button>

                <button
                  onClick={() => setIsSchoolLockModalOpen(true)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer shadow-xs ${
                    schoolProfile?.isLocked
                      ? 'text-white bg-rose-600 hover:bg-rose-700 border-rose-700 animate-pulse'
                      : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-300'
                  }`}
                  title={schoolProfile?.isLocked ? 'School portal is locked. Click to unlock logins.' : 'Click to lock faculty & admin logins for this school.'}
                >
                  {schoolProfile?.isLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-white" />
                      <span>Locked · Unlock</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Lock School</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Install PWA Button for Phones, Tablets, and Laptops */}
            <PWAInstallButton variant="navbar" />

            {/* Live Production Center launcher (Owner Account Only) */}
            {isOwnerAccountActive && onOpenProductionCenter && (
              <button
                onClick={onOpenProductionCenter}
                title="Application Launch Status: Fully Operational in Production"
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-md border border-slate-300 transition-colors cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>🚀 Live System</span>
              </button>
            )}

            {/* Quick Security Status Badge (Owner Account Only) */}
            {isOwnerAccountActive && (
              <button
                onClick={onOpenSecurityModal}
                title="Click to view AES-256 encryption status and RBAC permissions"
                className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>AES-256 Active</span>
              </button>
            )}

            {/* Audit Log button (Owner Account Only) */}
            {isOwnerAccountActive && (
              <button
                onClick={onOpenAuditLog}
                title="Security & System Audit Log"
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
              </button>
            )}

            {/* Authenticated User Badge / Owner Responsibility Switcher */}
            {isOwner ? (
              <div className="flex items-center gap-2">
                {isOwnerAccountActive && (
                  <span
                    title="Single Active Phone Policy Active: Restricted to authorized owner device"
                    className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-1 rounded"
                  >
                    <Smartphone className="w-3 h-3 text-emerald-600" />
                    <span>1-Phone Locked</span>
                  </span>
                )}

                <div className="relative">
                  {isOwnerAccountActive ? (
                    <button
                      type="button"
                      onClick={() => setShowOwnerSwitcher(!showOwnerSwitcher)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-md transition-all cursor-pointer shadow-xs"
                      title="App Owner: Click to switch active responsibility (Owner, HOI, Deputy HOI, Senior Teacher, Class Teacher, Subject Teacher, Parent)"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-600 fill-amber-500 shrink-0" />
                      <span className="font-bold text-amber-900">App Owner</span>
                      <span className="text-amber-400">·</span>
                      <span className="font-semibold text-indigo-900 truncate max-w-[140px]">
                        {getOwnerDesignationLabel(currentUser)}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowOwnerSwitcher(!showOwnerSwitcher)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition-colors cursor-pointer"
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-600" />
                      <span className="max-w-[130px] truncate font-semibold text-slate-800">{currentUser.name}</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-semibold text-indigo-700">{getRoleBadge(currentUser)}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    </button>
                  )}

                {showOwnerSwitcher && (
                  <div
                    className="absolute right-0 mt-2 w-84 bg-white rounded-xl shadow-2xl border border-slate-200 py-2.5 z-50 text-xs animate-in fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100 bg-amber-50/50 rounded-t-xl">
                      <div className="flex items-center gap-1.5">
                        <Crown className="w-4 h-4 text-amber-600 fill-amber-500" />
                        <span className="font-bold text-slate-900">Owner Responsibility Center</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        As the application owner, switch between your authorized responsibilities across {schoolProfile?.name || 'the institution'}:
                      </p>
                    </div>

                    <div className="max-h-96 overflow-y-auto py-1 divide-y divide-slate-50">
                      {OWNER_RESPONSIBILITIES.map((resp) => {
                        const Icon = resp.icon;
                        const isCurrent = currentUser.ownerDesignation === resp.id || (!currentUser.ownerDesignation && resp.id === 'owner');
                        return (
                          <button
                            key={resp.id}
                            type="button"
                            onClick={() => {
                              switchOwnerResponsibility(resp.id);
                              setActiveTab('dashboard');
                              setShowOwnerSwitcher(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                              isCurrent ? 'bg-indigo-50/80 border-l-3 border-indigo-600' : ''
                            }`}
                          >
                            <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                              isCurrent ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-slate-900 truncate">{resp.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium shrink-0 ${
                                  isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {resp.badge}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                                {resp.description}
                              </p>
                            </div>
                            {isCurrent && (
                              <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="px-3.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>📱 Single Active Phone Protected</span>
                      <button
                        type="button"
                        onClick={() => setShowOwnerSwitcher(false)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md">
                <div className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="max-w-[130px] truncate font-semibold text-slate-800">{currentUser.name}</span>
                <span className="text-slate-400">·</span>
                <span className="font-semibold text-indigo-700">{getRoleBadge(currentUser)}</span>
              </div>
            )}

            {/* Quick Sign Out Button */}
            <button
              onClick={() => logout()}
              title="Sign out and return to the Phone/ID login portal"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="lg:hidden flex items-center gap-3 overflow-x-auto py-2.5 border-t border-slate-100 text-xs">
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`whitespace-nowrap px-2.5 py-1 rounded transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* New School Registration Modal (Owner Only) */}
      {isOwner && (
        <NewSchoolRegistrationModal
          isOpen={isRegisterSchoolOpen}
          onClose={() => setIsRegisterSchoolOpen(false)}
          onRegister={registerNewSchool}
        />
      )}

      {/* School Lock / Unlock Modal (Owner Only) */}
      {isOwner && (
        <SchoolLockModal
          isOpen={isSchoolLockModalOpen}
          onClose={() => setIsSchoolLockModalOpen(false)}
          school={schoolProfile}
          onToggleLock={toggleSchoolLock}
        />
      )}

      {/* Delete School Modal (Owner Only) */}
      {isOwner && (
        <DeleteSchoolModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          targetSchool={schoolToDelete}
        />
      )}
    </header>
  );
};
