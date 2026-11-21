import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldAlert,
  Building,
  Clock,
  Info
} from 'lucide-react';
import { SchoolProfile } from '../types';

interface SchoolLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: SchoolProfile;
  onToggleLock: (schoolId: string, reason?: string) => Promise<{ success: boolean; isLocked: boolean; schoolName: string }>;
}

export const SchoolLockModal: React.FC<SchoolLockModalProps> = ({
  isOpen,
  onClose,
  school,
  onToggleLock,
}) => {
  const [lockReason, setLockReason] = useState(school.lockReason || 'Termly administrative review by Institution Director.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isCurrentlyLocked = Boolean(school.isLocked);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onToggleLock(school.id, isCurrentlyLocked ? undefined : lockReason);
      setIsSubmitting(false);
      onClose();
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-xs">
        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between text-white ${
            isCurrentlyLocked
              ? 'bg-linear-to-r from-emerald-800 to-teal-900'
              : 'bg-linear-to-r from-rose-900 to-amber-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isCurrentlyLocked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {isCurrentlyLocked ? <Unlock className="w-5 h-5 text-emerald-300" /> : <Lock className="w-5 h-5 text-rose-300" />}
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span>{isCurrentlyLocked ? 'Unlock School Portal' : 'Lock School Portal'}</span>
              </h2>
              <p className="text-[11px] text-slate-200 truncate max-w-[240px]">
                {school.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Target School Badge */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Building className="w-4 h-4 text-slate-600" />
              <div>
                <div className="font-bold text-slate-900 text-xs">{school.name}</div>
                <div className="text-[10px] text-slate-500 font-mono">
                  MoE Code: {school.registrationNumber} · {school.county}
                </div>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                isCurrentlyLocked
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              {isCurrentlyLocked ? '🔒 Currently Locked' : '🔓 Currently Unlocked'}
            </span>
          </div>

          {/* Policy Explanation */}
          {isCurrentlyLocked ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1.5 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Restoring Faculty & Administrative Logins</span>
              </div>
              <p className="text-[11px] text-emerald-700">
                Unlocking this school will allow teachers, class teachers, subject teachers, and school administrators (principals and bursars) to log in again normally.
              </p>
              {school.lockedAt && (
                <div className="text-[10px] text-emerald-600 font-mono mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Locked since: {new Date(school.lockedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-2 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Strict School Lock Policy</span>
              </div>
              <p className="text-[11px] text-amber-700">
                When this school is locked:
              </p>
              <ul className="text-[11px] text-amber-800 list-disc list-inside space-y-1 pl-1">
                <li><strong>Teachers cannot log in</strong> (class & subject teachers blocked).</li>
                <li><strong>School Administrators cannot log in</strong> (principals & bursars blocked).</li>
                <li><strong>All other features remain intact:</strong> The School Owner / Director retains full access to inspect student records, fee ledgers, scorecards, and reports.</li>
                <li>Faculty and admins can only log in once unlocked.</li>
              </ul>

              <div className="pt-2">
                <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                  Lock Reason (Displayed to blocked staff):
                </label>
                <input
                  type="text"
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  placeholder="e.g. Term 2 financial reconciliation and audit"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className={`flex items-center gap-1.5 px-4 py-2 font-semibold text-white rounded-lg text-xs transition-colors cursor-pointer shadow-sm disabled:opacity-50 ${
                isCurrentlyLocked
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isCurrentlyLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Unlocking...' : 'Unlock School Portal'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Locking...' : 'Lock School Portal Now'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
