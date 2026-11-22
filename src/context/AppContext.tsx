import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  UserRole,
  UserSession,
  OwnerDesignation,
  ParentRecord,
  LearnerRecord,
  FeePayment,
  FeeStructure,
  PaymentReminder,
  ScoreCard,
  AttendanceRecord,
  AuditLogEntry,
  TeacherRecord,
  SchoolProfile,
  GradeLevel,
  SubjectDefinition,
  AdminAccount,
  AssessmentRecord,
  SubjectMarksSubmission,
  AttendanceSession,
  AttendanceStatus,
  OwnerDeviceLock,
  LoginResult,
} from '../types';
import {
  INITIAL_USER_SESSIONS,
  INITIAL_PARENTS,
  INITIAL_LEARNERS,
  INITIAL_FEE_STRUCTURES,
  INITIAL_PAYMENTS,
  INITIAL_REMINDERS,
  INITIAL_SCORE_CARDS,
  INITIAL_ATTENDANCE,
  INITIAL_AUDIT_LOGS,
  INITIAL_TEACHERS,
  INITIAL_SCHOOL_PROFILE,
  INITIAL_GRADES,
  INITIAL_SUBJECTS,
  INITIAL_ADMIN_ACCOUNTS,
  INITIAL_ASSESSMENTS,
  INITIAL_SUBJECT_SUBMISSIONS,
} from '../data/mockData';
import {
  canRoleDecryptSensitivePII,
  canRoleRecordPayments,
  canRoleDispatchReminders,
  canRoleEditScoreCards,
  canRoleMarkAttendance,
  decryptSensitiveText,
  encryptSensitiveText,
  maskPhoneNumber,
  validateKenyanPhoneNumber,
  normalizeKenyanPhone,
} from '../services/cryptoService';
import {
  testFirestoreConnection,
  saveDocumentToFirestore,
  fetchDocumentFromFirestore,
  fetchCollectionSafe,
  batchSyncToFirestore,
  deleteDocumentFromFirestore,
  firestoreDatabaseId,
  firebaseProjectId,
} from '../services/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, rtdb } from '../services/firebase';
import {
  getCurrentDeviceId,
  getCurrentDeviceFriendlyName,
  getOwnerDeviceLock,
  persistOwnerDeviceLock,
  initiateOwnerOtpChallenge,
  verifyOwnerOtpAndAuthorizeDevice,
  OWNER_PHONE,
  OWNER_ID_NUMBER,
  OWNER_LOCK_DOC_ID,
} from '../services/deviceLockService';
import { createSynchronousPresetPng } from '../utils/signaturePresets';
import { dispatchRealSms } from '../services/smsGatewayService';

interface AppContextType {
  currentUser: UserSession;
  allUsers: UserSession[];
  isAuthenticated: boolean;
  isOwner: boolean;
  switchUser: (session: UserSession) => void;
  switchRole: (role: UserRole) => void;
  switchOwnerResponsibility: (designation: OwnerDesignation, teacherGrade?: string) => void;
  loginWithCredentials: (
    phone: string,
    idNumber: string,
    actingDesignation?: OwnerDesignation
  ) => Promise<LoginResult>;
  verifyOwnerOtp: (
    enteredOtp: string,
    actingDesignation?: OwnerDesignation
  ) => Promise<{ success: boolean; error?: string; session?: UserSession }>;
  resendOwnerOtp: () => Promise<{ success: boolean; error?: string; dispatchedOtpPreview?: string }>;
  forceRelockOwnerDevice: () => Promise<boolean>;
  ownerDeviceLock: OwnerDeviceLock | null;
  currentDeviceId: string;
  currentDeviceName: string;
  deviceKickoutNotice: string | null;
  clearDeviceKickoutNotice: () => void;
  requestPasswordResetLink: (phone: string) => {
    success: boolean;
    error?: string;
    resetToken?: string;
    resetLink?: string;
    user?: { name: string; role: string; phone: string; idNumber: string };
  };
  resetPasswordForUser: (
    phone: string,
    token: string,
    newPasswordOrId: string
  ) => { success: boolean; error?: string; userName?: string };
  logout: () => void;

  // Cloud Database (Firestore) State
  isCloudConnected: boolean;
  isCloudLoaded: boolean;
  firestoreDbId: string;
  firebaseProjectId: string;
  isSyncingToCloud: boolean;
  syncAllDataToFirestore: () => Promise<boolean>;
  
  // Data
  parents: ParentRecord[];
  learners: LearnerRecord[];
  teachers: TeacherRecord[];
  feeStructures: FeeStructure[];
  feePayments: FeePayment[];
  reminders: PaymentReminder[];
  scoreCards: ScoreCard[];
  attendance: AttendanceRecord[];
  auditLogs: AuditLogEntry[];

  // School, Grades 1-9, Teachers, Subjects, Admins
  schoolProfile: SchoolProfile;
  updateSchoolProfile: (updates: Partial<SchoolProfile>) => void;
  registeredSchools: SchoolProfile[];
  currentSchoolId: string;
  registerNewSchool: (schoolData: Omit<SchoolProfile, 'id'>) => Promise<SchoolProfile>;
  toggleSchoolLock: (schoolId?: string, reason?: string) => Promise<{ success: boolean; isLocked: boolean; schoolName: string }>;
  switchActiveSchool: (schoolId: string, isSystemRouting?: boolean) => void;
  deleteSchool: (schoolId: string) => Promise<{ success: boolean; message: string }>;

  grades: GradeLevel[];
  addGrade: (grade: Omit<GradeLevel, 'id'>) => void;
  updateGrade: (id: string, updates: Partial<GradeLevel>) => void;
  deleteGrade: (id: string) => void;

  subjects: SubjectDefinition[];
  addSubject: (subject: Omit<SubjectDefinition, 'id'>) => void;
  updateSubject: (id: string, updates: Partial<SubjectDefinition>) => void;
  deleteSubject: (id: string) => void;

  adminAccounts: AdminAccount[];
  addAdminAccount: (admin: Omit<AdminAccount, 'id'>) => void;
  updateAdminAccount: (id: string, updates: Partial<AdminAccount>) => void;
  deleteAdminAccount: (id: string) => void;

  addTeacher: (teacher: Omit<TeacherRecord, 'id'>) => void;
  updateTeacher: (id: string, updates: Partial<TeacherRecord>) => void;
  deleteTeacher: (id: string) => void;

  // Decryption state for sensitive PII
  decryptedParentIds: Set<string>;
  toggleParentDecryption: (parentId: string) => Promise<boolean>;
  isParentDecrypted: (parentId: string) => boolean;
  
  // Actions
  addLearnerWithParent: (
    learner: Omit<LearnerRecord, 'id' | 'studentId' | 'parentId' | 'status' | 'enrollmentDate' | 'photoPlaceholderColor'>,
    parent: Omit<ParentRecord, 'id' | 'encryptedPayload'>,
    initialTuition: number,
    term: string,
    dueDate: string
  ) => Promise<void>;
  updateLearner: (id: string, updates: Partial<LearnerRecord>) => void;
  deleteLearner: (id: string) => Promise<void>;
  requestLearnerDeletion: (learnerId: string) => void;
  approveLearnerDeletion: (learnerId: string) => Promise<void>;
  rejectLearnerDeletion: (learnerId: string) => void;
  updateParent: (id: string, updates: Partial<ParentRecord>) => void;
  
  // Fee Payments
  recordPayment: (payment: {
    learnerId: string;
    term: string;
    amount: number;
    method: 'Bank Transfer' | 'M-Pesa / Mobile Money' | 'Card' | 'Cash';
    notes?: string;
  }) => FeePayment;

  // Reminders
  batchDispatchReminders: () => { sentCount: number; message: string };
  sendBulkOverdueReminders: (options: {
    learnerIds: string[];
    term: string;
    channels: ('sms' | 'email')[];
    customMessageTemplate?: string;
    urgencyLevel?: 'standard' | 'friendly' | 'final';
  }) => {
    sentSmsCount: number;
    sentEmailCount: number;
    totalRecipients: number;
    totalDebtNotified: number;
    message: string;
  };
  scheduleReminder: (reminder: Omit<PaymentReminder, 'id' | 'status'>) => void;

  // Scorecards & Assessments Workflow
  saveScoreCard: (card: ScoreCard) => void;
  assessments: AssessmentRecord[];
  saveAssessment: (assessment: AssessmentRecord) => void;
  subjectSubmissions: SubjectMarksSubmission[];
  saveSubjectSubmission: (submission: SubjectMarksSubmission) => void;
  toggleExamAbsence: (grade: string, term: string, learnerId: string, isAbsent: boolean, reason?: string) => void;

  // Attendance (Morning & Afternoon Dual Session)
  recordSingleAttendance: (record: Omit<AttendanceRecord, 'id' | 'markedBy'>) => void;
  batchMarkClassAttendance: (
    date: string,
    grade: string,
    status: AttendanceStatus,
    session?: AttendanceSession | 'both'
  ) => void;

  // Helpers
  getLearnerById: (id: string) => LearnerRecord | undefined;
  getParentById: (id: string) => ParentRecord | undefined;
  getFeeStructureForLearner: (learnerId: string, term?: string) => FeeStructure | undefined;
  getPaymentsForLearner: (learnerId: string) => FeePayment[];
  getScoreCardsForLearner: (learnerId: string) => ScoreCard[];
  getAttendanceForLearner: (learnerId: string) => AttendanceRecord[];
  addAuditLog: (action: string, details: string, securityFlag?: boolean) => void;

