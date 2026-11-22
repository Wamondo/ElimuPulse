import { ref, onValue, set } from 'firebase/database';
import { rtdb } from './firebase';

export type AssignmentQuestionType = 'mcq' | 'text';

export interface AssignmentQuestion {
  id: string;
  prompt: string;
  type: AssignmentQuestionType;
  options?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctOption?: 'A' | 'B' | 'C' | 'D';
  marks: number;
}

export interface LearnerAssignmentSubmission {
  learnerId: string;
  learnerName: string;
  studentId: string;
  grade: string;
  answers: Record<string, string>;
  generalResponse?: string;
  autoScore: number;
  totalMarks: number;
  awardedScore?: string;
  teacherFeedback?: string;
  status: 'submitted' | 'marked';
  submittedAt: string;
  markedAt?: string;
}

export interface LearningAreaAssignmentItem {
  id: string;
  learningArea: string;
  grade: string;
  title: string;
  instructions: string;
  dueDate: string;
  teacherId?: string;
  teacherName: string;
  status: 'todo' | 'marked';
  score?: string;
  feedback?: string;
  questions?: AssignmentQuestion[];
  totalMarks?: number;
  submissions?: Record<string, LearnerAssignmentSubmission>;
  createdAt: string;
}

export const ASSIGNMENTS_STORAGE_KEY = 'elimupulse_learning_area_assignments';
const RTDB_ASSIGNMENTS_PATH = 'elimupulse/learningAreaAssignments';

function sanitizeForFirebase<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function loadLocalAssignments(): LearningAreaAssignmentItem[] {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAssignments(nextList: LearningAreaAssignmentItem[]): void {
  try {
    localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(nextList));
    window.dispatchEvent(new Event('elimupulse-assignments-updated'));
  } catch {
    // ignore storage errors
  }
  try {
    set(ref(rtdb, RTDB_ASSIGNMENTS_PATH), sanitizeForFirebase(nextList)).catch(() => {});
  } catch {
    // ignore offline sync errors
  }
}

export function subscribeAssignments(
  onUpdate: (items: LearningAreaAssignmentItem[]) => void
): () => void {
  const localHandler = () => {
    onUpdate(loadLocalAssignments());
  };
  window.addEventListener('storage', localHandler);
  window.addEventListener('elimupulse-assignments-updated', localHandler);

  let unsubRtdb: (() => void) | null = null;
  try {
    const dbRef = ref(rtdb, RTDB_ASSIGNMENTS_PATH);
    unsubRtdb = onValue(
      dbRef,
      (snapshot) => {
        const val = snapshot.val();
        if (Array.isArray(val)) {
          try {
            localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(val));
          } catch {
            // ignore
          }
          onUpdate(val);
        } else if (val && typeof val === 'object') {
          const list = Object.values(val) as LearningAreaAssignmentItem[];
          try {
            localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(list));
          } catch {
            // ignore
          }
          onUpdate(list);
        }
      },
      () => {
        // fallback to local
      }
    );
  } catch {
    // ignore
  }

  return () => {
    window.removeEventListener('storage', localHandler);
    window.removeEventListener('elimupulse-assignments-updated', localHandler);
    if (unsubRtdb) unsubRtdb();
  };
}

export function calculateAssignmentTotalMarks(questions?: AssignmentQuestion[]): number {
  if (!questions || questions.length === 0) return 20;
  const sum = questions.reduce((acc, q) => acc + (Number(q.marks) || 0), 0);
  return sum > 0 ? sum : questions.length * 2;
}

export function calculateAutoScore(
  questions: AssignmentQuestion[] | undefined,
  answers: Record<string, string>
): number {
  if (!questions || questions.length === 0) return 0;
  return questions.reduce((acc, q) => {
    if (q.type === 'mcq' && q.correctOption && answers[q.id] === q.correctOption) {
      return acc + (Number(q.marks) || 0);
    }
    return acc;
  }, 0);
}
