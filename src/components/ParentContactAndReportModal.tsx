import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { LearnerRecord, ParentRecord, ScoreCard } from '../types';
import { calculateCompetencyGrade } from '../services/gradingService';
import { normalizeKenyanPhone } from '../services/cryptoService';
import { dispatchRealSms } from '../services/smsGatewayService';
import {
  X,
  Phone,
  Mail,
  MessageCircle,
  MessageSquare,
  Send,
  Copy,
  Check,
  Award,
  AlertCircle,
  CheckCircle2,
  User,
  Sparkles,
} from 'lucide-react';

interface ParentContactAndReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  learner: LearnerRecord;
  parent?: ParentRecord;
  scoreCard?: ScoreCard;
  termLabel?: string;
  assessmentName?: string;
  initialMode?: 'score_summary' | 'direct_message';
}

function toWhatsAppDigits(rawPhone: string): string {
  const norm = normalizeKenyanPhone(rawPhone || '').replace(/\D/g, '');
  if (!norm) return '';
  if (norm.startsWith('0') && norm.length === 10) {
    return `254${norm.slice(1)}`;
  }
  if (norm.startsWith('254')) return norm;
  return norm;
}

export const ParentContactAndReportModal: React.FC<ParentContactAndReportModalProps> = ({
  isOpen,
  onClose,
  learner,
  parent,
  scoreCard: propScoreCard,
  termLabel,
  assessmentName,
  initialMode = 'score_summary',
}) => {
  const {
    currentUser,
    schoolProfile,
    scoreCards,
    assessments,
    addAuditLog,
  } = useApp();

  const resolvedScoreCard = useMemo(() => {
    if (propScoreCard) return propScoreCard;
    return (
      scoreCards.find(
        (sc) =>
          sc.learnerId === learner.id &&
          (!termLabel || sc.term === termLabel)
      ) ||
      scoreCards.find((sc) => sc.learnerId === learner.id)
    );
  }, [propScoreCard, scoreCards, learner.id, termLabel]);

  const effectiveTerm = termLabel || resolvedScoreCard?.term || 'Term 1 - 2026';

  const activeAssessment = useMemo(() => {
    return assessments.find(
      (a) => a.grade === learner.grade && a.term === effectiveTerm
    );
  }, [assessments, learner.grade, effectiveTerm]);

  const effectiveAssessmentName =
    assessmentName ||
    activeAssessment?.name ||
    resolvedScoreCard?.assessmentName ||
    `${effectiveTerm} Assessment`;

  const isAbsent = Boolean(
    resolvedScoreCard?.isExamAbsent ||
      activeAssessment?.absentLearnerIds?.includes(learner.id)
  );

  const isJunior =
    learner.grade.toLowerCase().includes('grade 7') ||
    learner.grade.toLowerCase().includes('grade 8') ||
    learner.grade.toLowerCase().includes('grade 9') ||
    learner.grade.toLowerCase().includes('junior');

  const wingName = isJunior
    ? schoolProfile.juniorWingName || schoolProfile.name
    : schoolProfile.primaryWingName || schoolProfile.name;

  const buildScoreSummaryText = () => {
    const parentGreeting = parent?.fullName ? `Dear ${parent.fullName},` : 'Dear Parent/Guardian,';
    const senderSignoff = `${currentUser.name} (${currentUser.teacherType === 'class_teacher' ? `Class Teacher, ${learner.grade}` : 'Subject Teacher'})\n${wingName}`;

    if (!resolvedScoreCard) {
      return `${parentGreeting}\n\n${wingName} · ${effectiveTerm}\nLearner: ${learner.firstName} ${learner.lastName} (${learner.studentId} · ${learner.grade})\nAssessment: ${effectiveAssessmentName}\n\nScore records for this learner are currently being finalized. Please contact us if you need an interim academic update.\n\nRegards,\n${senderSignoff}`;
    }

    if (isAbsent) {
      return `${parentGreeting}\n\n${wingName} · ${effectiveTerm}\nACADEMIC ASSESSMENT NOTICE\nLearner: ${learner.firstName} ${learner.lastName} (${learner.studentId} · ${learner.grade})\nAssessment: ${effectiveAssessmentName}\nStatus: ABSENT / DNS (Did Not Sit Exam)\nAttendance Rate: ${resolvedScoreCard.attendancePercentage.toFixed(1)}%\n\nPlease contact the school/class teacher regarding missed assessment arrangements.\n\nRegards,\n${senderSignoff}`;
    }

    const overallGrade = calculateCompetencyGrade(resolvedScoreCard.averageScore);
    const subjectLines = (resolvedScoreCard.subjects || [])
      .map((s) => `• ${s.subjectName}: ${s.totalScore}% (${s.letterGrade})`)
      .join('\n');

    return `${parentGreeting}\n\n${wingName.toUpperCase()}\nSCORE PERFORMANCE SUMMARY (${effectiveAssessmentName})\nLearner: ${learner.firstName} ${learner.lastName} (${learner.studentId} · ${learner.grade})\nTerm: ${effectiveTerm}\n\nOverall Mean: ${resolvedScoreCard.averageScore.toFixed(1)}% (${overallGrade.grade} - ${overallGrade.label})\nCompetency GPA: ${resolvedScoreCard.gpa.toFixed(2)} / 8.00\nClass Standing: Rank #${resolvedScoreCard.classRank} of ${resolvedScoreCard.classSize}\nAttendance: ${resolvedScoreCard.attendancePercentage.toFixed(1)}%\n\nSubject Breakdown:\n${subjectLines || 'No subjects recorded yet.'}\n\nTeacher Remarks: ${resolvedScoreCard.classTeacherRemark || 'Commendable effort and steady CBC progression.'}\n\nRegards,\n${senderSignoff}`;
  };

  const buildDirectMessageText = (template: 'checkin' | 'attendance' | 'meeting' | 'commendation' = 'checkin') => {
    const parentGreeting = parent?.fullName ? `Dear ${parent.fullName},` : 'Dear Parent/Guardian,';
    const studentRef = `${learner.firstName} ${learner.lastName} (${learner.grade})`;
    const signoff = `Regards,\n${currentUser.name}\n${wingName}`;

    switch (template) {
      case 'attendance':
        return `${parentGreeting}\n\nI am writing regarding ${studentRef}'s recent class attendance. Kindly let us know if everything is well at home or if there is any update we should note on the register.\n\n${signoff}`;
      case 'meeting':
        return `${parentGreeting}\n\nI would like to invite you for a brief parent-teacher consultation regarding ${studentRef}'s academic progress and welfare this term. Please reply with your preferred time.\n\n${signoff}`;
      case 'commendation':
        return `${parentGreeting}\n\nI am pleased to share positive feedback on ${studentRef}'s discipline, participation, and recent progress in class. Keep encouraging them!\n\n${signoff}`;
      case 'checkin':
      default:
        return `${parentGreeting}\n\nGreetings from ${wingName}. Reaching out regarding ${studentRef}. Please let us know if you have any questions or updates.\n\n${signoff}`;
    }
  };

  const [mode, setMode] = useState<'score_summary' | 'direct_message'>(initialMode);
  const [messageText, setMessageText] = useState<string>('');
  const [selectedPhoneType, setSelectedPhoneType] = useState<'primary' | 'alternate'>('primary');
  const [copied, setCopied] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsStatus, setSmsStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setSelectedPhoneType('primary');
    setSmsStatus(null);
    setCopied(false);
    setMessageText(
      initialMode === 'score_summary' ? buildScoreSummaryText() : buildDirectMessageText('checkin')
    );
  }, [isOpen, learner.id, initialMode, effectiveTerm, effectiveAssessmentName]);

  if (!isOpen) return null;

  const rawPrimaryPhone = parent?.phone || '';
  const rawAlternatePhone = parent?.alternatePhone || '';
  const activeRawPhone =
    selectedPhoneType === 'alternate' && rawAlternatePhone ? rawAlternatePhone : rawPrimaryPhone;
  const activeDialPhone = normalizeKenyanPhone(activeRawPhone);
  const activeWaDigits = toWhatsAppDigits(activeRawPhone);
  const parentEmail = (parent?.email || '').trim();

  const emailSubject =
    mode === 'score_summary'
      ? `${wingName}: Score Performance Summary - ${learner.firstName} ${learner.lastName} (${learner.grade})`
      : `${wingName}: Parent Update for ${learner.firstName} ${learner.lastName} (${learner.grade})`;

  const waHref = activeWaDigits
    ? `https://wa.me/${activeWaDigits}?text=${encodeURIComponent(messageText)}`
    : undefined;
  const smsHref = activeDialPhone
    ? `sms:${activeDialPhone}?body=${encodeURIComponent(messageText)}`
    : undefined;
  const telHref = activeDialPhone ? `tel:${activeDialPhone}` : undefined;
  const mailtoHref = parentEmail
    ? `mailto:${parentEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(messageText)}`
    : undefined;

  const handleModeSwitch = (nextMode: 'score_summary' | 'direct_message') => {
    setMode(nextMode);
    setSmsStatus(null);
    setMessageText(
      nextMode === 'score_summary' ? buildScoreSummaryText() : buildDirectMessageText('checkin')
    );
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const logChannelAction = (channel: string) => {
    addAuditLog(
      `Parent Contacted (${channel})`,
      `${currentUser.name} initiated ${channel} ${mode === 'score_summary' ? 'score summary' : 'direct message'} to ${parent?.fullName || 'Parent'} (${activeDialPhone || parentEmail || 'N/A'}) for ${learner.firstName} ${learner.lastName} (${learner.grade}).`
    );
  };

  const handleSendViaPortalSmsGateway = async () => {
    if (!activeDialPhone) {
      setSmsStatus({ type: 'error', text: 'No valid parent phone number on file.' });
      return;
    }
    setIsSendingSms(true);
    setSmsStatus(null);
    try {
      const res = await dispatchRealSms(activeDialPhone, messageText);
      setIsSendingSms(false);
      if (res.success) {
        setSmsStatus({
          type: 'success',
          text: `SMS dispatched to ${res.recipientPhone} (${res.networkCarrier}) · Ref: ${res.messageId}`,
        });
        logChannelAction('Portal SMS Gateway');
      } else {
        setSmsStatus({
          type: 'error',
          text:
            res.error ||
            'Portal SMS Gateway is not configured. Use "Device SMS App", "WhatsApp", or "Email" above.',
        });
      }
    } catch {
      setIsSendingSms(false);
      setSmsStatus({
        type: 'error',
        text: 'Unable to reach Portal SMS Gateway. Use "Device SMS App", "WhatsApp", or "Email" above.',
      });
    }
  };

  const overallGradeInfo = resolvedScoreCard
    ? calculateCompetencyGrade(resolvedScoreCard.averageScore)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-200">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Contact Parent &amp; Send Performance Summary
              </h3>
              <p className="text-[11px] text-slate-300">
                {learner.firstName} {learner.lastName} ({learner.studentId} · {learner.grade})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {/* Parent Contact Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="font-bold text-slate-900 text-sm">
                    {parent?.fullName || 'Parent / Guardian'}
                  </span>
                  {parent?.relationship && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      {parent.relationship}
                    </span>
                  )}
                </div>
              </div>

              {rawAlternatePhone && (
                <div className="inline-flex rounded-lg p-0.5 bg-slate-200 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectedPhoneType('primary')}
                    className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                      selectedPhoneType === 'primary'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Primary
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPhoneType('alternate')}
                    className={`px-2 py-0.5 rounded font-semibold cursor-pointer ${
                      selectedPhoneType === 'alternate'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Alternate
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-slate-700">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                    Phone Number
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {activeDialPhone || 'Not provided'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                <Mail className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                    Email Address
                  </span>
                  <span className="font-mono font-semibold text-slate-900 truncate block">
                    {parentEmail || 'Not provided'}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct Contact Action Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logChannelAction('WhatsApp')}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              ) : (
                <span className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-200 text-slate-400 font-semibold cursor-not-allowed">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>No WhatsApp</span>
                </span>
              )}

              {smsHref ? (
                <a
                  href={smsHref}
                  onClick={() => logChannelAction('Device SMS')}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>SMS App</span>
                </a>
              ) : (
                <span className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-200 text-slate-400 font-semibold cursor-not-allowed">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>No Phone</span>
                </span>
              )}

              {mailtoHref ? (
                <a
                  href={mailtoHref}
                  onClick={() => logChannelAction('Email')}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </a>
              ) : (
                <span className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-200 text-slate-400 font-semibold cursor-not-allowed">
                  <Mail className="w-3.5 h-3.5" />
                  <span>No Email</span>
                </span>
              )}

              {telHref ? (
                <a
                  href={telHref}
                  onClick={() => logChannelAction('Direct Call')}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-xs transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Direct</span>
                </a>
              ) : (
                <span className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-200 text-slate-400 font-semibold cursor-not-allowed">
                  <Phone className="w-3.5 h-3.5" />
                  <span>No Phone</span>
                </span>
              )}
            </div>
          </div>

          {/* Message Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="inline-flex rounded-lg p-1 bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => handleModeSwitch('score_summary')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
                  mode === 'score_summary'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Score Performance Summary</span>
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('direct_message')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
                  mode === 'direct_message'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Direct Parent Message</span>
              </button>
            </div>

            {resolvedScoreCard && overallGradeInfo && !isAbsent && (
              <div className="flex items-center gap-2 text-[11px] bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg text-indigo-900 font-semibold">
                <span>Mean: {resolvedScoreCard.averageScore.toFixed(1)}%</span>
                <span>·</span>
                <span>{overallGradeInfo.grade}</span>
                <span>·</span>
                <span>Rank #{resolvedScoreCard.classRank}</span>
              </div>
            )}
          </div>

          {/* Quick Templates in Direct Message mode */}
          {mode === 'direct_message' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Quick Templates:</span>
              {[
                { id: 'checkin' as const, label: 'General Check-in' },
                { id: 'attendance' as const, label: 'Attendance Follow-up' },
                { id: 'meeting' as const, label: 'Parent Consultation' },
                { id: 'commendation' as const, label: 'Positive Feedback' },
              ].map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setMessageText(buildDirectMessageText(tpl.id))}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 font-medium cursor-pointer transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          )}

          {/* Editable Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-800">
                Message Preview (Editable before sending via SMS, Email, or WhatsApp)
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>
            <textarea
              rows={9}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full p-3 bg-white border border-slate-300 rounded-xl font-sans text-xs text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Gateway Feedback */}
          {smsStatus && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                smsStatus.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {smsStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <span>{smsStatus.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={isSendingSms || !activeDialPhone || !messageText.trim()}
            onClick={handleSendViaPortalSmsGateway}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSendingSms ? 'Dispatching SMS...' : 'Send via Portal SMS Gateway'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