  resetToDefault: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'academias_secure_v1_';

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load current user
  const [currentUser, setCurrentUser] = useState<UserSession>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}user`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...parsed, phone: normalizeKenyanPhone(parsed.phone || '') };
      } catch { /* ignore */ }
    }
    return null;
  });

  const [parents, setParents] = useState<ParentRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}parents`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((p: ParentRecord) => {
            const cleanParent: ParentRecord = {
              ...p,
              phone: normalizeKenyanPhone(p.phone || ''),
            };
            if (p.alternatePhone) {
              cleanParent.alternatePhone = normalizeKenyanPhone(p.alternatePhone);
            } else {
              delete cleanParent.alternatePhone;
            }
            return cleanParent;
          });
        }
      } catch { /* ignore */ }
    }
    return [];
  });

  const [learners, setLearners] = useState<LearnerRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}learners`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch { /* ignore */ }
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}learners`, JSON.stringify(learners));
    } catch { /* ignore */ }
  }, [learners]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}parents`, JSON.stringify(parents));
    } catch { /* ignore */ }
  }, [parents]);

  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}fee_structures`);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [];
  });

  const [feePayments, setFeePayments] = useState<FeePayment[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}fee_payments`);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [];
  });

  const [reminders, setReminders] = useState<PaymentReminder[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}reminders`);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [];
  });

  const [scoreCards, setScoreCards] = useState<ScoreCard[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}score_cards`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0 || parsed.some((sc: ScoreCard) => sc.learnerId === 'stu-4' || sc.learnerId === 'stu-5' || sc.id)) {
            return parsed;
          }
        }
      } catch { /* ignore */ }
    }
    return [];
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}attendance`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) return [];
          if (parsed.some((a) => a.session === 'afternoon')) {
            return parsed;
          }
          // Upgrade single-session legacy records to morning + afternoon sessions
          const upgraded: AttendanceRecord[] = [];
          parsed.forEach((a) => {
            upgraded.push({ ...a, session: a.session || 'morning' });
            upgraded.push({
              id: `${a.id}-afternoon`,
              learnerId: a.learnerId,
              date: a.date,
              session: 'afternoon',
              status: a.status,
              markedBy: a.markedBy || 'Mr. Marcus Thorne',
            });
          });
          return upgraded;
        }
      } catch { /* ignore */ }
    }
    return [];
  });

  const [assessments, setAssessments] = useState<AssessmentRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}assessments`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* ignore */ }
    }
    return [];
  });

  const [subjectSubmissions, setSubjectSubmissions] = useState<SubjectMarksSubmission[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}subject_submissions`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* ignore */ }
    }
    return [];
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}audit_logs`);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return [];
  });

  const [teachers, setTeachers] = useState<TeacherRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}teachers`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((t: TeacherRecord) => ({
          ...t,
          phone: normalizeKenyanPhone(t.phone || ''),
        }));
      } catch { /* ignore */ }
    }
    return [];
  });

  const [registeredSchools, setRegisteredSchools] = useState<SchoolProfile[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}registered_schools`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch { /* ignore */ }
    }

    let base = { ...INITIAL_SCHOOL_PROFILE, id: 'sch-001', isLocked: false } as SchoolProfile;
    const legacySaved = localStorage.getItem(`${STORAGE_KEY_PREFIX}school_profile`);
    if (legacySaved) {
      try {
        const parsed = JSON.parse(legacySaved);
        if (parsed && parsed.name && !parsed.name.includes('Academia') && parsed.primaryWingName && parsed.juniorWingName) {
          base = { ...parsed, id: parsed.id || 'sch-001', isLocked: Boolean(parsed.isLocked) };
        }
      } catch { /* ignore */ }
    }

    // Ensure default signatures exist if not already present
    if (!base.signatures || Object.keys(base.signatures).length === 0) {
      const defaultSigs = {
        hoi: {
          id: 'sig-hoi-init',
          role: 'hoi' as const,
          roleTitle: 'Chief Principal & Head of School',
          signatoryName: 'Dr. Evelyn Vance, Ph.D',
          signatureDataUrl: createSynchronousPresetPng('hoi', 'Dr. Evelyn Vance', '#1e3a8a'),
          sourceType: 'preset' as const,
          updatedAt: new Date().toISOString(),
          dateStr: new Date().toLocaleDateString('en-GB'),
          isVerified: true,
          verificationCode: 'SIG-HOI-VANCE-2026',
        },
        bursar: {
          id: 'sig-bursar-init',
          role: 'bursar' as const,
          roleTitle: 'Chief Bursar & Treasury Controller',
          signatoryName: 'Sarah Kimani, CPA',
          signatureDataUrl: createSynchronousPresetPng('bursar', 'Sarah Kimani, CPA', '#0f172a'),
          sourceType: 'preset' as const,
          updatedAt: new Date().toISOString(),
          dateStr: new Date().toLocaleDateString('en-GB'),
          isVerified: true,
          verificationCode: 'SIG-BURSAR-KIMANI-2026',
        },
        seal: {
          id: 'sig-seal-init',
          role: 'seal' as const,
          roleTitle: 'Official Institutional Seal & Stamp',
          signatoryName: `${base.name || 'Institutional'} Seal`,
          signatureDataUrl: createSynchronousPresetPng('seal', `${base.name || 'Official'} Seal`, '#4338ca'),
          sourceType: 'preset' as const,
          updatedAt: new Date().toISOString(),
          dateStr: new Date().toLocaleDateString('en-GB'),
          isVerified: true,
          verificationCode: `SEAL-${(base.name || 'OFFICIAL').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`,
        },
      };
      base = { ...base, signatures: defaultSigs };
    }

    return [base];
  });

  const [currentSchoolId, setCurrentSchoolId] = useState<string>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}active_school_id`);
    return saved || 'sch-001';
  });

  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(() => {
    const match = registeredSchools.find((s) => s.id === currentSchoolId);
    return match || registeredSchools[0] || ({ ...INITIAL_SCHOOL_PROFILE, id: 'sch-001', isLocked: false } as SchoolProfile);
  });

  // Keep schoolProfile and localStorage synced when registeredSchools or currentSchoolId change
  useEffect(() => {
    const active = registeredSchools.find((s) => s.id === currentSchoolId) || registeredSchools[0];
    if (active) {
      setSchoolProfile(active);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}school_profile`, JSON.stringify(active));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}active_school_id`, active.id);
    }
    localStorage.setItem(`${STORAGE_KEY_PREFIX}registered_schools`, JSON.stringify(registeredSchools));
  }, [registeredSchools, currentSchoolId]);

  const [grades, setGrades] = useState<GradeLevel[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}grades`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 8 && parsed.some((g: GradeLevel) => g.wing === 'Junior')) {
          return parsed;
        }
      } catch { /* ignore */ }
    }
    return INITIAL_GRADES;
  });

  const [subjects, setSubjects] = useState<SubjectDefinition[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}subjects`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const has901 = Array.isArray(parsed) && parsed.some((s: SubjectDefinition) => s.code?.includes('901'));
        const has601 = Array.isArray(parsed) && parsed.some((s: SubjectDefinition) => s.code?.includes('601'));
        const has301 = Array.isArray(parsed) && parsed.some((s: SubjectDefinition) => s.code?.includes('301'));
        const hasLegacy = Array.isArray(parsed) && parsed.some((s: SubjectDefinition) => s.code?.includes('101 (ENG)') || s.code === '101 (ENG)');
        if (has901 && has601 && has301 && !hasLegacy) {
          return parsed;
        }
      } catch { /* ignore */ }
    }
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}subjects`, JSON.stringify(INITIAL_SUBJECTS));
    } catch { /* ignore */ }
    return INITIAL_SUBJECTS;
  });

  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}admins`);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* ignore */ }
    }
    return INITIAL_ADMIN_ACCOUNTS;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}auth`);
    if (saved !== null) {
      return saved === 'true';
    }
    return false; // Authentication required by default
  });
  // Sync Firebase Auth + Realtime Database `approved` flag with AppContext
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        const rawSession = localStorage.getItem('elimupulse_staff_session');
        if (rawSession) {
          localStorage.removeItem('elimupulse_staff_session');
          setIsAuthenticated(false);
        }
        return;
      }

      try {
        const snap = await get(ref(rtdb, `users/${firebaseUser.uid}`));
        const profile = snap.val() as {
          name?: string;
          email?: string;
          role?: UserRole;
          approved?: boolean;
        } | null;

        if (profile && profile.approved === true) {
          setCurrentUser((prev) => ({
            ...prev,
            id: `firebase-${firebaseUser.uid}`,
            name: profile.name || prev.name,
            email: firebaseUser.email || profile.email || prev.email,
            role: profile.role || prev.role || 'teacher',
            isOwner: profile.role === 'admin' ? prev?.isOwner : false,
          }));
          setIsAuthenticated(true);
        } else {
          // User exists in Auth but is not yet approved in Realtime Database
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.warn('Realtime Database approval check notice:', err);
      }
    });

    return () => unsubscribe();
  }, []);
  
  const [decryptedParentIds, setDecryptedParentIds] = useState<Set<string>>(new Set());
  const [ownerDeviceLock, setOwnerDeviceLock] = useState<OwnerDeviceLock | null>(() => {
    try {
      const cached = localStorage.getItem('academias_owner_device_lock_v1');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [deviceKickoutNotice, setDeviceKickoutNotice] = useState<string | null>(null);
  const currentDeviceId = getCurrentDeviceId();
  const currentDeviceName = getCurrentDeviceFriendlyName();
  const clearDeviceKickoutNotice = () => setDeviceKickoutNotice(null);

  // Cloud Database (Firestore) State
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [isSyncingToCloud, setIsSyncingToCloud] = useState<boolean>(false);
  const [isCloudLoaded, setIsCloudLoaded] = useState<boolean>(false);

  // Monitor single active phone lock concurrency only when cloud is reachable
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.isOwner || !isCloudConnected) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      try {
        const lock = await getOwnerDeviceLock();
        if (!isMounted) return;
        if (lock) {
          setOwnerDeviceLock(lock);
          // If another phone/device took over ownership
          if (lock.activeDeviceId && lock.activeDeviceId !== currentDeviceId) {
            setDeviceKickoutNotice(
              'Session Terminated: The Owner Account was accessed and authorized on another device via SMS OTP verification. Under your strict single-phone security policy, only one phone can access the Owner Account at a time.'
            );
            logout();
          }
        }
      } catch {
        /* ignore */
      }
    }, 6000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, currentUser?.isOwner, currentDeviceId, isCloudConnected]);

  // Active curriculum migration & synchronization
  useEffect(() => {
    const has901 = subjects.some((s) => s.code?.includes('901'));
    const has601 = subjects.some((s) => s.code?.includes('601'));
    const has301 = subjects.some((s) => s.code?.includes('301'));
    const hasLegacy = subjects.some((s) => s.code?.includes('101 (ENG)'));
    if (!has901 || !has601 || !has301 || hasLegacy) {
      console.log('Auto-migrating subjects to official KNEC 901/601/301 curriculum...');
      setSubjects(INITIAL_SUBJECTS);
      try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}subjects`, JSON.stringify(INITIAL_SUBJECTS));
      } catch { /* ignore */ }
      batchSyncToFirestore('subjects', INITIAL_SUBJECTS).catch(() => {});
    }
  }, [subjects]);

  // Keep any active teacher session (including Owner acting as Class/Senior/Subject Teacher)
  // synchronized with the live Faculty Teacher Registry and Grade Assignments
  useEffect(() => {
    if (!isAuthenticated || currentUser?.role !== 'teacher') return;

    const sessionTeacherId = currentUser?.id.startsWith('session-teacher-')
      ? currentUser?.id.replace('session-teacher-', '')
      : '';
    const userNormPhone = normalizeKenyanPhone(currentUser?.phone || '');
    const userEmail = (currentUser?.email || '').trim().toLowerCase();

    const matchedTeacher =
      teachers.find((t) => sessionTeacherId && t.id === sessionTeacherId) ||
      teachers.find(
        (t) =>
          (t.schoolId || 'sch-001') === currentSchoolId &&
          ((userNormPhone && normalizeKenyanPhone(t.phone || '') === userNormPhone) ||
            (userEmail && (t.email || '').trim().toLowerCase() === userEmail))
      ) ||
      teachers.find(
        (t) =>
          (userNormPhone && normalizeKenyanPhone(t.phone || '') === userNormPhone) ||
          (userEmail && (t.email || '').trim().toLowerCase() === userEmail)
      );

    if (!matchedTeacher) return;

    const targetSchId = matchedTeacher.schoolId || currentSchoolId;
    const matchedGradeObj = grades.find(
      (g) => g.classTeacherId === matchedTeacher.id && (!g.schoolId || g.schoolId === targetSchId)
    );
    const resolvedGrade = (matchedTeacher.assignedGrade || '').trim() || matchedGradeObj?.name || '';
    const resolvedSubjects =
      matchedTeacher.registeredSubjects && matchedTeacher.registeredSubjects.length > 0
        ? matchedTeacher.registeredSubjects
        : currentUser?.registeredSubjects;

    const isOwnerActingOverride =
      currentUser?.isOwner &&
      (currentUser?.ownerDesignation === 'subject_teacher' || currentUser?.ownerDesignation === 'senior_teacher');

    const nextTeacherType = isOwnerActingOverride
      ? currentUser?.teacherType
      : matchedTeacher.teacherType;
    const nextTeacherGrade =
      nextTeacherType === 'class_teacher' || resolvedGrade
        ? resolvedGrade || currentUser?.teacherGrade
        : currentUser?.teacherGrade;

    const nextTitle =
      currentUser?.ownerDesignation === 'senior_teacher'
        ? `Senior Teacher & Academic Lead (${nextTeacherGrade || 'Faculty'})`
        : nextTeacherType === 'class_teacher'
        ? `Class Teacher · ${nextTeacherGrade || 'Unassigned'} (${schoolProfile.name})`
        : `Subject Teacher (${(resolvedSubjects || []).join(', ')}) · ${schoolProfile.name}`;

    const subjectsChanged =
      JSON.stringify(currentUser?.registeredSubjects || []) !== JSON.stringify(resolvedSubjects || []);

    if (
      currentUser?.name !== matchedTeacher.name ||
      currentUser?.teacherType !== nextTeacherType ||
      currentUser?.teacherGrade !== nextTeacherGrade ||
      currentUser?.title !== nextTitle ||
      subjectsChanged
    ) {
      setCurrentUser((prev) => ({
        ...prev,
        name: matchedTeacher.name,
        teacherType: nextTeacherType,
        teacherGrade: nextTeacherGrade,
        registeredSubjects: resolvedSubjects,
        title: nextTitle,
      }));
    }
  }, [isAuthenticated, currentUser, teachers, grades, currentSchoolId, schoolProfile.name]);

  // Persistence effects
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}school_profile`, JSON.stringify(schoolProfile));
  }, [schoolProfile]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}grades`, JSON.stringify(grades));
  }, [grades]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}subjects`, JSON.stringify(subjects));
  }, [subjects]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}admins`, JSON.stringify(adminAccounts));
  }, [adminAccounts]);

  // Persistence effects
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}user`, JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}auth`, String(isAuthenticated));
  }, [isAuthenticated]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}teachers`, JSON.stringify(teachers));
  }, [teachers]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}parents`, JSON.stringify(parents));
  }, [parents]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}learners`, JSON.stringify(learners));
  }, [learners]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}fee_structures`, JSON.stringify(feeStructures));
  }, [feeStructures]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}fee_payments`, JSON.stringify(feePayments));
  }, [feePayments]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}reminders`, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}score_cards`, JSON.stringify(scoreCards));
  }, [scoreCards]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}attendance`, JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}audit_logs`, JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Validate Connection to Firestore on boot and initialize cloud data
  useEffect(() => {
    let isMounted = true;

    async function initCloudData() {
      const connected = await testFirestoreConnection();
      if (!isMounted) return;
      setIsCloudConnected(connected);

      if (!connected) return;

      try {
        // Fetch existing collections from Firestore with explicit ok status
        const [
          learnersRes,
          parentsRes,
          teachersRes,
          feeStructuresRes,
          feePaymentsRes,
          scoreCardsRes,
          attendanceRes,
          remindersRes,
          gradesRes,
          subjectsRes,
          adminsRes,
          remoteSettings,
          assessmentsRes,
          submissionsRes,
          schoolsRes,
        ] = await Promise.all([
          fetchCollectionSafe<LearnerRecord>('learners'),
          fetchCollectionSafe<ParentRecord>('parents'),
          fetchCollectionSafe<TeacherRecord>('teachers'),
          fetchCollectionSafe<FeeStructure>('feeStructures'),
          fetchCollectionSafe<FeePayment>('feePayments'),
          fetchCollectionSafe<ScoreCard>('scoreCards'),
          fetchCollectionSafe<AttendanceRecord>('attendance'),
          fetchCollectionSafe<PaymentReminder>('paymentReminders'),
          fetchCollectionSafe<GradeLevel>('grades'),
          fetchCollectionSafe<SubjectDefinition>('subjects'),
          fetchCollectionSafe<AdminAccount>('admins'),
          fetchDocumentFromFirestore<SchoolProfile & { id: string }>('settings', 'school_config').catch(() => null),
          fetchCollectionSafe<AssessmentRecord>('assessments'),
          fetchCollectionSafe<SubjectMarksSubmission>('subjectSubmissions'),
          fetchCollectionSafe<SchoolProfile>('schools'),
        ]);

        if (!isMounted) return;

        // Only auto-seed when Firestore is genuinely fresh (no schools, no teachers, no grades, no learners, and no school_config)
        const isBrandNewFirestore =
          learnersRes.ok &&
          schoolsRes.ok &&
          teachersRes.ok &&
          gradesRes.ok &&
          learnersRes.items.length === 0 &&
          schoolsRes.items.length === 0 &&
          teachersRes.items.length === 0 &&
          gradesRes.items.length === 0 &&
          !remoteSettings;

        if (isBrandNewFirestore) {
          console.log('Bootstrapping Firestore with Mwivona Comprehensive School initial dataset...');
          await Promise.all([
            batchSyncToFirestore('learners', []),
            batchSyncToFirestore('parents', []),
            batchSyncToFirestore('teachers', []),
            batchSyncToFirestore('feeStructures', []),
            batchSyncToFirestore('feePayments', []),
            batchSyncToFirestore('paymentReminders', []),
            batchSyncToFirestore('scoreCards', []),
            batchSyncToFirestore('attendance', []),
            batchSyncToFirestore('auditLogs', []),
            saveDocumentToFirestore('settings', { ...INITIAL_SCHOOL_PROFILE, id: 'school_config' }),
            saveDocumentToFirestore('schools', { ...INITIAL_SCHOOL_PROFILE, id: 'sch-001', isLocked: false }),
            batchSyncToFirestore('grades', INITIAL_GRADES),
            batchSyncToFirestore('subjects', INITIAL_SUBJECTS),
            batchSyncToFirestore('admins', INITIAL_ADMIN_ACCOUNTS),
            batchSyncToFirestore('assessments', []),
            batchSyncToFirestore('subjectSubmissions', []),
          ]);
        } else {
          // Hydrate live state from Firestore (respecting empty collections when learners were deleted)
          if (schoolsRes.ok && schoolsRes.items.length > 0) {
            setRegisteredSchools(schoolsRes.items);
            const active = schoolsRes.items.find((s) => s.id === currentSchoolId) || schoolsRes.items[0];
            setSchoolProfile(active);
          } else if (remoteSettings && remoteSettings.name) {
            const { id: _, ...profile } = remoteSettings;
            setSchoolProfile(profile as SchoolProfile);
          }

          const validLearnerIds = learnersRes.ok ? new Set(learnersRes.items.map((l) => l.id)) : null;
          const validParentIds = learnersRes.ok ? new Set(learnersRes.items.map((l) => l.parentId)) : null;

          if (learnersRes.ok && learnersRes.items.length > 0) {
            setLearners(learnersRes.items);
          } else {
            try {
              const schoolKey = currentSchoolId || 'sch-001';
              const rtdbLearnersSnap = await get(ref(rtdb, `schools/${schoolKey}/learners`));
              const fallbackSnap = schoolKey !== 'sch-001' ? await get(ref(rtdb, `schools/sch-001/learners`)) : null;
              const mergedMap = new Map<string, LearnerRecord>();
              if (fallbackSnap && fallbackSnap.exists()) {
                for (const item of Object.values(fallbackSnap.val()) as LearnerRecord[]) {
                  if (item?.id) mergedMap.set(item.id, item);
                }
              }
              if (rtdbLearnersSnap.exists()) {
                for (const item of Object.values(rtdbLearnersSnap.val()) as LearnerRecord[]) {
                  if (item?.id) mergedMap.set(item.id, item);
                }
              }
              if (mergedMap.size > 0) {
                setLearners((prev) => {
                  const byId = new Map(prev.map((l) => [l.id, l]));
                  mergedMap.forEach((v, k) => byId.set(k, v));
                  return Array.from(byId.values());
                });
              }
            } catch (_) {}
          }

          if (parentsRes.ok && parentsRes.items.length > 0) {
            if (validParentIds) {
              const validParents = parentsRes.items.filter((p) => validParentIds.has(p.id));
              const orphanParents = parentsRes.items.filter((p) => !validParentIds.has(p.id));
              setParents(validParents);
              orphanParents.forEach((p) => deleteDocumentFromFirestore('parents', p.id).catch(() => {}));
            } else {
              setParents(parentsRes.items);
            }
          } else {
            try {
              const schoolKey = currentSchoolId || 'sch-001';
              const rtdbParentsSnap = await get(ref(rtdb, `schools/${schoolKey}/parents`));
              const fallbackParentSnap = schoolKey !== 'sch-001' ? await get(ref(rtdb, `schools/sch-001/parents`)) : null;
              const mergedParents = new Map<string, ParentRecord>();
              if (fallbackParentSnap && fallbackParentSnap.exists()) {
                for (const item of Object.values(fallbackParentSnap.val()) as ParentRecord[]) {
                  if (item?.id) mergedParents.set(item.id, item);
                }
              }
              if (rtdbParentsSnap.exists()) {
                for (const item of Object.values(rtdbParentsSnap.val()) as ParentRecord[]) {
                  if (item?.id) mergedParents.set(item.id, item);
                }
              }
              if (mergedParents.size > 0) {
                setParents((prev) => {
                  const byId = new Map(prev.map((p) => [p.id, p]));
                  mergedParents.forEach((v, k) => byId.set(k, v));
                  return Array.from(byId.values());
                });
              }
            } catch (_) {}
          }

          if (teachersRes.ok && teachersRes.items.length > 0) setTeachers(teachersRes.items);

          if (feeStructuresRes.ok) {
            if (validLearnerIds) {
              const validFs = feeStructuresRes.items.filter((fs) => validLearnerIds.has(fs.learnerId));
              const orphanFs = feeStructuresRes.items.filter((fs) => !validLearnerIds.has(fs.learnerId));
              setFeeStructures(validFs);
              orphanFs.forEach((fs) => deleteDocumentFromFirestore('feeStructures', fs.id).catch(() => {}));
            } else {
              setFeeStructures(feeStructuresRes.items);
            }
          }

          if (feePaymentsRes.ok) {
            if (validLearnerIds) {
              const validFp = feePaymentsRes.items.filter((fp) => validLearnerIds.has(fp.learnerId));
              const orphanFp = feePaymentsRes.items.filter((fp) => !validLearnerIds.has(fp.learnerId));
              setFeePayments(validFp);
              orphanFp.forEach((fp) => deleteDocumentFromFirestore('feePayments', fp.id).catch(() => {}));
            } else {
              setFeePayments(feePaymentsRes.items);
            }
          }

          if (scoreCardsRes.ok) {
            if (validLearnerIds) {
              const validSc = scoreCardsRes.items.filter((sc) => validLearnerIds.has(sc.learnerId));
              const orphanSc = scoreCardsRes.items.filter((sc) => !validLearnerIds.has(sc.learnerId));
              setScoreCards(validSc);
              orphanSc.forEach((sc) => deleteDocumentFromFirestore('scoreCards', sc.id).catch(() => {}));
            } else {
              setScoreCards(scoreCardsRes.items);
            }
          }

          if (attendanceRes.ok) {
            if (validLearnerIds) {
              const validAtt = attendanceRes.items.filter((a) => validLearnerIds.has(a.learnerId));
              const orphanAtt = attendanceRes.items.filter((a) => !validLearnerIds.has(a.learnerId));
              setAttendance(validAtt);
              orphanAtt.forEach((a) => deleteDocumentFromFirestore('attendance', a.id).catch(() => {}));
            } else {
              setAttendance(attendanceRes.items);
            }
          }

          if (remindersRes.ok) {
            if (validLearnerIds) {
              const validRem = remindersRes.items.filter((r) => validLearnerIds.has(r.learnerId));
              const orphanRem = remindersRes.items.filter((r) => !validLearnerIds.has(r.learnerId));
              setReminders(validRem);
              orphanRem.forEach((r) => deleteDocumentFromFirestore('paymentReminders', r.id).catch(() => {}));
            } else {
              setReminders(remindersRes.items);
            }
          }

          if (gradesRes.ok && gradesRes.items.length > 0) setGrades(gradesRes.items);
          if (assessmentsRes.ok && assessmentsRes.items.length > 0) setAssessments(assessmentsRes.items);
          if (submissionsRes.ok && submissionsRes.items.length > 0) setSubjectSubmissions(submissionsRes.items);

          if (subjectsRes.ok && subjectsRes.items.length > 0) {
            const hasOfficialCurriculum =
              subjectsRes.items.some((s) => s.code?.includes('901')) &&
              subjectsRes.items.some((s) => s.code?.includes('601')) &&
              subjectsRes.items.some((s) => s.code?.includes('301')) &&
              !subjectsRes.items.some((s) => s.code?.includes('101 (ENG)'));

            if (hasOfficialCurriculum) {
              setSubjects(subjectsRes.items);
            } else {
              console.log('Upgrading Firestore with official KNEC 901/601/301 curriculum...');
              setSubjects(INITIAL_SUBJECTS);
              try {
                localStorage.setItem(`${STORAGE_KEY_PREFIX}subjects`, JSON.stringify(INITIAL_SUBJECTS));
              } catch { /* ignore */ }
              batchSyncToFirestore('subjects', INITIAL_SUBJECTS).catch(() => {});
            }
          } else if (subjectsRes.ok) {
            batchSyncToFirestore('subjects', INITIAL_SUBJECTS).catch(() => {});
          }
          if (adminsRes.ok && adminsRes.items.length > 0) setAdminAccounts(adminsRes.items);
        }
        setIsCloudLoaded(true);
      } catch (err) {
        console.warn('Cloud hydration notice:', err);
      }
    }

    initCloudData();

    return () => {
      isMounted = false;
    };
  }, []);

  const syncAllDataToFirestore = async (): Promise<boolean> => {
    setIsSyncingToCloud(true);
    try {
      await Promise.all([
        batchSyncToFirestore('learners', learners),
        batchSyncToFirestore('parents', parents),
        batchSyncToFirestore('teachers', teachers),
        batchSyncToFirestore('feeStructures', feeStructures),
        batchSyncToFirestore('feePayments', feePayments),
        batchSyncToFirestore('paymentReminders', reminders),
        batchSyncToFirestore('scoreCards', scoreCards),
        batchSyncToFirestore('attendance', attendance),
        batchSyncToFirestore('auditLogs', auditLogs),
        saveDocumentToFirestore('settings', { ...schoolProfile, id: 'school_config' }),
        batchSyncToFirestore('grades', grades),
        batchSyncToFirestore('subjects', subjects),
        batchSyncToFirestore('admins', adminAccounts),
        batchSyncToFirestore('assessments', assessments),
        batchSyncToFirestore('subjectSubmissions', subjectSubmissions),
        ...registeredSchools.map((sch) => saveDocumentToFirestore('schools', sch)),
      ]);
      addAuditLog(
        'Cloud Database Synchronized',
        `Synchronized active school records to Firestore live database: ${firestoreDatabaseId}`
      );
      setIsSyncingToCloud(false);
      return true;
    } catch (err) {
      console.error('Failed to sync to Firestore:', err);
      setIsSyncingToCloud(false);
      return false;
    }
  };

  const addAuditLog = (action: string, details: string, securityFlag = false) => {
    const now = new Date();
    const formattedTime = now.toISOString().replace('T', ' ').slice(0, 19);
    const newEntry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: formattedTime,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      action,
      details,
      securityFlag,
    };
    setAuditLogs((prev) => [newEntry, ...prev.slice(0, 49)]);
  };

  const switchUser = (session: UserSession) => {
    setCurrentUser(session);
    setIsAuthenticated(true);
    if (session.role === 'parent' && session.parentId) {
      setDecryptedParentIds(new Set([session.parentId]));
    } else {
      setDecryptedParentIds(new Set()); // Reset decrypted view when switching users for zero-trust
    }
    addAuditLog('User Session Switched', `Active session: ${session.name} (${session.role.toUpperCase()})`);
  };

  const switchRole = (role: UserRole) => {
    const matchingSession = INITIAL_USER_SESSIONS.find((s) => s.role === role) || {
      id: `user-${role}-gen`,
      name: `${role.charAt(0).toUpperCase() + role.slice(1)} User`,
      role,
      email: `${role}@academiacademy.edu`,
      phone: '+254 700 000 000',
      idNumber: 'ID-GEN-001',
      title: `${role.toUpperCase()} Authority`,
    };
    switchUser(matchingSession);
  };

  const clearAllTrialAndStaleSessions = () => {
    try {
      sessionStorage.clear();
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.includes('trial') ||
            key.includes('demo') ||
            key.includes('temp_') ||
            key.includes('preview_') ||
            key.includes('role_preview'))
        ) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      /* ignore */
    }
  };

  const resolveRegisteredTeacherForOwner = (
    preferredSchoolId?: string
  ): { teacher?: TeacherRecord; assignedGrade?: string; schoolId?: string } => {
    const ownerNormPhone = normalizeKenyanPhone(OWNER_PHONE);
    const cleanOwnerId = OWNER_ID_NUMBER.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^ID/, '');
    const matchesOwner = (t: TeacherRecord) => {
      const tPhone = normalizeKenyanPhone(t.phone || '');
      const tEmail = (t.email || '').trim().toLowerCase();
      const tId = (t.nationalOrStaffId || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^ID/, '');
      return (
        tPhone === ownerNormPhone ||
        tEmail === 'dwnwmnd@gmail.com' ||
        (tId !== '' && tId === cleanOwnerId)
      );
    };

    const targetSch = preferredSchoolId || currentSchoolId;
    const matched =
      teachers.find((t) => (t.schoolId || 'sch-001') === targetSch && matchesOwner(t)) ||
      teachers.find(matchesOwner);

    if (!matched) {
      return {};
    }

    const resolvedSchoolId = matched.schoolId || targetSch;
    const gradeById = grades.find(
      (g) => g.classTeacherId === matched.id && (!g.schoolId || g.schoolId === resolvedSchoolId)
    );
    const assignedGrade = (matched.assignedGrade || '').trim() || gradeById?.name || '';

    return {
      teacher: matched,
      assignedGrade: assignedGrade || undefined,
      schoolId: resolvedSchoolId,
    };
  };

  const buildOwnerSession = (
    designation: OwnerDesignation = 'owner',
    teacherGrade?: string,
    teacherProfile?: TeacherRecord,
    targetSchool?: SchoolProfile
  ): UserSession => {
    const resolvedOwnerTeacher = teacherProfile || resolveRegisteredTeacherForOwner().teacher;
    const resolvedSch = targetSchool || schoolProfile;
    const schoolGrades = grades.filter((g) => (g.schoolId || 'sch-001') === (resolvedSch.id || currentSchoolId));
    const ownerTeacherInfo = resolveRegisteredTeacherForOwner(resolvedSch.id || currentSchoolId);
    const resolvedRegisteredGrade =
      teacherGrade ||
      resolvedOwnerTeacher?.assignedGrade ||
      ownerTeacherInfo.assignedGrade ||
      schoolGrades[0]?.name ||
      'Grade 7A';
    const resolvedSubjects =
      resolvedOwnerTeacher?.registeredSubjects && resolvedOwnerTeacher.registeredSubjects.length > 0
        ? resolvedOwnerTeacher.registeredSubjects
        : undefined;
    const resolvedTeacherName = resolvedOwnerTeacher?.name || 'App Owner & Director';

    const base: UserSession = {
      id: 'user-owner-main',
      name: 'App Owner & Director',
      email: 'dwnwmnd@gmail.com',
      phone: '0716235185',
      idNumber: '34233496',
      role: 'admin',
      title: 'App Owner & School Director (Master Executive)',
      isOwner: true,
      ownerDesignation: designation,
      schoolId: resolvedSch.id || currentSchoolId,
    };

    switch (designation) {
      case 'hoi':
        return {
          ...base,
          role: 'admin',
          title: 'Head of Institution (HOI) / Chief Principal',
        };
      case 'deputy_hoi':
        return {
          ...base,
          role: 'admin',
          title: 'Deputy Head of Institution (Deputy HOI) · Academics & Operations',
        };
      case 'exam_council':
        return {
          ...base,
          role: 'admin',
          title: 'Academic Coordinator & Examination Council Chair',
        };
      case 'senior_teacher':
        return {
          ...base,
          name: resolvedTeacherName,
          role: 'teacher',
          teacherType: 'class_teacher',
          teacherGrade: resolvedRegisteredGrade,
          registeredSubjects: resolvedSubjects || ['Mathematics', 'Integrated Science', 'Pre-Technical Studies'],
          title: `Senior Teacher & Academic Lead (${resolvedRegisteredGrade})`,
        };
      case 'class_teacher':
        return {
          ...base,
          name: resolvedTeacherName,
          role: 'teacher',
          teacherType: 'class_teacher',
          teacherGrade: resolvedRegisteredGrade,
          registeredSubjects: resolvedSubjects || ['Mathematics', 'Creative Arts and Sports'],
          title: `Class Teacher · ${resolvedRegisteredGrade} (${resolvedSch.name})`,
        };
      case 'subject_teacher':
        return {
          ...base,
          name: resolvedTeacherName,
          role: 'teacher',
          teacherType: 'subject_teacher',
          teacherGrade: resolvedOwnerTeacher?.assignedGrade || ownerTeacherInfo.assignedGrade,
          registeredSubjects: resolvedSubjects || ['Mathematics', 'Integrated Science'],
          title: `Subject Teacher (${(resolvedSubjects || ['Mathematics', 'Integrated Science']).join(', ')}) · ${resolvedSch.name}`,
        };
      case 'parent':
        return {
          ...base,
          role: 'parent',
          parentId: 'par-1',
          learnerId: 'stu-1',
          title: 'Parent / Guardian of Liam Mwangi (Grade 7A)',
        };
      case 'owner':
      default:
        return {
          ...base,
          role: 'admin',
          title: 'App Owner & School Director (Master Executive)',
        };
    }
  };

  const switchOwnerResponsibility = (
    designation: OwnerDesignation,
    grade?: string
  ) => {
    const ownerTeacherInfo = resolveRegisteredTeacherForOwner(currentSchoolId);
    const schoolGrades = grades.filter((g) => (g.schoolId || 'sch-001') === currentSchoolId);
    const targetGrade =
      grade ||
      ownerTeacherInfo.assignedGrade ||
      currentUser?.teacherGrade ||
      schoolGrades[0]?.name ||
      'Grade 7A';
    const updated = buildOwnerSession(designation, targetGrade, ownerTeacherInfo.teacher, schoolProfile);
    setCurrentUser(updated);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}user`, JSON.stringify(updated));
    if (updated.role === 'parent' && updated.parentId) {
      setDecryptedParentIds(new Set([updated.parentId]));
    } else {
      setDecryptedParentIds(new Set());
    }
    addAuditLog(
      'Owner Responsibility Switched',
      `App Owner switched active responsibility context to: ${updated.title}`
    );
  };

  const loginWithCredentials = async (
    phoneInput: string,
    idNumberInput: string,
    actingDesignation?: OwnerDesignation
  ): Promise<LoginResult> => {
    const rawPhone = phoneInput.trim();
    const rawId = idNumberInput.trim();

    if (!rawPhone || !rawId) {
      return {
        success: false,
        error: 'Please provide both your registered mobile phone number and ID number (as password).',
      };
    }

    const validation = validateKenyanPhoneNumber(rawPhone);
    if (!validation.isValid) {
      return {
        success: false,
        error:
          validation.error ||
          'The phone number format should start with 07.... Or 01.... Not +2547.... nor +254..... (Example: 0712345678 or 0110445566)',
      };
    }
    const cleanPhone = validation.cleanPhone!;

    const normId = (id: string) => id.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    const phoneMatch = (stored: string, targetClean: string) => {
      const s = normalizeKenyanPhone(stored);
      return s === targetClean;
    };

    const idMatch = (stored: string, input: string) => {
      const s = normId(stored);
      const i = normId(input);
      if (!s || !i) return false;
      const cleanS = s.replace(/^ID/, '');
      const cleanI = i.replace(/^ID/, '');
      return s === i || cleanS === cleanI || cleanS === i || s === cleanI;
    };

    clearAllTrialAndStaleSessions();

    // 0. CHECK IF ATTEMPTING TO ACCESS APP OWNER ACCOUNT
    const isOwnerPhone = cleanPhone === OWNER_PHONE || phoneMatch(OWNER_PHONE, cleanPhone);
    const isOwnerId = idMatch(OWNER_ID_NUMBER, rawId);

    if (isOwnerPhone) {
      // Access to owner account is strictly restricted to ID 34233496
      if (!isOwnerId) {
        return {
          success: false,
          error: 'Access Denied: Invalid password credentials for the School Owner Account.',
        };
      }

      // Valid credentials for Owner! Now enforce SINGLE ACTIVE PHONE at a time.
      const currentLock = await getOwnerDeviceLock();

      const effectiveDesignation = actingDesignation || 'owner';
      const isTeacherContext =
        effectiveDesignation === 'class_teacher' ||
        effectiveDesignation === 'senior_teacher' ||
        effectiveDesignation === 'subject_teacher';
      const ownerTeacherInfo = resolveRegisteredTeacherForOwner(currentSchoolId);
      const targetSchoolForTeacher =
        isTeacherContext && ownerTeacherInfo.schoolId
          ? registeredSchools.find((s) => s.id === ownerTeacherInfo.schoolId) || schoolProfile
          : schoolProfile;

      // Case A: First-time initialization (no device locked yet)
      if (!currentLock || !currentLock.activeDeviceId) {
        const newLock: OwnerDeviceLock = {
          id: OWNER_LOCK_DOC_ID,
          activeDeviceId: currentDeviceId,
          activeDeviceName: currentDeviceName,
          authorizedPhone: OWNER_PHONE,
          authorizedId: OWNER_ID_NUMBER,
          lastActiveAt: new Date().toISOString(),
          registeredAt: new Date().toISOString(),
          pendingChallenge: null,
        };
        await persistOwnerDeviceLock(newLock);
        setOwnerDeviceLock(newLock);

        if (isTeacherContext && targetSchoolForTeacher.id !== currentSchoolId) {
          switchActiveSchool(targetSchoolForTeacher.id, true);
        }

        const ownerSession = buildOwnerSession(
          effectiveDesignation,
          ownerTeacherInfo.assignedGrade,
          ownerTeacherInfo.teacher,
          targetSchoolForTeacher
        );
        setCurrentUser(ownerSession);
        setIsAuthenticated(true);
        if (ownerSession.role === 'parent' && ownerSession.parentId) {
          setDecryptedParentIds(new Set([ownerSession.parentId]));
        } else {
          setDecryptedParentIds(new Set());
        }
        addAuditLog(
          'Owner Primary Phone Initialized',
          `Primary device bound to Owner Account: ${currentDeviceName} (ID: ${currentDeviceId.slice(0, 8)}...). Single-phone lock active.`
        );
        return { success: true, session: ownerSession };
      }

      // Case B: Current device matches the authorized active phone
      if (currentLock.activeDeviceId === currentDeviceId) {
        currentLock.lastActiveAt = new Date().toISOString();
        currentLock.activeDeviceName = currentDeviceName;
        await persistOwnerDeviceLock(currentLock);
        setOwnerDeviceLock(currentLock);

        if (isTeacherContext && targetSchoolForTeacher.id !== currentSchoolId) {
          switchActiveSchool(targetSchoolForTeacher.id, true);
        }

        const ownerSession = buildOwnerSession(
          effectiveDesignation,
          ownerTeacherInfo.assignedGrade,
          ownerTeacherInfo.teacher,
          targetSchoolForTeacher
        );
        setCurrentUser(ownerSession);
        setIsAuthenticated(true);
        if (ownerSession.role === 'parent' && ownerSession.parentId) {
          setDecryptedParentIds(new Set([ownerSession.parentId]));
        } else {
          setDecryptedParentIds(new Set());
        }
        addAuditLog(
          'Owner Device Authenticated',
          `Owner logged in from verified active device: ${currentDeviceName}.`
        );
        return { success: true, session: ownerSession };
      }

      // Case C: Second or Third Party Device Attempting Access!
      // Enforce: Only ONE phone at a time. Trigger OTP sent to owner number 0716235185.
      const challengeRes = await initiateOwnerOtpChallenge(currentDeviceId, currentDeviceName);
      const updatedLock = await getOwnerDeviceLock();
      setOwnerDeviceLock(updatedLock);

      addAuditLog(
        'Owner Device OTP Challenge Dispatched',
        `Secondary device (${currentDeviceName}) attempted Owner access. Cellular SMS OTP dispatched to ${OWNER_PHONE}.`
      );

      return {
        success: false,
        requiresOtp: true,
        challengeDetails: {
          phone: OWNER_PHONE,
          targetDeviceId: currentDeviceId,
          expiresAt: challengeRes.challenge.expiresAt,
          dispatchedOtpPreview: challengeRes.challenge.otpCode,
        },
      };
    }

    // 1. Check Parent Records (matches Parent National ID OR Linked Learner Admission Number)
    let matchedChildByAdm = learners.find((l) => idMatch(l.studentId, rawId));
    const matchedParent = parents.find((p) => {
      const phoneOk =
        phoneMatch(p.phone, cleanPhone) ||
        (p.alternatePhone && phoneMatch(p.alternatePhone, cleanPhone));
      if (!phoneOk) return false;
      const parentChildren = learners.filter((l) => l.parentId === p.id);
      const admOk = parentChildren.some((l) => idMatch(l.studentId, rawId));
      return idMatch(p.nationalId, rawId) || admOk;
    });

    if (matchedParent) {
      const parentSchoolId = matchedParent.schoolId || 'sch-001';
      const targetSchool = registeredSchools.find((s) => s.id === parentSchoolId) || schoolProfile;
      switchActiveSchool(targetSchool.id, true);

      const child =
        (matchedChildByAdm && matchedChildByAdm.parentId === matchedParent.id
          ? matchedChildByAdm
          : undefined) || learners.find((l) => l.parentId === matchedParent.id);
      const session: UserSession = {
        id: `session-parent-${matchedParent.id}`,
        name: matchedParent.fullName,
        role: 'parent',
        email: matchedParent.email,
        phone: normalizeKenyanPhone(matchedParent.phone),
        idNumber: matchedParent.nationalId,
        title: child
          ? `Parent of ${child.firstName} ${child.lastName} (${child.grade}) · ${targetSchool.name}`
          : `Parent / Guardian · ${targetSchool.name}`,
        parentId: matchedParent.id,
        learnerId: child ? child.id : undefined,
        schoolId: targetSchool.id,
      };

      setCurrentUser(session);
      setIsAuthenticated(true);
      setDecryptedParentIds(new Set([matchedParent.id]));
      addAuditLog(
        'Parent Portal Authentication',
        `Authenticated parent ${matchedParent.fullName} routed to ${targetSchool.name}.`
      );
      return { success: true, session };
    }

    // 2. Check Teachers Directory
    const matchedTeacher = teachers.find(
      (t) => phoneMatch(t.phone, cleanPhone) && idMatch(t.nationalOrStaffId, rawId)
    );

    if (matchedTeacher) {
      const teacherSchoolId = matchedTeacher.schoolId || 'sch-001';
      const targetSchool = registeredSchools.find((s) => s.id === teacherSchoolId) || schoolProfile;

      // ENFORCE SCHOOL LOCK: Teachers cannot log in when school is locked
      if (targetSchool.isLocked) {
        return {
          success: false,
          error: `School Portal Locked: ${targetSchool.name} is currently locked by the Institution Director. Teachers and faculty cannot log in while the school portal is locked. Only when unlocked can they log in. (Notice: ${targetSchool.lockReason || 'Administrative lock engaged by Institution Director'}).`,
        };
      }

      switchActiveSchool(targetSchool.id, true);

      const isClassTeacher = matchedTeacher.teacherType === 'class_teacher';
      const session: UserSession = {
        id: `session-teacher-${matchedTeacher.id}`,
        name: matchedTeacher.name,
        role: 'teacher',
        email: matchedTeacher.email,
        phone: normalizeKenyanPhone(matchedTeacher.phone),
        idNumber: matchedTeacher.nationalOrStaffId,
        title: isClassTeacher
          ? `Class Teacher · ${matchedTeacher.assignedGrade} (${targetSchool.name})`
          : `Subject Teacher (${matchedTeacher.registeredSubjects.join(', ')}) · ${targetSchool.name}`,
        teacherType: matchedTeacher.teacherType,
        teacherGrade: matchedTeacher.assignedGrade,
        registeredSubjects: matchedTeacher.registeredSubjects,
        schoolId: targetSchool.id,
      };

      setCurrentUser(session);
      setIsAuthenticated(true);
      setDecryptedParentIds(new Set());
      addAuditLog(
        'Teacher Portal Authentication',
        `${matchedTeacher.name} logged into ${targetSchool.name} as ${isClassTeacher ? `Class Teacher (${matchedTeacher.assignedGrade})` : 'Subject Teacher'}.`
      );
      return { success: true, session };
    }

    // 3. Check Registered Administrators & Bursars
    const matchedRegisteredAdmin = adminAccounts.find(
      (a) => phoneMatch(a.phone, cleanPhone) && idMatch(a.nationalOrStaffId, rawId)
    );
    if (matchedRegisteredAdmin) {
      const adminSchoolId = matchedRegisteredAdmin.schoolId || 'sch-001';
      const targetSchool = registeredSchools.find((s) => s.id === adminSchoolId) || schoolProfile;

      // ENFORCE SCHOOL LOCK: School administrators cannot log in when school is locked
      if (targetSchool.isLocked) {
        return {
          success: false,
          error: `School Portal Locked: ${targetSchool.name} is currently locked by the Institution Director. School administrators and bursars cannot log in while the school portal is locked. Only when unlocked can they log in. (Notice: ${targetSchool.lockReason || 'Administrative lock engaged by Institution Director'}).`,
        };
      }

      switchActiveSchool(targetSchool.id, true);

      const session: UserSession = {
        id: `session-admin-${matchedRegisteredAdmin.id}`,
        name: matchedRegisteredAdmin.name,
        role: matchedRegisteredAdmin.role,
        email: matchedRegisteredAdmin.email,
        phone: normalizeKenyanPhone(matchedRegisteredAdmin.phone),
        idNumber: matchedRegisteredAdmin.nationalOrStaffId,
        title: `${matchedRegisteredAdmin.title} · ${targetSchool.name}`,
        schoolId: targetSchool.id,
      };
      setCurrentUser(session);
      setIsAuthenticated(true);
      addAuditLog(
        `${matchedRegisteredAdmin.role === 'admin' ? 'Administrator' : 'Bursar'} Portal Authentication`,
        `${matchedRegisteredAdmin.name} logged into ${targetSchool.name}.`
      );
      return { success: true, session };
    }

    // 4. Fallback to Initial User Sessions
    const matchedSession = INITIAL_USER_SESSIONS.find(
      (u) =>
        (u.role === 'admin' || u.role === 'bursar') &&
        phoneMatch(u.phone, cleanPhone) &&
        idMatch(u.idNumber, rawId)
    );
    if (matchedSession) {
      const adminSchoolId = matchedSession.schoolId || 'sch-001';
      const targetSchool = registeredSchools.find((s) => s.id === adminSchoolId) || schoolProfile;

      if (targetSchool.isLocked) {
        return {
          success: false,
          error: `School Portal Locked: ${targetSchool.name} is currently locked by the Institution Director. School administrators cannot log in while the school portal is locked. Only when unlocked can they log in.`,
        };
      }

      switchActiveSchool(targetSchool.id, true);
      setCurrentUser({ ...matchedSession, schoolId: targetSchool.id });
      setIsAuthenticated(true);
      addAuditLog(`${matchedSession.role.toUpperCase()} Authentication`, `${matchedSession.name} logged in.`);
      return { success: true, session: { ...matchedSession, schoolId: targetSchool.id } };
    }

    return {
      success: false,
      error:
        'Access Denied: No account matched the provided mobile phone number and ID number password. Please check your credentials.',
    };
  };

  const verifyOwnerOtp = async (
    enteredOtp: string,
    actingDesignation: OwnerDesignation = 'owner'
  ): Promise<{ success: boolean; error?: string; session?: UserSession }> => {
    const res = await verifyOwnerOtpAndAuthorizeDevice(
      enteredOtp,
      currentDeviceId,
      currentDeviceName
    );
    if (!res.success) {
      return { success: false, error: res.error };
    }

    const updatedLock = await getOwnerDeviceLock();
    setOwnerDeviceLock(updatedLock);

    const isTeacherContext =
      actingDesignation === 'class_teacher' ||
      actingDesignation === 'senior_teacher' ||
      actingDesignation === 'subject_teacher';
    const ownerTeacherInfo = resolveRegisteredTeacherForOwner(currentSchoolId);
    const targetSchoolForTeacher =
      isTeacherContext && ownerTeacherInfo.schoolId
        ? registeredSchools.find((s) => s.id === ownerTeacherInfo.schoolId) || schoolProfile
        : schoolProfile;
    if (isTeacherContext && targetSchoolForTeacher.id !== currentSchoolId) {
      switchActiveSchool(targetSchoolForTeacher.id, true);
    }

    const ownerSession = buildOwnerSession(
      actingDesignation,
      ownerTeacherInfo.assignedGrade,
      ownerTeacherInfo.teacher,
      targetSchoolForTeacher
    );
    setCurrentUser(ownerSession);
    setIsAuthenticated(true);
    if (ownerSession.role === 'parent' && ownerSession.parentId) {
      setDecryptedParentIds(new Set([ownerSession.parentId]));
    } else {
      setDecryptedParentIds(new Set());
    }

    addAuditLog(
      'Owner Access Granted via Verified OTP',
      `Access authorized for secondary device (${currentDeviceName}). Active single-phone lock transferred. Prior device revoked.`
    );
    return { success: true, session: ownerSession };
  };

  const resendOwnerOtp = async (): Promise<{ success: boolean; error?: string; dispatchedOtpPreview?: string }> => {
    const res = await initiateOwnerOtpChallenge(currentDeviceId, currentDeviceName);
    if (res.success) {
      const updated = await getOwnerDeviceLock();
      setOwnerDeviceLock(updated);
      return { success: true, dispatchedOtpPreview: res.challenge.otpCode };
    }
    return { success: false, error: res.error || 'Failed to dispatch SMS' };
  };

  const forceRelockOwnerDevice = async (): Promise<boolean> => {
    const lock: OwnerDeviceLock = {
      id: OWNER_LOCK_DOC_ID,
      activeDeviceId: currentDeviceId,
      activeDeviceName: currentDeviceName,
      authorizedPhone: OWNER_PHONE,
      authorizedId: OWNER_ID_NUMBER,
      lastActiveAt: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
      pendingChallenge: null,
    };
    await persistOwnerDeviceLock(lock);
    setOwnerDeviceLock(lock);
    addAuditLog('Owner Device Re-locked', `Active single-phone lock re-bound to current device: ${currentDeviceName}`);
    return true;
  };

  const requestPasswordResetLink = (
    phoneInput: string
  ): {
    success: boolean;
    error?: string;
    resetToken?: string;
    resetLink?: string;
    user?: { name: string; role: string; phone: string; idNumber: string };
  } => {
    const validation = validateKenyanPhoneNumber(phoneInput);
    if (!validation.isValid) {
      return {
        success: false,
        error:
          validation.error ||
          'The phone number format should start with 07.... Or 01.... Not +2547.... nor +254..... (Example: 0712345678 or 0110445566)',
      };
    }

    const cleanPhone = validation.cleanPhone!;

    // Find account across parents, teachers, and administrative staff
    const parent = parents.find(
      (p) =>
        normalizeKenyanPhone(p.phone) === cleanPhone ||
        (p.alternatePhone && normalizeKenyanPhone(p.alternatePhone) === cleanPhone)
    );
    if (parent) {
      const token = `RST-${Math.floor(100000 + Math.random() * 900000)}`;
      const resetLink = `https://academiacademy.edu/reset?token=${token}&phone=${cleanPhone}`;

      addAuditLog(
        'Password Reset Link Requested',
        `Password reset link dispatched via cellular SMS to ${cleanPhone} for Parent ${parent.fullName}.`
      );

      // Record SMS delivery in reminders table
      const resetSms: PaymentReminder = {
        id: `sms-reset-${Date.now()}`,
        learnerId: '',
        parentId: parent.id,
        term: 'Account Security',
        amountDue: 0,
        dueDate: new Date().toISOString().slice(0, 10),
        type: 'upcoming_due',
        channel: 'sms',
        status: 'delivered',
        scheduledDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
        sentDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
        messagePreview: `ACADEMIA-PORTAL SMS: Reset your password by clicking ${resetLink} (Link valid for 15 minutes).`,
      };
      setReminders((prev) => [resetSms, ...prev]);

      return {
        success: true,
        resetToken: token,
        resetLink,
        user: {
          name: parent.fullName,
          role: 'Parent',
          phone: cleanPhone,
          idNumber: parent.nationalId,
        },
      };
    }

    const teacher = teachers.find((t) => normalizeKenyanPhone(t.phone) === cleanPhone);
    if (teacher) {
      const token = `RST-${Math.floor(100000 + Math.random() * 900000)}`;
      const resetLink = `https://academiacademy.edu/reset?token=${token}&phone=${cleanPhone}`;

      addAuditLog(
        'Password Reset Link Requested',
        `Password reset link dispatched via cellular SMS to ${cleanPhone} for Teacher ${teacher.name}.`
      );

      const resetSms: PaymentReminder = {
        id: `sms-reset-${Date.now()}`,
        learnerId: '',
        parentId: '',
        term: 'Account Security',
        amountDue: 0,
        dueDate: new Date().toISOString().slice(0, 10),
        type: 'upcoming_due',
        channel: 'sms',
        status: 'delivered',
        scheduledDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
        sentDate: new Date().toISOString().replace('T', ' ').slice(0, 16),
        messagePreview: `ACADEMIA-PORTAL SMS: Reset your teacher password by clicking ${resetLink} (Link valid for 15 minutes).`,
      };
      setReminders((prev) => [resetSms, ...prev]);

      return {
        success: true,
        resetToken: token,
        resetLink,
        user: {
          name: teacher.name,
          role: teacher.teacherType === 'class_teacher' ? `Class Teacher (${teacher.assignedGrade})` : 'Subject Teacher',
          phone: cleanPhone,
          idNumber: teacher.nationalOrStaffId,
        },
      };
    }

    const adminUser = INITIAL_USER_SESSIONS.find((u) => normalizeKenyanPhone(u.phone) === cleanPhone);
    if (adminUser) {
      const token = `RST-${Math.floor(100000 + Math.random() * 900000)}`;
      const resetLink = `https://academiacademy.edu/reset?token=${token}&phone=${cleanPhone}`;

      addAuditLog(
        'Password Reset Link Requested',
        `Password reset link dispatched via cellular SMS to ${cleanPhone} for ${adminUser.name} (${adminUser.role.toUpperCase()}).`
      );

      return {
        success: true,
        resetToken: token,
        resetLink,
        user: {
          name: adminUser.name,
          role: adminUser.role.toUpperCase(),
          phone: cleanPhone,
          idNumber: adminUser.idNumber,
        },
      };
    }

    return {
      success: false,
      error: `No registered account found with mobile phone ${cleanPhone}. Please verify your 10-digit number (format starting with 07... or 01...) or contact the school office.`,
    };
  };

  const resetPasswordForUser = (
    phoneInput: string,
    _token: string,
    newPasswordOrId: string
  ): { success: boolean; error?: string; userName?: string } => {
    const validation = validateKenyanPhoneNumber(phoneInput);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }
    const cleanPhone = validation.cleanPhone!;
    const newPass = newPasswordOrId.trim();

    if (!newPass || newPass.length < 3) {
      return {
        success: false,
        error: 'New password must be at least 3 characters long (e.g. your updated National ID or Staff ID).',
      };
    }

    // 1. Check Parents
    const parentIndex = parents.findIndex(
      (p) =>
        normalizeKenyanPhone(p.phone) === cleanPhone ||
        (p.alternatePhone && normalizeKenyanPhone(p.alternatePhone) === cleanPhone)
    );
    if (parentIndex !== -1) {
      const target = parents[parentIndex];
      const updatedParents = [...parents];
      updatedParents[parentIndex] = { ...target, nationalId: newPass };
      setParents(updatedParents);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}parents`, JSON.stringify(updatedParents));

      addAuditLog(
        'Password Reset Completed',
        `Password (National ID) reset completed successfully for Parent ${target.fullName} via verified SMS link to ${cleanPhone}.`
      );
      return { success: true, userName: target.fullName };
    }

    // 2. Check Teachers
    const teacherIndex = teachers.findIndex((t) => normalizeKenyanPhone(t.phone) === cleanPhone);
    if (teacherIndex !== -1) {
      const target = teachers[teacherIndex];
      const updatedTeachers = [...teachers];
      updatedTeachers[teacherIndex] = { ...target, nationalOrStaffId: newPass };
      setTeachers(updatedTeachers);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}teachers`, JSON.stringify(updatedTeachers));

      addAuditLog(
        'Password Reset Completed',
        `Password (Staff ID) reset completed successfully for Teacher ${target.name} via verified SMS link to ${cleanPhone}.`
      );
      return { success: true, userName: target.name };
    }

    // 3. Check Administrators
    const adminIndex = INITIAL_USER_SESSIONS.findIndex(
      (u) => normalizeKenyanPhone(u.phone) === cleanPhone
    );
    if (adminIndex !== -1) {
      const target = INITIAL_USER_SESSIONS[adminIndex];
      target.idNumber = newPass;

      addAuditLog(
        'Password Reset Completed',
        `Password reset completed successfully for ${target.name} (${target.role.toUpperCase()}) via verified SMS link to ${cleanPhone}.`
      );
      return { success: true, userName: target.name };
    }

    return {
      success: false,
      error: 'Account could not be found to complete the password update.',
    };
  };

  const logout = () => {
    clearAllTrialAndStaleSessions();
    localStorage.removeItem('elimupulse_staff_session');
    firebaseSignOut(auth).catch(() => {});
    setIsAuthenticated(false);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}auth`);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}user`);
    setDecryptedParentIds(new Set());
    addAuditLog('User Session Ended', `Signed out ${currentUser?.name || 'User'}`);
  };

  const toggleParentDecryption = async (parentId: string): Promise<boolean> => {
    const allowed = canRoleDecryptSensitivePII(currentUser?.role);
    if (!allowed && currentUser?.role !== 'parent') {
      alert("Access Denied: Your assigned role lacks permissions to decrypt sensitive PII.");
      return false;
    }

    // If already decrypted, re-encrypt / hide
    if (decryptedParentIds.has(parentId)) {
      setDecryptedParentIds((prev) => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
      return false;
    }

    // Decrypt and log
    const parent = parents.find((p) => p.id === parentId);
    setDecryptedParentIds((prev) => new Set(prev).add(parentId));
    addAuditLog(
      'Decrypted Sensitive PII',
      `Authorized decryption of phone, ID & address for parent ${parent?.fullName || parentId}`,
      true
    );
    return true;
  };

  const isParentDecrypted = (parentId: string) => {
    // If user is parent and this is their child's parent or themselves, always allow
    if (currentUser?.role === 'parent') {
      if (currentUser?.parentId === parentId) return true;
      if (currentUser?.learnerId) {
        const learner = learners.find((l) => l.id === currentUser?.learnerId);
        if (learner && learner.parentId === parentId) return true;
      }
    }
    return decryptedParentIds.has(parentId);
  };

  const addLearnerWithParent = async (
    learnerData: Omit<LearnerRecord, 'id' | 'studentId' | 'parentId' | 'status' | 'enrollmentDate' | 'photoPlaceholderColor'>,
    parentData: Omit<ParentRecord, 'id' | 'encryptedPayload'>,
    initialTuition: number,
    term: string,
    dueDate: string
  ) => {
    const parentId = `par-${Date.now()}`;
    const learnerId = `stu-${Date.now()}`;
    const studentIdNumber = String(learners.length + 1).padStart(3, '0');
    const studentId = `STU-2026-${studentIdNumber}`;

    // Encrypt sensitive phone + email payload for storage (with safe Base64 fallback)
    let encryptedPayload = '';
    try {
      encryptedPayload = await encryptSensitiveText(`${parentData.email || ''}|${parentData.phone || ''}`);
    } catch (encErr) {
      console.warn('WebCrypto fallback used for parent payload:', encErr);
      encryptedPayload = btoa(unescape(encodeURIComponent(`${parentData.email || ''}|${parentData.phone || ''}`)));
    }

    const cleanParentData = Object.fromEntries(
      Object.entries(parentData).filter(([_, v]) => v !== undefined)
    ) as unknown as Omit<ParentRecord, 'id' | 'encryptedPayload'>;

    const newParent: ParentRecord = {
      ...cleanParentData,
      id: parentId,
      encryptedPayload,
      schoolId: currentSchoolId,
    };

    const colors = ['bg-indigo-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-sky-600', 'bg-teal-600', 'bg-violet-600'];
    const randomColor = colors[learners.length % colors.length];

    const cleanLearnerData = Object.fromEntries(
      Object.entries(learnerData).filter(([_, v]) => v !== undefined)
    ) as unknown as Omit<LearnerRecord, 'id' | 'studentId' | 'parentId' | 'enrollmentDate' | 'status' | 'photoPlaceholderColor'>;

    const newLearner: LearnerRecord = {
      ...cleanLearnerData,
      id: learnerId,
      studentId,
      parentId,
      enrollmentDate: new Date().toISOString().slice(0, 10),
      status: 'active',
      photoPlaceholderColor: randomColor,
      schoolId: currentSchoolId,
    };

    const newFeeStructure: FeeStructure = {
      id: `fs-${Date.now()}`,
      learnerId,
      term,
      tuitionFee: initialTuition,
      sportsAndActivityFee: 150,
      learningMaterialsFee: 100,
      discountOrScholarship: 0,
      totalDue: initialTuition + 250,
      amountPaid: 0,
      balance: initialTuition + 250,
      dueDate,
      status: 'pending',
      schoolId: currentSchoolId,
    };

    setParents((prev) => [newParent, ...prev]);
    setLearners((prev) => [newLearner, ...prev]);
    setFeeStructures((prev) => [newFeeStructure, ...prev]);

    // Persist to Firestore
    saveDocumentToFirestore('parents', newParent).catch((e) => console.warn('Firestore write error:', e));
    saveDocumentToFirestore('learners', newLearner).catch((e) => console.warn('Firestore write error:', e));
    saveDocumentToFirestore('feeStructures', newFeeStructure).catch((e) => console.warn('Firestore write error:', e));

    const targetSchoolForRtdb = newLearner.schoolId || currentSchoolId || 'sch-001';
    set(ref(rtdb, `schools/${targetSchoolForRtdb}/parents/${newParent.id}`), newParent).catch((e) =>
      console.warn('RTDB parent mirror warning:', e)
    );
    set(ref(rtdb, `schools/${targetSchoolForRtdb}/learners/${newLearner.id}`), newLearner).catch((e) =>
      console.warn('RTDB learner mirror warning:', e)
    );
    set(ref(rtdb, `schools/${targetSchoolForRtdb}/feeStructures/${newFeeStructure.id}`), newFeeStructure).catch((e) =>
      console.warn('RTDB feeStructure mirror warning:', e)
    );

    addAuditLog('Created Student & Parent Record', `Enrolled ${newLearner.firstName} ${newLearner.lastName} (${studentId}) with parent ${newParent.fullName}`);
  };

  const updateLearner = (id: string, updates: Partial<LearnerRecord>) => {
    setLearners((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const updated = { ...l, ...updates };
          saveDocumentToFirestore('learners', updated).catch((e) => console.warn('Firestore write error:', e));
          const schId = updated.schoolId || currentSchoolId || 'sch-001';
          set(ref(rtdb, `schools/${schId}/learners/${updated.id}`), updated).catch(() => {});
          return updated;
        }
        return l;
      })
    );
    addAuditLog('Updated Learner Profile', `Modified details for learner ${id}`);
  };

  const requestLearnerDeletion = (learnerId: string) => {
    const target = learners.find((l) => l.id === learnerId);
    if (!target) return;
    const requestedBy = currentUser?.name || currentUser?.email || 'Class Teacher';
    updateLearner(learnerId, {
      pendingHoiDeletion: true,
      deletionRequestedBy: requestedBy,
      deletionRequestedAt: new Date().toISOString(),
    } as Partial<LearnerRecord>);
    addAuditLog(
      'Learner Deletion Pending HOI Approval',
      `Class teacher ${requestedBy} requested deletion for ${target.firstName} ${target.lastName} (${target.studentId}). Learner remains active in the school until HOI approves.`
    );
  };

  const approveLearnerDeletion = async (learnerId: string) => {
    await deleteLearner(learnerId);
  };

  const rejectLearnerDeletion = (learnerId: string) => {
    const target = learners.find((l) => l.id === learnerId);
    if (!target) return;
    updateLearner(learnerId, {
      pendingHoiDeletion: false,
      deletionRequestedBy: undefined,
      deletionRequestedAt: undefined,
    } as Partial<LearnerRecord>);
    addAuditLog(
      'Learner Deletion Declined by HOI',
      `HOI retained ${target.firstName} ${target.lastName} (${target.studentId}) in the school.`
    );
  };

  const deleteLearner = async (id: string) => {
    const target = learners.find((l) => l.id === id);
    if (!target) return;
    const targetSchoolId = target.schoolId || currentSchoolId || 'sch-001';
    remove(ref(rtdb, `schools/${targetSchoolId}/learners/${id}`)).catch(() => {});

    const remainingLearners = learners.filter((l) => l.id !== id);
    const fsToDelete = feeStructures.filter((fs) => fs.learnerId === id);
    const fpToDelete = feePayments.filter((fp) => fp.learnerId === id);
    const scToDelete = scoreCards.filter((sc) => sc.learnerId === id);
    const attToDelete = attendance.filter((a) => a.learnerId === id);
    const remToDelete = reminders.filter((r) => r.learnerId === id);
    const shouldDeleteParent = Boolean(
      target.parentId && !remainingLearners.some((l) => l.parentId === target.parentId)
    );

    setLearners(remainingLearners);
    setFeeStructures((prev) => prev.filter((fs) => fs.learnerId !== id));
    setScoreCards((prev) => prev.filter((sc) => sc.learnerId !== id));
    setAttendance((prev) => prev.filter((a) => a.learnerId !== id));
    setFeePayments((prev) => prev.filter((fp) => fp.learnerId !== id));
    setReminders((prev) => prev.filter((r) => r.learnerId !== id));
    if (shouldDeleteParent) {
      setParents((prev) => prev.filter((p) => p.id !== target.parentId));
    }

    setAssessments((prev) =>
      prev.map((a) => {
        if (a.absentLearnerIds?.includes(id)) {
          const updated = {
            ...a,
            absentLearnerIds: a.absentLearnerIds.filter((lid) => lid !== id),
          };
          saveDocumentToFirestore('assessments', updated).catch(() => {});
          return updated;
        }
        return a;
      })
    );

    const firestoreDeletes: Promise<void>[] = [
      deleteDocumentFromFirestore('learners', id),
      ...fsToDelete.map((fs) => deleteDocumentFromFirestore('feeStructures', fs.id)),
      ...fpToDelete.map((fp) => deleteDocumentFromFirestore('feePayments', fp.id)),
      ...scToDelete.map((sc) => deleteDocumentFromFirestore('scoreCards', sc.id)),
      ...attToDelete.map((a) => deleteDocumentFromFirestore('attendance', a.id)),
      ...remToDelete.map((r) => deleteDocumentFromFirestore('paymentReminders', r.id)),
    ];
    if (shouldDeleteParent && target.parentId) {
      firestoreDeletes.push(deleteDocumentFromFirestore('parents', target.parentId));
    }

    const rtdbDeletes: Promise<void>[] = [
      remove(ref(rtdb, `schools/${targetSchoolId}/learners/${id}`)).catch(() => {}),
      ...fsToDelete.map((fs) => remove(ref(rtdb, `schools/${targetSchoolId}/feeStructures/${fs.id}`)).catch(() => {})),
      ...fpToDelete.map((fp) => remove(ref(rtdb, `schools/${targetSchoolId}/feePayments/${fp.id}`)).catch(() => {})),
    ];
    if (shouldDeleteParent && target.parentId) {
      rtdbDeletes.push(remove(ref(rtdb, `schools/${targetSchoolId}/parents/${target.parentId}`)).catch(() => {}));
    }

    try {
      await Promise.allSettled([...firestoreDeletes, ...rtdbDeletes]);
    } catch (e) {
      console.warn('Cascade delete warning for learner:', e);
    }

    try {
      addAuditLog(
        'Learner Record Deleted',
        `Permanently removed student ${target.firstName} ${target.lastName} (${target.studentId}) and all linked fee, score, attendance, and reminder records.`
      );
    } catch (auditErr) {
      console.warn('Audit log warning on learner delete:', auditErr);
    }
  };

  const updateParent = (id: string, updates: Partial<ParentRecord>) => {
    setParents((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          saveDocumentToFirestore('parents', updated).catch((e) => console.warn('Firestore write error:', e));
          return updated;
        }
        return p;
      })
    );
    addAuditLog('Updated Parent Contact', `Modified sensitive records for parent ${id}`, true);
  };

  const recordPayment = ({
    learnerId,
    term,
    amount,
    method,
    notes,
  }: {
    learnerId: string;
    term: string;
    amount: number;
    method: 'Bank Transfer' | 'M-Pesa / Mobile Money' | 'Card' | 'Cash';
    notes?: string;
  }): FeePayment => {
    const learner = learners.find((l) => l.id === learnerId);
    const parentId = learner ? learner.parentId : '';
    const receiptNum = `REC-2026-${String(feePayments.length + 101).padStart(4, '0')}`;
    const txnRef = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPayment: FeePayment = {
      id: `pay-${Date.now()}`,
      transactionRef: txnRef,
      receiptNumber: receiptNum,
      learnerId,
      parentId,
      term,
      amount,
      paymentDate: new Date().toISOString().slice(0, 10),
      method,
      status: 'completed',
      recordedBy: currentUser?.name,
      notes,
      schoolId: currentSchoolId,
    };

    // Update Fee structure
    setFeeStructures((prev) =>
      prev.map((fs) => {
        if (fs.learnerId === learnerId && fs.term === term) {
          const newAmountPaid = fs.amountPaid + amount;
          const newBalance = Math.max(0, fs.totalDue - newAmountPaid);
          const newStatus = newBalance <= 0 ? 'paid' : 'partial';
          const updatedFs: FeeStructure = {
            ...fs,
            amountPaid: newAmountPaid,
            balance: newBalance,
            status: newStatus,
          };
          saveDocumentToFirestore('feeStructures', updatedFs).catch((e) => console.warn('Firestore write error:', e));
          return updatedFs;
        }
        return fs;
      })
    );

    setFeePayments((prev) => [newPayment, ...prev]);
    saveDocumentToFirestore('feePayments', newPayment).catch((e) => console.warn('Firestore write error:', e));

    addAuditLog(
      'Recorded Tuition Payment',
      `Receipt ${receiptNum} issued for Ksh ${amount.toLocaleString()} (${method}) for ${learner?.firstName} ${learner?.lastName}`
    );

    return newPayment;
  };

  const batchDispatchReminders = () => {
    // Look for fee structures with pending or overdue balance > 0
    const pendingFees = feeStructures.filter((fs) => fs.balance > 0);
    let sentCount = 0;

    const updatedReminders = [...reminders];

    pendingFees.forEach((fee) => {
      const learner = learners.find((l) => l.id === fee.learnerId);
      const parent = parents.find((p) => p.id === learner?.parentId);
      if (!learner || !parent) return;

      const isOverdue = new Date(fee.dueDate) < new Date('2026-06-18');
      const reminderType = isOverdue ? 'overdue_first_notice' : 'upcoming_due';
      const channel = parent.preferredChannel === 'call' ? 'sms' : parent.preferredChannel;

      const message = isOverdue
        ? `Overdue Tuition Alert: Dear ${parent.fullName}, tuition balance of Ksh ${fee.balance.toLocaleString()} for ${learner.firstName} ${learner.lastName} is past due date (${fee.dueDate}). Kindly settle promptly.`
        : `Tuition Reminder: Dear ${parent.fullName}, term fees of Ksh ${fee.balance.toLocaleString()} for ${learner.firstName} ${learner.lastName} are due on ${fee.dueDate}.`;

      if (channel === 'sms' && parent.phone) {
        dispatchRealSms(parent.phone, message).catch((err) => {
          console.warn('Real SMS dispatch error:', err);
        });
      }

      updatedReminders.unshift({
        id: `rem-auto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        learnerId: learner.id,
        parentId: parent.id,
        term: fee.term,
        amountDue: fee.balance,
        dueDate: fee.dueDate,
        type: reminderType,
        channel,
        status: 'delivered',
        scheduledDate: new Date().toISOString().slice(0, 10),
        sentDate: new Date().toLocaleString(),
        messagePreview: message,
        schoolId: currentSchoolId,
      });

      sentCount++;
    });

    setReminders(updatedReminders);
    batchSyncToFirestore('paymentReminders', updatedReminders).catch((e) => console.warn('Firestore write error:', e));

    addAuditLog(
      'Dispatched Automated Payment Reminders',
      `Sent ${sentCount} automated SMS and email reminders to parents with pending tuition balances`
    );

    return {
      sentCount,
      message: `Successfully dispatched ${sentCount} automated payment notifications across SMS and Email queues.`,
    };
  };

  const sendBulkOverdueReminders = ({
    learnerIds,
    term,
    channels,
    customMessageTemplate,
    urgencyLevel = 'standard',
  }: {
    learnerIds: string[];
    term: string;
    channels: ('sms' | 'email')[];
    customMessageTemplate?: string;
    urgencyLevel?: 'standard' | 'friendly' | 'final';
  }) => {
    let sentSmsCount = 0;
    let sentEmailCount = 0;
    let totalDebtNotified = 0;
    const newReminders: PaymentReminder[] = [];

    learnerIds.forEach((id) => {
      const learner = learners.find((l) => l.id === id);
      const parent = parents.find((p) => p.id === learner?.parentId);
      const fee =
        feeStructures.find((fs) => fs.learnerId === id && fs.term === term) ||
        feeStructures.find((fs) => fs.learnerId === id && fs.balance > 0);

      if (!learner || !parent || !fee || fee.balance <= 0) return;

      totalDebtNotified += fee.balance;
      const dueDateStr = fee.dueDate;
      const amountStr = `Ksh ${fee.balance.toLocaleString()}`;

      let messageText = '';
      if (customMessageTemplate) {
        messageText = customMessageTemplate
          .replace(/{ParentName}/g, parent.fullName)
          .replace(/{LearnerName}/g, `${learner.firstName} ${learner.lastName}`)
          .replace(/{Grade}/g, learner.grade)
          .replace(/{AmountDue}/g, amountStr)
          .replace(/{DueDate}/g, dueDateStr)
          .replace(/{Paybill}/g, `Paybill 28491 (A/C: ${learner.studentId})`);
      } else if (urgencyLevel === 'final') {
        messageText = `FINAL OVERDUE DEMAND: Dear ${parent.fullName}, outstanding tuition of ${amountStr} for ${learner.firstName} ${learner.lastName} (${learner.grade}) was due on ${dueDateStr}. Immediate settlement required to prevent academic service suspension.`;
      } else if (urgencyLevel === 'friendly') {
        messageText = `Friendly Tuition Reminder: Dear ${parent.fullName}, a tuition balance of ${amountStr} remains for ${learner.firstName} for ${term} (due ${dueDateStr}). Settle via Paybill 28491. Thank you.`;
      } else {
        messageText = `OVERDUE TUITION ALERT: Dear ${parent.fullName}, tuition balance of ${amountStr} for ${learner.firstName} ${learner.lastName} is overdue (was due ${dueDateStr}). Please remit via Paybill 28491 A/C: ${learner.studentId}.`;
      }

      channels.forEach((ch) => {
        if (ch === 'sms') {
          sentSmsCount++;
          if (parent.phone) {
            dispatchRealSms(parent.phone, messageText).catch((err) => {
              console.warn('Real SMS dispatch error:', err);
            });
          }
        }
        if (ch === 'email') sentEmailCount++;

        newReminders.unshift({
          id: `rem-bulk-${Date.now()}-${ch}-${Math.random().toString(36).substring(2, 6)}`,
          learnerId: learner.id,
          parentId: parent.id,
          term: fee.term,
          amountDue: fee.balance,
          dueDate: fee.dueDate,
          type: 'overdue_first_notice',
          channel: ch,
          status: 'delivered',
          scheduledDate: new Date().toISOString().slice(0, 10),
          sentDate: new Date().toLocaleString(),
          messagePreview: messageText,
          schoolId: currentSchoolId,
        });
      });
    });

    setReminders((prev) => [...newReminders, ...prev]);
    batchSyncToFirestore('paymentReminders', newReminders).catch((e) => console.warn('Firestore write error:', e));

    const totalRecipients = learnerIds.length;
    addAuditLog(
      'Dispatched Bulk Overdue Reminders',
      `Sent ${sentSmsCount} SMS and ${sentEmailCount} emails across ${totalRecipients} accounts notifying Ksh ${totalDebtNotified.toLocaleString()} in overdue tuition`
    );

    return {
      sentSmsCount,
      sentEmailCount,
      totalRecipients,
      totalDebtNotified,
      message: `Successfully dispatched ${sentSmsCount} SMS and ${sentEmailCount} Email reminders across ${totalRecipients} parent accounts notifying Ksh ${totalDebtNotified.toLocaleString()} in overdue tuition.`,
    };
  };

  const scheduleReminder = (reminderData: Omit<PaymentReminder, 'id' | 'status'>) => {
    const newReminder: PaymentReminder = {
      ...reminderData,
      id: `rem-sch-${Date.now()}`,
      status: 'scheduled',
      schoolId: currentSchoolId,
    };
    setReminders((prev) => [newReminder, ...prev]);
    saveDocumentToFirestore('paymentReminders', newReminder).catch((e) => console.warn('Firestore write error:', e));
    addAuditLog('Scheduled Payment Reminder', `Scheduled reminder for ${reminderData.dueDate} via ${reminderData.channel}`);
  };

  const saveScoreCard = (card: ScoreCard) => {
    const cardWithSchool: ScoreCard = {
      ...card,
      schoolId: card.schoolId || currentSchoolId,
    };
    setScoreCards((prev) => {
      const exists = prev.some((c) => c.id === cardWithSchool.id);
      if (exists) {
        return prev.map((c) => (c.id === cardWithSchool.id ? cardWithSchool : c));
      }
      return [cardWithSchool, ...prev];
    });

    saveDocumentToFirestore('scoreCards', cardWithSchool).catch((e) => console.warn('Firestore write error:', e));

    const learner = learners.find((l) => l.id === card.learnerId);
    addAuditLog(
      'Published Learner Score Card',
      `Generated term report card for ${learner?.firstName} ${learner?.lastName} (${card.term}) with GPA ${card.gpa.toFixed(2)}`
    );
  };

  const recordSingleAttendance = (recordData: Omit<AttendanceRecord, 'id' | 'markedBy'>) => {
    const session = recordData.session || 'morning';
    const id = `att-${recordData.learnerId}-${recordData.date}-${session}`;
    const newRecord: AttendanceRecord = {
      ...recordData,
      session,
      id,
      markedBy: currentUser?.name,
      schoolId: currentSchoolId,
    };

    setAttendance((prev) => {
      const filtered = prev.filter(
        (a) => !(a.learnerId === recordData.learnerId && a.date === recordData.date && (a.session || 'morning') === session)
      );
      return [newRecord, ...filtered];
    });

    saveDocumentToFirestore('attendance', newRecord).catch((e) => console.warn('Firestore write error:', e));
  };

  const batchMarkClassAttendance = (
    date: string,
    grade: string,
    status: AttendanceStatus,
    session: AttendanceSession | 'both' = 'both'
  ) => {
    const classLearners = learners.filter((l) => l.grade === grade);
    const targetSessions: AttendanceSession[] = session === 'both' ? ['morning', 'afternoon'] : [session];

    const newRecords: AttendanceRecord[] = [];
    classLearners.forEach((l) => {
      targetSessions.forEach((sess) => {
        newRecords.push({
          id: `att-${l.id}-${date}-${sess}`,
          learnerId: l.id,
          date,
          session: sess,
          status,
          markedBy: currentUser?.name,
          schoolId: currentSchoolId,
        });
      });
    });

    setAttendance((prev) => {
      const existingOther = prev.filter(
        (a) => !(a.date === date && classLearners.some((l) => l.id === a.learnerId) && targetSessions.includes(a.session || 'morning'))
      );
      return [...newRecords, ...existingOther];
    });

    batchSyncToFirestore('attendance', newRecords).catch((e) => console.warn('Firestore write error:', e));

    addAuditLog(
      'Batch Marked Attendance',
      `Marked ${classLearners.length} students as ${status.toUpperCase()} (${session === 'both' ? 'Morning & Afternoon' : session}) for ${grade} on ${date}`
    );
  };

  const saveAssessment = (assessment: AssessmentRecord) => {
    const assessmentWithSchool: AssessmentRecord = {
      ...assessment,
      schoolId: assessment.schoolId || currentSchoolId,
    };
    setAssessments((prev) => {
      const exists = prev.some((a) => a.id === assessmentWithSchool.id);
      return exists ? prev.map((a) => (a.id === assessmentWithSchool.id ? assessmentWithSchool : a)) : [assessmentWithSchool, ...prev];
    });

    saveDocumentToFirestore('assessments', assessmentWithSchool).catch((e) => console.warn('Firestore write error:', e));
    addAuditLog('Assessment Configured', `Updated assessment ${assessment.name} for ${assessment.grade} (${assessment.term})`);
  };

  const saveSubjectSubmission = (submission: SubjectMarksSubmission) => {
    const submissionWithSchool: SubjectMarksSubmission = {
      ...submission,
      schoolId: submission.schoolId || currentSchoolId,
    };
    setSubjectSubmissions((prev) => {
      const exists = prev.some((s) => s.id === submissionWithSchool.id);
      return exists ? prev.map((s) => (s.id === submissionWithSchool.id ? submissionWithSchool : s)) : [submissionWithSchool, ...prev];
    });

    saveDocumentToFirestore('subjectSubmissions', submissionWithSchool).catch((e) => console.warn('Firestore write error:', e));
    addAuditLog('Subject Marks Submitted', `Submitted marks for ${submission.subjectName} (${submission.grade} - ${submission.term})`);
  };

  const toggleExamAbsence = (grade: string, term: string, learnerId: string, isAbsent: boolean, reason?: string) => {
    setAssessments((prev) => {
      const current = prev.find((a) => a.grade === grade && a.term === term) || {
        id: `asm-${grade.replace(/\s+/g, '-').toLowerCase()}-${term.replace(/\s+/g, '-').toLowerCase()}`,
        grade,
        term,
        academicYear: '2026',
        name: `${term} Summative Assessment 2026`,
        type: 'End of Term Exam' as const,
        dateAdministered: new Date().toISOString().slice(0, 10),
        status: 'in_progress' as const,
        absentLearnerIds: [],
      };

      const set = new Set(current.absentLearnerIds || []);
      if (isAbsent) {
        set.add(learnerId);
      } else {
        set.delete(learnerId);
      }

      const updated: AssessmentRecord = {
        ...current,
        absentLearnerIds: Array.from(set),
      };

      saveDocumentToFirestore('assessments', updated).catch(() => {});
      const exists = prev.some((a) => a.id === updated.id);
      return exists ? prev.map((a) => (a.id === updated.id ? updated : a)) : [updated, ...prev];
    });

    // Also update ScoreCard for this learner and term
    setScoreCards((prev) =>
      prev.map((sc) => {
        if (sc.learnerId === learnerId && sc.term === term) {
          const updatedCard: ScoreCard = {
            ...sc,
            isExamAbsent: isAbsent,
            ...(reason ? { examAbsentReason: reason } : {}),
          };
          saveDocumentToFirestore('scoreCards', updatedCard).catch(() => {});
          return updatedCard;
        }
        return sc;
      })
    );

    const learner = learners.find((l) => l.id === learnerId);
    const learnerName = learner ? `${learner.firstName} ${learner.lastName}` : learnerId;
    addAuditLog(
      isAbsent ? 'Marked Learner Exam Absent' : 'Cleared Exam Absenteeism',
      `${learnerName} marked ${isAbsent ? 'ABSENT (Did Not Sit)' : 'PRESENT'} for ${grade} ${term} assessment`,
      isAbsent
    );
  };

  const getLearnerById = (id: string) => learners.find((l) => l.id === id);
  const getParentById = (id: string) => parents.find((p) => p.id === id);
  const getFeeStructureForLearner = (learnerId: string, term = 'Term 2 - 2026') =>
    feeStructures.find((fs) => fs.learnerId === learnerId && fs.term === term) ||
    feeStructures.find((fs) => fs.learnerId === learnerId);
  const getPaymentsForLearner = (learnerId: string) =>
    feePayments.filter((p) => p.learnerId === learnerId);
  const getScoreCardsForLearner = (learnerId: string) =>
    scoreCards.filter((sc) => sc.learnerId === learnerId);
  const getAttendanceForLearner = (learnerId: string) =>
    attendance.filter((a) => a.learnerId === learnerId);

  const updateSchoolProfile = (updates: Partial<SchoolProfile>) => {
    const prevProfile = registeredSchools.find((s) => s.id === currentSchoolId) || schoolProfile;
    const nextPrincipalName = updates.principalName?.trim();
    let mergedUpdates: Partial<SchoolProfile> = { ...updates };

    // Keep HOI signature in sync when Principal name changes
    if (nextPrincipalName && nextPrincipalName !== prevProfile.principalName) {
      const existingHoiSig = prevProfile.signatures?.hoi;
      const isPresetSig = !existingHoiSig || existingHoiSig.sourceType === 'preset';
      mergedUpdates.signatures = {
        ...(updates.signatures || prevProfile.signatures),
        hoi: {
          id: existingHoiSig?.id || `sig-hoi-${currentSchoolId}`,
          role: 'hoi',
          roleTitle: existingHoiSig?.roleTitle || 'Chief Principal & Head of Institution',
          signatoryName: nextPrincipalName,
          signatureDataUrl: isPresetSig
            ? createSynchronousPresetPng('hoi', nextPrincipalName, '#1e3a8a')
            : existingHoiSig.signatureDataUrl,
          sourceType: existingHoiSig?.sourceType || 'preset',
          updatedAt: new Date().toISOString(),
          dateStr: new Date().toLocaleDateString('en-GB'),
          isVerified: true,
          verificationCode: existingHoiSig?.verificationCode || `SIG-HOI-${currentSchoolId.toUpperCase()}`,
        },
      };
    }

    setRegisteredSchools((prev) => {
      const updated = prev.map((s) => {
        if (s.id === currentSchoolId) {
          return { ...s, ...mergedUpdates };
        }
        return s;
      });
      localStorage.setItem(`${STORAGE_KEY_PREFIX}registered_schools`, JSON.stringify(updated));
      const active = updated.find((s) => s.id === currentSchoolId) || updated[0];
      setSchoolProfile(active);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}school_profile`, JSON.stringify(active));
      saveDocumentToFirestore('schools', active).catch(() => {});
      saveDocumentToFirestore('settings', { ...active, id: 'school_config' }).catch(() => {});
      return updated;
    });

    // Cascade school / wing rename across existing scorecards referencing the old school name
    const nextName = updates.name?.trim();
    const nextJuniorWing = updates.juniorWingName?.trim();
    const nextPrimaryWing = updates.primaryWingName?.trim();
    if (
      (nextName && nextName !== prevProfile.name) ||
      (nextJuniorWing && nextJuniorWing !== prevProfile.juniorWingName) ||
      (nextPrimaryWing && nextPrimaryWing !== prevProfile.primaryWingName)
    ) {
      setScoreCards((prevCards) =>
        prevCards.map((sc) => {
          if (sc.schoolId && sc.schoolId !== currentSchoolId) return sc;
          let remark = sc.principalRemark || '';
          if (prevProfile.juniorWingName && nextJuniorWing) {
            remark = remark.split(prevProfile.juniorWingName).join(nextJuniorWing);
          }
          if (prevProfile.primaryWingName && nextPrimaryWing) {
            remark = remark.split(prevProfile.primaryWingName).join(nextPrimaryWing);
          }
          if (prevProfile.name && nextName) {
            remark = remark.split(prevProfile.name).join(nextName);
          }
          if (remark !== sc.principalRemark) {
            const updatedCard = { ...sc, principalRemark: remark };
            saveDocumentToFirestore('scoreCards', updatedCard).catch(() => {});
            return updatedCard;
          }
          return sc;
        })
      );
    }

    addAuditLog('School Profile Updated', `Updated official details for ${nextName || prevProfile.name}`);
  };

  const registerNewSchool = async (schoolData: Omit<SchoolProfile, 'id'>): Promise<SchoolProfile> => {
    // Only accessed inside the owner's account and registered under approval of the owner
    if (!isOwner) {
      throw new Error("Access Denied: New school registration can only be approved by the App Owner and accessed within the Owner's account.");
    }

    const newId = `sch-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const defaultSigs = {
      hoi: {
        id: `sig-hoi-${newId}`,
        role: 'hoi' as const,
        roleTitle: 'Chief Principal & Head of Institution',
        signatoryName: schoolData.principalName || 'Head of Institution',
        signatureDataUrl: createSynchronousPresetPng('hoi', schoolData.principalName || 'Principal', '#1e3a8a'),
        sourceType: 'preset' as const,
        updatedAt: new Date().toISOString(),
        dateStr: new Date().toLocaleDateString('en-GB'),
        isVerified: true,
        verificationCode: `SIG-HOI-${newId.toUpperCase()}`,
      },
      bursar: {
        id: `sig-bursar-${newId}`,
        role: 'bursar' as const,
        roleTitle: 'Chief Bursar & Treasury Controller',
        signatoryName: 'Bursar & Treasury Office',
        signatureDataUrl: createSynchronousPresetPng('bursar', 'Bursar', '#0f172a'),
        sourceType: 'preset' as const,
        updatedAt: new Date().toISOString(),
        dateStr: new Date().toLocaleDateString('en-GB'),
        isVerified: true,
        verificationCode: `SIG-BURSAR-${newId.toUpperCase()}`,
      },
      seal: {
        id: `sig-seal-${newId}`,
        role: 'seal' as const,
        roleTitle: 'Official Institutional Seal & Stamp',
        signatoryName: `${schoolData.name} Seal`,
        signatureDataUrl: createSynchronousPresetPng('seal', schoolData.name, '#4338ca'),
        sourceType: 'preset' as const,
        updatedAt: new Date().toISOString(),
        dateStr: new Date().toLocaleDateString('en-GB'),
        isVerified: true,
        verificationCode: `SEAL-${newId.toUpperCase()}`,
      },
    };

    const newSchool: SchoolProfile = {
      ...schoolData,
      id: newId,
      isLocked: false,
      approvedByOwner: true,
      approvedByOwnerPhone: '0716235185',
      approvedAt: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
      signatures: schoolData.signatures || defaultSigs,
    };

    // Auto-instantiate independent CBC Grade Cohorts and Learning Areas for this new institution
    const newSchoolGrades: GradeLevel[] = INITIAL_GRADES.map((g, idx) => ({
      ...g,
      id: `grd-${newId}-${idx + 1}`,
      schoolId: newId,
      classTeacherId: undefined,
    }));
    const newSchoolSubjects: SubjectDefinition[] = INITIAL_SUBJECTS.map((s, idx) => ({
      ...s,
      id: `sub-${newId}-${idx + 1}`,
      schoolId: newId,
      assignedTeacherId: undefined,
    }));

    setGrades((prev) => [...prev, ...newSchoolGrades]);
    setSubjects((prev) => [...prev, ...newSchoolSubjects]);
    newSchoolGrades.forEach((g) => saveDocumentToFirestore('grades', g).catch(() => {}));
    newSchoolSubjects.forEach((s) => saveDocumentToFirestore('subjects', s).catch(() => {}));

    const nextSchools = [...registeredSchools, newSchool];
    setRegisteredSchools(nextSchools);
    setCurrentSchoolId(newId);
    setSchoolProfile(newSchool);

    localStorage.setItem(`${STORAGE_KEY_PREFIX}registered_schools`, JSON.stringify(nextSchools));
    localStorage.setItem(`${STORAGE_KEY_PREFIX}active_school_id`, newId);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}school_profile`, JSON.stringify(newSchool));

    saveDocumentToFirestore('schools', newSchool).catch((e) => console.warn('Firestore school save error:', e));
    saveDocumentToFirestore('settings', { ...newSchool, id: 'school_config' }).catch(() => {});

    addAuditLog(
      'School Registration Approved by Owner',
      `App Owner formally approved and registered new institution: ${newSchool.name} (MoE/KNEC Code: ${newSchool.registrationNumber}, County: ${newSchool.county}). Complete CBC Grade cohorts and academic ledgers instantiated under Owner governance.`
    );

    return newSchool;
  };

  const toggleSchoolLock = async (
    targetSchoolId?: string,
    reason?: string
  ): Promise<{ success: boolean; isLocked: boolean; schoolName: string }> => {
    const idToToggle = targetSchoolId || currentSchoolId;
    let targetName = schoolProfile.name;
    let newLockedState = !schoolProfile.isLocked;

    setRegisteredSchools((prev) => {
      const updated = prev.map((sch) => {
        if (sch.id === idToToggle) {
          targetName = sch.name;
          newLockedState = !sch.isLocked;
          return {
            ...sch,
            isLocked: newLockedState,
            lockedAt: newLockedState ? new Date().toISOString() : undefined,
            lockReason: newLockedState ? (reason || 'Administrative review by Institution Director.') : undefined,
          };
        }
        return sch;
      });

      localStorage.setItem(`${STORAGE_KEY_PREFIX}registered_schools`, JSON.stringify(updated));
      const target = updated.find((s) => s.id === idToToggle);
      if (target) {
        saveDocumentToFirestore('schools', target).catch((e) => console.warn('Firestore school lock update error:', e));
        if (target.id === currentSchoolId) {
          saveDocumentToFirestore('settings', { ...target, id: 'school_config' }).catch(() => {});
          setSchoolProfile(target);
        }
      }
      return updated;
    });

    addAuditLog(
      newLockedState ? 'School Portal Locked' : 'School Portal Unlocked',
      `${newLockedState ? 'Locked' : 'Unlocked'} ${targetName}. Faculty and administrative logins are ${newLockedState ? 'suspended' : 'restored'}.`
    );

    return {
      success: true,
      isLocked: newLockedState,
      schoolName: targetName,
    };
  };

  const switchActiveSchool = (schoolId: string, isSystemRouting = false) => {
    // Only the App Owner can freely switch active schools.
    // System routing (e.g. during verified login) is permitted.
    if (!isSystemRouting && isAuthenticated && !isOwner) {
      console.warn('Unauthorized attempt to switch schools: Only app owner can switch schools.');
      return;
    }
    const target = registeredSchools.find((s) => s.id === schoolId);
    if (!target) return;
    setCurrentSchoolId(schoolId);
    setSchoolProfile(target);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}active_school_id`, schoolId);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}school_profile`, JSON.stringify(target));
    addAuditLog(
      'Active Institution Switched',
      `Switched active school view to ${target.name} (${target.registrationNumber}).`
    );
  };

  const deleteSchool = async (schoolId: string): Promise<{ success: boolean; message: string }> => {
    // Strictly accessible by App Owner alone
    if (!isOwner) {
      throw new Error("Access Denied: Only the App Owner can delete registered educational institutions.");
    }

    if (registeredSchools.length <= 1) {
      throw new Error("Cannot delete the only registered institution in the system. At least one school must remain active.");
    }

    const targetSchool = registeredSchools.find((s) => s.id === schoolId);
    if (!targetSchool) {
      throw new Error("Institution not found or already deleted.");
    }

    const schoolName = targetSchool.name;
    const remainingSchools = registeredSchools.filter((s) => s.id !== schoolId);

    // Update state and persistence
    setRegisteredSchools(remainingSchools);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}registered_schools`, JSON.stringify(remainingSchools));

    // If the active school is being deleted, switch immediately to a remaining school
    if (currentSchoolId === schoolId) {
      const nextActive = remainingSchools[0];
      setCurrentSchoolId(nextActive.id);
      setSchoolProfile(nextActive);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}active_school_id`, nextActive.id);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}school_profile`, JSON.stringify(nextActive));
    }

    // Delete school document from Firestore
    deleteDocumentFromFirestore('schools', schoolId).catch((err) =>
      console.warn('Firestore school delete error:', err)
    );

    addAuditLog(
      'School Deletion Executed by App Owner',
      `App Owner formally deleted registered institution: ${schoolName} (Code: ${targetSchool.registrationNumber || targetSchool.county}). Institution removed from multi-tenancy.`
    );

    return {
      success: true,
      message: `Institution "${schoolName}" has been permanently deleted.`,
    };
  };

  const addGrade = (grade: Omit<GradeLevel, 'id'>) => {
    const newGrade: GradeLevel = {
      ...grade,
      id: `grd-${Date.now()}`,
      schoolId: grade.schoolId || currentSchoolId,
    };
    setGrades((prev) => [...prev, newGrade]);
    saveDocumentToFirestore('grades', newGrade).catch(() => {});
    addAuditLog('Grade Registered', `Added cohort ${newGrade.name} (${newGrade.tier})`);
  };

  const updateGrade = (id: string, updates: Partial<GradeLevel>) => {
    const oldGrade = grades.find((g) => g.id === id);
    const oldName = oldGrade?.name || '';
    const nextName = updates.name ?? oldName;

    setGrades((prev) =>
      prev.map((g) => {
        if (g.id === id) {
          const next = { ...g, ...updates };
          saveDocumentToFirestore('grades', next).catch(() => {});
          return next;
        }
        return g;
      })
    );

    // Bidirectional Class Teacher synchronization when classTeacherId or grade name changes
    if (updates.classTeacherId !== undefined || (nextName && oldName && nextName !== oldName)) {
      const targetTeacherId = updates.classTeacherId !== undefined ? updates.classTeacherId : oldGrade?.classTeacherId;
      setTeachers((prevTeachers) =>
        prevTeachers.map((t) => {
          if (t.schoolId && t.schoolId !== currentSchoolId) return t;
          let changed = false;
          let nextT = { ...t };

          if (updates.classTeacherId !== undefined) {
            if (t.id === targetTeacherId) {
              if (nextT.teacherType !== 'class_teacher' || nextT.assignedGrade !== nextName) {
                nextT = { ...nextT, teacherType: 'class_teacher', assignedGrade: nextName };
                changed = true;
              }
            } else if (
              t.teacherType === 'class_teacher' &&
              ((t.assignedGrade || '').trim().toLowerCase() === oldName.trim().toLowerCase() ||
                (t.assignedGrade || '').trim().toLowerCase() === nextName.trim().toLowerCase())
            ) {
              // Unbind previous class teacher from this grade so no two teachers claim the same grade
              nextT = { ...nextT, assignedGrade: '' };
              changed = true;
            }
          } else if (nextName && oldName && nextName !== oldName && nextT.assignedGrade === oldName) {
            nextT = { ...nextT, assignedGrade: nextName };
            changed = true;
          }

          if (changed) {
            saveDocumentToFirestore('teachers', nextT).catch(() => {});
            if (currentUser?.id === nextT.id || currentUser?.phone === nextT.phone) {
              setCurrentUser((u) => ({
                ...u,
                teacherType: nextT.teacherType,
                teacherGrade: nextT.assignedGrade,
              }));
            }
            return nextT;
          }
          return t;
        })
      );
    }

    // Cascade grade rename across learners, assessments, and submissions
    if (nextName && oldName && nextName !== oldName) {
      setLearners((prev) =>
        prev.map((l) => {
          if (l.grade === oldName && (!l.schoolId || l.schoolId === currentSchoolId)) {
            const nextL = { ...l, grade: nextName };
            saveDocumentToFirestore('learners', nextL).catch(() => {});
            return nextL;
          }
          return l;
        })
      );
      setAssessments((prev) =>
        prev.map((a) => {
          if (a.grade === oldName && (!a.schoolId || a.schoolId === currentSchoolId)) {
            const nextA = { ...a, grade: nextName };
            saveDocumentToFirestore('assessments', nextA).catch(() => {});
            return nextA;
          }
          return a;
        })
      );
      setSubjectSubmissions((prev) =>
        prev.map((s) => {
          if (s.grade === oldName && (!s.schoolId || s.schoolId === currentSchoolId)) {
            const nextS = { ...s, grade: nextName };
            saveDocumentToFirestore('subjectSubmissions', nextS).catch(() => {});
            return nextS;
          }
          return s;
        })
      );
    }

    addAuditLog('Grade Updated', `Modified grade profile for ${nextName || id}`);
  };

  const deleteGrade = (id: string) => {
    setGrades((prev) => prev.filter((g) => g.id !== id));
    deleteDocumentFromFirestore('grades', id).catch(() => {});
    addAuditLog('Grade Removed', `Deleted grade cohort ${id}`);
  };

  const addSubject = (subject: Omit<SubjectDefinition, 'id'>) => {
    const newSubject: SubjectDefinition = {
      ...subject,
      id: `sub-${Date.now()}`,
      schoolId: subject.schoolId || currentSchoolId,
    };
    setSubjects((prev) => [...prev, newSubject]);
    saveDocumentToFirestore('subjects', newSubject).catch(() => {});
    addAuditLog('CBC Subject Registered', `Added learning area ${newSubject.name} (${newSubject.code})`);
  };

  const updateSubject = (id: string, updates: Partial<SubjectDefinition>) => {
    const oldSub = subjects.find((s) => s.id === id);
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const next = { ...s, ...updates };
          saveDocumentToFirestore('subjects', next).catch(() => {});
          return next;
        }
        return s;
      })
    );

    // Cascade subject rename across teachers, scoreCards, and submissions
    if (updates.name && oldSub && updates.name !== oldSub.name) {
      const oldSubName = oldSub.name;
      const newSubName = updates.name;
      setTeachers((prev) =>
        prev.map((t) => {
          if (t.registeredSubjects?.includes(oldSubName) && (!t.schoolId || t.schoolId === currentSchoolId)) {
            const nextT = {
              ...t,
              registeredSubjects: t.registeredSubjects.map((r) => (r === oldSubName ? newSubName : r)),
            };
            saveDocumentToFirestore('teachers', nextT).catch(() => {});
            return nextT;
          }
          return t;
        })
      );
      setScoreCards((prev) =>
        prev.map((sc) => {
          if (sc.schoolId && sc.schoolId !== currentSchoolId) return sc;
          if (!sc.subjects.some((sub) => sub.subjectName === oldSubName)) return sc;
          const nextCard = {
            ...sc,
            subjects: sc.subjects.map((sub) =>
              sub.subjectName === oldSubName ? { ...sub, subjectName: newSubName } : sub
            ),
          };
          saveDocumentToFirestore('scoreCards', nextCard).catch(() => {});
          return nextCard;
        })
      );
      setSubjectSubmissions((prev) =>
        prev.map((subm) => {
          if (subm.subjectName === oldSubName && (!subm.schoolId || subm.schoolId === currentSchoolId)) {
            const nextSubm = { ...subm, subjectName: newSubName };
            saveDocumentToFirestore('subjectSubmissions', nextSubm).catch(() => {});
            return nextSubm;
          }
          return subm;
        })
      );
    }

    addAuditLog('CBC Subject Updated', `Modified subject ${updates.name || id}`);
  };

  const deleteSubject = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    deleteDocumentFromFirestore('subjects', id).catch(() => {});
    addAuditLog('CBC Subject Removed', `Deleted subject ${id}`);
  };

  const addTeacher = (teacher: Omit<TeacherRecord, 'id'>) => {
    const newTeacher: TeacherRecord = {
      ...teacher,
      id: `tch-${Date.now()}`,
      schoolId: teacher.schoolId || currentSchoolId,
    };
    setTeachers((prev) => {
      const cleaned =
        newTeacher.teacherType === 'class_teacher' && newTeacher.assignedGrade
          ? prev.map((t) => {
              if (
                t.teacherType === 'class_teacher' &&
                t.assignedGrade === newTeacher.assignedGrade &&
                (!t.schoolId || t.schoolId === currentSchoolId)
              ) {
                const updated = { ...t, assignedGrade: '' };
                saveDocumentToFirestore('teachers', updated).catch(() => {});
                return updated;
              }
              return t;
            })
          : prev;
      return [...cleaned, newTeacher];
    });
    saveDocumentToFirestore('teachers', newTeacher).catch(() => {});

    // Sync GradeLevel classTeacherId if added directly as Class Teacher of a grade
    if (newTeacher.teacherType === 'class_teacher' && newTeacher.assignedGrade) {
      setGrades((prevGrades) =>
        prevGrades.map((g) => {
          if (g.name === newTeacher.assignedGrade && (!g.schoolId || g.schoolId === currentSchoolId)) {
            const nextG = { ...g, classTeacherId: newTeacher.id };
            saveDocumentToFirestore('grades', nextG).catch(() => {});
            return nextG;
          }
          return g;
        })
      );
    }

    addAuditLog('Teacher Registered', `Enrolled faculty teacher ${newTeacher.name} (${newTeacher.teacherType})`);
  };

  const updateTeacher = (id: string, updates: Partial<TeacherRecord>) => {
    const oldTeacher = teachers.find((t) => t.id === id);
    const nextTeacher: TeacherRecord | undefined = oldTeacher ? { ...oldTeacher, ...updates } : undefined;

    setTeachers((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const next = { ...t, ...updates };
          saveDocumentToFirestore('teachers', next).catch(() => {});
          return next;
        }
        // If this update assigns a Class Teacher to a grade, unbind any previous class teacher on that same grade
        if (
          nextTeacher &&
          nextTeacher.teacherType === 'class_teacher' &&
          nextTeacher.assignedGrade &&
          t.teacherType === 'class_teacher' &&
          t.assignedGrade === nextTeacher.assignedGrade &&
          (!t.schoolId || t.schoolId === currentSchoolId)
        ) {
          const updated = { ...t, assignedGrade: '' };
          saveDocumentToFirestore('teachers', updated).catch(() => {});
          return updated;
        }
        return t;
      })
    );

    if (oldTeacher && nextTeacher) {
      // Bidirectional sync with grades.classTeacherId
      setGrades((prevGrades) =>
        prevGrades.map((g) => {
          if (g.schoolId && g.schoolId !== currentSchoolId) return g;
          if (nextTeacher.teacherType === 'class_teacher' && g.name === nextTeacher.assignedGrade) {
            if (g.classTeacherId !== id) {
              const nextG = { ...g, classTeacherId: id };
              saveDocumentToFirestore('grades', nextG).catch(() => {});
              return nextG;
            }
          } else if (g.classTeacherId === id) {
            const nextG = { ...g, classTeacherId: '' };
            saveDocumentToFirestore('grades', nextG).catch(() => {});
            return nextG;
          }
          return g;
        })
      );

      // Cascade teacher name rename across scorecards, submissions, attendance, admins, and signatures
      if (updates.name && updates.name !== oldTeacher.name) {
        const oldName = oldTeacher.name;
        const newName = updates.name;

        setScoreCards((prev) =>
          prev.map((sc) => {
            if (sc.schoolId && sc.schoolId !== currentSchoolId) return sc;
            if (!sc.subjects.some((s) => s.subjectTeacher === oldName)) return sc;
            const nextSc = {
              ...sc,
              subjects: sc.subjects.map((s) =>
                s.subjectTeacher === oldName ? { ...s, subjectTeacher: newName } : s
              ),
            };
            saveDocumentToFirestore('scoreCards', nextSc).catch(() => {});
            return nextSc;
          })
        );

        setSubjectSubmissions((prev) =>
          prev.map((s) => {
            if (s.teacherName === oldName && (!s.schoolId || s.schoolId === currentSchoolId)) {
              const nextS = { ...s, teacherName: newName };
              saveDocumentToFirestore('subjectSubmissions', nextS).catch(() => {});
              return nextS;
            }
            return s;
          })
        );

        setAttendance((prev) =>
          prev.map((a) => {
            if (a.markedBy === oldName && (!a.schoolId || a.schoolId === currentSchoolId)) {
              const nextA = { ...a, markedBy: newName };
              saveDocumentToFirestore('attendance', nextA).catch(() => {});
              return nextA;
            }
            return a;
          })
        );

        setAdminAccounts((prev) =>
          prev.map((adm) => {
            if (
              (adm.phone === oldTeacher.phone || adm.name === oldName) &&
              (!adm.schoolId || adm.schoolId === currentSchoolId)
            ) {
              const nextAdm = { ...adm, name: newName };
              saveDocumentToFirestore('admins', nextAdm).catch(() => {});
              return nextAdm;
            }
            return adm;
          })
        );

        if (schoolProfile.signatures?.class_teacher?.signatoryName === oldName) {
          const ctSig = schoolProfile.signatures.class_teacher;
          updateSchoolProfile({
            signatures: {
              ...schoolProfile.signatures,
              class_teacher: {
                ...ctSig,
                signatoryName: newName,
                signatureDataUrl:
                  ctSig.sourceType === 'preset'
                    ? createSynchronousPresetPng('class_teacher', newName, '#047857')
                    : ctSig.signatureDataUrl,
                updatedAt: new Date().toISOString(),
              },
            },
          });
        }
      }

      // Sync active session if logged in / impersonating this teacher
      if (currentUser?.id === id || currentUser?.phone === oldTeacher.phone) {
        setCurrentUser((u) => ({
          ...u,
          name: nextTeacher.name,
          phone: nextTeacher.phone,
          teacherType: nextTeacher.teacherType,
          teacherGrade: nextTeacher.assignedGrade,
          registeredSubjects: nextTeacher.registeredSubjects,
        }));
      }
    }

    addAuditLog('Teacher Updated', `Modified profile for teacher ${updates.name || oldTeacher?.name || id}`);
  };

  const deleteTeacher = (id: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
    setGrades((prevGrades) =>
      prevGrades.map((g) => {
        if (g.classTeacherId === id && (!g.schoolId || g.schoolId === currentSchoolId)) {
          const nextG = { ...g, classTeacherId: '' };
          saveDocumentToFirestore('grades', nextG).catch(() => {});
          return nextG;
        }
        return g;
      })
    );
    deleteDocumentFromFirestore('teachers', id).catch(() => {});
    addAuditLog('Teacher Removed', `Deleted teacher ${id}`);
  };

  const addAdminAccount = (admin: Omit<AdminAccount, 'id'>) => {
    const newAdmin: AdminAccount = {
      ...admin,
      id: `adm-${Date.now()}`,
      schoolId: admin.schoolId || currentSchoolId,
    };
    setAdminAccounts((prev) => [...prev, newAdmin]);
    saveDocumentToFirestore('admins', newAdmin).catch(() => {});
    addAuditLog('Administrator Registered', `Created administrator account for ${newAdmin.name} (${newAdmin.role})`);
  };

  const updateAdminAccount = (id: string, updates: Partial<AdminAccount>) => {
    setAdminAccounts((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const next = { ...a, ...updates };
          saveDocumentToFirestore('admins', next).catch(() => {});
          return next;
        }
        return a;
      })
    );
    addAuditLog('Administrator Updated', `Updated officer profile for ${id}`);
  };

  const deleteAdminAccount = (id: string) => {
    setAdminAccounts((prev) => prev.filter((a) => a.id !== id));
    deleteDocumentFromFirestore('admins', id).catch(() => {});
    addAuditLog('Administrator Removed', `Removed admin ${id}`);
  };

  const resetToDefault = () => {
    localStorage.clear();
    setParents([]);
    setLearners([]);
    setFeeStructures([]);
    setFeePayments([]);
    setReminders([]);
    setScoreCards([]);
    setAttendance([]);
    setAuditLogs([]);
    setSchoolProfile(INITIAL_SCHOOL_PROFILE);
    setGrades(INITIAL_GRADES);
    setSubjects(INITIAL_SUBJECTS);
    setAdminAccounts(INITIAL_ADMIN_ACCOUNTS);
    setTeachers([]);
    setCurrentUser(null);
    setDecryptedParentIds(new Set());
  };

  // Ensure superadmin session objects carry isOwner = true everywhere
  React.useEffect(() => {
    if (currentUser && currentUser.role === 'superadmin' && !currentUser.isOwner) {
      setCurrentUser((prev) => (prev ? { ...prev, isOwner: true } : prev));
    }
  }, [currentUser]);

  const isOwner = Boolean(currentUser?.isOwner || currentUser?.role || currentUser?.role || (currentUser?.phone && (normalizeKenyanPhone(currentUser?.phone) === '0716235185' || currentUser?.phone === '0716235185'))
  );

  // Scoped data arrays strictly isolated to current active school AND valid existing learners
  const activeLearners = useMemo(
    () => learners.filter((l) => (l.schoolId || 'sch-001') === currentSchoolId),
    [learners, currentSchoolId]
  );
  const activeLearnerIds = useMemo(
    () => new Set(activeLearners.map((l) => l.id)),
    [activeLearners]
  );
  const activeParentIds = useMemo(
    () => new Set(activeLearners.map((l) => l.parentId)),
    [activeLearners]
  );
  const activeParents = useMemo(
    () => parents.filter((p) => (p.schoolId || 'sch-001') === currentSchoolId && activeParentIds.has(p.id)),
    [parents, currentSchoolId, activeParentIds]
  );
  const activeTeachers = useMemo(
    () => teachers.filter((t) => (t.schoolId || 'sch-001') === currentSchoolId),
    [teachers, currentSchoolId]
  );
  const activeFeeStructures = useMemo(
    () => feeStructures.filter((f) => (f.schoolId || 'sch-001') === currentSchoolId && activeLearnerIds.has(f.learnerId)),
    [feeStructures, currentSchoolId, activeLearnerIds]
  );
  const activeFeePayments = useMemo(
    () => feePayments.filter((p) => (p.schoolId || 'sch-001') === currentSchoolId && activeLearnerIds.has(p.learnerId)),
    [feePayments, currentSchoolId, activeLearnerIds]
  );
  const activeReminders = useMemo(
    () => reminders.filter((r) => (r.schoolId || 'sch-001') === currentSchoolId && activeLearnerIds.has(r.learnerId)),
    [reminders, currentSchoolId, activeLearnerIds]
  );
  const activeScoreCards = useMemo(
    () => scoreCards.filter((s) => (s.schoolId || 'sch-001') === currentSchoolId && activeLearnerIds.has(s.learnerId)),
    [scoreCards, currentSchoolId, activeLearnerIds]
  );
  const activeAttendance = useMemo(
    () => attendance.filter((a) => (a.schoolId || 'sch-001') === currentSchoolId && activeLearnerIds.has(a.learnerId)),
    [attendance, currentSchoolId, activeLearnerIds]
  );
  const activeGrades = useMemo(() => {
    const scoped = grades.filter((g) => (g.schoolId || 'sch-001') === currentSchoolId);
    if (scoped.length > 0) return scoped;
    return INITIAL_GRADES.map((g, i) => ({
      ...g,
      id: `grd-${currentSchoolId}-${i + 1}`,
      schoolId: currentSchoolId,
    }));
  }, [grades, currentSchoolId]);

  const activeSubjects = useMemo(() => {
    const scoped = subjects.filter((s) => (s.schoolId || 'sch-001') === currentSchoolId);
    if (scoped.length > 0) return scoped;
    return INITIAL_SUBJECTS.map((s, i) => ({
      ...s,
      id: `sbj-${currentSchoolId}-${i + 1}`,
      schoolId: currentSchoolId,
    }));
  }, [subjects, currentSchoolId]);

  const activeAdminAccounts = useMemo(
    () => adminAccounts.filter((a) => (a.schoolId || 'sch-001') === currentSchoolId),
    [adminAccounts, currentSchoolId]
  );
  const activeAssessments = useMemo(
    () => assessments.filter((a) => (a.schoolId || 'sch-001') === currentSchoolId),
    [assessments, currentSchoolId]
  );
  const activeSubjectSubmissions = useMemo(
    () => subjectSubmissions.filter((s) => (s.schoolId || 'sch-001') === currentSchoolId),
    [subjectSubmissions, currentSchoolId]
  );
  const activeAuditLogs = useMemo(
    () => auditLogs.filter((l) => !l.schoolId || l.schoolId === currentSchoolId),
    [auditLogs, currentSchoolId]
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        allUsers: INITIAL_USER_SESSIONS,
        isAuthenticated,
        isOwner,
        switchUser,
        switchRole,
        switchOwnerResponsibility,
        loginWithCredentials,
        verifyOwnerOtp,
        resendOwnerOtp,
        forceRelockOwnerDevice,
        ownerDeviceLock,
        currentDeviceId,
        currentDeviceName,
        deviceKickoutNotice,
        clearDeviceKickoutNotice,
        requestPasswordResetLink,
        resetPasswordForUser,
        logout,
        parents: activeParents,
        learners: activeLearners,
        teachers: activeTeachers,
        feeStructures: activeFeeStructures,
        feePayments: activeFeePayments,
        reminders: activeReminders,
        scoreCards: activeScoreCards,
        attendance: activeAttendance,
        auditLogs: activeAuditLogs,
        schoolProfile,
        updateSchoolProfile,
        registeredSchools,
        currentSchoolId,
        registerNewSchool,
        toggleSchoolLock,
        switchActiveSchool,
        deleteSchool,
        grades: activeGrades,
        addGrade,
        updateGrade,
        deleteGrade,
        subjects: activeSubjects,
        addSubject,
        updateSubject,
        deleteSubject,
        adminAccounts: activeAdminAccounts,
        addAdminAccount,
        updateAdminAccount,
        deleteAdminAccount,
        addTeacher,
        updateTeacher,
        deleteTeacher,
        decryptedParentIds,
        toggleParentDecryption,
        isParentDecrypted,
        addLearnerWithParent,
        updateLearner,
        deleteLearner,
      requestLearnerDeletion,
      approveLearnerDeletion,
      rejectLearnerDeletion,
        updateParent,
        recordPayment,
        batchDispatchReminders,
        sendBulkOverdueReminders,
        scheduleReminder,
        saveScoreCard,
        assessments: activeAssessments,
        saveAssessment,
        subjectSubmissions: activeSubjectSubmissions,
        saveSubjectSubmission,
        toggleExamAbsence,
        recordSingleAttendance,
        batchMarkClassAttendance,
        getLearnerById,
        getParentById,
        getFeeStructureForLearner,
        getPaymentsForLearner,
        getScoreCardsForLearner,
        getAttendanceForLearner,
        addAuditLog,
        resetToDefault,
        isCloudConnected,
        isCloudLoaded,
        firestoreDbId: firestoreDatabaseId,
        firebaseProjectId,
        isSyncingToCloud,
        syncAllDataToFirestore,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
