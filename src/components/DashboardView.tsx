import { DiagramSketchModal } from './DiagramSketchModal';
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { calculateCompetencyGrade } from '../services/gradingService';
import {
  Users,
  DollarSign,
  AlertCircle,
  CalendarCheck,
  BellRing,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  GraduationCap,
  FileCheck,
  Lock,
  ChevronRight,
  Send,
  BookOpen,
  Building,
  CheckCircle2,
  Calendar,
  Clock,
  Printer,
  ShieldCheck,
  Award,
  Sparkles,
  Phone,
  Mail,
  Receipt
} from 'lucide-react';
import { maskPhoneNumber } from '../services/cryptoService';
import { extractQuestionsFromPdfFile } from '../services/pdfQuestionExtractor';
import {
  AssignmentQuestion,
  LearningAreaAssignmentItem,
  LearnerAssignmentSubmission,
  loadLocalAssignments,
  saveAssignments,
  subscribeAssignments,
  calculateAssignmentTotalMarks,
  formatCalculationSteps,
  CalculationStepAnnotation,
  RedInkStamp,
} from '../services/assignmentService';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenRecordPayment: () => void;
  onOpenAddLearner: () => void;
}


const SYMBOL_CATEGORIES: Record<string, string[]> = {
  'Arithmetic & Signs': ['+', '−', '×', '÷', '±', '∓', '=', '≠', '≈', '≡', '≅', '∝', '<', '>', '≤', '≥', '≪', '≫'],
  'Powers & Roots': ['²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁰', '¹', 'ⁿ', '√', '∛', '∜', '¹/₂', '½', '⅓', '⅔', '¼', '¾', '⅕', '⅛', '%', '‰'],
  'Geometry & Units': ['∠', '∟', '⊥', '∥', '△', '□', '◇', '○', '●', '°', '′', '″', 'π', 'τ', 'φ', 'mm', 'cm', 'dm', 'm', 'km', 'mm²', 'cm²', 'm²', 'km²', 'ha', 'ml', 'L', 'cm³', 'm³', 'g', 'kg', 't'],
  'Greek & Sets': ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'ρ', 'σ', 'τ', 'υ', 'ϕ', 'χ', 'ψ', 'ω', 'Δ', 'Σ', 'Π', 'Ω', '∈', '∉', '⊂', '⊃', '⊆', '⊇', '∪', '∩', '∅', 'ℕ', 'ℤ', 'ℚ', 'ℝ'],
  'Logic & Calculus': ['∀', '∃', '∄', '∴', '∵', '→', '←', '↔', '⇒', '⇔', '∞', '∂', '∇', '∫', '∬', '∮', '∏', '∑', '!'],
};

const ALL_MATH_SYMBOLS = Array.from(
  new Set(Object.values(SYMBOL_CATEGORIES).flat())
);

type ShapePresetKey = 'triangle' | 'rectangle' | 'circle' | 'cube';

interface DiagramMeasurements {
  shape: ShapePresetKey;
  base: string;
  height: string;
  length: string;
  width: string;
  radius: string;
  unit: string;
}

function renderMeasuredDiagramSvg(m: DiagramMeasurements): string {
  const u = (m.unit || 'cm').trim();
  const b = (m.base || 'b').trim();
  const h = (m.height || 'h').trim();
  const l = (m.length || 'l').trim();
  const w = (m.width || 'w').trim();
  const r = (m.radius || 'r').trim();

  if (m.shape === 'triangle') {
    const bLabel = /^\d/.test(b) ? `${b} ${u}` : `b = ${b} ${u}`;
    const hLabel = /^\d/.test(h) ? `${h} ${u}` : `h = ${h} ${u}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 140" width="260" height="140"><rect width="260" height="140" fill="#f8fafc"/><polygon points="75,112 210,112 75,26" fill="#e0e7ff" stroke="#1e293b" stroke-width="2.5"/><polyline points="75,98 89,98 89,112" fill="none" stroke="#1e293b" stroke-width="1.8"/><text x="115" y="128" font-size="12" font-weight="bold" font-family="sans-serif" fill="#0f172a">${bLabel}</text><text x="12" y="72" font-size="12" font-weight="bold" font-family="sans-serif" fill="#1e40af">${hLabel}</text></svg>`;
  }
  if (m.shape === 'rectangle') {
    const lLabel = /^\d/.test(l) ? `${l} ${u}` : `l = ${l} ${u}`;
    const wLabel = /^\d/.test(w) ? `${w} ${u}` : `w = ${w} ${u}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 140" width="260" height="140"><rect width="260" height="140" fill="#f8fafc"/><rect x="55" y="26" width="145" height="76" fill="#dcfce7" stroke="#1e293b" stroke-width="2.5"/><text x="102" y="120" font-size="12" font-weight="bold" font-family="sans-serif" fill="#0f172a">${lLabel}</text><text x="206" y="68" font-size="12" font-weight="bold" font-family="sans-serif" fill="#166534">${wLabel}</text></svg>`;
  }
  if (m.shape === 'circle') {
    const rLabel = /^\d/.test(r) ? `r = ${r} ${u}` : `r = ${r} ${u}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 140" width="260" height="140"><rect width="260" height="140" fill="#f8fafc"/><circle cx="115" cy="70" r="46" fill="#fef3c7" stroke="#1e293b" stroke-width="2.5"/><line x1="115" y1="70" x2="161" y2="70" stroke="#dc2626" stroke-width="2.2"/><circle cx="115" cy="70" r="3.5" fill="#0f172a"/><text x="166" y="74" font-size="12" font-weight="bold" font-family="sans-serif" fill="#dc2626">${rLabel}</text></svg>`;
  }
  const lLabel = /^\d/.test(l) ? `l=${l}${u}` : `l=${l}`;
  const wLabel = /^\d/.test(w) ? `w=${w}${u}` : `w=${w}`;
  const hLabel = /^\d/.test(h) ? `h=${h}${u}` : `h=${h}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 145" width="260" height="145"><rect width="260" height="145" fill="#f8fafc"/><rect x="65" y="44" width="80" height="64" fill="#e0f2fe" stroke="#1e293b" stroke-width="2"/><polygon points="65,44 96,22 176,22 145,44" fill="#bae6fd" stroke="#1e293b" stroke-width="2"/><polygon points="145,44 176,22 176,86 145,108" fill="#7dd3fc" stroke="#1e293b" stroke-width="2"/><text x="72" y="124" font-size="11" font-weight="bold" font-family="sans-serif" fill="#0f172a">${lLabel} · ${wLabel}</text><text x="182" y="60" font-size="11" font-weight="bold" font-family="sans-serif" fill="#0369a1">${hLabel}</text></svg>`;
}

