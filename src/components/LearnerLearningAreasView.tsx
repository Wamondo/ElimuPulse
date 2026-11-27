import { InlineSubmissionReader, ReaderAttachmentItem, StampedPin } from './InlineSubmissionReader';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  LearningAreaAssignmentItem,
  LearnerAssignmentSubmission,
  AssignmentQuestion,
  SubmissionFileAttachment,
  loadLocalAssignments,
  saveAssignments,
  saveAssignmentsAsync,
  compressImageDataUrl,
  subscribeAssignments,
  calculateAssignmentTotalMarks,
  calculateAutoScore,
  formatCalculationSteps,
} from '../services/assignmentService';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Send,
  FileText,
  Plus,
  Upload,
  Trash2,
  Paperclip,
  Image as ImageIcon,
} from 'lucide-react';

const DEFAULT_CBC_LEARNING_AREAS = [
  'Mathematics',
  'English',
  'Kiswahili',
  'Integrated Science',
  'Pre-Technical Studies',
  'Agriculture and Nutrition',
  'Social Studies',
  'Creative Arts and Sports',
  'Religious Education (CRE / IRE)',
];

export const LearnerLearningAreasView: React.FC = () => {
  const { currentUser, learners, subjects, logout } = useApp();

  const learnerRecord = useMemo(
    () =>
      learners.find(
        (l) => l.id === currentUser?.learnerId || l.studentId === currentUser?.idNumber
      ),
    [learners, currentUser]
  );

  const activeLearnerId =
    learnerRecord?.id || currentUser?.learnerId || currentUser?.idNumber || currentUser?.id || 'learner-guest';
  const activeLearnerName = learnerRecord
    ? `${learnerRecord.firstName} ${learnerRecord.lastName}`
    : currentUser?.name || 'Learner';
  const activeStudentId = learnerRecord?.studentId || currentUser?.idNumber || '—';
  const activeLearnerGrade = (
    learnerRecord?.grade ||
    currentUser?.teacherGrade ||
    ''
  ).trim();

  const [teacherAssignments, setTeacherAssignments] = useState<LearningAreaAssignmentItem[]>(() =>
    loadLocalAssignments()
  );

  useEffect(() => {
    const unsubscribe = subscribeAssignments((items) => {
      setTeacherAssignments(items);
    });
    return unsubscribe;
  }, []);

  const learningAreas = useMemo(() => {
    const gradeMatch = activeLearnerGrade.match(/\d+/);
    const gradeNum = gradeMatch ? Number(gradeMatch[0]) : null;
    const isPP1 = /pp\s*1/i.test(activeLearnerGrade);
    const isPP2 = /pp\s*2/i.test(activeLearnerGrade);

    const matchesLearnerGrade = (sub: Record<string, unknown>): boolean => {
      const appGrades = sub.applicableGrades;
      if (Array.isArray(appGrades) && appGrades.length > 0) {
        return appGrades.some((g) => {
          if (typeof g === 'number' && gradeNum !== null) return g === gradeNum;
          const gStr = String(g).trim().toLowerCase();
          if (gradeNum !== null) {
            const m = gStr.match(/\d+/);
            if (m && Number(m[0]) === gradeNum) return true;
          }
          if (isPP1 && /pp\s*1/i.test(gStr)) return true;
          if (isPP2 && /pp\s*2/i.test(gStr)) return true;
          return gStr === activeLearnerGrade.toLowerCase();
        });
      }
      const singleGrade = String(sub.grade || sub.level || '').trim().toLowerCase();
      if (singleGrade && activeLearnerGrade) {
        if (gradeNum !== null) {
          const m = singleGrade.match(/\d+/);
          if (m) return Number(m[0]) === gradeNum;
        }
        return singleGrade === activeLearnerGrade.toLowerCase();
      }
      return true;
    };

    const configured = Array.isArray(subjects)
      ? subjects
          .filter((s: Record<string, unknown>) =>
            activeLearnerGrade ? matchesLearnerGrade(s) : true
          )
          .map((s: Record<string, unknown>) =>
            String(s.name || s.title || s.subjectName || '').trim()
          )
          .filter(Boolean)
      : [];

    const fromAssignments = teacherAssignments
      .filter((a) => {
        if (!activeLearnerGrade) return true;
        const aGrade = (a.grade || '').trim();
        if (!aGrade) return false;
        if (gradeNum !== null) {
          const m = aGrade.match(/\d+/);
          if (m) return Number(m[0]) === gradeNum;
        }
        return aGrade.toLowerCase() === activeLearnerGrade.toLowerCase();
      })
      .map((a) => a.learningArea.trim())
      .filter(Boolean);

    const merged = Array.from(new Set([...configured, ...fromAssignments]));
    if (merged.length > 0) return merged;

    if (gradeNum !== null && gradeNum >= 1 && gradeNum <= 3) {
      return [
        'Mathematical Activities',
        'English Language Activities',
        'Kiswahili Activities',
        'Environmental Activities',
        'Hygiene and Nutrition Activities',
        'Religious Education Activities',
        'Movement and Creative Activities',
      ];
    }
    if (gradeNum !== null && gradeNum >= 4 && gradeNum <= 6) {
      return [
        'Mathematics',
        'English Language',
        'Kiswahili Lugha',
        'Science and Technology',
        'Agriculture',
        'Social Studies',
        'Creative Arts',
        'Physical and Health Education PHE',
        'Home Science',
        'Religious Education (CRE / IRE / HRE)',
      ];
    }
    return DEFAULT_CBC_LEARNING_AREAS;
  }, [subjects, teacherAssignments, activeLearnerGrade]);

  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, Record<string, string>>>({});
  const [draftGeneralResponses, setDraftGeneralResponses] = useState<Record<string, string>>({});
  const [draftSketches, setDraftSketches] = useState<Record<string, Record<string, string>>>({});
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [submittingAssignmentId, setSubmittingAssignmentId] = useState<string | null>(null);
  const [expandedMarkedId, setExpandedMarkedId] = useState<string | null>(null);
  const [printableSheet, setPrintableSheet] = useState<{
    mode: 'assignment' | 'marked';
    assignment: LearningAreaAssignmentItem;
    submission?: LearnerAssignmentSubmission;
  } | null>(null);

  const openPrintSheet = (sheet: {
    mode: 'assignment' | 'marked';
    assignment: LearningAreaAssignmentItem;
    submission?: LearnerAssignmentSubmission;
  }) => {
    setPrintableSheet(sheet);
    setTimeout(() => {
      window.print();
    }, 120);
  };
  const [computerShift, setComputerShift] = useState(false);
  const workingInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Learner Self-Submitted Past Paper / Practice Work state
  const [isSelfSubmitOpen, setIsSelfSubmitOpen] = useState(false);
  const [selfPaperTitle, setSelfPaperTitle] = useState('');
  const [selfPaperNotes, setSelfPaperNotes] = useState('');
  const [selfQuestions, setSelfQuestions] = useState<AssignmentQuestion[]>([]);
  const [selfAnswers, setSelfAnswers] = useState<Record<string, string>>({});
  const [selfAttachments, setSelfAttachments] = useState<SubmissionFileAttachment[]>([]);
  const [selfSubmitError, setSelfSubmitError] = useState<string | null>(null);
  const [isSelfSubmitting, setIsSelfSubmitting] = useState(false);

  const openSelfSubmitModal = () => {
    setSelfPaperTitle('');
    setSelfPaperNotes('');
    setSelfQuestions([]);
    setSelfAnswers({});
    setSelfAttachments([]);
    setSelfSubmitError(null);
    setIsSelfSubmitOpen(true);
  };

  const addSelfQuestion = (qType: 'mcq' | 'text') => {
    const newQ: AssignmentQuestion = {
      id: `spq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prompt: '',
      type: qType,
      marks: qType === 'mcq' ? 1 : 2,
      ...(qType === 'mcq' ? { options: { A: '', B: '', C: '', D: '' } } : {}),
    };
    setSelfQuestions((prev) => [...prev, newQ]);
  };

  const updateSelfQuestion = (id: string, patch: Partial<AssignmentQuestion>) => {
    setSelfQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const removeSelfQuestion = (id: string) => {
    setSelfQuestions((prev) => prev.filter((q) => q.id !== id));
    setSelfAnswers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSelfFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setSelfSubmitError(null);

    const newFiles: SubmissionFileAttachment[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|svg)$/i.test(file.name);
      const maxBytes = 15 * 1024 * 1024;
      if (file.size > maxBytes) {
        setSelfSubmitError(`"${file.name}" exceeds the 15 MB file upload limit.`);
        continue;
      }
      const rawDataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const finalDataUrl = isImage ? await compressImageDataUrl(rawDataUrl, 1280, 0.78) : rawDataUrl;
      newFiles.push({
        id: `att-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        mimeType: file.type || (isImage ? 'image/jpeg' : 'application/octet-stream'),
        sizeBytes: file.size,
        dataUrl: finalDataUrl,
      });
    }
    setSelfAttachments((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const handleConfirmSelfPaperSubmit = async () => {
    if (!selectedArea) return;
    setSelfSubmitError(null);

    const title = selfPaperTitle.trim();
    if (!title) {
      setSelfSubmitError('Please enter a title for your past paper or practice work (e.g., 2025 Term 2 Past Paper).');
      return;
    }

    const hasQuestions = selfQuestions.length > 0;
    const hasFiles = selfAttachments.length > 0;
    const hasNotes = selfPaperNotes.trim().length > 0;

    if (!hasQuestions && !hasFiles && !hasNotes) {
      setSelfSubmitError('Add at least one typed question with your answer, or upload a document/photo of your work.');
      return;
    }

    if (hasQuestions) {
      for (let idx = 0; idx < selfQuestions.length; idx++) {
        const q = selfQuestions[idx];
        if (!q.prompt.trim()) {
          setSelfSubmitError(`Question ${idx + 1} is empty. Enter the question text or remove it.`);
          return;
        }
        if (q.type === 'mcq') {
          const opts = q.options || { A: '', B: '', C: '', D: '' };
          if (!opts.A.trim() || !opts.B.trim() || !opts.C.trim() || !opts.D.trim()) {
            setSelfSubmitError(`Question ${idx + 1} (Multiple Choice): fill in all four options (A, B, C, D).`);
            return;
          }
          const chosen = selfAnswers[q.id];
          if (!chosen || !['A', 'B', 'C', 'D'].includes(chosen)) {
            setSelfSubmitError(`Question ${idx + 1}: select your answer choice (A, B, C, or D) before submitting.`);
            return;
          }
        } else {
          const ans = (selfAnswers[q.id] || '').trim();
          if (!ans) {
            setSelfSubmitError(`Question ${idx + 1}: fill in your answer/working before submitting for marking.`);
            return;
          }
        }
      }
    }

    setIsSelfSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const assignmentId = `self-paper-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const totalMarks = hasQuestions ? calculateAssignmentTotalMarks(selfQuestions) : 20;
      const firstImage = selfAttachments.find((a) => a.mimeType.startsWith('image/'));
      const sketchAttachments: Record<string, string> = {};
      if (firstImage) {
        sketchAttachments['_general'] = firstImage.dataUrl;
      }

      const submission: LearnerAssignmentSubmission = {
        learnerId: activeLearnerId,
        learnerName: activeLearnerName,
        studentId: activeStudentId,
        grade: activeLearnerGrade || 'All Grades',
        answers: hasQuestions ? { ...selfAnswers } : {},
        ...(Object.keys(sketchAttachments).length > 0 ? { sketchAttachments } : {}),
        ...(hasFiles ? { attachments: selfAttachments } : {}),
        generalResponse:
          selfPaperNotes.trim() ||
          (hasFiles
            ? `Submitted ${selfAttachments.length} file(s): ${selfAttachments.map((f) => f.name).join(', ')}`
            : 'Interactive past paper questions completed by learner.'),
        autoScore: 0,
        totalMarks,
        status: 'submitted',
        submittedAt: nowIso,
      };

      const newAssignment: LearningAreaAssignmentItem = {
        id: assignmentId,
        learningArea: selectedArea,
        grade: activeLearnerGrade || 'All Grades',
        title,
        instructions:
          selfPaperNotes.trim() ||
          `Learner self-submitted past paper / practice work by ${activeLearnerName} (${activeStudentId}).`,
        dueDate: `Self-Submitted · ${new Date().toLocaleDateString()}`,
        teacherName: 'Subject Teacher',
        status: 'todo',
        ...(hasQuestions ? { questions: selfQuestions } : {}),
        totalMarks,
        isSelfSubmitted: true,
        submittedByLearnerId: activeLearnerId,
        submittedByLearnerName: activeLearnerName,
        submissions: {
          [activeLearnerId]: submission,
        },
        createdAt: nowIso,
      };

      const latest = loadLocalAssignments();
      const nextList = [newAssignment, ...latest];
      saveAssignments(nextList);
      await saveAssignmentsAsync(nextList);
      setTeacherAssignments(nextList);
      setIsSelfSubmitOpen(false);
      setSubmitNotice(`"${title}" submitted to your ${selectedArea} teacher for marking.`);
    } finally {
      setIsSelfSubmitting(false);
    }
  };

  const getAssignmentsForArea = (area: string) => {
    const learnerGradeKey = activeLearnerGrade.toLowerCase();
    const areaKey = area.trim().toLowerCase();

    const matched = teacherAssignments.filter((item) => {
      const itemArea = item.learningArea.trim().toLowerCase();
      const areaMatch =
        itemArea === areaKey || itemArea.includes(areaKey) || areaKey.includes(itemArea);
      if (!areaMatch) return false;
      if (item.isSelfSubmitted && item.submittedByLearnerId && item.submittedByLearnerId !== activeLearnerId) return false;
      const itemGrade = (item.grade || 'All Grades').trim().toLowerCase();
      return !learnerGradeKey || itemGrade === 'all grades' || itemGrade === learnerGradeKey;
    });
    const toDo: Array<{
      assignment: LearningAreaAssignmentItem;
      submission?: LearnerAssignmentSubmission;
    }> = [];
    const marked: Array<{
      assignment: LearningAreaAssignmentItem;
      submission?: LearnerAssignmentSubmission;
    }> = [];

    matched.forEach((item) => {
      const sub = item.submissions?.[activeLearnerId];
      if (sub?.status === 'marked' || item.status === 'marked') {
        marked.push({ assignment: item, submission: sub });
      } else {
        toDo.push({ assignment: item, submission: sub });
      }
    });

    return { toDo, marked };
  };

  const handleAnswerChange = (assignmentId: string, questionId: string, value: string) => {
    setDraftAnswers((prev) => ({
      ...prev,
      [assignmentId]: {
        ...(prev[assignmentId] || {}),
        [questionId]: value,
      },
    }));
  };

  const handlePaperPhotoUpload = (assignmentId: string, key: string, file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return;
      const img = new Image();
      img.onload = () => {
        const maxDim = 1100;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.78);
          setDraftSketches((prev) => ({
            ...prev,
            [assignmentId]: {
              ...(prev[assignmentId] || {}),
              [key]: compressed,
            },
          }));
          return;
        }
        setDraftSketches((prev) => ({
          ...prev,
          [assignmentId]: {
            ...(prev[assignmentId] || {}),
            [key]: rawDataUrl,
          },
        }));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePaperPhoto = (assignmentId: string, key: string) => {
    setDraftSketches((prev) => {
      const nextForAssignment = { ...(prev[assignmentId] || {}) };
      delete nextForAssignment[key];
      return {
        ...prev,
        [assignmentId]: nextForAssignment,
      };
    });
  };

  const handleSubmitAssignment = async (assignment: LearningAreaAssignmentItem) => {
    if (submittingAssignmentId === assignment.id) return;
    setSubmittingAssignmentId(assignment.id);
    try {
      const answers = draftAnswers[assignment.id] || {};
      const generalResponse = (draftGeneralResponses[assignment.id] || '').trim();
      const rawSketches = draftSketches[assignment.id] || {};
      const sketchAttachments: Record<string, string> = {};
      for (const [k, url] of Object.entries(rawSketches)) {
        if (typeof url === 'string' && url) {
          sketchAttachments[k] = await compressImageDataUrl(url, 960, 0.72);
        }
      }
      const hasSketchAttachments = Object.keys(sketchAttachments).length > 0;
      const questions = assignment.questions || [];
      const totalMarks = assignment.totalMarks || calculateAssignmentTotalMarks(questions);
      const autoScore = calculateAutoScore(questions, answers);

      const submission: LearnerAssignmentSubmission = {
        learnerId: activeLearnerId,
        learnerName: activeLearnerName,
        studentId: activeStudentId,
        grade: activeLearnerGrade || assignment.grade,
        answers,
        ...(hasSketchAttachments ? { sketchAttachments } : {}),
        ...(generalResponse ? { generalResponse } : {}),
        autoScore,
        totalMarks,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      };

      const nextList = teacherAssignments.map((item) => {
        if (item.id !== assignment.id) return item;
        return {
          ...item,
          submissions: {
            ...(item.submissions || {}),
            [activeLearnerId]: submission,
          },
        };
      });

      setTeacherAssignments(nextList);
      const syncRes = await saveAssignmentsAsync(nextList);
      setActiveAssignmentId(null);
      if (syncRes.synced) {
        setSubmitNotice(
          `Submitted "${assignment.title}" directly to ${assignment.teacherName}. Once marked, it will appear in your Marked Assignments below.`
        );
      } else {
        setSubmitNotice(
          `Saved "${assignment.title}" on this device, but cloud upload had a network issue (${syncRes.error || 'offline'}). Keep this page open when back online so it finishes syncing.`
        );
      }
    } finally {
      setSubmittingAssignmentId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Learner Portal · Learning Areas
          </p>
          <h1 className="text-base font-bold text-slate-900">
            {activeLearnerName}
            {activeLearnerGrade ? ` · ${activeLearnerGrade}` : ''}
          </h1>
          <p className="text-xs text-slate-500">Student No: {activeStudentId}</p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        {!selectedArea ? (
          <>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your Learning Areas</h2>
              <p className="text-xs text-slate-600">
                Select a learning area to answer assignment sets directly on your phone and view your marked assignments.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {learningAreas.map((area) => {
                const { toDo, marked } = getAssignmentsForArea(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => {
                      setSelectedArea(area);
                      setSubmitNotice(null);
                    }}
                    className="bg-white border border-slate-200 hover:border-amber-400 rounded-xl p-4 text-left shadow-2xs transition-all cursor-pointer flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{area}</h3>
                      <div className="mt-2 flex items-center gap-3 text-[11px] font-medium">
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Clock className="w-3 h-3" />
                          {toDo.length} To Do
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {marked.length} Marked
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedArea(null);
                  setActiveAssignmentId(null);
                  setSubmitNotice(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Learning Areas</span>
              </button>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                {selectedArea}
              </span>
            </div>

            <h2 className="text-lg font-bold text-slate-900">{selectedArea}</h2>

            {submitNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
                <span className="font-medium">{submitNotice}</span>
                <button
                  type="button"
                  onClick={() => setSubmitNotice(null)}
                  className="text-[11px] font-semibold underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Assignments to be done */}
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">Assignments to Be Done</h3>
                </div>
                <button
                  type="button"
                  onClick={openSelfSubmitModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Submit Past Paper / Practice Work</span>
                </button>
              </div>

              {getAssignmentsForArea(selectedArea).toDo.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No pending assignments sent in {selectedArea} right now.
                </p>
              ) : (
                <div className="space-y-3">
                  {getAssignmentsForArea(selectedArea).toDo.map(({ assignment, submission }) => {
                    const isOpen = activeAssignmentId === assignment.id;
                    const questions = assignment.questions || [];
                    const totalMarks =
                      assignment.totalMarks || calculateAssignmentTotalMarks(questions);
                    const currentAnswers =
                      draftAnswers[assignment.id] || submission?.answers || {};
                    const currentGeneral =
                      draftGeneralResponses[assignment.id] ??
                      submission?.generalResponse ??
                      '';
                    const isSubmitted = submission?.status === 'submitted';

                    return (
                      <div
                        key={assignment.id}
                        className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 space-y-3"
                      >                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-bold text-slate-900">{assignment.title}</p>
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 text-slate-700 rounded">
                                {questions.length > 0
                                  ? `${questions.length} Questions · ${totalMarks} Marks`
                                  : `${totalMarks} Marks`}
                              </span>
                              {assignment.isSelfSubmitted && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 rounded-full">
                                  Self-Submitted Past Paper
                                </span>
                              )}
                              {isSubmitted && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-full">
                                  Submitted · Awaiting Teacher Marking
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 mt-1">
                              {assignment.instructions}
                            </p>
                            <p className="text-[10px] font-semibold text-amber-800 mt-1">
                              {assignment.dueDate} · Teacher: {assignment.teacherName}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0"><button type="button" onClick={() => openPrintSheet({ mode: 'assignment', assignment })} className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg cursor-pointer">Print Assignment</button><button
                            type="button"
                            onClick={() =>
                              setActiveAssignmentId(isOpen ? null : assignment.id)
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shrink-0 cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>
                              {isOpen
                                ? 'Close Questions'
                                : isSubmitted
                                ? 'View / Update Answers'
                                : 'Answer Questions'}
                            </span>
                          </button></div>
                        </div>

                        {isOpen && (
                          <div className="pt-3 border-t border-amber-200/80 space-y-3">
                            {assignment.attachments && assignment.attachments.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-bold text-indigo-900">
                                  Teacher Attached Document / Question Paper ({assignment.attachments.length} file{assignment.attachments.length === 1 ? '' : 's'}):
                                </p>
                                <InlineSubmissionReader
                                  attachments={assignment.attachments}
                                  annotationsByKey={{}}
                                  readOnly
                                />
                              </div>
                            )}

                            {questions.length > 0 ? (
                              <div className="space-y-3">
                                {questions.map((q, idx) => (
                                  <div
                                    key={q.id}
                                    className="p-3 bg-white border border-slate-200 rounded-lg space-y-2"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-bold text-slate-900">
                                        {idx + 1}. {q.prompt}
                                      </p>
                                      <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                                        [{q.marks} {q.marks === 1 ? 'mark' : 'marks'}]
                                      </span>
                                    </div>

                                    {q.diagramUrl && (
                                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                                        <img
                                          src={q.diagramUrl}
                                          alt={q.diagramCaption || `Question ${idx + 1} diagram`}
                                          className="max-h-48 w-auto rounded border border-slate-200 bg-white object-contain"
                                        />
                                        {q.diagramCaption && (
                                          <p className="text-[11px] font-medium text-slate-600">
                                            {q.diagramCaption}
                                          </p>
                                        )}
                                          </div>
                                        )}

                                    {q.type === 'mcq' && q.options ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                        {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                                          const optText = q.options?.[optKey] || '';
                                          if (!optText) return null;
                                          const picked = currentAnswers[q.id] === optKey;
                                          return (
                                            <label
                                              key={optKey}
                                              className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                                picked
                                                  ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-semibold'
                                                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                                              }`}
                                            >
                                              <input
                                                type="radio"
                                                name={`ans-${assignment.id}-${q.id}`}
                                                checked={picked}
                                                onChange={() =>
                                                  handleAnswerChange(assignment.id, q.id, optKey)
                                                }
                                              />
                                              <span className="font-bold">{optKey}.</span>
                                              <span>{optText}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        <textarea
                                          ref={(el) => {
                                            workingInputRefs.current[q.id] = el;
                                          }}
                                          rows={4}
                                          value={currentAnswers[q.id] || ''}
                                          onChange={(e) =>
                                            handleAnswerChange(assignment.id, q.id, e.target.value)
                                          }
                                          placeholder={"Type your working or use the computer keyboard below...\nExample: 23 ÷ 50 = 46 ÷ 100 = 0.46"}
                                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-indigo-500 focus:outline-none font-mono"
                                        />
                                        <div className="p-2 bg-slate-200/90 border border-slate-400 rounded-xl space-y-1.5 select-none shadow-inner overflow-hidden">
                                          <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-600 px-0.5">
                                            <span>COMPUTER KEYBOARD ({computerShift ? 'SHIFT ON' : 'STANDARD'})</span>
                                            <button
                                              type="button"
                                              onClick={() => handleAnswerChange(assignment.id, q.id, '')}
                                              className="px-2 py-0.5 text-[10px] font-bold bg-white hover:bg-rose-50 text-rose-700 border border-slate-300 rounded cursor-pointer"
                                            >
                                              Clear All
                                            </button>
                                          </div>
                                          {(() => {
                                            const currentVal = currentAnswers[q.id] || '';
                                            const applyEdit = (transform: (val: string, start: number, end: number) => { nextVal: string; nextCursor: number }) => {
                                              const el = workingInputRefs.current[q.id];
                                              const start = el ? (el.selectionStart ?? currentVal.length) : currentVal.length;
                                              const end = el ? (el.selectionEnd ?? currentVal.length) : currentVal.length;
                                              const { nextVal, nextCursor } = transform(currentVal, start, end);
                                              handleAnswerChange(assignment.id, q.id, nextVal);
                                              requestAnimationFrame(() => {
                                                const target = workingInputRefs.current[q.id];
                                                if (target) {
                                                  target.focus();
                                                  target.setSelectionRange(nextCursor, nextCursor);
                                                }
                                              });
                                            };
                                            const insertText = (snippet: string) => {
                                              applyEdit((val, start, end) => ({
                                                nextVal: val.slice(0, start) + snippet + val.slice(end),
                                                nextCursor: start + snippet.length,
                                              }));
                                              if (computerShift) setComputerShift(false);
                                            };
                                            const handleBackspaceKey = () => {
                                              applyEdit((val, start, end) => {
                                                if (start !== end) {
                                                  return { nextVal: val.slice(0, start) + val.slice(end), nextCursor: start };
                                                }
                                                if (start === 0) return { nextVal: val, nextCursor: 0 };
                                                return { nextVal: val.slice(0, start - 1) + val.slice(start), nextCursor: start - 1 };
                                              });
                                            };
                                            const handleDeleteKey = () => {
                                              applyEdit((val, start, end) => {
                                                if (start !== end) {
                                                  return { nextVal: val.slice(0, start) + val.slice(end), nextCursor: start };
                                                }
                                                if (start >= val.length) return { nextVal: val, nextCursor: val.length };
                                                return { nextVal: val.slice(0, start) + val.slice(start + 1), nextCursor: start };
                                              });
                                            };

                                            const numRow = [
                                              { base: '1', shift: '!' },
                                              { base: '2', shift: '@' },
                                              { base: '3', shift: '#' },
                                              { base: '4', shift: '$' },
                                              { base: '5', shift: '%' },
                                              { base: '6', shift: '^' },
                                              { base: '7', shift: '&' },
                                              { base: '8', shift: '*' },
                                              { base: '9', shift: '(' },
                                              { base: '0', shift: ')' },
                                              { base: '-', shift: '_' },
                                              { base: '=', shift: '+' },
                                            ];
                                            const row1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', { base: '[', shift: '{' }, { base: ']', shift: '}' }, { base: '\\', shift: '|' }];
                                            const row2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', { base: ';', shift: ':' }, { base: "'", shift: '"' }];
                                            const row3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm', { base: ',', shift: '<' }, { base: '.', shift: '>' }, { base: '/', shift: '?' }];
                                            const mathRow = ['+', '−', '×', '÷', '±', '≠', '≈', '≤', '≥', '²', '³', '√', '∛', 'π', '°', '∠', '⊥', '∥', '△', '○', 'cm', 'm', 'cm²', 'm²', 'cm³', 'm³', '½', '⅓', '¼', '¾', '∞', '→', '∴'];

                                            const renderKeyItem = (item: string | { base: string; shift: string }, keyIdx: number) => {
                                              if (typeof item === 'string') {
                                                const label = computerShift ? item.toUpperCase() : item;
                                                return (
                                                  <button
                                                    key={`k-${keyIdx}-${item}`}
                                                    type="button"
                                                    onClick={() => insertText(label)}
                                                    className="flex-1 min-w-[20px] sm:min-w-[24px] h-7 px-0.5 sm:px-1 text-[10px] sm:text-[11px] font-semibold bg-white hover:bg-indigo-50 active:bg-indigo-100 text-slate-900 border border-slate-300 rounded shadow-2xs cursor-pointer"
                                                  >
                                                    {label}
                                                  </button>
                                                );
                                              }
                                              const activeChar = computerShift ? item.shift : item.base;
                                              return (
                                                <button
                                                  key={`ks-${keyIdx}-${item.base}`}
                                                  type="button"
                                                  onClick={() => insertText(activeChar)}
                                                  className="flex-1 min-w-[21px] sm:min-w-[26px] h-7 px-0.5 sm:px-1 leading-tight bg-white hover:bg-indigo-50 active:bg-indigo-100 text-slate-900 border border-slate-300 rounded shadow-2xs cursor-pointer flex flex-col items-center justify-center"
                                                >
                                                  <span className="text-[9px] text-slate-400 leading-none">{computerShift ? item.base : item.shift}</span>
                                                  <span className="text-[11px] font-bold text-slate-900 leading-tight">{activeChar}</span>
                                                </button>
                                              );
                                            };

                                            return (
                                              <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                                                  {numRow.map((k, i) => renderKeyItem(k, i))}
                                                  <button
                                                    type="button"
                                                    onClick={handleBackspaceKey}
                                                    className="px-1.5 h-7 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded shadow-2xs cursor-pointer"
                                                  >
                                                    ⌫ Bksp
                                                  </button>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                                                  {row1.map((k, i) => renderKeyItem(k, i))}
                                                  <button
                                                    type="button"
                                                    onClick={handleDeleteKey}
                                                    className="px-1.5 h-7 text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded shadow-2xs cursor-pointer"
                                                  >
                                                    Del
                                                  </button>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                                                  <button
                                                    type="button"
                                                    onClick={() => setComputerShift((prev) => !prev)}
                                                    className={`px-2.5 h-7 text-[11px] font-bold rounded border shadow-2xs cursor-pointer shrink-0 ${
                                                      computerShift
                                                        ? 'bg-indigo-600 text-white border-indigo-700'
                                                        : 'bg-slate-100 hover:bg-white text-slate-800 border-slate-300'
                                                    }`}
                                                  >
                                                    ⇧ Shift
                                                  </button>
                                                  {row2.map((k, i) => renderKeyItem(k, i))}
                                                  <button
                                                    type="button"
                                                    onClick={() => insertText('\n')}
                                                    className="px-2 h-7 text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded shadow-2xs cursor-pointer"
                                                  >
                                                    ↵ Enter
                                                  </button>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                                                  <button
                                                    type="button"
                                                    onClick={() => setComputerShift((prev) => !prev)}
                                                    className={`px-2 h-7 text-[11px] font-bold rounded border shadow-2xs cursor-pointer shrink-0 ${
                                                      computerShift
                                                        ? 'bg-indigo-600 text-white border-indigo-700'
                                                        : 'bg-slate-100 hover:bg-white text-slate-800 border-slate-300'
                                                    }`}
                                                  >
                                                    ⇧ Shift
                                                  </button>
                                                  {row3.map((k, i) => renderKeyItem(k, i))}
                                                </div>
                                                <div className="flex items-center gap-1 pt-0.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => insertText(' ')}
                                                    className="flex-1 h-7 text-[11px] font-semibold bg-white hover:bg-indigo-50 active:bg-indigo-100 text-slate-800 border border-slate-300 rounded shadow-2xs cursor-pointer"
                                                  >
                                                    Space Bar
                                                  </button>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-300/80">
                                                  {mathRow.map((sym) => (
                                                    <button
                                                      key={sym}
                                                      type="button"
                                                      onClick={() => insertText(sym)}
                                                      className="px-1.5 py-0.5 text-[11px] font-semibold bg-white hover:bg-indigo-50 text-slate-800 border border-slate-300 rounded cursor-pointer"
                                                    >
                                                      {sym}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                        <div className="p-2 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <span className="text-[11px] font-semibold text-amber-950">
                                                Worked on paper instead? Upload a photo of your written work for Q{idx + 1}:
                                              </span>
                                              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-amber-950 bg-white hover:bg-amber-100 border border-amber-300 rounded-md cursor-pointer">
                                                <span>📷 Upload / Camera Photo</span>
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  className="hidden"
                                                  onChange={(e) => {
                                                    handlePaperPhotoUpload(assignment.id, q.id, e.target.files?.[0]);
                                                    e.currentTarget.value = '';
                                                  }}
                                                />
                                              </label>
                                            </div>
                                            {draftSketches[assignment.id]?.[q.id] && (
                                              <div className="space-y-1.5">
                                                <img
                                                  src={draftSketches[assignment.id][q.id]}
                                                  alt={`Uploaded written work for Question ${idx + 1}`}
                                                  className="max-h-56 w-auto rounded-lg border border-amber-300 bg-white object-contain"
                                                />
                                                <div className="flex items-center justify-between text-[10px] text-amber-900">
                                                  <span>Attached written paper work ready to send</span>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleRemovePaperPhoto(assignment.id, q.id)}
                                                    className="font-bold text-rose-700 hover:underline cursor-pointer"
                                                  >
                                                    Remove Photo
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
                                <label className="block text-xs font-bold text-slate-800">
                                  Your Direct Answer / Working
                                </label>
                                <textarea
                                  rows={4}
                                  value={currentGeneral}
                                  onChange={(e) =>
                                    setDraftGeneralResponses((prev) => ({
                                      ...prev,
                                      [assignment.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Type your complete answers directly here..."
                                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-indigo-500 focus:outline-none"
                                />
                                <div className="p-2 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-amber-950">
                                      Or upload a photo of your written work on paper:
                                    </span>
                                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-amber-950 bg-white hover:bg-amber-100 border border-amber-300 rounded-md cursor-pointer">
                                      <span>📷 Upload / Camera Photo</span>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          handlePaperPhotoUpload(assignment.id, '_general', e.target.files?.[0]);
                                          e.currentTarget.value = '';
                                        }}
                                      />
                                    </label>
                                  </div>
                                  {draftSketches[assignment.id]?.['_general'] && (
                                    <div className="space-y-1.5">
                                      <img
                                        src={draftSketches[assignment.id]['_general']}
                                        alt="Uploaded written paper work"
                                        className="max-h-56 w-auto rounded-lg border border-amber-300 bg-white object-contain"
                                      />
                                      <div className="flex items-center justify-between text-[10px] text-amber-900">
                                        <span>Attached written paper work ready to send</span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePaperPhoto(assignment.id, '_general')}
                                          className="font-bold text-rose-700 hover:underline cursor-pointer"
                                        >
                                          Remove Photo
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="flex justify-end">
                              <button
                                type="button"
                                disabled={submittingAssignmentId === assignment.id}
                                onClick={() => handleSubmitAssignment(assignment)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Submit Answers to {assignment.teacherName}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Assignments marked */}
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Assignments Marked</h3>
              </div>

              {getAssignmentsForArea(selectedArea).marked.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No marked assignments published in {selectedArea} yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {getAssignmentsForArea(selectedArea).marked.map(({ assignment, submission }) => {
                    const displayScore =
                      submission?.awardedScore || assignment.score || 'Marked';
                    const displayFeedback =
                      submission?.teacherFeedback ||
                      assignment.feedback ||
                      'Marked by subject teacher.';
                    const isExpanded = expandedMarkedId === assignment.id;
                    const questions = assignment.questions || [];

                    return (
                      <div
                        key={assignment.id}
                        className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-900">{assignment.title}</p>
                            <p className="text-[11px] text-slate-700 mt-0.5">
                              {displayFeedback}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Marked by {assignment.teacherName}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 self-start sm:self-center">
                            <span className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-md shrink-0">
                              {displayScore}
                            </span>
                            {submission && (questions.length > 0 || (submission.attachments || []).length > 0 || Boolean(submission.sketchAttachments?.['_general'])) && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openPrintSheet({ mode: 'marked', assignment, submission })}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-md cursor-pointer"
                                >
                                  Print Marked Script
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedMarkedId(isExpanded ? null : assignment.id)
                                  }
                                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-md cursor-pointer"
                                >
                                  {isExpanded ? 'Hide Script' : 'View Marked Script'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {isExpanded && submission && (questions.length > 0 || (submission.attachments || []).length > 0 || Boolean(submission.sketchAttachments?.['_general'])) && (
                          <div className="pt-2 border-t border-emerald-200/70 space-y-2">
                            {((submission.attachments || []).length > 0 || submission.sketchAttachments?.['_general']) && (() => {
                              const readerItems: ReaderAttachmentItem[] =
                                (submission.attachments || []).length > 0
                                  ? submission.attachments!
                                  : [
                                      {
                                        id: '_general',
                                        name: 'Uploaded Written Paper',
                                        mimeType: 'image/jpeg',
                                        dataUrl: submission.sketchAttachments!['_general'],
                                      },
                                    ];
                              const annsByAtt: Record<string, StampedPin[]> = {};
                              readerItems.forEach((att) => {
                                annsByAtt[att.id] =
                                  (submission.stepAnnotations?.[`att_${att.id}`] as StampedPin[]) || [];
                              });
                              return (
                                <InlineSubmissionReader
                                  attachments={readerItems}
                                  annotationsByKey={annsByAtt}
                                  readOnly={true}
                                />
                              );
                            })()}
                            {questions.length > 0 && (
                          <div className="pt-2 border-t border-emerald-200/70 space-y-1.5">
                            {questions.map((q, idx) => {
                              const ans = submission.answers?.[q.id] || '—';
                              const isCorrect =
                                q.type === 'mcq' && q.correctOption === ans;
                              const calcSteps = q.type !== 'mcq' ? formatCalculationSteps(ans) : [];
                              const anns = submission.stepAnnotations?.[q.id] || [];
                              return (
                                <div
                                  key={q.id}
                                  className="p-2.5 bg-white border border-emerald-100 rounded-lg text-[11px] space-y-1.5"
                                >
                                  <p className="font-bold text-slate-900">
                                    {idx + 1}. {q.prompt} ({q.marks} mks)
                                  </p>
                                  {q.diagramUrl && (
                                    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                                      <img
                                        src={q.diagramUrl}
                                        alt={q.diagramCaption || `Question ${idx + 1} diagram`}
                                        className="max-h-40 w-auto rounded border border-slate-200 bg-white object-contain"
                                      />
                                      {q.diagramCaption && (
                                        <p className="text-[10px] font-medium text-slate-600">
                                          {q.diagramCaption}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  {submission.sketchAttachments?.[q.id] && (
                                    <div className="p-2 bg-amber-50/60 border border-amber-200 rounded-lg space-y-1">
                                      <p className="text-[10px] font-bold text-amber-900">
                                        Your Uploaded Written Paper Work:
                                      </p>
                                      <div className="relative inline-block max-w-full">
                                        <img
                                          src={submission.sketchAttachments[q.id]}
                                          alt={`Uploaded written work for Question ${idx + 1}`}
                                          className="max-h-64 w-auto rounded border border-amber-300 bg-white object-contain block"
                                        />
                                        {anns.map((pin, pIdx) => {
                                          const p = pin as { stamp?: string; x?: number; y?: number };
                                          if (!p?.stamp || typeof p.x !== 'number' || typeof p.y !== 'number') return null;
                                          return (
                                            <span
                                              key={`lpin-${q.id}-${pIdx}`}
                                              style={{ left: `${p.x}%`, top: `${p.y}%` }}
                                              className="-translate-x-1/2 -translate-y-1/2 absolute inline-flex items-center px-1.5 py-0.5 rounded font-sans text-xs font-black text-red-600 bg-red-50/95 border border-red-400 shadow-xs pointer-events-none"
                                            >
                                              {p.stamp}
                                            </span>
                                          );
                                        })}
                            </div>
                          </div>
                        )}
                                  {q.type === 'mcq' ? (
                                    <p className="text-slate-700 mt-0.5">
                                      Your Answer: <strong>{ans}</strong>
                                      <span
                                        className={`ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                          isCorrect
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-rose-100 text-rose-800'
                                        }`}
                                      >
                                        {isCorrect
                                          ? 'Correct'
                                          : `Correct Answer: ${q.correctOption}`}
                                      </span>
                                    </p>
                                  ) : anns.some((p) => typeof (p as { x?: number }).x === 'number' && typeof (p as { y?: number }).y === 'number') ? (
                                    <div className="relative rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 whitespace-pre-wrap leading-relaxed">
                                      {ans}
                                      {anns.map((pin, pIdx) => {
                                        const p = pin as { stamp?: string; x?: number; y?: number };
                                        if (!p?.stamp || typeof p.x !== 'number' || typeof p.y !== 'number') return null;
                                        return (
                                          <span
                                            key={`tpin-${q.id}-${pIdx}`}
                                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                                            className="-translate-x-1/2 -translate-y-1/2 absolute inline-flex items-center px-1.5 py-0.5 rounded font-sans text-xs font-black text-red-600 bg-red-50/95 border border-red-400 shadow-xs pointer-events-none"
                                          >
                                            {p.stamp}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : calcSteps.length > 0 ? (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 divide-y divide-slate-200/70">
                                      {calcSteps.map((stepLine, sIdx) => {
                                        const ann = anns[sIdx] || {};
                                        const isWrong = ann.stamp === '✗';
                                        return (
                                          <div key={sIdx} className="px-2.5 py-1.5 space-y-1">
                                            <div className="flex items-center justify-between gap-2 font-mono text-xs">
                                              <span
                                                className={`font-bold ${
                                                  isWrong
                                                    ? 'text-red-700 underline decoration-wavy decoration-red-500'
                                                    : 'text-slate-900'
                                                }`}
                                              >
                                                {stepLine}
                                              </span>
                                              {ann.stamp && (
                                                <span className="font-sans text-xs font-black text-red-600 bg-red-50 border border-red-300 px-1.5 py-0.5 rounded">
                                                  {ann.stamp}
                                                </span>
                                              )}
                                            </div>
                                            {ann.mistakeNote && (
                                              <p className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                                                Teacher Correction: {ann.mistakeNote}
                                              </p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-slate-700 mt-0.5">
                                      Your Answer: <strong>{ans}</strong>
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
      {printableSheet && (
        <div
          id="elimu-print-backdrop"
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
        >
          <style>{`
            @media print {
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                overflow: visible !important;
                background: #ffffff !important;
              }
              body * {
                visibility: hidden !important;
              }
              #elimu-print-backdrop {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                right: 0 !important;
                bottom: auto !important;
                display: block !important;
                padding: 0 !important;
                margin: 0 !important;
                background: #ffffff !important;
                visibility: visible !important;
              }
              #elimu-printable-sheet, #elimu-printable-sheet * {
                visibility: visible !important;
              }
              #elimu-printable-sheet {
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                max-height: none !important;
                overflow: visible !important;
                margin: 0 !important;
                padding: 12px !important;
                box-shadow: none !important;
                border: none !important;
                background: #ffffff !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>
          <div
            id="elimu-printable-sheet"
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-white text-slate-900 rounded-xl border border-slate-300 p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-300 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">
                  {printableSheet.mode === 'marked' ? 'Marked Assignment Review Copy' : 'Assigned Learner Worksheet'}
                </p>
                <h2 className="text-base font-extrabold text-slate-900 mt-0.5">
                  {printableSheet.assignment.title}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {printableSheet.assignment.learningArea} · {printableSheet.assignment.grade} · Teacher: {printableSheet.assignment.teacherName} · Due: {printableSheet.assignment.dueDate}
                </p>
                <p className="text-xs font-semibold text-slate-800 mt-1">
                  Learner: {activeLearnerName} ({activeLearnerId})
                </p>
              </div>
              <div className="flex items-center gap-2 no-print shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                >
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPrintableSheet(null)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {printableSheet.mode === 'marked' && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-emerald-950">Teacher Remarks: </span>
                  <span className="text-emerald-900">
                    {printableSheet.submission?.teacherFeedback || printableSheet.assignment.feedback || 'Marked by subject teacher.'}
                  </span>
                </div>
                <span className="font-extrabold text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded">
                  Score: {printableSheet.submission?.awardedScore || printableSheet.assignment.score || 'Marked'}
                </span>
              </div>
            )}

            {printableSheet.assignment.instructions && (
              <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <strong>Instructions:</strong> {printableSheet.assignment.instructions}
              </p>
            )}

            <div className="space-y-3">
              {(printableSheet.assignment.questions || []).map((q, idx) => {
                const subAns = printableSheet.submission?.answers?.[q.id] || '';
                const sketchUrl = printableSheet.submission?.sketchAttachments?.[q.id] || '';
                const stepAnns = printableSheet.submission?.stepAnnotations?.[q.id] || [];
                const coordPins = stepAnns.filter(
                  (p): p is { stamp: string; x: number; y: number } =>
                    Boolean(p?.stamp) && typeof p?.x === 'number' && typeof p?.y === 'number'
                );
                const legacyStamps = stepAnns
                  .map((s) => s?.stamp)
                  .filter((s): s is string => Boolean(s));
                const answerLines = (subAns || printableSheet.submission?.generalResponse || '')
                  .split(/\r?\n/)
                  .filter((l) => l.trim().length > 0);
                return (
                  <div
                    key={q.id}
                    className="p-3 rounded-lg border border-slate-200 space-y-2 text-xs break-inside-avoid"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-900">
                        Q{idx + 1}. {q.prompt}
                      </p>
                      <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                        ({q.marks} {q.marks === 1 ? 'mark' : 'marks'})
                      </span>
                    </div>

                    {q.diagramUrl && (
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                        <img
                          src={q.diagramUrl}
                          alt={q.diagramCaption || `Question ${idx + 1} diagram`}
                          className="max-h-48 w-auto rounded border border-slate-200 bg-white object-contain"
                        />
                        {q.diagramCaption && (
                          <p className="text-[10px] font-medium text-slate-600">
                            {q.diagramCaption}
                          </p>
                        )}
                      </div>
                    )}

                    {q.type === 'mcq' && q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-3 text-slate-700">
                        {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                          <div key={opt}>
                            <strong>{opt}.</strong> {q.options?.[opt] || '—'}
                          </div>
                        ))}
                      </div>
                    )}


                    {printableSheet.mode === 'assignment' ? (
                      <div className="pt-1 space-y-1.5">
                        <p className="text-[11px] font-semibold text-slate-500">Learner Working / Answer:</p>
                        <div className="h-14 border-b border-dashed border-slate-400" />
                        <div className="h-6 border-b border-dashed border-slate-300" />
                      </div>
                    ) : (
                      <div className="pt-1 space-y-2">
                        {sketchUrl && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-slate-600">Learner Written Paper Work:</p>
                            <div className="relative inline-block max-w-full">
                              <img
                                src={sketchUrl}
                                alt={`Written work for Q${idx + 1}`}
                                className="max-h-60 w-auto rounded border border-slate-300 bg-white object-contain block"
                              />
                              {coordPins.map((p, pIdx) => (
                                <span
                                  key={`psketch-${q.id}-${pIdx}`}
                                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                                  className="-translate-x-1/2 -translate-y-1/2 absolute inline-flex items-center px-1.5 py-0.5 rounded font-sans text-xs font-black text-red-600 bg-red-50/95 border border-red-400"
                                >
                                  {p.stamp}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {coordPins.length > 0 ? (
                          <div className="relative p-2.5 rounded bg-slate-50 border border-slate-300 font-mono text-slate-900 whitespace-pre-wrap leading-relaxed">
                            {subAns || printableSheet.submission?.generalResponse || 'No written response recorded.'}
                            {!sketchUrl && coordPins.map((p, pIdx) => (
                              <span
                                key={`ptext-${q.id}-${pIdx}`}
                                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                                className="-translate-x-1/2 -translate-y-1/2 absolute inline-flex items-center px-1.5 py-0.5 rounded font-sans text-xs font-black text-red-600 bg-red-50/95 border border-red-400"
                              >
                                {p.stamp}
                              </span>
                            ))}
                          </div>
                        ) : answerLines.length > 0 ? (
                          <div className="rounded bg-slate-50 border border-slate-300 divide-y divide-slate-200 font-mono text-slate-900">
                            {answerLines.map((lineText, lIdx) => (
                              <div key={lIdx} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
                                <span className="whitespace-pre-wrap">{lineText}</span>
                                {legacyStamps[lIdx] && (
                                  <span className="font-sans text-xs font-black text-red-600 bg-red-50 border border-red-300 px-1.5 py-0.5 rounded shrink-0">
                                    {legacyStamps[lIdx]}
                                  </span>
                                )}
                              </div>
                            ))}
                            {legacyStamps.length > answerLines.length && (
                              <div className="px-2.5 py-1 text-[11px] font-sans font-bold text-red-600">
                                Additional Marks: {legacyStamps.slice(answerLines.length).join(' · ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-2.5 rounded bg-slate-50 border border-slate-300 font-mono text-slate-900 whitespace-pre-wrap">
                            No written response recorded.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Self-Submit Past Paper / Practice Work Modal */}
      {isSelfSubmitOpen && selectedArea && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {selectedArea} · {activeLearnerGrade || 'Learner Portal'}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Submit Past Paper or Practice Work for Marking
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSelfSubmitOpen(false)}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {selfSubmitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                  {selfSubmitError}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Past Paper / Exercise Title *
                  </label>
                  <input
                    type="text"
                    value={selfPaperTitle}
                    onChange={(e) => setSelfPaperTitle(e.target.value)}
                    placeholder="e.g., KPSEA 2025 Revision Paper 1 or Topic 4 Practice"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Notes / Instructions for Teacher (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={selfPaperNotes}
                    onChange={(e) => setSelfPaperNotes(e.target.value)}
                    placeholder="Add source of the past paper, any working notes, or questions you want feedback on..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Section 1: Upload Documents or Pictures (All Formats) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Upload Documents or Photos (All Formats)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Supports PDF, Word (.doc/.docx), PowerPoint (.ppt/.pptx), Excel (.xls/.xlsx), Text, and all Image formats (JPG, PNG, WEBP, HEIC, etc.).
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose Files / Photos</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.odt,.ods,.odp,.csv"
                      onChange={handleSelfFilesSelected}
                      className="hidden"
                    />
                  </label>
                </div>

                {selfAttachments.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {selfAttachments.map((att) => {
                      const isImg = att.mimeType.startsWith('image/');
                      return (
                        <div
                          key={att.id}
                          className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isImg ? (
                              <img
                                src={att.dataUrl}
                                alt={att.name}
                                className="w-9 h-9 rounded object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4 text-indigo-600" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{att.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {isImg ? 'Image' : 'Document'} · {(att.sizeBytes / 1024).toFixed(0)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSelfAttachments((prev) => prev.filter((item) => item.id !== att.id))
                            }
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: Type Questions & Fill Answers / Select Choices */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Or Type Questions &amp; Fill Your Answers
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Add Multiple Choice or Written questions from your paper. Every added question must be answered before submitting.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => addSelfQuestion('mcq')}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer"
                    >
                      + Multiple Choice
                    </button>
                    <button
                      type="button"
                      onClick={() => addSelfQuestion('text')}
                      className="px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                    >
                      + Written Question
                    </button>
                  </div>
                </div>

                {selfQuestions.length > 0 && (
                  <div className="space-y-3 pt-1">
                    {selfQuestions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-800">
                            Question {idx + 1} ({q.type === 'mcq' ? 'Multiple Choice' : 'Written / Calculation'})
                          </span>
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-semibold text-slate-600 flex items-center gap-1">
                              Marks:
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={q.marks}
                                onChange={(e) =>
                                  updateSelfQuestion(q.id, { marks: Math.max(1, Number(e.target.value) || 1) })
                                }
                                className="w-12 px-1.5 py-0.5 text-[11px] bg-white border border-slate-300 rounded"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => removeSelfQuestion(q.id)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                              title="Remove question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={2}
                          value={q.prompt}
                          onChange={(e) => updateSelfQuestion(q.id, { prompt: e.target.value })}
                          placeholder={`Type Question ${idx + 1} here...`}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />

                        {q.type === 'mcq' ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                                const isSelected = selfAnswers[q.id] === optKey;
                                return (
                                  <div
                                    key={optKey}
                                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${
                                      isSelected
                                        ? 'bg-indigo-50 border-indigo-500'
                                        : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelfAnswers((prev) => ({ ...prev, [q.id]: optKey }))
                                      }
                                      className={`w-6 h-6 rounded-md text-xs font-bold shrink-0 cursor-pointer ${
                                        isSelected
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                      }`}
                                      title={`Select ${optKey} as your answer`}
                                    >
                                      {optKey}
                                    </button>
                                    <input
                                      type="text"
                                      value={q.options?.[optKey] || ''}
                                      onChange={(e) =>
                                        updateSelfQuestion(q.id, {
                                          options: {
                                            A: q.options?.A || '',
                                            B: q.options?.B || '',
                                            C: q.options?.C || '',
                                            D: q.options?.D || '',
                                            [optKey]: e.target.value,
                                          },
                                        })
                                      }
                                      placeholder={`Option ${optKey}`}
                                      className="w-full text-xs bg-transparent focus:outline-none"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[11px] font-semibold text-indigo-700">
                              Selected Answer:{' '}
                              {selfAnswers[q.id]
                                ? `Option ${selfAnswers[q.id]}`
                                : 'Click A, B, C, or D button to select your answer *'}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                              Your Answer / Working *
                            </label>
                            <textarea
                              rows={2}
                              value={selfAnswers[q.id] || ''}
                              onChange={(e) =>
                                setSelfAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                              }
                              placeholder="Fill in your answer or step-by-step working here..."
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg font-mono"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSelfSubmitOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSelfSubmitting}
                onClick={handleConfirmSelfPaperSubmit}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSelfSubmitting ? 'Submitting...' : 'Submit to Teacher for Marking'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
