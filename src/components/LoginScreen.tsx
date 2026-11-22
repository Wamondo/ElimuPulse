import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Shield,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  UserPlus,
  Building,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Check,
  Clock,
  LogOut,
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { auth, rtdb, saveDocumentToFirestore, fetchDocumentFromFirestore } from '../services/firebase';
const crestImage =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="%231e1b4b"/><text x="32" y="39" text-anchor="middle" fill="%23fbbf24" font-size="22" font-family="sans-serif" font-weight="bold">EP</text></svg>';

const resolveComprehensiveSeal = (_name?: string) => crestImage;
import { PWAInstallButton } from './PWAInstallButton';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

interface StaffProfile {
  name: string;
  subject?: string;
  email: string;
  role: 'admin' | 'teacher';
  approved: boolean;
  schoolId?: string;
  createdAt?: number;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const {
    schoolProfile,
    registeredSchools,
    currentSchoolId,
    switchActiveSchool,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [subject, setSubject] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);

  // Pending approval state
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [pendingProfile, setPendingProfile] = useState<StaffProfile | null>(null);

  const unlockAppWithProfile = (user: User, profile: StaffProfile) => {
    localStorage.setItem(
      'elimupulse_staff_session',
      JSON.stringify({
        uid: user.uid,
        email: user.email,
        name: profile.name,
        role: profile.role,
        approved: true,
      })
    );
    if (onLoginSuccess) {
      onLoginSuccess();
    }
  };

  // Check existing Firebase session on load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setPendingUser(null);
        setPendingProfile(null);
        setCheckingSession(false);
        return;
      }

      try {
        const snap = await get(ref(rtdb, `users/${user.uid}`));
        const profile = snap.val() as StaffProfile | null;

        if (profile && profile.approved === true) {
          setPendingUser(null);
          setPendingProfile(null);
          unlockAppWithProfile(user, profile);
        } else {
          setPendingUser(user);
          setPendingProfile(profile);
        }
      } catch (err) {
        console.error('Error verifying staff approval:', err);
        setPendingUser(user);
      } finally {
        setCheckingSession(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await get(ref(rtdb, `users/${cred.user.uid}`));
      const profile = snap.val() as StaffProfile | null;

      if (profile && profile.approved === true) {
        unlockAppWithProfile(cred.user, profile);
      } else {
        setPendingUser(cred.user);
        setPendingProfile(profile);
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErrorMsg('Invalid email or password. Please verify your credentials.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('Too many failed attempts. Please wait a few minutes and retry.');
      } else {
        setErrorMsg(err?.message || 'Unable to sign in. Please check your internet connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    setIsLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newProfile: StaffProfile = {
        name: fullName.trim(),
        subject: subject.trim() || 'Teaching Staff',
        email: email.trim().toLowerCase(),
        role: 'teacher',
        approved: false,
        schoolId: currentSchoolId || 'default',
        createdAt: Date.now(),
      };

      await set(ref(rtdb, `users/${cred.user.uid}`), newProfile);
      setPendingUser(cred.user);
      setPendingProfile(newProfile);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        setErrorMsg('An account with this email already exists. Switch to Sign In.');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('Password must be at least 6 characters.');
      } else {
        setErrorMsg(err?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    localStorage.removeItem('elimupulse_staff_session');
    await signOut(auth);
    setPendingUser(null);
    setPendingProfile(null);
  };

  const recheckApproval = async () => {
    if (!pendingUser) return;
    setIsLoading(true);
    try {
      const snap = await get(ref(rtdb, `users/${pendingUser.uid}`));
      const profile = snap.val() as StaffProfile | null;
      if (profile && profile.approved === true) {
        unlockAppWithProfile(pendingUser, profile);
      } else {
        setErrorMsg('Still awaiting Admin approval. Please check again shortly.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-indigo-200">Verifying ElimuPulse authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 flex flex-col justify-center p-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Official Institutional Seal */}
        <div className="inline-flex p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-amber-300/30 shadow-2xl mb-4">
          <img
            src={resolveComprehensiveSeal(schoolProfile, crestImage)}
            alt={`${schoolProfile?.name || 'School'} Official Seal`}
            className="w-20 h-20 object-contain rounded-full bg-white/95 p-0.5"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-medium mb-2">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>ElimuPulse School Analytics</span>
        </div>

        <h1 className="text-3xl font-black tracking-tight text-white">
          ElimuPulse
        </h1>
        <p className="mt-1 text-sm text-indigo-200 font-semibold">
          {schoolProfile?.name || 'Comprehensive School Portal'}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Institution Selector Bar */}
        {registeredSchools && registeredSchools.length > 0 && (
          <div className="mb-4 bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => setShowSchoolDropdown(!showSchoolDropdown)}
                className="w-full text-left flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-900/80 border border-white/10 transition-colors"
              >
                <div className="truncate">
                  <span className="text-[10px] text-indigo-300 font-mono block">Selected Institution:</span>
                  <span className="text-xs font-bold text-white truncate block">
                    {schoolProfile?.name || 'Academic Institution'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              </button>

              {showSchoolDropdown && (
                <div className="absolute left-0 top-full mt-1.5 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 p-1.5 space-y-1">
                  {registeredSchools.map((sch) => (
                    <button
                      key={sch.id}
                      type="button"
                      onClick={() => {
                        switchActiveSchool(sch.id);
                        setShowSchoolDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs ${
                        sch.id === currentSchoolId
                          ? 'bg-indigo-600/30 border border-indigo-500/40 text-indigo-200 font-bold'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="truncate">{sch.name}</span>
                      {sch.id === currentSchoolId && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-4">
          <PWAInstallButton variant="banner" />
        </div>

        {/* MAIN AUTH CARD */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900">
          {pendingUser ? (
            /* PENDING ADMIN APPROVAL VIEW */
            <div className="p-6 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto text-amber-600">
                <Clock className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Account Awaiting Admin Approval
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hello <strong>{pendingProfile?.name || pendingUser.email}</strong>, your staff account has been created and is locked until the School Administrator approves your access.
              </p>

              {errorMsg && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  {errorMsg}
                </div>
              )}

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={recheckApproval}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  {isLoading ? 'Checking status...' : 'Check Approval Status'}
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-2 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Sign In / Request Access Tabs */}
              <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg(null);
                  }}
                  className={`py-3.5 px-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white text-indigo-700 border-b-2 border-indigo-600 font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Staff Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                  }}
                  className={`py-3.5 px-2 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white text-indigo-700 border-b-2 border-indigo-600 font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Request Access</span>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-950 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    {mode === 'login' ? (
                      <span>
                        <strong>Authorized Staff Portal:</strong> Sign in with your approved school email and password to access assessment analytics.
                      </span>
                    ) : (
                      <span>
                        <strong>New Staff Registration:</strong> Create your account below. Access remains locked until verified by the School Admin.
                      </span>
                    )}
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
                  {mode === 'register' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Mr. Edwin Wamondo"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Department / Learning Areas
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Mathematics & Business Studies"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Staff Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        placeholder="teacher@school.ac.ke"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{mode === 'login' ? 'Verifying Credentials...' : 'Submitting Request...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{mode === 'login' ? 'Sign In to ElimuPulse' : 'Submit Access Request'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
        
        <div className="mt-4 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Protected Academic Workspace • Admin-Verified Access</span>
        </div>
      </div>
    </div>
  );
};