const QUICK_DIAGRAMS: { key: ShapePresetKey; label: string; caption: string; defaults: DiagramMeasurements }[] = [
  {
    key: 'triangle',
    label: 'Triangle',
    caption: 'Triangle Diagram',
    defaults: { shape: 'triangle', base: '12', height: '8', length: '10', width: '6', radius: '7', unit: 'cm' }
  },
  {
    key: 'rectangle',
    label: 'Rectangle',
    caption: 'Rectangle Diagram',
    defaults: { shape: 'rectangle', base: '10', height: '6', length: '12', width: '7', radius: '7', unit: 'cm' }
  },
  {
    key: 'circle',
    label: 'Circle',
    caption: 'Circle Diagram',
    defaults: { shape: 'circle', base: '14', height: '10', length: '10', width: '6', radius: '7', unit: 'cm' }
  },
  {
    key: 'cube',
    label: 'Cube / Prism',
    caption: 'Prism / Block Diagram',
    defaults: { shape: 'cube', base: '8', height: '5', length: '8', width: '6', radius: '7', unit: 'cm' }
  }
];

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateTab,
  onOpenRecordPayment,
  onOpenAddLearner,
}) => {
  const {
    learners,
    parents,
    feeStructures,
    feePayments,
    reminders,
    scoreCards,
    attendance,
    currentUser,
    batchDispatchReminders,
    schoolProfile,
    grades,
    subjects,
    teachers,
    adminAccounts,
  } = useApp();

  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);
  const [subjectAssignments, setSubjectAssignments] = useState<LearningAreaAssignmentItem[]>(() =>
    loadLocalAssignments()
  );
  const [selectedTeacherArea, setSelectedTeacherArea] = useState<string>('');
  const [assignGrade, setAssignGrade] = useState<string>('All Grades');
  const [assignTitle, setAssignTitle] = useState<string>('');
  const [assignInstructions, setAssignInstructions] = useState<string>('');
  const [assignDueDate, setAssignDueDate] = useState<string>('');
  const [sketchTargetQuestionId, setSketchTargetQuestionId] = useState<string | null>(null);
  const [draftQuestions, setDraftQuestions] = useState<AssignmentQuestion[]>([]);
  const [isExtractingPdf, setIsExtractingPdf] = useState<boolean>(false);
  const [pdfExtractNotice, setPdfExtractNotice] = useState<string>('');

  const handlePdfQuestionsUpload = async (file?: File | null) => {
    if (!file) return;
    setIsExtractingPdf(true);
    setPdfExtractNotice('');
    try {
      const result = await extractQuestionsFromPdfFile(file, (info) => {
        setPdfExtractNotice(info.message);
      });
      if (!assignTitle.trim() && result.suggestedTitle) {
        setAssignTitle(result.suggestedTitle);
      }
      if (result.questions.length > 0) {
        setDraftQuestions(result.questions);
        setPdfExtractNotice(
          `Extracted ${result.questions.length} question(s) in exact order from "${file.name}"${result.usedOcr ? ' via OCR' : ''}. Review below and post to learners.`
        );
      } else {
        setPdfExtractNotice(
          `No numbered questions could be read from "${file.name}"${result.usedOcr ? ' even after OCR' : ''}.${result.suggestedTitle ? ` Suggested title "${result.suggestedTitle}" filled if blank.` : ''} You can use "+ Multiple Choice" or "+ Written / Working Question" below to add questions.`
        );
      }
    } catch {
      setPdfExtractNotice(`Unable to read "${file.name}". Please check the PDF file and try again.`);
    } finally {
      setIsExtractingPdf(false);
    }
  };
  const [onlyMySets, setOnlyMySets] = useState<boolean>(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [selectedSubmissionLearnerId, setSelectedSubmissionLearnerId] = useState<string>('');
  const [markScoreInput, setMarkScoreInput] = useState<string>('');
  const [markFeedbackInput, setMarkFeedbackInput] = useState<string>('Well done; meets competency expectations.');
  const [stepMarksDraft, setStepMarksDraft] = useState<Record<string, CalculationStepAnnotation[]>>({});
  const [activePaperStamp, setActivePaperStamp] = useState<RedInkStamp>('M1');
  const [crossAreaGradeFilter, setCrossAreaGradeFilter] = useState<string>('ALL');
  const [symbolCategory, setSymbolCategory] = useState<string>('Arithmetic & Signs');
  const [showAllSymbols, setShowAllSymbols] = useState<boolean>(false);
  const [diagramMeasurementsByQ, setDiagramMeasurementsByQ] = useState<Record<string, DiagramMeasurements>>({});
  const [assignToast, setAssignToast] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeAssignments((items) => {
      setSubjectAssignments(items);
    });
    return unsubscribe;
  }, []);

  const persistSubjectAssignments = (nextList: LearningAreaAssignmentItem[]) => {
    setSubjectAssignments(nextList);
    saveAssignments(nextList);
  };

  const addDraftQuestion = (type: 'mcq' | 'text') => {
    const newQ: AssignmentQuestion = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      prompt: '',
      type,
      marks: type === 'mcq' ? 2 : 5,
      ...(type === 'mcq'
        ? {
            options: { A: '', B: '', C: '', D: '' },
            correctOption: 'A' as const,
          }
        : {}),
    };
    setDraftQuestions((prev) => [...prev, newQ]);
  };

  const updateDraftQuestion = (id: string, patch: Partial<AssignmentQuestion>) => {
    setDraftQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
    );
  };

  const removeDraftQuestion = (id: string) => {
    setDraftQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  // =====================
  // 1. PARENT ROLE SPECIFIC DASHBOARD VIEW
  // =====================
  if (currentUser?.role === 'parent') {
    const parentLearner =
      learners.find((l) => l.id === currentUser?.learnerId) ||
      learners.find((l) => l.parentId === currentUser?.parentId) ||
      learners[0];

    const parentRecord = parents.find((p) => p.id === parentLearner?.parentId);
    const learnerFee =
      feeStructures.find((fs) => fs.learnerId === parentLearner?.id && fs.term === 'Term 2 - 2026') ||
      feeStructures.find((fs) => fs.learnerId === parentLearner?.id);
    const learnerScoreCard = scoreCards.find((sc) => sc.learnerId === parentLearner?.id);
    const learnerAttendance = attendance.filter((a) => a.learnerId === parentLearner?.id);
    const learnerPayments = feePayments.filter((p) => p.learnerId === parentLearner?.id);
    const parentNotices = reminders.filter(
      (r) => r.parentId === parentRecord?.id || r.learnerId === parentLearner?.id
    );

    const totalDays = learnerAttendance.length;
    const presentDays = learnerAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    const absences = learnerAttendance.filter((a) => a.status === 'absent').length;
    const attendancePercent = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    const competencyResult = learnerScoreCard
      ? calculateCompetencyGrade(learnerScoreCard.averageScore)
      : calculateCompetencyGrade(0);

    return (
      <div className="space-y-6">
        {/* Parent Welcome Banner */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>{schoolProfile?.name || 'Comprehensive School'} · Parent Portal</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Confidential Child Data
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome, {parentRecord?.fullName || currentUser?.name}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {parentLearner ? (
                <>
                  Secure official academic and financial records for your learner:{' '}
                  <strong className="text-slate-900">
                    {parentLearner.firstName} {parentLearner.lastName}
                  </strong>{' '}
                  ({parentLearner.studentId} · {parentLearner.grade})
                </>
              ) : (
                'No enrolled learner profile is currently linked to this guardian account.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateTab('scorecards')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Award className="w-3.5 h-3.5" />
              <span>View Score Card</span>
            </button>
            <button
              onClick={() => onNavigateTab('fees')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-slate-500" />
              <span>Fee Receipts</span>
            </button>
          </div>
        </div>

        {/* Child Specific KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Academic Competency Grade */}
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Academic Competency</span>
              <Award className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono px-2 py-0.5 rounded border text-sm ${learnerScoreCard ? competencyResult.badgeClass : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {learnerScoreCard ? competencyResult.grade : '—'}
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {learnerScoreCard ? learnerScoreCard.gpa.toFixed(2) : '0.00'}{' '}
                <span className="text-xs text-slate-500 font-normal">/ 8.0</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {learnerScoreCard
                ? `Mean: ${learnerScoreCard.averageScore.toFixed(1)}% · Class Rank #${learnerScoreCard.classRank}`
                : 'No assessment results published yet'}
            </p>
          </div>

          {/* School Fee Standing */}
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Tuition Balance</span>
              <CreditCard className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums">
              {learnerFee ? (
                learnerFee.balance <= 0 ? (
                  <span className="text-emerald-700">Ksh 0</span>
                ) : (
                  <span className="text-amber-700">Ksh {learnerFee.balance.toLocaleString()}</span>
                )
              ) : (
                'Ksh 0'
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {!learnerFee
                ? 'No fee invoice generated'
                : learnerFee.balance <= 0
                ? '✓ All fees cleared for Term 2'
                : `Paid Ksh ${learnerFee.amountPaid.toLocaleString()} of Ksh ${learnerFee.totalDue.toLocaleString()}`}
            </p>
          </div>

          {/* Attendance Percentage */}
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Term Attendance</span>
              <CalendarCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {attendancePercent.toFixed(1)}%
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {presentDays} days present · {absences} unexcused absence
            </p>
          </div>

          {/* Student Profile Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold uppercase tracking-wider text-[11px]">Student Profile</span>
              <GraduationCap className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-base font-bold text-slate-900">
              {parentLearner?.grade}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              DOB: {parentLearner?.dateOfBirth}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 truncate" title={parentLearner?.emergencyMedicalNotes}>
              Med: {parentLearner?.emergencyMedicalNotes || 'No known allergies'}
            </p>
          </div>
        </div>

        {/* Parent Details Grid: Academic Subject Performance & Fee Invoices */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subject Grades Breakdown */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {parentLearner?.firstName}'s Subject Evaluations (Term 2 - 2026)
                </h2>
                <p className="text-xs text-slate-500">Graded on the 8-point competency rubric</p>
              </div>
              <button
                onClick={() => onNavigateTab('scorecards')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Full Score Card</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] whitespace-nowrap text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-3 text-right">Test 1</th>
                    <th className="py-2.5 px-3 text-right">Test 2</th>
                    <th className="py-2.5 px-3 text-right">Exam</th>
                    <th className="py-2.5 px-3 text-right">Total (/100)</th>
                    <th className="py-2.5 px-3 text-center">Grade</th>
                    <th className="py-2.5 px-4">Teacher Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(learnerScoreCard?.subjects || []).map((sub) => {
                    const gradeInfo = calculateCompetencyGrade(sub.totalScore);
                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {sub.subjectName}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          {sub.catScore}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          {sub.midTermScore}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          {sub.finalExamScore}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 tabular-nums">
                          {sub.totalScore}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${gradeInfo.badgeClass}`}
                          >
                            {gradeInfo.grade} ({gradeInfo.points} pts)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px] italic">
                          "{sub.teacherRemarks}"
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side Panel: Recent Fee Receipts & Notices */}
          <div className="space-y-6">
            {/* Fee Receipts Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900">Payment History & Receipts</h2>
                <button
                  onClick={() => onNavigateTab('fees')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  View All
                </button>
              </div>

              {learnerPayments.length > 0 ? (
                <div className="space-y-2.5">
                  {learnerPayments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{p.receiptNumber}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {p.paymentDate} · {p.method}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold font-mono text-emerald-700">
                          Ksh {p.amount.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-medium">Cleared</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-3 text-center">No payment transactions recorded.</p>
              )}
            </div>

            {/* School Communications Received */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900">Official Notices & Reminders</h2>
                <BellRing className="w-4 h-4 text-slate-400" />
              </div>
              {parentNotices.length > 0 ? (
                <div className="space-y-2.5">
                  {parentNotices.slice(0, 3).map((n) => (
                    <div
                      key={n.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 capitalize">
                          {n.channel.toUpperCase()} Notification
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{n.scheduledDate}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {n.messagePreview}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-3 text-center">No pending notifications.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =====================
  // 2. CLASS TEACHER SPECIFIC DASHBOARD VIEW
  // =====================
  if (currentUser?.role === 'teacher' && currentUser?.teacherType === 'class_teacher') {
    const representedGrade = currentUser?.teacherGrade || 'Grade 7A';
    const gradeLearners = learners.filter((l) => l.grade === representedGrade);
    const gradeStructures = feeStructures.filter(
      (fs) => fs.term === 'Term 2 - 2026' && gradeLearners.some((l) => l.id === fs.learnerId)
    );
    const gradeAttendance = attendance.filter((a) =>
      gradeLearners.some((l) => l.id === a.learnerId)
    );

    const gradeTotalBilled = gradeStructures.reduce((acc, curr) => acc + curr.totalDue, 0);
    const gradeTotalCollected = gradeStructures.reduce((acc, curr) => acc + curr.amountPaid, 0);
    const gradeTotalBal = gradeStructures.reduce((acc, curr) => acc + curr.balance, 0);
    const gradeClearanceRate =
      gradeTotalBilled > 0 ? (gradeTotalCollected / gradeTotalBilled) * 100 : 0;

    // Today's attendance for this grade
    const allDates = Array.from(new Set(gradeAttendance.map((a) => a.date))).sort();
    const latestDate = allDates[allDates.length - 1] || '';
    const latestGradeAtt = latestDate ? gradeAttendance.filter((a) => a.date === latestDate) : [];
    const presentInGrade = latestGradeAtt.filter(
      (a) => a.status === 'present' || a.status === 'late'
    ).length;
    const gradeAttRate =
      latestGradeAtt.length > 0 ? (presentInGrade / latestGradeAtt.length) * 100 : 0;

    return (
      <div className="space-y-6">
        {/* Class Teacher Banner */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Faculty Information System</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Class Teacher · {representedGrade}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome, {currentUser?.name}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Authorized full management of all academic scorecards, daily roll call, and student welfare for{' '}
              <strong className="text-slate-900">{representedGrade}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateTab('attendance')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Take Today's Roll Call ({representedGrade})</span>
            </button>
            <button
              onClick={() => onNavigateTab('scorecards')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-slate-500" />
              <span>Class Remarks & Score Cards</span>
            </button>
          </div>
        </div>

        {requestStatusMsg && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-center justify-between gap-3">
            <span className="font-medium">{requestStatusMsg}</span>
            <button
              type="button"
              onClick={() => setRequestStatusMsg(null)}
              className="text-[11px] font-semibold text-amber-800 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Request Marks Upload ({representedGrade})
              </h2>
              <p className="text-xs text-slate-500">
                Send a push notification to Subject Teachers to unlock mark uploads for {representedGrade}.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {markRequests.filter((r) => r.grade === representedGrade && r.active).length} active request(s)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(
              new Set(
                scoreCards
                  .filter((sc) => gradeLearners.some((l) => l.id === sc.learnerId))
                  .flatMap((sc) => sc.subjects.map((s) => s.subjectName))
              )
            ).map((subjName) => {
              const alreadyRequested = markRequests.some(
                (r) =>
                  r.active &&
                  r.grade === representedGrade &&
                  (r.subject === subjName || r.subject === 'All Subject Areas')
              );
              return (
                <button
                  key={subjName}
                  type="button"
                  onClick={() => sendMarkUploadPushRequest(representedGrade, subjName)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    alreadyRequested
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-slate-50 hover:bg-amber-50 text-slate-800 hover:text-amber-900 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  {alreadyRequested ? `Requested · ${subjName}` : `Request ${subjName} Marks`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grade KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-1">Class Roll</span>
            <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {gradeLearners.length} Students
            </div>
            <p className="text-xs text-slate-500 mt-1">{representedGrade} Cohort</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-1">Today's Attendance Rate</span>
            <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
              {gradeAttRate.toFixed(1)}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {latestDate ? `${presentInGrade} of ${latestGradeAtt.length} present on ${latestDate}` : 'No attendance records yet'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-1">Fee Clearance Rate</span>
            <div className="text-2xl font-bold font-mono text-indigo-700 tabular-nums">
              {gradeClearanceRate.toFixed(1)}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Ksh {gradeTotalCollected.toLocaleString()} of Ksh {gradeTotalBilled.toLocaleString()} collected
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-1">Outstanding Grade Dues</span>
            <div className="text-2xl font-bold font-mono text-amber-700 tabular-nums">
              Ksh {gradeTotalBal.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">Parent settlement pending</p>
          </div>
        </div>

        {/* Class Roster Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Learners in {representedGrade} (Class Teacher Authorized Directory)
              </h2>
              <p className="text-xs text-slate-500">
                Direct access to student profiles, guardian contacts, and term performance
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('learners')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Roster</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] whitespace-nowrap text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4">Student Name</th>
                  <th className="py-2.5 px-3">Student ID</th>
                  <th className="py-2.5 px-4">Parent / Guardian</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Medical / Emergency</th>
                  <th className="py-2.5 px-3">Fee Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gradeLearners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                      No learners are currently enrolled in {representedGrade}.
                    </td>
                  </tr>
                ) : (
                  gradeLearners.map((learner) => {
                    const parent = parents.find((p) => p.id === learner.parentId);
                    const fee = feeStructures.find(
                      (fs) => fs.learnerId === learner.id && fs.term === 'Term 2 - 2026'
                    );
                    return (
                      <tr key={learner.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {learner.firstName} {learner.lastName}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">{learner.studentId}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{parent?.fullName}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {parent ? maskPhoneNumber(parent.phone) : ''}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {learner.emergencyMedicalNotes || 'None'}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase font-mono ${
                              fee && fee.balance <= 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {!fee ? 'Unbilled' : fee.balance <= 0 ? 'Cleared' : `Due Ksh ${fee.balance.toLocaleString()}`}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onNavigateTab('scorecards')}
                              className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors cursor-pointer"
                            >
                              Score Card
                            </button>
                            <button
                              onClick={() => onNavigateTab('attendance')}
                              className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                            >
                              Attendance
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =====================
  // 3. SUBJECT TEACHER SPECIFIC DASHBOARD VIEW
  // =====================
  if (currentUser?.role === 'teacher' && currentUser?.teacherType === 'subject_teacher') {
    const matchedTeacher = teachers.find(
      (t) =>
        currentUser?.id === `session-teacher-${t.id}` ||
        (t.name || '').trim().toLowerCase() === (currentUser?.name || '').trim().toLowerCase()
    );
    const registeredSubjects =
      matchedTeacher?.registeredSubjects && matchedTeacher.registeredSubjects.length > 0
        ? matchedTeacher.registeredSubjects
        : currentUser?.registeredSubjects || ['Mathematics'];

    const subjectGradesMap = matchedTeacher?.subjectGrades || {};
    const fallbackTeacherGrades = (matchedTeacher?.assignedGrade || currentUser?.teacherGrade || '')
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);

    const getGradesForLearningArea = (area: string): string[] => {
      const exact = subjectGradesMap[area];
      if (Array.isArray(exact) && exact.length > 0) return exact;
      const ciKey = Object.keys(subjectGradesMap).find(
        (k) => k.trim().toLowerCase() === area.trim().toLowerCase()
      );
      if (ciKey && Array.isArray(subjectGradesMap[ciKey]) && subjectGradesMap[ciKey].length > 0) {
        return subjectGradesMap[ciKey];
      }
      return fallbackTeacherGrades;
    };

    const allAssignedGrades = Array.from(
      new Set(
        registeredSubjects.flatMap((subj) => getGradesForLearningArea(subj))
      )
    );

    const scopedLearners = learners.filter((l) => {
      const sameSchool = !currentUser?.schoolId || !l.schoolId || l.schoolId === currentUser.schoolId;
      if (!sameSchool) return false;
      if (allAssignedGrades.length === 0) return false;
      return allAssignedGrades.some(
        (g) => g.trim().toLowerCase() === (l.grade || '').trim().toLowerCase()
      );
    });

    return (
      <div className="space-y-6">
        {/* Subject Teacher Banner */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>Departmental Assessment Workspace</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                Subject Teacher
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome, {currentUser?.name}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Authorized assessment privileges for registered subjects:{' '}
              <strong className="text-slate-900">{registeredSubjects.join(', ')}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateTab('scorecards')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Enter Subject Scores & Remarks</span>
            </button>
          </div>
        </div>

        {/* Subject KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-1">Registered Subjects</span>
            <div className="text-2xl font-bold font-mono text-slate-900">
              {registeredSubjects.length}
            </div>
            <p className="text-xs text-indigo-600 mt-1 truncate">
              {registeredSubjects.join(' · ')}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-1">Active Classes Taught</span>
            <div className="text-2xl font-bold font-mono text-indigo-700 tabular-nums">
              {allAssignedGrades.length > 0
                ? `${allAssignedGrades.length} ${allAssignedGrades.length === 1 ? 'Grade' : 'Grades'}`
                : 'Unassigned'}
            </div>
            <p
              className="text-xs text-slate-500 mt-1 truncate"
              title={allAssignedGrades.length > 0 ? allAssignedGrades.join(', ') : 'Assign specific grades in Academic Setup'}
            >
              {allAssignedGrades.length > 0
                ? `${allAssignedGrades.slice(0, 4).join(', ')}${allAssignedGrades.length > 4 ? ` +${allAssignedGrades.length - 4} more` : ''}`
                : 'Assign specific grades in Academic Setup'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-1">Total Enrolled Students</span>
            <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
              {scopedLearners.length} Students
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {allAssignedGrades.length > 0
                ? `Across ${allAssignedGrades.join(', ')}`
                : 'No classes assigned yet'}
            </p>
          </div>
        </div>

        {/* Learning Area Assignments (Assignments to Be Done & Assignments Marked) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Learning Area Assignments (Send to Learners &amp; Mark)
              </h2>
              <p className="text-xs text-slate-500">
                Select a registered learning area to send an assignment directly to the Learner Portal or mark completed work.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {registeredSubjects.map((area) => {
                const activeArea = selectedTeacherArea || registeredSubjects[0];
                const isSelected = activeArea === area;
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setSelectedTeacherArea(area)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </div>

          {assignToast && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
              <span className="font-medium">{assignToast}</span>
              <button
                type="button"
                onClick={() => setAssignToast(null)}
                className="text-[11px] font-semibold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {(() => {
            const activeArea = selectedTeacherArea || registeredSubjects[0];
            const currentTeacherId = currentUser?.id || '';
            const currentTeacherName = (currentUser?.name || '').trim().toLowerCase();

            const areaItems = subjectAssignments.filter((a) => {
              const areaMatches = a.learningArea.trim().toLowerCase() === activeArea.trim().toLowerCase();
              if (!areaMatches) return false;
              if (!onlyMySets) return true;
              if (a.teacherId && currentTeacherId) return a.teacherId === currentTeacherId;
              return (a.teacherName || '').trim().toLowerCase() === currentTeacherName;
            });

            const toDoItems = areaItems.filter((a) => {
              const subs = Object.values(a.submissions || {});
              if (subs.length === 0) return a.status === 'todo';
              return subs.some((s) => s.status === 'submitted') || a.status === 'todo';
            });

            const markedEntries: Array<{
              assignment: LearningAreaAssignmentItem;
              submission?: LearnerAssignmentSubmission;
            }> = [];

            areaItems.forEach((item) => {
              const subs = Object.values(item.submissions || {});
              const markedSubs = subs.filter((s) => s.status === 'marked');
              if (markedSubs.length > 0) {
                markedSubs.forEach((sub) => {
                  markedEntries.push({ assignment: item, submission: sub });
                });
              } else if (item.status === 'marked') {
                markedEntries.push({ assignment: item });
              }
            });

            const draftTotalMarks = calculateAssignmentTotalMarks(draftQuestions);

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/60 border border-indigo-100 px-3.5 py-2 rounded-xl">
                  <div className="text-xs text-indigo-950 font-semibold">
                    {activeArea} · Multiple Assignment Sets ({areaItems.length} {areaItems.length === 1 ? 'Set' : 'Sets'})
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOnlyMySets(true)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                        onlyMySets
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      My Sets ({currentUser?.name || 'Teacher'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOnlyMySets(false)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                        !onlyMySets
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      All Departmental Sets
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!assignTitle.trim()) return;
                    const cleanedQuestions = draftQuestions
                      .filter((q) => q.prompt.trim().length > 0)
                      .map((q) => ({
                        ...q,
                        prompt: q.prompt.trim(),
                        marks: Number(q.marks) > 0 ? Number(q.marks) : 2,
                      }));
                    const totalMarks = calculateAssignmentTotalMarks(cleanedQuestions);

                    const created: LearningAreaAssignmentItem = {
                      id: `asgn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      learningArea: activeArea,
                      grade: (getGradesForLearningArea(activeArea).includes(assignGrade) ? assignGrade : getGradesForLearningArea(activeArea)[0]) || 'Unassigned',
                      title: assignTitle.trim(),
                      instructions:
                        assignInstructions.trim() ||
                        (cleanedQuestions.length > 0
                          ? `Answer all ${cleanedQuestions.length} interactive questions directly below and submit.`
                          : `Complete the ${activeArea} task directly on your portal and submit before the due date.`),
                      dueDate: assignDueDate.trim() || 'Due This Week',
                      teacherId: currentUser?.id || '',
                      teacherName: currentUser?.name || 'Subject Teacher',
                      status: 'todo',
                      questions: cleanedQuestions,
                      totalMarks,
                      submissions: {},
                      createdAt: new Date().toISOString(),
                    };
                    persistSubjectAssignments([created, ...subjectAssignments]);
                    setAssignTitle('');
                    setAssignInstructions('');
                    setAssignDueDate('');
                    setDraftQuestions([]);
                    setAssignToast(
                      `Sent "${created.title}" (${cleanedQuestions.length} questions · ${totalMarks} marks) to Learner Portal under ${activeArea} (${created.grade}).`
                    );
                  }}
                  className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Target Grade / Class ({activeArea})
                      </label>
                      {(() => {
                        const areaGrades = getGradesForLearningArea(activeArea);
                        const effectiveSelectValue =
                          areaGrades.includes(assignGrade) ? assignGrade : areaGrades[0] || '';
                        return (
                          <select
                            value={effectiveSelectValue}
                            onChange={(e) => setAssignGrade(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                          >
                            {areaGrades.length === 0 ? (
                              <option value="">No grades assigned for {activeArea}</option>
                            ) : (
                              areaGrades.map((gName) => (
                                <option key={gName} value={gName}>
                                  {gName}
                                </option>
                              ))
                            )}
                          </select>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Assignment Set Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={assignTitle}
                        onChange={(e) => setAssignTitle(e.target.value)}
                        placeholder={`e.g. ${activeArea} Set 1: Algebra`}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        General Instructions
                      </label>
                      <input
                        type="text"
                        value={assignInstructions}
                        onChange={(e) => setAssignInstructions(e.target.value)}
                        placeholder="Optional instructions for learners..."
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Due Date
                      </label>
                      <input
                        type="text"
                        value={assignDueDate}
                        onChange={(e) => setAssignDueDate(e.target.value)}
                        placeholder="e.g. Friday 4:00 PM"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Interactive In-App Questions Builder */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Interactive Questions ({draftQuestions.length}) · Total: {draftTotalMarks} Marks
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Learners answer these questions directly on their phones without downloading or printing.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-2xs">
                                <span>{isExtractingPdf ? 'Extracting...' : '📄 Upload Questions (PDF / Word / Image)'}</span>
                                <input
                                  type="file"
                                  accept="application/pdf,.pdf,.docx,.txt,.md,image/*"
                                  disabled={isExtractingPdf}
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0] || null;
                                    e.currentTarget.value = '';
                                    void handlePdfQuestionsUpload(f);
                                  }}
                                />
                              </label>
                              <button
                          type="button"
                          onClick={() => addDraftQuestion('mcq')}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md cursor-pointer"
                        >
                          + Multiple Choice (Auto-Marked)
                        </button>
                        <button
                          type="button"
                          onClick={() => addDraftQuestion('text')}
                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md cursor-pointer"
                        >
                          + Written / Working Question
                        </button>
                      </div>
                    </div>

                    {pdfExtractNotice && (
                      <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] font-medium text-indigo-950">
                        {pdfExtractNotice}
                      </div>
                    )}

                    {draftQuestions.length > 0 && (
                      <div className="space-y-2.5 pt-1">
                        {draftQuestions.map((q, idx) => (
                          <div
                            key={q.id}
                            className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-indigo-900">
                                Question {idx + 1} ({q.type === 'mcq' ? 'Multiple Choice' : 'Written Answer'})
                              </span>
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] text-slate-600 flex items-center gap-1">
                                  Marks:
                                  <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={q.marks}
                                    onChange={(e) =>
                                      updateDraftQuestion(q.id, { marks: Number(e.target.value) || 1 })
                                    }
                                    className="w-14 px-1.5 py-0.5 text-xs bg-white border border-slate-300 rounded"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => removeDraftQuestion(q.id)}
                                  className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            <input
                              type="text"
                              value={q.prompt}
                              onChange={(e) => updateDraftQuestion(q.id, { prompt: e.target.value })}
                              placeholder={`Type Question ${idx + 1} here...`}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                            />

                            <div className="p-2 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  {Object.keys(SYMBOL_CATEGORIES).map((cat) => (
                                    <button
                                      key={cat}
                                      type="button"
                                      onClick={() => {
                                        setShowAllSymbols(false);
                                        setSymbolCategory(cat);
                                      }}
                                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                                        !showAllSymbols && symbolCategory === cat
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-indigo-50'
                                      }`}
                                    >
                                      {cat}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => setShowAllSymbols((prev) => !prev)}
                                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                                      showAllSymbols
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
                                    }`}
                                  >
                                    All ({ALL_MATH_SYMBOLS.length})
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-1 max-h-24 overflow-y-auto">
                                {(showAllSymbols ? ALL_MATH_SYMBOLS : (SYMBOL_CATEGORIES[symbolCategory] || ALL_MATH_SYMBOLS)).map((sym) => (
                                  <button
                                    key={sym}
                                    type="button"
                                    onClick={() =>
                                      updateDraftQuestion(q.id, {
                                        prompt: `${q.prompt || ''}${sym}`
                                      })
                                    }
                                    className="px-1.5 py-0.5 text-xs font-semibold bg-white hover:bg-indigo-100 text-slate-900 border border-slate-300 rounded cursor-pointer"
                                  >
                                    {sym}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <label className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-md cursor-pointer">
                                  Attach Picture
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = () => {
                                        if (typeof reader.result === 'string') {
                                          updateDraftQuestion(q.id, {
                                            diagramUrl: reader.result,
                                            diagramCaption: q.diagramCaption || file.name
                                          });
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setSketchTargetQuestionId(q.id)}
                                  className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-md cursor-pointer"
                                >
                                  Draw Diagram
                                </button>
                                {QUICK_DIAGRAMS.map((qd) => (
                                  <button
                                    key={qd.label}
                                    type="button"
                                    onClick={() => {
                                      const nextMeas: DiagramMeasurements = { ...qd.defaults };
                                      setDiagramMeasurementsByQ((prev) => ({ ...prev, [q.id]: nextMeas }));
                                      updateDraftQuestion(q.id, {
                                        diagramUrl: svgToDataUrl(renderMeasuredDiagramSvg(nextMeas)),
                                        diagramCaption: `${qd.caption} (${nextMeas.unit})`
                                      });
                                    }}
                                    className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded cursor-pointer"
                                  >
                                    +{qd.label}
                                  </button>
                                ))}
                              </div>
                              {q.diagramUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDraftQuestion(q.id, {
                                      diagramUrl: undefined,
                                      diagramCaption: undefined
                                    })
                                  }
                                  className="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer"
                                >
                                  Remove Picture
                                </button>
                              )}
                            </div>

                            {q.diagramUrl && (
                              <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2">
                                <img
                                  src={q.diagramUrl}
                                  alt={q.diagramCaption || `Question ${idx + 1} diagram`}
                                  className="max-h-44 w-auto rounded border border-slate-100 object-contain"
                                />
                                {(() => {
                                  const m = diagramMeasurementsByQ[q.id];
                                  if (!m) return null;
                                  const applyMeas = (patch: Partial<DiagramMeasurements>) => {
                                    const updated: DiagramMeasurements = { ...m, ...patch };
                                    setDiagramMeasurementsByQ((prev) => ({ ...prev, [q.id]: updated }));
                                    updateDraftQuestion(q.id, {
                                      diagramUrl: svgToDataUrl(renderMeasuredDiagramSvg(updated)),
                                    });
                                  };
                                  return (
                                    <div className="p-2 bg-indigo-50/50 border border-indigo-100 rounded-md space-y-1.5">
                                      <p className="text-[10px] font-bold text-indigo-950">
                                        Edit Diagram Measurements:
                                      </p>
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                        {m.shape === 'triangle' && (
                                          <>
                                            <label className="text-[10px] text-slate-700 font-semibold">
                                              Base
                                              <input
                                                type="text"
                                                value={m.base}
                                                onChange={(e) => applyMeas({ base: e.target.value })}
                                                className="mt-0.5 w-full px-1.5 py-0.5 text-xs bg-white border border-slate-300 rounded"
                                              />
                                            </label>
                                            <label className="text-[10px] text-slate-700 font-semibold">
                                              Height
                                              <input
                                                type="text"
                                                value={m.height}
                                                onChange={(e) => applyMeas({ height: e.target.value })}
                                                className="mt-0.5 w-full px-1.5 py-0.5 text-xs bg-white border border-slate-300 rounded"
                                              />
                                            </label>
                                          </>
                                        )}
                                        {m.shape === 'rectangle' && (
                                          <>
                                            <label className="text-[10px] text-slate-700 font-semibold">
                                              Length
                                              <input
                                                type="text"
                                                value={m.length}
                                                onChange={(e) => applyMeas({ length: e.target.value })}
                                                className="mt-0.5 w-full px-1.5 py-0.5 text-xs bg-white border border-slate-300 rounded"
                                              />
                                            </label>
                                            <label className="text-[10px] text-slate-700 font-semibold">
                                              Width
                                              <input
                                                type="text"
                                                value={m.width}
                                                onChange={(e) => applyMeas({ width: e.target.value })}
                                                className="mt-0.5 w-full px-1.5 py-0.5 text-xs bg-white border border-slate-300 rounded"
                                              />
                                            </label>
                                          </>
                                        )}
                                        {m.shape === 'circle' && (
                                          <label className="text-[10px] text-slate-700 font-semibold">
                                            Radius (r)
                                            <input
                                              type="text"
                                              value={m.radius}
                                              onChange={(e) => applyMeas({ radius: e.target.value })}
                                              className="mt-0.5 w-full px-1.5 py-0.5 text-xs bg-white border border-slate-300 rounded"
                                            />
                                          </label>
                                        )}
                                        {m.shape === 'cube' && (
                                          <>
                                            <label className="text-[10px] text-slate-700 font-semibold">
                                              Length
                                              <input
                                                type="text"
                                                value={m.length}
                                                onChange={(e) => applyMeas({ length: e.target.value })}
                                                className="mt-0.5 w-full px-1.5 py-0.5 text-xs bg-white border border-slate-300 rounded"
                                              />
                                            </label>
                                            <label className="text-[10px] text-slate-700 font-semibold">
                                              Width
                                              <input
                                                type="text"
                                                value={m.width}
                                                onChange={(e) => applyMeas({ width: e.target.value })}
                                                className="mt-0.5 w-full px-1.5 py-0.5 text-xs bg-white border border-slate-300 rounded"
                                              />
                                            </label>
                                            <label className="text-[10px] text-slate-700 font-semibold">
                                              Height
                                              <input
                                                type="text"
                                                value={m.height}
                                                onChange={(e) => applyMeas({ height: e.target.value })}
                                                className="mt-0.5 w-full px-1.5 py-0.5 text-xs bg-white border border-slate-300 rounded"
                                              />
                                            </label>
                                          </>
                                        )}
                                        <label className="text-[10px] text-slate-700 font-semibold">
                                          Unit
                                          <input
                                            type="text"
                                            value={m.unit}
                                            onChange={(e) => applyMeas({ unit: e.target.value })}
                                            className="mt-0.5 w-full px-1.5 py-0.5 text-xs bg-white border border-slate-300 rounded"
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  );
                                })()}
                                <input
                                  type="text"
                                  value={q.diagramCaption || ''}
                                  onChange={(e) =>
                                    updateDraftQuestion(q.id, { diagramCaption: e.target.value })
                                  }
                                  placeholder="Diagram / picture label (optional)..."
                                  className="w-full px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded"
                                />
                              </div>
                            )}

                            {q.type === 'mcq' && q.options && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {(['A', 'B', 'C', 'D'] as const).map((optKey) => (
                                  <div key={optKey} className="flex items-center gap-1.5">
                                    <input
                                      type="radio"
                                      name={`correct-${q.id}`}
                                      checked={q.correctOption === optKey}
                                      onChange={() =>
                                        updateDraftQuestion(q.id, { correctOption: optKey })
                                      }
                                      title={`Mark Option ${optKey} as correct`}
                                    />
                                    <span className="text-[11px] font-bold text-slate-700 w-4">
                                      {optKey}.
                                    </span>
                                    <input
                                      type="text"
                                      value={q.options?.[optKey] || ''}
                                      onChange={(e) =>
                                        updateDraftQuestion(q.id, {
                                          options: {
                                            ...(q.options || { A: '', B: '', C: '', D: '' }),
                                            [optKey]: e.target.value,
                                          },
                                        })
                                      }
                                      placeholder={`Option ${optKey}`}
                                      className="flex-1 px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                                    />
                                  </div>
                                ))}
                                <p className="sm:col-span-2 text-[10px] text-indigo-700">
                                  Selected correct answer: <strong>Option {q.correctOption || 'A'}</strong> (auto-scored when learner submits)
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                  >
                    Send Assignment Set to Learners ({activeArea})
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Assignments to Be Done */}
                  <div className="border border-amber-200 bg-amber-50/30 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-amber-950">
                        Assignments to Be Done ({toDoItems.length})
                      </h3>
                      <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                        Live on Learner Portal
                      </span>
                    </div>
                    {toDoItems.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No active assignments sent in {activeArea} yet.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {toDoItems.map((item) => {
                          const allSubs = Object.values(item.submissions || {});
                          const pendingSubs = allSubs.filter((s) => s.status === 'submitted');
                          const markedCount = allSubs.filter((s) => s.status === 'marked').length;
                          const totalMarks = item.totalMarks || calculateAssignmentTotalMarks(item.questions);
                          const activeSub =
                            pendingSubs.find((s) => s.learnerId === selectedSubmissionLearnerId) ||
                            pendingSubs[0];

                          return (
                            <div
                              key={item.id}
                              className="p-3 bg-white border border-amber-200 rounded-lg space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <p className="text-xs font-bold text-slate-900">{item.title}</p>
                                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded">
                                      {(item.questions || []).length} Qs · {totalMarks} Marks
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 mt-0.5">{item.instructions}</p>
                                  <p className="text-[10px] font-semibold text-amber-800 mt-1">
                                    {item.grade} · {item.dueDate} · By {item.teacherName}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                                    <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                                      {pendingSubs.length} Submitted to Mark
                                    </span>
                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                      {markedCount} Marked & Pushed
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (markingId === item.id) {
                                      setMarkingId(null);
                                    } else {
                                      setMarkingId(item.id);
                                      const firstSub = pendingSubs[0];
                                      if (firstSub) {
                                        setSelectedSubmissionLearnerId(firstSub.learnerId);
                                        setMarkScoreInput(`${firstSub.autoScore}/${totalMarks}`);
                                      } else {
                                        setSelectedSubmissionLearnerId('');
                                        setMarkScoreInput(`${totalMarks}/${totalMarks}`);
                                      }
                                    }
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md shrink-0 cursor-pointer"
                                >
                                  {pendingSubs.length > 0
                                    ? `Review & Mark (${pendingSubs.length})`
                                    : 'Mark Assignment'}
                                </button>
                              </div>

                              {markingId === item.id && (
                                <div className="pt-2.5 border-t border-slate-200 space-y-2.5">
                                  {pendingSubs.length > 0 && activeSub ? (
                                    <div className="space-y-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <label className="text-[11px] font-bold text-slate-800">
                                          Learner Submission:
                                        </label>
                                        <select
                                          value={activeSub.learnerId}
                                          onChange={(e) => {
                                            const nextSub = pendingSubs.find(
                                              (s) => s.learnerId === e.target.value
                                            );
                                            setSelectedSubmissionLearnerId(e.target.value);
                                            if (nextSub) {
                                              setMarkScoreInput(`${nextSub.autoScore}/${totalMarks}`);
                                            }
                                          }}
                                          className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md font-semibold"
                                        >
                                          {pendingSubs.map((sub) => (
                                            <option key={sub.learnerId} value={sub.learnerId}>
                                              {sub.learnerName} ({sub.studentId})
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="text-[11px] text-indigo-800 font-semibold">
                                        Auto-Marked MCQ Score: {activeSub.autoScore} / {totalMarks} marks
                                      </div>

                                      {(item.questions || []).length > 0 ? (
                                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                          {(item.questions || []).map((q, qIdx) => {
                                            const ans = activeSub.answers?.[q.id] || 'No answer provided';
                                            const isCorrectMcq =
                                              q.type === 'mcq' && q.correctOption === ans;
                                            const calcSteps = q.type !== 'mcq' ? formatCalculationSteps(ans) : [];
                                            const draftKey = `${item.id}:${activeSub.learnerId}:${q.id}`;
                                            const currentAnns =
                                              stepMarksDraft[draftKey] ||
                                              activeSub.stepAnnotations?.[q.id] ||
                                              [];

                                            const updateStepAnn = (
                                              stepIdx: number,
                                              patch: Partial<CalculationStepAnnotation>
                                            ) => {
                                              const nextArr = calcSteps.map((_, i) =>
                                                i === stepIdx
                                                  ? { ...(currentAnns[i] || {}), ...patch }
                                                  : currentAnns[i] || {}
                                              );
                                              const updatedDraft = {
                                                ...stepMarksDraft,
                                                [draftKey]: nextArr,
                                              };
                                              setStepMarksDraft(updatedDraft);

                                              let stampedMarks = 0;
                                              (item.questions || []).forEach((qq) => {
                                                const k = `${item.id}:${activeSub.learnerId}:${qq.id}`;
                                                const anns = updatedDraft[k] || activeSub.stepAnnotations?.[qq.id] || [];
                                                anns.forEach((st) => {
                                                  if (st?.stamp === 'M1' || st?.stamp === 'A1' || st?.stamp === '✓') stampedMarks += 1;
                                                  if (st?.stamp === 'M2' || st?.stamp === 'A2') stampedMarks += 2;
                                                });
                                              });
                                              if (stampedMarks > 0) {
                                                setMarkScoreInput(`${Math.min(stampedMarks, totalMarks)}/${totalMarks}`);
                                              }
                                            };

                                            return (
                                              <div
                                                key={q.id}
                                                className="p-2.5 bg-white border border-slate-200 rounded-lg text-[11px] space-y-2"
                                              >
                                                <div className="flex items-start justify-between gap-2">
                                                  <p className="font-bold text-slate-900">
                                                    Q{qIdx + 1}. {q.prompt} ({q.marks} mks)
                                                  </p>
                                                  {q.type !== 'mcq' && (
                                                    <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded shrink-0">
                                                      Red Ink Marking
                                                    </span>
                                                  )}
                                                </div>

                                                {q.diagramUrl && (
                                                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                                                    <img
                                                      src={q.diagramUrl}
                                                      alt={q.diagramCaption || `Q${qIdx + 1} diagram`}
                                                      className="max-h-40 w-auto rounded border border-slate-200 bg-white object-contain"
                                                    />
                                                    {q.diagramCaption && (
                                                      <p className="text-[10px] font-medium text-slate-600">
                                                        {q.diagramCaption}
                                                      </p>
                                                    )}
                                                  </div>
                                                )}

                                                {q.type === 'mcq' ? (
                                                  <p className="text-slate-700">
                                                    Learner Answer: <strong>{ans}</strong>
                                                    <span
                                                      className={`ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                        isCorrectMcq
                                                          ? 'bg-emerald-100 text-emerald-800'
                                                          : 'bg-rose-100 text-rose-800'
                                                      }`}
                                                    >
                                                      {isCorrectMcq
                                                        ? `Correct (+${q.marks})`
                                                        : `Key: ${q.correctOption}`}
                                                    </span>
                                                  </p>
                                                ) : calcSteps.length > 0 ? (
                                                  <div className="rounded-lg border border-slate-200 bg-amber-50/20 divide-y divide-slate-200/80">
                                                    {calcSteps.map((stepLine, sIdx) => {
                                                      const ann = currentAnns[sIdx] || {};
                                                      const isWrong = ann.stamp === '✗';
                                                      const hasRedMark = Boolean(ann.stamp);
                                                      return (
                                                        <div key={sIdx} className="p-2 space-y-1.5">
                                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2 font-mono text-xs">
                                                              <span className="text-[10px] font-sans font-semibold text-slate-400 w-11">
                                                                Step {sIdx + 1}:
                                                              </span>
                                                              <span
                                                                className={`font-bold ${
                                                                  isWrong
                                                                    ? 'text-red-700 underline decoration-wavy decoration-red-500'
                                                                    : 'text-slate-900'
                                                                }`}
                                                              >
                                                                {stepLine}
                                                              </span>
                                                              {hasRedMark && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded font-sans text-xs font-black text-red-600 bg-red-50 border border-red-300 shadow-2xs">
                                                                  {ann.stamp}
                                                                </span>
                                                              )}
                                                            </div>

                                                            <div className="flex items-center gap-1 flex-wrap">
                                                              {(['✓', 'M1', 'A1', '✗'] as RedInkStamp[]).map((st) => (
                                                                <button
                                                                  key={st}
                                                                  type="button"
                                                                  title={
                                                                    st === '✓'
                                                                      ? 'Red Tick (Correct Step)'
                                                                      : st === 'M1'
                                                                      ? 'Method Mark (Formula / Substitution)'
                                                                      : st === 'A1'
                                                                      ? 'Accuracy Mark (Final Answer & Units)'
                                                                      : 'Red Cross (Mistake in this step)'
                                                                  }
                                                                  onClick={() =>
                                                                    updateStepAnn(sIdx, {
                                                                      stamp: ann.stamp === st ? '' : st,
                                                                    })
                                                                  }
                                                                  className={`px-1.5 py-0.5 rounded text-[10px] font-black border transition-colors cursor-pointer ${
                                                                    ann.stamp === st
                                                                      ? 'bg-red-600 text-white border-red-700 shadow-2xs'
                                                                      : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                                                  }`}
                                                                >
                                                                  {st}
                                                                </button>
                                                              ))}
                                                            </div>
                                                          </div>

                                                          {(isWrong || ann.mistakeNote) && (
                                                            <input
                                                              type="text"
                                                              value={ann.mistakeNote || ''}
                                                              onChange={(e) =>
                                                                updateStepAnn(sIdx, {
                                                                  mistakeNote: e.target.value,
                                                                })
                                                              }
                                                              placeholder="Red pen note: explain mistake or correction for learner (e.g. Volume unit is cm³, not cm²)..."
                                                              className="w-full px-2 py-1 text-[11px] text-red-700 placeholder:text-red-300 bg-red-50/70 border border-red-200 rounded focus:outline-none focus:border-red-500"
                                                            />
                                                          )}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                ) : activeSub.sketchAttachments?.[q.id] ? (
                                                  <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-2 space-y-1.5">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                      <span className="text-[11px] font-bold text-amber-950">
                                                        Tap a mark style to highlight, then tap on the learner&apos;s paper work:
                                                      </span>
                                                      <div className="flex items-center gap-1 flex-wrap">
                                                        {(['✓', 'M1', 'A1', '✗'] as RedInkStamp[]).map((st) => {
                                                          const isSelected = activePaperStamp === st;
                                                          return (
                                                            <button
                                                              key={st}
                                                              type="button"
                                                              title={
                                                                st === '✓'
                                                                  ? 'Highlight Red Tick (Correct Step)'
                                                                  : st === 'M1'
                                                                  ? 'Highlight Method Mark (M1)'
                                                                  : st === 'A1'
                                                                  ? 'Highlight Accuracy Mark (A1)'
                                                                  : 'Highlight Red Cross (Mistake)'
                                                              }
                                                              onClick={() =>
                                                                setActivePaperStamp((prev) => (prev === st ? '' : st))
                                                              }
                                                              className={`px-2 py-0.5 rounded text-[11px] font-black border transition-all cursor-pointer ${
                                                                isSelected
                                                                  ? 'bg-red-600 text-white border-red-800 ring-2 ring-red-300 scale-105 shadow-sm'
                                                                  : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                                              }`}
                                                            >
                                                              {st}
                                                            </button>
                                                          );
                                                        })}
                                                        {currentAnns.length > 0 && (
                                                          <>
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                const trimmed = currentAnns.slice(0, -1);
                                                                setStepMarksDraft({
                                                                  ...stepMarksDraft,
                                                                  [draftKey]: trimmed,
                                                                });
                                                              }}
                                                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 cursor-pointer"
                                                            >
                                                              Undo
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => {
                                                                setStepMarksDraft({
                                                                  ...stepMarksDraft,
                                                                  [draftKey]: [],
                                                                });
                                                              }}
                                                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                                                            >
                                                              Clear
                                                            </button>
                                                          </>
                                                        )}
                                                      </div>
                                                    </div>
                                                    <p className="text-[10px] text-amber-900">
                                                      Active mark: <strong>{activePaperStamp || 'None (select ✓, M1, A1, or ✗ above)'}</strong> — {currentAnns.filter((a) => a && a.stamp).length} placed on paper
                                                    </p>
                                                    {(currentAnns.some((a) => a?.stamp === '✗') || currentAnns[0]?.mistakeNote) && (
                                                      <input
                                                        type="text"
                                                        value={currentAnns[0]?.mistakeNote || ''}
                                                        onChange={(e) =>
                                                          updateStepAnn(0, {
                                                            mistakeNote: e.target.value,
                                                          })
                                                        }
                                                        placeholder="Red pen note on learner's written paper work..."
                                                        className="w-full px-2 py-1 text-[11px] text-red-700 placeholder:text-red-300 bg-red-50/70 border border-red-200 rounded focus:outline-none focus:border-red-500"
                                                      />
                                                    )}
                                                  </div>
                                                ) : (
                                                  <p className="text-slate-500 italic">No calculation or answer submitted.</p>
                                                )}

                                                {activeSub.sketchAttachments?.[q.id] && (
                                                  <div className="p-2 bg-amber-50/50 border border-amber-200 rounded-lg space-y-1">
                                                    <p className="text-[10px] font-bold text-amber-950">
                                                      Uploaded Written Paper Work ({q.id}):
                                                    </p>
                                                    <div
                                                      className="relative inline-block max-w-full select-none cursor-crosshair"
                                                      onClick={(e) => {
                                                        if (!activePaperStamp) return;
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        if (!rect.width || !rect.height) return;
                                                        const xPct = Math.max(
                                                          2,
                                                          Math.min(98, Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(1)))
                                                        );
                                                        const yPct = Math.max(
                                                          2,
                                                          Math.min(98, Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(1)))
                                                        );
                                                        const nextAnns: Array<CalculationStepAnnotation & { x?: number; y?: number }> = [
                                                          ...currentAnns.filter((a) => a && a.stamp),
                                                          { stamp: activePaperStamp, x: xPct, y: yPct },
                                                        ];
                                                        const updatedDraft = {
                                                          ...stepMarksDraft,
                                                          [draftKey]: nextAnns,
                                                        };
                                                        setStepMarksDraft(updatedDraft);

                                                        let stampedMarks = 0;
                                                        (item.questions || []).forEach((qq) => {
                                                          const k = `${item.id}:${activeSub.learnerId}:${qq.id}`;
                                                          const anns = updatedDraft[k] || activeSub.stepAnnotations?.[qq.id] || [];
                                                          anns.forEach((st) => {
                                                            if (st?.stamp === 'M1' || st?.stamp === 'A1' || st?.stamp === '✓') stampedMarks += 1;
                                                            if (st?.stamp === 'M2' || st?.stamp === 'A2') stampedMarks += 2;
                                                          });
                                                        });
                                                        if (stampedMarks > 0) {
                                                          setMarkScoreInput(`${Math.min(stampedMarks, totalMarks)}/${totalMarks}`);
                                                        }
                                                      }}
                                                    >
                                                      <img
                                                        src={activeSub.sketchAttachments[q.id]}
                                                        alt={`Learner written work for ${q.id}`}
                                                        className="max-h-72 w-auto rounded border border-amber-300 bg-white object-contain block pointer-events-none"
                                                      />
                                                      {currentAnns.map((pin, pIdx) => {
                                                        const p = pin as CalculationStepAnnotation & { x?: number; y?: number };
                                                        if (!p?.stamp || typeof p.x !== 'number' || typeof p.y !== 'number') return null;
                                                        return (
                                                          <span
                                                            key={`pin-${q.id}-${pIdx}`}
                                                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                                                            className=" -translate-x-1/2 -translate-y-1/2 absolute inline-flex items-center px-1.5 py-0.5 rounded font-sans text-xs font-black text-red-600 bg-red-50/95 border border-red-400 shadow-xs pointer-events-none"
                                                          >
                                                            {p.stamp}
                                                          </span>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="p-2 bg-white border border-slate-200 rounded text-[11px] space-y-2">
                                          <div>
                                            <p className="font-semibold text-slate-700">Learner Response:</p>
                                            <p className="text-slate-900 mt-0.5 whitespace-pre-wrap">
                                              {activeSub.generalResponse || (activeSub.sketchAttachments?.['_general'] ? 'Submitted via uploaded written paper photo.' : 'No written text submitted.')}
                                            </p>
                                          </div>
                                          {activeSub.sketchAttachments?.['_general'] && (
                                            <div className="p-2 bg-amber-50/50 border border-amber-200 rounded-lg space-y-1">
                                              <p className="text-[10px] font-bold text-amber-950">
                                                Uploaded Written Paper Work:
                                              </p>
                                              <img
                                                src={activeSub.sketchAttachments['_general']}
                                                alt="Learner written paper work"
                                                className="max-h-60 w-auto rounded border border-amber-300 bg-white object-contain"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                        <input
                                          type="text"
                                          value={markScoreInput}
                                          onChange={(e) => setMarkScoreInput(e.target.value)}
                                          placeholder={`Score e.g. 18/${totalMarks}`}
                                          className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md sm:w-28"
                                        />
                                        <input
                                          type="text"
                                          value={markFeedbackInput}
                                          onChange={(e) => setMarkFeedbackInput(e.target.value)}
                                          placeholder="Teacher remarks..."
                                          className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md flex-1"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const finalScore =
                                              markScoreInput.trim() || `${activeSub.autoScore}/${totalMarks}`;
                                            const finalFeedback =
                                              markFeedbackInput.trim() || 'Marked by subject teacher.';
                                            const updated = subjectAssignments.map((a) => {
                                              if (a.id !== item.id) return a;
                                              const nextSubs = { ...(a.submissions || {}) };
                                              const mergedStepAnnotations: Record<string, CalculationStepAnnotation[]> = {
                                                ...(activeSub.stepAnnotations || {}),
                                              };
                                              (item.questions || []).forEach((qq) => {
                                                const k = `${item.id}:${activeSub.learnerId}:${qq.id}`;
                                                if (stepMarksDraft[k]) {
                                                  mergedStepAnnotations[qq.id] = stepMarksDraft[k];
                                                }
                                              });
                                              nextSubs[activeSub.learnerId] = {
                                                ...activeSub,
                                                status: 'marked',
                                                stepAnnotations: mergedStepAnnotations,
                                                awardedScore: finalScore,
                                                teacherFeedback: finalFeedback,
                                                markedAt: new Date().toISOString(),
                                              };
                                              return {
                                                ...a,
                                                submissions: nextSubs,
                                              };
                                            });
                                            persistSubjectAssignments(updated);
                                            setAssignToast(
                                              `Marked ${activeSub.learnerName}'s "${item.title}" (${finalScore}) and pushed to Learner Marked Assignments.`
                                            );
                                          }}
                                          className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md cursor-pointer"
                                        >
                                          Mark & Push to Learner
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <input
                                        type="text"
                                        value={markScoreInput}
                                        onChange={(e) => setMarkScoreInput(e.target.value)}
                                        placeholder="Score e.g. EE1 (90%)"
                                        className="px-2 py-1 text-xs border border-slate-300 rounded-md sm:w-28"
                                      />
                                      <input
                                        type="text"
                                        value={markFeedbackInput}
                                        onChange={(e) => setMarkFeedbackInput(e.target.value)}
                                        placeholder="Teacher remarks..."
                                        className="px-2 py-1 text-xs border border-slate-300 rounded-md flex-1"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = subjectAssignments.map((a) =>
                                            a.id === item.id
                                              ? {
                                                  ...a,
                                                  status: 'marked' as const,
                                                  score: markScoreInput.trim() || 'Marked',
                                                  feedback:
                                                    markFeedbackInput.trim() ||
                                                    'Marked by subject teacher.',
                                                }
                                              : a
                                          );
                                          persistSubjectAssignments(updated);
                                          setMarkingId(null);
                                          setAssignToast(
                                            `Marked "${item.title}" and pushed to Learner Portal under ${activeArea}.`
                                          );
                                        }}
                                        className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md cursor-pointer"
                                      >
                                        Publish Marked
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Assignments Marked */}
                  <div className="border border-emerald-200 bg-emerald-50/30 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-emerald-950">
                        Assignments Marked ({markedEntries.length})
                      </h3>
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Pushed to Learners
                      </span>
                    </div>
                    {markedEntries.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No marked assignments published in {activeArea} yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {markedEntries.map(({ assignment, submission }, idx) => (
                          <div
                            key={`${assignment.id}-${submission?.learnerId || idx}`}
                            className="p-2.5 bg-white border border-emerald-200 rounded-lg flex items-start justify-between gap-2"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {assignment.title}
                                {submission ? ` · ${submission.learnerName}` : ''}
                              </p>
                              <p className="text-[11px] text-slate-600">
                                {submission ? submission.teacherFeedback : assignment.feedback}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {assignment.grade} · By {assignment.teacherName}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 rounded shrink-0">
                              {submission ? submission.awardedScore : assignment.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <DiagramSketchModal
          isOpen={Boolean(sketchTargetQuestionId)}
          title="Draw Diagram for Assignment Question"
          initialImage={
            draftQuestions.find((dq) => dq.id === sketchTargetQuestionId)?.diagramUrl
          }
          onClose={() => setSketchTargetQuestionId(null)}
          onSaveDiagram={(dataUrl) => {
            if (!sketchTargetQuestionId) return;
            updateDraftQuestion(sketchTargetQuestionId, { diagramUrl: dataUrl });
          }}
        />

        {/* Separate Assignments Broadsheet & Class Teacher Cross-Learning-Area Tracker */}
        {(() => {
          const broadsheetArea = selectedTeacherArea || registeredSubjects[0] || '';
          const areaSets = broadsheetArea
            ? subjectAssignments.filter(
                (a) => a.learningArea.trim().toLowerCase() === broadsheetArea.trim().toLowerCase()
              )
            : [];
          const areaLearners = learners.filter(
            (l) =>
              (broadsheetArea && (l.learningAreas || []).includes(broadsheetArea)) ||
              areaSets.some((s) => s.grade === l.grade)
          );

          const parseScoreNum = (val?: string) => {
            if (!val) return null;
            const m = String(val).match(/(\d+(?:\.\d+)?)/);
            return m ? Number(m[1]) : null;
          };

          const allGrades = Array.from(
            new Set([
              ...learners.map((l) => l.grade).filter(Boolean),
              ...subjectAssignments.map((a) => a.grade).filter(Boolean),
            ])
          );
          const filteredClassLearners = learners.filter((l) =>
            crossAreaGradeFilter === 'ALL' ? true : l.grade === crossAreaGradeFilter
          );

          return (
            <div className="space-y-4">
              {/* 1. Separate Assignments Broadsheet (Distinct from Regular School Assessments) */}
              <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50/40 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Assignments Broadsheet — {broadsheetArea || 'Learning Area'} (Separate from Test 1 / Test 2 / Exam)
                    </h2>
                    <p className="text-xs text-slate-600">
                      Tracks assignment completion status and assignment marks separately from regular school assessments
                    </p>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold text-indigo-800 bg-indigo-100 rounded-full">
                    {areaSets.length} Assignment Set{areaSets.length === 1 ? '' : 's'}
                  </span>
                </div>

                {areaLearners.length === 0 ? (
                  <div className="p-5 text-xs text-slate-500">
                    No learners enrolled for {broadsheetArea || 'this learning area'} assignment tracking yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                          <th className="py-2.5 px-3 font-bold">Learner</th>
                          <th className="py-2.5 px-2.5 font-bold">Grade</th>
                          {areaSets.map((set) => (
                            <th key={set.id} className="py-2.5 px-2.5 font-bold">
                              {set.title}
                            </th>
                          ))}
                          <th className="py-2.5 px-2.5 font-bold">Done</th>
                          <th className="py-2.5 px-2.5 font-bold">Assignment Marks</th>
                          <th className="py-2.5 px-3 font-bold">Completion Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {areaLearners.map((learner) => {
                          const learnerSets = areaSets.filter(
                            (s) => !s.grade || s.grade === learner.grade
                          );
                          let completedCount = 0;
                          let totalEarned = 0;
                          let totalPossible = 0;

                          const setCells = learnerSets.map((s) => {
                            const sub = s.submissions?.[learner.id];
                            const isDone = Boolean(sub);
                            if (isDone) completedCount += 1;
                            const qMax = (s.questions || []).reduce(
                              (acc, q) => acc + (Number(q.marks) || 0),
                              0
                            );
                            if (qMax > 0) totalPossible += qMax;
                            const num = parseScoreNum(sub?.awardedScore);
                            if (num !== null) totalEarned += num;
                            return {
                              setId: s.id,
                              done: isDone,
                              scoreLabel: sub?.awardedScore || (isDone ? 'Submitted' : '—'),
                            };
                          });

                          const statusLabel =
                            learnerSets.length === 0
                              ? 'No Sets'
                              : completedCount === learnerSets.length
                              ? 'Completed All'
                              : completedCount > 0
                              ? 'Partial'
                              : 'Missing';

                          const statusBadgeClass =
                            statusLabel === 'Completed All'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : statusLabel === 'Partial'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200';

                          return (
                            <tr key={learner.id} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {learner.name}
                                <span className="block text-[10px] text-slate-500 font-normal">
                                  {learner.studentId}
                                </span>
                              </td>
                              <td className="py-2.5 px-2.5 text-slate-700">{learner.grade}</td>
                              {areaSets.map((s) => {
                                const cell = setCells.find((c) => c.setId === s.id);
                                return (
                                  <td key={s.id} className="py-2.5 px-2.5">
                                    {cell ? (
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                          cell.done
                                            ? 'bg-indigo-50 text-indigo-900 border border-indigo-200'
                                            : 'text-slate-400'
                                        }`}
                                      >
                                        {cell.scoreLabel}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">N/A</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="py-2.5 px-2.5 font-bold text-slate-800">
                                {completedCount}/{learnerSets.length}
                              </td>
                              <td className="py-2.5 px-2.5 font-bold text-indigo-900">
                                {totalPossible > 0
                                  ? `${totalEarned}/${totalPossible}`
                                  : totalEarned > 0
                                  ? `${totalEarned} pts`
                                  : '—'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusBadgeClass}`}
                                >
                                  {statusLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>


              {/* 2. Class Teacher Cross-Learning-Area Assignment Completion Tracker */}
              <div className="bg-white rounded-xl border border-emerald-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-emerald-100 bg-emerald-50/40 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Class Teacher Cross-Learning-Area Assignment Tracker
                    </h2>
                    <p className="text-xs text-slate-600">
                      Shows learners who completed all assignments across every registered learning area and their pushed marks
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-700">Class / Grade:</label>
                    <select
                      value={crossAreaGradeFilter}
                      onChange={(e) => setCrossAreaGradeFilter(e.target.value)}
                      className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md font-semibold"
                    >
                      <option value="ALL">All Classes</option>
                      {allGrades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {filteredClassLearners.length === 0 ? (
                  <div className="p-5 text-xs text-slate-500">
                    No learners found for the selected class filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                          <th className="py-2.5 px-3 font-bold">Learner</th>
                          <th className="py-2.5 px-2.5 font-bold">Class</th>
                          <th className="py-2.5 px-3 font-bold">Learning Areas & Assignment Marks</th>
                          <th className="py-2.5 px-2.5 font-bold">Areas Done</th>
                          <th className="py-2.5 px-3 font-bold">All Learning Areas Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredClassLearners.map((learner) => {
                          const assignedAreas = Array.from(
                            new Set([
                              ...(learner.learningAreas || []),
                              ...subjectAssignments
                                .filter((s) => !s.grade || s.grade === learner.grade)
                                .map((s) => s.learningArea),
                            ])
                          );

                          let areasAllCompleted = 0;
                          const areaSummaries = assignedAreas.map((area) => {
                            const setsForArea = subjectAssignments.filter(
                              (s) =>
                                s.learningArea === area &&
                                (!s.grade || s.grade === learner.grade)
                            );
                            const doneInArea = setsForArea.filter(
                              (s) => Boolean(s.submissions?.[learner.id])
                            ).length;
                            const earnedInArea = setsForArea.reduce((sum, s) => {
                              const n = parseScoreNum(s.submissions?.[learner.id]?.awardedScore);
                              return sum + (n ?? 0);
                            }, 0);
                            const maxInArea = setsForArea.reduce(
                              (sum, s) =>
                                sum +
                                (s.questions || []).reduce(
                                  (qSum, q) => qSum + (Number(q.marks) || 0),
                                  0
                                ),
                              0
                            );
                            const completeAllInArea =
                              setsForArea.length > 0 && doneInArea === setsForArea.length;
                            if (completeAllInArea) areasAllCompleted += 1;

                            return {
                              area,
                              doneInArea,
                              totalInArea: setsForArea.length,
                              completeAllInArea,
                              scoreText:
                                maxInArea > 0
                                  ? `${earnedInArea}/${maxInArea}`
                                  : earnedInArea > 0
                                  ? `${earnedInArea}`
                                  : '',
                            };
                          });

                          const activeAreasWithSets = areaSummaries.filter(
                            (a) => a.totalInArea > 0
                          );
                          const completedEveryArea =
                            activeAreasWithSets.length > 0 &&
                            areasAllCompleted === activeAreasWithSets.length;

                          return (
                            <tr key={learner.id} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {learner.name}
                                <span className="block text-[10px] text-slate-500 font-normal">
                                  {learner.studentId}
                                </span>
                              </td>
                              <td className="py-2.5 px-2.5 text-slate-700">{learner.grade}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {areaSummaries.map((as) => (
                                    <span
                                      key={as.area}
                                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                                        as.completeAllInArea
                                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                          : as.doneInArea > 0
                                          ? 'bg-amber-50 text-amber-900 border-amber-200'
                                          : 'bg-slate-50 text-slate-600 border-slate-200'
                                      }`}
                                    >
                                      {as.area}: {as.doneInArea}/{as.totalInArea}
                                      {as.scoreText ? ` (${as.scoreText})` : ''}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2.5 px-2.5 font-bold text-slate-800">
                                {areasAllCompleted}/{activeAreasWithSets.length}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                    completedEveryArea
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                      : areasAllCompleted > 0
                                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                                      : 'bg-rose-100 text-rose-800 border-rose-200'
                                  }`}
                                >
                                  {completedEveryArea
                                    ? 'Completed All Areas'
                                    : areasAllCompleted > 0
                                    ? 'Partial Areas'
                                    : 'Incomplete'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Subject Grading Entry Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Enrolled Students in {registeredSubjects[0]}
              </h2>
              <p className="text-xs text-slate-500">
                Enter custom assessment marks (configurable out-of totals) and Subject Teacher remarks
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('scorecards')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Batch Grade Entry</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] whitespace-nowrap text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-3">Grade</th>
                  <th className="py-2.5 px-3 text-right">Test 1</th>
                  <th className="py-2.5 px-3 text-right">Test 2</th>
                  <th className="py-2.5 px-3 text-right">Exam</th>
                  <th className="py-2.5 px-3 text-right">Total (/100)</th>
                  <th className="py-2.5 px-3 text-center">Competency Grade</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {learners.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 px-4 text-center text-slate-500">
                      No enrolled learners available for subject evaluation.
                    </td>
                  </tr>
                ) : (
                  learners.map((learner) => {
                    const card = scoreCards.find((sc) => sc.learnerId === learner.id);
                    const sub = card?.subjects.find((s) => registeredSubjects.includes(s.subjectName)) || {
                      catScore: 0,
                      midTermScore: 0,
                      finalExamScore: 0,
                      totalScore: 0,
                    };
                    const gradeResult = calculateCompetencyGrade(sub.totalScore);

                    return (
                      <tr key={learner.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {learner.firstName} {learner.lastName}
                          <span className="text-[11px] text-slate-500 font-normal block font-mono">
                            {learner.studentId}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-700">{learner.grade}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">{sub.catScore}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">{sub.midTermScore}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">{sub.finalExamScore}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 tabular-nums">
                          {sub.totalScore}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${gradeResult.badgeClass}`}>
                            {gradeResult.grade} ({gradeResult.points} pts)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onNavigateTab('scorecards')}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors cursor-pointer"
                          >
                            Edit Mark
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =====================
  // 4. INSTITUTIONAL / ADMIN / BURSAR DASHBOARD
  // =====================
  const learnerIds = new Set(learners.map((l) => l.id));
  const validFeeStructures = feeStructures.filter((fs) => learnerIds.has(fs.learnerId));
  const totalBilled = validFeeStructures.reduce((acc, curr) => acc + curr.totalDue, 0);
  const totalCollected = validFeeStructures.reduce((acc, curr) => acc + curr.amountPaid, 0);
  const totalOutstanding = validFeeStructures.reduce((acc, curr) => acc + curr.balance, 0);
  const collectionEfficiency = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

  const overdueAccounts = validFeeStructures.filter((fs) => fs.balance > 0);
  const validReminders = reminders.filter((r) => learnerIds.has(r.learnerId));
  const validScoreCards = scoreCards.filter((sc) => learnerIds.has(sc.learnerId));

  const validAttendance = attendance.filter((a) => learnerIds.has(a.learnerId));
  const allDates = Array.from(new Set(validAttendance.map((a) => a.date))).sort();
  const latestDate = allDates[allDates.length - 1] || '';
  const latestDayAttendance = latestDate ? validAttendance.filter((a) => a.date === latestDate) : [];
  const presentCount = latestDayAttendance.filter(
    (a) => a.status === 'present' || a.status === 'late'
  ).length;
  const attendanceRate =
    latestDayAttendance.length > 0 ? (presentCount / latestDayAttendance.length) * 100 : 0;

  const handleQuickBatchReminders = () => {
    const result = batchDispatchReminders();
    setDispatchNotice(result.message);
    setTimeout(() => setDispatchNotice(null), 6000);
  };

  return (
    <div className="space-y-6">
      {dispatchNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{dispatchNotice}</span>
          </div>
          <button
            onClick={() => setDispatchNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Welcome Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Academic Term 2 · 2026</span>
            <span aria-hidden="true">·</span>
            <span>Institution ID: SCH-28491</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-emerald-700 font-medium">Encrypted RBAC Online</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome, {currentUser?.name}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Institutional overview: parent PII encryption, tuition billing ledgers, attendance metrics, and automated notifications.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {((currentUser?.role === 'admin' || currentUser?.isOwner) || currentUser?.role === 'bursar') && (
            <button
              onClick={onOpenRecordPayment}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Fee Payment</span>
            </button>
          )}

          {((currentUser?.role === 'admin' || currentUser?.isOwner) || currentUser?.role === 'bursar') && (
            <button
              onClick={handleQuickBatchReminders}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dispatch Due Reminders</span>
            </button>
          )}

          {(currentUser?.role === 'admin' || currentUser?.isOwner) && (
            <button
              onClick={() => onNavigateTab('school')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
            >
              <Building className="w-3.5 h-3.5 text-indigo-600" />
              <span>Register School & Academics</span>
            </button>
          )}

          {(currentUser?.role === 'admin' || currentUser?.isOwner) && (
            <button
              onClick={onOpenAddLearner}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-slate-600" />
              <span>New Learner & Parent</span>
            </button>
          )}
        </div>
      </div>

      {/* Institutional Structure Overview Widget */}
      {(currentUser?.role === 'admin' || currentUser?.isOwner) && (
        <div className="bg-linear-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-xl p-5 text-white text-xs border border-indigo-700/50 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-200 text-[11px] mb-1">
                <Building className="w-3.5 h-3.5 text-indigo-300" />
                <span className="font-semibold uppercase tracking-wider">Institution & Academic Roster</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-emerald-300">{schoolProfile.registrationNumber}</span>
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {schoolProfile.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  {schoolProfile.primaryWingName || `${schoolProfile.name} Primary School`} (Grades 1–6)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-400/20 text-indigo-200 border border-indigo-400/30">
                  {schoolProfile.juniorWingName || `${schoolProfile.name} Junior School`} (Grades 7–9)
                </span>
              </div>
              <p className="text-indigo-200 text-xs mt-1">
                {schoolProfile.subCounty}, {schoolProfile.county} · MoE/KNEC Center Code: <strong className="text-white font-mono">{schoolProfile.registrationNumber}</strong> · Paybill: <strong className="text-white font-mono">{schoolProfile.mpesaPaybill}</strong>
              </p>
            </div>

            <button
              onClick={() => onNavigateTab('school')}
              className="flex items-center gap-1.5 px-3 py-2 bg-white text-indigo-950 font-bold rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer text-xs shrink-0 shadow-xs"
            >
              <span>Manage School & Academics</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-indigo-700/60">
            <div className="bg-white/10 rounded-lg p-2.5 backdrop-blur-xs">
              <span className="text-[10px] uppercase font-semibold text-indigo-200 block">Admins & Bursars</span>
              <span className="text-base font-bold font-mono text-white">{adminAccounts.length} Registered</span>
              <span className="text-[10px] text-indigo-300 block mt-0.5">National ID login</span>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5 backdrop-blur-xs">
              <span className="text-[10px] uppercase font-semibold text-indigo-200 block">Faculty Teachers</span>
              <span className="text-base font-bold font-mono text-white">{teachers.length} Faculty</span>
              <span className="text-[10px] text-indigo-300 block mt-0.5">Class & Subject teachers</span>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5 backdrop-blur-xs">
              <span className="text-[10px] uppercase font-semibold text-indigo-200 block">CBC Grades</span>
              <span className="text-base font-bold font-mono text-white">{grades.length} Grade Cohorts</span>
              <span className="text-[10px] text-indigo-300 block mt-0.5">Grade 1 to 9 tiers</span>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5 backdrop-blur-xs">
              <span className="text-[10px] uppercase font-semibold text-indigo-200 block">CBC Subjects</span>
              <span className="text-base font-bold font-mono text-white">{subjects.length} Learning Areas</span>
              <span className="text-[10px] text-indigo-300 block mt-0.5">Curriculum mapped</span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Metric Strip (Tabular Numerals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Enrolled Learners</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{learners.length}</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
            <span>Across {grades.length} Grades</span>
            <span aria-hidden="true">·</span>
            <span>{parents.length} Registered Parents</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Fee Collection Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {collectionEfficiency.toFixed(1)}%
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
            <span className="text-emerald-700 font-medium tabular-nums font-mono">
              Ksh {totalCollected.toLocaleString()}
            </span>
            <span>collected of Ksh {totalBilled.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Pending Tuition Dues</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums text-amber-700">
            Ksh {totalOutstanding.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
            <span>{overdueAccounts.length} student balances pending</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Daily Attendance ({latestDate ? latestDate.slice(5) : 'No Logs'})</span>
            <CalendarCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {attendanceRate.toFixed(1)}%
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
            <span>
              {presentCount} of {latestDayAttendance.length} learners present
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Tuition & Action Items vs Academic/Attendance Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Pending Tuition Due */}
        <div className="lg:col-span-2 min-w-0 max-w-full overflow-x-hidden space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Tuition Payment Status & Dues</h2>
                <p className="text-xs text-slate-500">Learners with pending or overdue school fees for current term</p>
              </div>
              <button
                onClick={() => onNavigateTab('fees')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Full Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] whitespace-nowrap text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-4">Learner & Grade</th>
                    <th className="py-2.5 px-4">Parent / Contact</th>
                    <th className="py-2.5 px-3 text-right">Total Due</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdueAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                        {learners.length === 0
                          ? 'No learners currently enrolled. Enroll a learner to view tuition fee ledgers.'
                          : 'All enrolled learners have cleared their tuition dues.'}
                      </td>
                    </tr>
                  ) : (
                    overdueAccounts.map((fs) => {
                      const learner = learners.find((l) => l.id === fs.learnerId);
                      if (!learner) return null;
                      const parent = parents.find((p) => p.id === learner.parentId);
                      const isOverdue = new Date(fs.dueDate) < new Date('2026-06-18');

                      return (
                        <tr key={fs.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              {learner.firstName} {learner.lastName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {learner.studentId} · {learner.grade}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800">{parent?.fullName || '—'}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {parent ? maskPhoneNumber(parent.phone) : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-mono text-slate-700">
                            Ksh {fs.totalDue.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums font-mono font-bold text-amber-700">
                            Ksh {fs.balance.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 tabular-nums text-slate-600">{fs.dueDate}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                isOverdue
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isOverdue ? 'Overdue' : 'Partial / Pending'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={onOpenRecordPayment}
                              className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors cursor-pointer"
                            >
                              Pay
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Automated Reminders Queue */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Automated Payment Reminders Queue</h2>
                <p className="text-xs text-slate-500">Automated notification schedule for pending fees</p>
              </div>
              <button
                onClick={() => onNavigateTab('reminders')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>View Dispatch Center</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {validReminders.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No payment reminders queued for active learners.
                </p>
              ) : (
                validReminders.slice(0, 3).map((r) => {
                  const learner = learners.find((l) => l.id === r.learnerId);
                  if (!learner) return null;
                  const parent = parents.find((p) => p.id === r.parentId);

                  return (
                    <div
                      key={r.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0 mt-0.5">
                          <BellRing className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {learner.firstName} {learner.lastName} · {parent?.fullName || 'Parent'}
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            Due: Ksh {r.amountDue.toLocaleString()} · Due Date: {r.dueDate}
                          </div>
                          <p className="text-slate-600 mt-1 italic text-[11px] max-w-md line-clamp-1">
                            "{r.messagePreview}"
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="capitalize px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {r.channel.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {r.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Scorecards Snapshot & Quick Actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Learner Score Cards Summary</h2>
                <p className="text-xs text-slate-500">Assessment Records</p>
              </div>
              <button
                onClick={() => onNavigateTab('scorecards')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>All Cards</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {validScoreCards.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No learner score cards recorded yet.
                </p>
              ) : (
                validScoreCards.slice(0, 4).map((sc) => {
                  const learner = learners.find((l) => l.id === sc.learnerId);
                  if (!learner) return null;
                  const gradeInfo = calculateCompetencyGrade(sc.averageScore);

                  return (
                    <div
                      key={sc.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">
                          {learner.firstName} {learner.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {learner.grade} · Rank #{sc.classRank}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold font-mono text-slate-900 tabular-nums">
                          {sc.averageScore.toFixed(1)}%
                        </div>
                        <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border ${gradeInfo.badgeClass}`}>
                          {gradeInfo.grade} ({gradeInfo.points} pts)
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Institutional Security Panel */}
          <div className="bg-linear-to-br from-slate-900 to-indigo-950 rounded-xl p-5 text-white text-xs space-y-3 shadow-md">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero-Knowledge RBAC Enforcement</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Parents authenticate with phone and national ID to access only their specific learner's data. Teachers authenticate to access learners per registered subjects or grade representation.
            </p>
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Cipher: AES-GCM-256</span>
              <span>Key: PBKDF2 (100k)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
