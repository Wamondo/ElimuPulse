import React, { useState } from 'react';
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

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenRecordPayment: () => void;
  onOpenAddLearner: () => void;
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
    const registeredSubjects = currentUser?.registeredSubjects || ['English Literature & Composition'];

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
              {grades.length} Grades
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate" title={grades.map((g) => g.name).join(', ')}>
              {grades.map((g) => g.name).slice(0, 4).join(', ')}{grades.length > 4 ? ` +${grades.length - 4} more` : ''}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-1">Total Enrolled Students</span>
            <div className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
              {learners.length} Students
            </div>
            <p className="text-xs text-slate-500 mt-1">Across represented curriculum</p>
          </div>
        </div>

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
