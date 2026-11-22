import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, CheckCircle2, Clock, LogOut, ChevronRight, ArrowLeft } from 'lucide-react';

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
    () => learners.find((l) => l.id === currentUser?.learnerId || l.studentId === currentUser?.idNumber),
    [learners, currentUser]
  );

  const learningAreas = useMemo(() => {
    const configured = Array.isArray(subjects)
      ? subjects
          .map((s: Record<string, unknown>) => String(s.name || s.title || s.subjectName || '').trim())
          .filter(Boolean)
      : [];
    return configured.length > 0 ? Array.from(new Set(configured)) : DEFAULT_CBC_LEARNING_AREAS;
  }, [subjects]);

  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Record<string, boolean>>({});

  const getAssignmentsForArea = (area: string) => {
    const toDo = [
      {
        id: `${area}-todo-1`,
        title: `${area} — Structured Competency Task 1`,
        dueDate: 'Due This Week',
        instructions: `Complete the practice exercises and competency reflection for ${area}.`,
      },
      {
        id: `${area}-todo-2`,
        title: `${area} — Strand Review & Problem Set`,
        dueDate: 'Due Next Lesson',
        instructions: `Review key concepts in ${area} and submit your responses.`,
      },
    ];

    const marked = [
      {
        id: `${area}-marked-1`,
        title: `${area} — Continuous Assessment 1`,
        score: 'EE1 (88%)',
        feedback: 'Strong mastery of core concepts and neat presentation.',
      },
      {
        id: `${area}-marked-2`,
        title: `${area} — Practical / Activity Check`,
        score: 'ME2 (76%)',
        feedback: 'Good effort; verify steps on multi-part questions.',
      },
    ];

    return {
      toDo: toDo.filter((item) => !completedIds[item.id]),
      marked,
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Learner Portal · Learning Areas
          </p>
          <h1 className="text-base font-bold text-slate-900">
            {learnerRecord ? `${learnerRecord.firstName} ${learnerRecord.lastName}` : currentUser?.name || 'Learner'}
            {learnerRecord?.grade ? ` · ${learnerRecord.grade}` : ''}
          </h1>
          <p className="text-xs text-slate-500">
            Student No: {learnerRecord?.studentId || currentUser?.idNumber || '—'}
          </p>
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
                Select a learning area to view assignments to be done and marked assignments.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {learningAreas.map((area) => {
                const { toDo, marked } = getAssignmentsForArea(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setSelectedArea(area)}
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
                onClick={() => setSelectedArea(null)}
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

            {/* Assignments to be done */}
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Assignments to Be Done</h3>
              </div>

              {getAssignmentsForArea(selectedArea).toDo.length === 0 ? (
                <p className="text-xs text-slate-500">All pending assignments in {selectedArea} are marked done.</p>
              ) : (
                <div className="space-y-2.5">
                  {getAssignmentsForArea(selectedArea).toDo.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">{task.title}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{task.instructions}</p>
                        <p className="text-[10px] font-semibold text-amber-800 mt-1">{task.dueDate}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCompletedIds((prev) => ({ ...prev, [task.id]: true }))}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shrink-0 cursor-pointer"
                      >
                        Mark Done
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Assignments marked */}
            <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Assignments Marked</h3>
              </div>

              <div className="space-y-2.5">
                {getAssignmentsForArea(selectedArea).marked.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">{item.title}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">{item.feedback}</p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 rounded-md shrink-0">
                      {item.score}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
