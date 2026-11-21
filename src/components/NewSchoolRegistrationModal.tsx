import React, { useState } from 'react';
import {
  Building,
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Smartphone,
  Save,
  X,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Crown,
  Lock,
} from 'lucide-react';
import { SchoolProfile } from '../types';
import { validateKenyanPhoneNumber } from '../services/cryptoService';

interface NewSchoolRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (schoolData: Omit<SchoolProfile, 'id'>) => Promise<SchoolProfile>;
}

const KENYAN_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo Marakwet', 'Embu', 'Garissa',
  'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi',
  'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu',
  'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa',
  'Murang\'a', 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua',
  'Nyeri', 'Samburu', 'Siaya', 'Taita Taveta', 'Tana River', 'Tharaka Nithi',
  'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'
];

export const NewSchoolRegistrationModal: React.FC<NewSchoolRegistrationModalProps> = ({
  isOpen,
  onClose,
  onRegister,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    primaryWingName: '',
    juniorWingName: '',
    registrationNumber: '',
    county: 'Kakamega',
    subCounty: 'Lugari / Kakamega North',
    postalAddress: 'P.O. Box 100 - 50100, Kenya',
    email: '',
    phone: '',
    motto: 'Excellence in Knowledge and Character',
    curriculum: 'Kenyan CBC (Competency-Based Curriculum Grades 1 - 9)',
    principalName: '',
    bankName: 'Kenya Commercial Bank (KCB)',
    bankAccount: '',
    mpesaPaybill: '522522',
    mpesaAccountName: '',
    academicYear: '2026',
    currentTerm: 'Term 2 - 2026',
  });

  const [ownerApprovalConfirmed, setOwnerApprovalConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Auto-generate wing names when school name changes
  const handleNameChange = (newName: string) => {
    setFormData((prev) => {
      const updates: any = { name: newName };
      if (!prev.primaryWingName || prev.primaryWingName === `${prev.name} Primary School`) {
        updates.primaryWingName = newName ? `${newName} Primary School` : '';
      }
      if (!prev.juniorWingName || prev.juniorWingName === `${prev.name} Junior School`) {
        updates.juniorWingName = newName ? `${newName} Junior School` : '';
      }
      if (!prev.mpesaAccountName || prev.mpesaAccountName.startsWith('FEES-')) {
        const acronym = newName.replace(/[^A-Za-z]/g, '').slice(0, 8).toUpperCase();
        updates.mpesaAccountName = acronym ? `FEES-${acronym}` : '';
      }
      return { ...prev, ...updates };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.name.trim()) {
      setErrorMsg('Please enter the official school name.');
      return;
    }

    if (!formData.registrationNumber.trim()) {
      setErrorMsg('Please enter the Ministry of Education (MoE) / KNEC registration number.');
      return;
    }

    const phoneValidation = validateKenyanPhoneNumber(formData.phone);
    if (!phoneValidation.isValid) {
      setErrorMsg(
        phoneValidation.error ||
          'Phone must start with 07... or 01... (Example: 0712345678 or 0110445566).'
      );
      return;
    }

    if (!ownerApprovalConfirmed) {
      setErrorMsg('Owner Approval Required: You must certify and grant App Owner Approval to onboard and register this educational institution.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onRegister({
        ...formData,
        phone: phoneValidation.cleanPhone!,
        isLocked: false,
        approvedByOwner: true,
        approvedByOwnerPhone: '0716235185',
        approvedAt: new Date().toISOString(),
        registeredAt: new Date().toISOString(),
      });
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || 'Failed to register the new school. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Building className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>New School Registration</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                  Multi-Institution
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Register a new institution with complete CBC grading, tuition ledgers, staff rosters, and security.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Institution Details */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-indigo-600" />
              <span>1. Institutional Identity & Accreditation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">
                  School Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. St. Jude Comprehensive School"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Primary Wing Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. St. Jude Primary School"
                  value={formData.primaryWingName}
                  onChange={(e) => setFormData({ ...formData, primaryWingName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Junior School Wing Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. St. Jude Junior School"
                  value={formData.juniorWingName}
                  onChange={(e) => setFormData({ ...formData, juniorWingName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  MoE / KNEC Center Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MOE/MJS/2026/09124"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Principal / Head of Institution
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Arthur Wekesa, Ph.D"
                  value={formData.principalName}
                  onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Location & Contacts */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>2. Location & Official Contacts</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">County</label>
                <select
                  value={formData.county}
                  onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-white"
                >
                  {KENYAN_COUNTIES.map((c) => (
                    <option key={c} value={c}>
                      {c} County
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Sub-County</label>
                <input
                  type="text"
                  placeholder="e.g. Lugari Sub-County"
                  value={formData.subCounty}
                  onChange={(e) => setFormData({ ...formData, subCounty: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Official Phone <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="07... or 01..."
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                />
                <span className="text-[10px] text-slate-400">Kenyan cellular format (07... or 01...)</span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Official Email</label>
                <input
                  type="email"
                  placeholder="admin@school.sc.ke"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Postal Address</label>
                <input
                  type="text"
                  placeholder="P.O. Box ... Kenya"
                  value={formData.postalAddress}
                  onChange={(e) => setFormData({ ...formData, postalAddress: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">School Motto</label>
                <input
                  type="text"
                  placeholder="e.g. Strive for Excellence, Integrity and Leadership"
                  value={formData.motto}
                  onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs italic"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Bursar & Financial Treasury */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
              <span>3. Financial & Fee Collection Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">M-Pesa Paybill</label>
                <input
                  type="text"
                  placeholder="522522"
                  value={formData.mpesaPaybill}
                  onChange={(e) => setFormData({ ...formData, mpesaPaybill: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">M-Pesa Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. FEES-STJUDE"
                  value={formData.mpesaAccountName}
                  onChange={(e) => setFormData({ ...formData, mpesaAccountName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. KCB / Equity Bank / Co-op"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Bank Account Number</label>
                <input
                  type="text"
                  placeholder="e.g. 129038475"
                  value={formData.bankAccount}
                  onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Automated Provisioning Notice */}
          <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-start gap-2.5 text-indigo-900 text-[11px] leading-relaxed">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Automated Feature Provisioning:</span> Registering this school will instantly instantiate all features: CBC Grades (Grade 1 - 9), Kenyan CBC curriculum subjects, tuition fee ledgers, automated reminders, and attendance roll calls.
            </div>
          </div>

          {/* App Owner Master Authorization & Approval Gate */}
          <div className="p-4 bg-linear-to-br from-amber-50 via-indigo-50/40 to-amber-50 border-2 border-amber-300 rounded-xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-200/90 rounded-lg text-amber-900 shrink-0">
                  <Crown className="w-4 h-4 text-amber-700 fill-amber-500" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-amber-950 uppercase tracking-wide">
                    App Owner Approval &amp; Authorization Gate
                  </h4>
                  <p className="text-[11px] text-amber-900/80">
                    Registration can only be executed under the explicit approval of the App Owner.
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200 text-amber-950 border border-amber-400 shrink-0">
                OWNER APPROVAL REQUIRED
              </span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-amber-200 text-[11px] text-slate-800 space-y-2.5">
              <div className="flex items-center justify-between font-mono text-[10px] text-slate-600 pb-2 border-b border-slate-100">
                <span className="text-slate-500">Authorized Approver:</span>
                <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                  👑 App Owner &amp; Director (0716235185)
                </span>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ownerApprovalConfirmed}
                  onChange={(e) => {
                    setOwnerApprovalConfirmed(e.target.checked);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="leading-snug font-medium text-slate-900 select-none">
                  I, as the authorized <strong>App Owner and Director</strong>, formally approve and authorize the registration of <strong>{formData.name || 'this educational institution'}</strong> under the ElimuPulse national school network with full CBC Grade 1–9 capabilities.
                </span>
              </label>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !ownerApprovalConfirmed}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Registering with Owner Approval...' : 'Approve & Register School'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
