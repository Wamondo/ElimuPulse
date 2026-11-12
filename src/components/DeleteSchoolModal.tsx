import React, { useState } from 'react';
import { SchoolProfile } from '../types';
import { useApp } from '../context/AppContext';
import {
  AlertTriangle,
  Trash2,
  X,
  ShieldAlert,
  Building,
  CheckCircle2,
  Lock
} from 'lucide-react';

interface DeleteSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSchool: SchoolProfile | null;
  onSuccess?: (msg: string) => void;
}

export const DeleteSchoolModal: React.FC<DeleteSchoolModalProps> = ({
  isOpen,
  onClose,
  targetSchool,
  onSuccess,
}) => {
  const { deleteSchool, registeredSchools, isOwner } = useApp();
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !targetSchool) return null;

  // Strict owner gate: If user is somehow not owner, do not render content
  if (!isOwner) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-rose-200 text-center">
          <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Access Denied</h2>
          <p className="text-xs text-slate-600 mt-1">
            School deletion is strictly restricted to the Application Owner account.
          </p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const isSoleSchool = (registeredSchools?.length || 1) <= 1;
  const isConfirmed =
    confirmationInput.trim().toLowerCase() === targetSchool.name.trim().toLowerCase() ||
    confirmationInput.trim() === 'DELETE';

  const handleDelete = async () => {
    setErrorMessage(null);
    if (!isConfirmed) {
      setErrorMessage(`Please type "${targetSchool.name}" or "DELETE" exactly to confirm.`);
      return;
    }

    if (isSoleSchool) {
      setErrorMessage('Cannot delete the only registered school in the system. At least one institution must remain.');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteSchool(targetSchool.id);
      setIsDeleting(false);
      setConfirmationInput('');
      if (onSuccess) {
        onSuccess(res.message);
      }
      onClose();
    } catch (err: any) {
      setIsDeleting(false);
      setErrorMessage(err?.message || 'Failed to delete school. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-lg w-full overflow-hidden text-xs">
        {/* Header */}
        <div className="bg-linear-to-r from-rose-950 via-slate-900 to-rose-950 p-4 text-white flex items-center justify-between border-b border-rose-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300">
              <Trash2 className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-200 text-[10px] font-mono font-bold uppercase mb-0.5">
                <Lock className="w-2.5 h-2.5 text-rose-400" />
                App Owner Master Security Control
              </div>
              <h2 className="text-base font-bold tracking-tight text-white">
                Delete Educational Institution
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs">{errorMessage}</div>
            </div>
          )}

          {isSoleSchool ? (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Single Remaining Institution Protection</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>{targetSchool.name}</strong> is currently the only registered school in this portal. 
                The system requires at least one registered educational institution to maintain operational services.
              </p>
              <p className="text-[11px] text-amber-700">
                To delete this school, you must first register another approved school under your App Owner governance.
              </p>
            </div>
          ) : (
            <>
              {/* Institution Profile Summary Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-slate-900 text-sm">{targetSchool.name}</span>
                  </div>
                  <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">
                    {targetSchool.registrationNumber || 'MoE Registered'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px]">County / Location:</span>
                    <span className="font-medium text-slate-800">{targetSchool.subCounty ? `${targetSchool.subCounty}, ` : ''}{targetSchool.county}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Portal Status:</span>
                    <span className={`font-semibold ${targetSchool.isLocked ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {targetSchool.isLocked ? 'Locked (Faculty Logins Blocked)' : 'Active (Live System)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning Notice */}
              <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl text-rose-900 space-y-1.5 text-xs">
                <p className="font-bold flex items-center gap-1.5 text-rose-950">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Warning: Irreversible Deletion
                </p>
                <p className="text-rose-800 leading-relaxed text-[11px]">
                  Permanently deleting this institution will unmount its dedicated multi-tenancy portal, 
                  faculty logins, and local records. If this school is currently active, your account will 
                  automatically switch to another registered school.
                </p>
              </div>

              {/* Confirmation Input */}
              <div className="space-y-1.5 pt-1">
                <label className="block font-semibold text-slate-800 text-xs">
                  To confirm permanent deletion, type <strong className="text-rose-700 select-all font-mono">{targetSchool.name}</strong> or <strong className="text-rose-700 font-mono">DELETE</strong> below:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder={`Type "${targetSchool.name}" or "DELETE"`}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:ring-2 focus:ring-rose-500 focus:bg-white"
                  autoFocus
                />
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-xs"
          >
            Cancel
          </button>

          {!isSoleSchool && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={!isConfirmed || isDeleting}
              className={`flex items-center gap-1.5 px-4 py-2 font-bold rounded-lg text-xs transition-colors shadow-xs ${
                isConfirmed && !isDeleting
                  ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Deleting Institution...' : 'Permanently Delete School'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
