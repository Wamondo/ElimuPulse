import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  LearningAreaAssignmentItem,
  LearnerAssignmentSubmission,
  loadLocalAssignments,
  saveAssignments,
  subscribeAssignments,
  calculateAssignmentTotalMarks,
  calculateAutoScore,
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
    const configured = Array.isArray(subjects)
      ? subjects
          .map((s: Record<string, unknown>) =>
            String(s.name || s.title || s.subjectName || '').trim()
          )
          .filter(Boolean)
      : [];
    const fromAssignments = teacherAssignments
      .map((a) => a.learningArea.trim())
      .filter(Boolean);
    const merged = Array.from(new Set([...configured, ...fromAssignments]));
    return merged.length > 0 ? merged : DEFAULT_CBC_LEARNING_AREAS;
  }, [subjects, teacherAssignments]);

  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, Record<string, string>>>({});
  const [draftGeneralResponses, setDraftGeneralResponses] = useState<Record<string, string>>({});
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
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

  const handleSubmitAssignment = (assignment: LearningAreaAssignmentItem) => {
    const answers = draftAnswers[assignment.id] || {};
    const generalResponse = (draftGeneralResponses[assignment.id] || '').trim();
    const questions = assignment.questions || [];
    const totalMarks = assignment.totalMarks || calculateAssignmentTotalMarks(questions);
    const autoScore = calculateAutoScore(questions, answers);

    const submission: LearnerAssignmentSubmission = {
      learnerId: activeLearnerId,
      learnerName: activeLearnerName,
      studentId: activeStudentId,
      grade: activeLearnerGrade || assignment.grade,
      answers,
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
    saveAssignments(nextList);
    setActiveAssignmentId(null);
    setSubmitNotice(
      `Submitted "${assignment.title}" directly to ${assignment.teacherName}. Once marked, it will appear in your Marked Assignments below.`
    );
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
                                      <textarea
                                        rows={3}
                                        value={currentAnswers[q.id] || ''}
                                        onChange={(e) =>
                                          handleAnswerChange(assignment.id, q.id, e.target.value)
                                        }
                                        placeholder="Type your answer or working directly here..."
                                        className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-indigo-500 focus:outline-none"
                                      />
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
                              </div>
                            )}

                            <div className="flex justify-end">
                              <button
                                type="button"
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
                              return (
                                <div
                                  key={q.id}
                                  className="p-2 bg-white border border-emerald-100 rounded text-[11px]"
                                >
                                  <p className="font-bold text-slate-800">
                                    {idx + 1}. {q.prompt} ({q.marks} mks)
                                  </p>
                                  <p className="text-slate-700 mt-0.5">
                                    Your Answer: <strong>{ans}</strong>
                                    {q.type === 'mcq' && (
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
                                    )}
                                  </p>
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
