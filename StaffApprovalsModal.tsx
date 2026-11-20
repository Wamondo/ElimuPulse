import React, { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { rtdb } from '../services/firebase';
import {
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  X,
  Users,
  Search,
} from 'lucide-react';

interface StaffApprovalsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StaffUserRecord {
  uid: string;
  name: string;
  subject?: string;
  email: string;
  role: 'admin' | 'teacher';
  approved: boolean;
  createdAt?: number;
}

export const StaffApprovalsModal: React.FC<StaffApprovalsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [staffList, setStaffList] = useState<StaffUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setErrorMsg(null);
    const usersRef = ref(rtdb, 'users');

    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const val = snapshot.val() as Record<string, Omit<StaffUserRecord, 'uid'>> | null;
        if (!val) {
          setStaffList([]);
          setLoading(false);
          return;
        }

        const parsed: StaffUserRecord[] = Object.entries(val).map(([uid, data]) => ({
          uid,
          name: data.name || 'Unnamed Staff',
          subject: data.subject || 'Teaching Staff',
          email: data.email || '',
          role: data.role || 'teacher',
          approved: Boolean(data.approved),
          createdAt: data.createdAt || 0,
        }));

        // Pending accounts first, then newest first
        parsed.sort((a, b) => {
          if (a.approved !== b.approved) return a.approved ? 1 : -1;
          return (b.createdAt || 0) - (a.createdAt || 0);
        });

        setStaffList(parsed);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load staff approvals:', err);
        setErrorMsg('Unable to load staff list. Ensure your account has role: "admin" in Realtime Database.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  const handleToggleApproval = async (staff: StaffUserRecord, nextApproved: boolean) => {
    setUpdatingUid(staff.uid);
    setErrorMsg(null);
    try {
      await update(ref(rtdb, `users/${staff.uid}`), {
        approved: nextApproved,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Permission denied while updating staff approval.');
    } finally {
      setUpdatingUid(null);
    }
  };

  if (!isOpen) return null;

  const pendingCount = staffList.filter((s) => !s.approved).length;
  const filteredStaff = staffList.filter((s) => {
    if (filter === 'pending' && s.approved) return false;
    if (filter === 'approved' && !s.approved) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.subject || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 border border-white/15">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                <span>Staff Access Approvals</span>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-400 text-slate-950">
                    {pendingCount} Pending
                  </span>
                )}
              </h2>
              <p className="text-xs text-indigo-200">
                Approve or revoke teacher login access to ElimuPulse
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 justify-between">
          <div className="inline-flex rounded-lg bg-slate-200/70 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filter === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({staffList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filter === 'pending' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('approved')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                filter === 'approved' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Approved ({staffList.length - pendingCount})
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search teacher or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Loading staff registry...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-slate-500">
              <Users className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-semibold">No staff accounts found</p>
              <p className="text-xs">New teacher requests will appear here automatically.</p>
            </div>
          ) : (
            filteredStaff.map((staff) => (
              <div
                key={staff.uid}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  staff.approved
                    ? 'bg-white border-slate-200'
                    : 'bg-amber-50/60 border-amber-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">{staff.name}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                        staff.role === 'admin'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {staff.role}
                    </span>
                    {staff.approved ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                        <Clock className="w-3 h-3" />
                        Awaiting Approval
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">{staff.email}</p>
                  {staff.subject && (
                    <p className="text-[11px] text-slate-500">Department: {staff.subject}</p>
                  )}
                </div>

                {/* Action Button */}
                {staff.role !== 'admin' && (
                  <div className="shrink-0">
                    {staff.approved ? (
                      <button
                        type="button"
                        disabled={updatingUid === staff.uid}
                        onClick={() => handleToggleApproval(staff, false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>{updatingUid === staff.uid ? 'Updating...' : 'Revoke Access'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingUid === staff.uid}
                        onClick={() => handleToggleApproval(staff, true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{updatingUid === staff.uid ? 'Approving...' : 'Approve Teacher'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Changes take effect immediately on the teacher&apos;s device.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
