import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  LearningAreaAssignmentItem,
  LearnerAssignmentSubmission,
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

  const getAssignmentsForArea = (area: string) => {
    const learnerGradeKey = activeLearnerGrade.toLowerCase();
    const areaKey = area.trim().toLowerCase();

    const matched = teacherAssignments.filter((item) => {
      const itemArea = item.learningArea.trim().toLowerCase();
      const areaMatch =
        itemArea === areaKey || itemArea.includes(areaKey) || areaKey.includes(itemArea);
      if (!areaMatch) return false;
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
                <span className="text-[11px] text-slate-500">
                  Answer directly on screen — no printing needed
                </span>
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

                          <button
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
                          </button>
                        </div>

                        {isOpen && (
                          <div className="pt-3 border-t border-amber-200/80 space-y-3">
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
                                      <div className="space-y-1.5">
                                        <textarea
                                          rows={3}
                                          value={currentAnswers[q.id] || ''}
                                          onChange={(e) =>
                                            handleAnswerChange(assignment.id, q.id, e.target.value)
                                          }
                                          placeholder="Write each calculation step on a new line:
Formula: V = l x w x h
Substitution: = 6 x 6 x 6
Working: = 36 x 6
Answer: = 216 cm³"
                                          className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-indigo-500 focus:outline-none"
                                        />
                                        <div className="flex flex-wrap items-center gap-1">
                                          <span className="text-[10px] font-semibold text-slate-500 mr-1">Insert Symbol:</span>
                                          {['+', '−', '×', '÷', '±', '=', '≠', '≈', '<', '>', '≤', '≥', '²', '³', '√', '∛', 'π', '°', '∠', '⊥', '∥', '△', '○', 'cm', 'm', 'cm²', 'm²', 'cm³', 'm³', '½', '⅓', '¼', '¾', '∞', '→', '∴', 'Δ', '∑', '∫', '∈', '∪', '∩'].map((sym) => (
                                            <button
                                              key={sym}
                                              type="button"
                                              onClick={() =>
                                                handleAnswerChange(
                                                  assignment.id,
                                                  q.id,
                                                  `${currentAnswers[q.id] || ''}${sym}`
                                                )
                                              }
                                              className="px-1.5 py-0.5 text-[11px] font-semibold bg-slate-50 hover:bg-indigo-50 text-slate-800 border border-slate-300 rounded cursor-pointer"
                                            >
                                              {sym}
                                            </button>
                                          ))}
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
                            {submission && questions.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedMarkedId(isExpanded ? null : assignment.id)
                                }
                                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-md cursor-pointer"
                              >
                                {isExpanded ? 'Hide Script' : 'View Marked Script'}
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && submission && questions.length > 0 && (
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
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
