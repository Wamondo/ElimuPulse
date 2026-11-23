import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, CheckCircle2, XCircle, Clock, UserCheck } from 'lucide-react';
import { onValue, ref, update, remove } from 'firebase/database';
import { rtdb } from '../services/firebase';

interface StaffApprovalsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StaffUserEntry {
  uid: string;
  name?: string;
  email?: string;
  subject?: string;
  role?: string;
  approved?: boolean;
  schoolId?: string;
  createdAt?: number;
}

export const StaffApprovalsModal: React.FC<StaffApprovalsModalProps> = ({ isOpen, onClose }) => {
  const [staffList, setStaffList] = useState<StaffUserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const usersRef = ref(rtdb, 'users');
    const unsub = onValue(
      usersRef,
      (snap) => {
        const val = snap.val() || {};
        const entries: StaffUserEntry[] = Object.entries(val).map(([uid, data]) => ({
          uid,
          ...(typeof data === 'object' && data !== null ? (data as Omit<StaffUserEntry, 'uid'>) : {}),
        }));
        entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setStaffList(entries);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApprove = async (uid: string) => {
    setBusyUid(uid);
    try {
      await update(ref(rtdb, `users/${uid}`), { approved: true });
    } finally {
      setBusyUid(null);
    }
  };

  const handleRevokeOrReject = async (uid: string, currentlyApproved?: boolean) => {
    setBusyUid(uid);
    try {
      if (currentlyApproved) {
        await update(ref(rtdb, `users/${uid}`), { approved: false });
      } else {
        await remove(ref(rtdb, `users/${uid}`));
      }
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-indigo-950 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="text-sm font-bold">Staff Account Approvals</h3>
              <p className="text-[11px] text-indigo-200">
                Approve or revoke self-registered staff access in Firebase RTDB
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-3">
          {loading ? (
            <p className="text-xs text-slate-500 text-center py-6">Loading registered staff accounts...</p>
          ) : staffList.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No staff accounts found in RTDB.</p>
          ) : (
            staffList.map((staff) => (
              <div
                key={staff.uid}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {staff.name || 'Unnamed Staff'}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      {staff.role || 'teacher'}
                    </span>
                    {staff.approved ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <UserCheck className="w-3 h-3" /> Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" /> Pending Approval
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 truncate mt-0.5">
                    {staff.email || staff.uid} {staff.subject ? `· ${staff.subject}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!staff.approved && (
                    <button
                      type="button"
                      disabled={busyUid === staff.uid}
                      onClick={() => handleApprove(staff.uid)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyUid === staff.uid}
                    onClick={() => handleRevokeOrReject(staff.uid, staff.approved)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{staff.approved ? 'Revoke' : 'Reject'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
