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
  diagramUrl?: string;
  diagramCaption?: string;
  marks: number;
}

export type RedInkStamp = '✓' | '✓✓' | '✗' | 'M1' | 'M2' | 'M3' | 'M0' | 'A1' | 'A2' | 'A3' | 'A0' | 'B1' | 'B2' | 'B3' | 'B0' | 'C1' | 'S1' | 'P1' | 'L1' | 'CAO' | 'FT' | 'BOD' | '^';

export interface CalculationStepAnnotation {
  stamp?: RedInkStamp;
  mistakeNote?: string;
}

export interface SubmissionFileAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export interface LearnerAssignmentSubmission {
  learnerId: string;
  learnerName: string;
  studentId: string;
  grade: string;
  answers: Record<string, string>;
  sketchAttachments?: Record<string, string>;
  attachments?: SubmissionFileAttachment[];
  stepAnnotations?: Record<string, CalculationStepAnnotation[]>;
  generalResponse?: string;
  autoScore: number;
  totalMarks: number;
  awardedScore?: string;
  teacherFeedback?: string;
  status: 'submitted' | 'marked';
  submittedAt: string;
  markedAt?: string;
}

export function formatCalculationSteps(rawAnswer: string): string[] {
  const cleaned = String(rawAnswer || '').trim();
  if (!cleaned || cleaned === 'No answer provided' || cleaned === '—') return [];

  const initialLines = cleaned
    .split(/[\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const steps: string[] = [];
  for (const line of initialLines) {
    if ((line.match(/=/g) || []).length >= 2) {
      const eqParts = line.split(/\s*=\s*/).map((p) => p.trim()).filter(Boolean);
      eqParts.forEach((part, idx) => {
        steps.push(idx === 0 ? part : `= ${part}`);
      });
    } else {
      steps.push(line);
    }
  }
  return steps;
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
  attachments?: SubmissionFileAttachment[];
  submissions?: Record<string, LearnerAssignmentSubmission>;
  isSelfSubmitted?: boolean;
  submittedByLearnerId?: string;
  submittedByLearnerName?: string;
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


export async function compressImageDataUrl(
  dataUrl: string,
  maxDimension = 960,
  quality = 0.72
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.startsWith('data:image/svg+xml')) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (!width || !height) {
          resolve(dataUrl);
          return;
        }
        if (width > maxDimension || height > maxDimension) {
          const scale = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function saveAssignmentsAsync(
  nextList: LearningAreaAssignmentItem[]
): Promise<{ synced: boolean; error?: string }> {
  const safeList = Array.isArray(nextList) ? nextList.filter((item) => item && item.id) : [];
  try {
    if (safeList.length > 0) {
      localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(safeList));
    }
    window.dispatchEvent(new Event('elimupulse-assignments-updated'));
  } catch {
    // ignore storage quota errors; cloud sync still runs
  }

  try {
    const writes: Promise<void>[] = [];
    for (const item of safeList) {
      const cleanItem = sanitizeForFirebase(item);
      writes.push(
        set(ref(rtdb, `${RTDB_ASSIGNMENTS_PATH}/${encodeURIComponent(item.id)}`), cleanItem)
      );
    }
    await Promise.all(writes);
    return { synced: true };
  } catch (err) {
    return {
      synced: false,
      error: err instanceof Error ? err.message : 'Network or permission error during cloud sync.',
    };
  }
}

export async function saveLearnerSubmissionAsync(
  assignmentId: string,
  submission: LearnerAssignmentSubmission
): Promise<{ synced: boolean; error?: string }> {
  try {
    const cleanSub = sanitizeForFirebase(submission);
    await set(
      ref(
        rtdb,
        `${RTDB_ASSIGNMENTS_PATH}/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submission.learnerId)}`
      ),
      cleanSub
    );
    return { synced: true };
  } catch (err) {
    return {
      synced: false,
      error: err instanceof Error ? err.message : "Network or permission error while submitting.",
    };
  }
}

export function exportAssignmentsBackupJson(items: LearningAreaAssignmentItem[]): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'ElimuPulse',
    count: items.length,
    assignments: items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `elimupulse-assignments-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function saveAssignments(nextList: LearningAreaAssignmentItem[]): void {
  const safeList = Array.isArray(nextList) ? nextList.filter((item) => item && item.id) : [];
  try {
    if (safeList.length > 0) {
      localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(safeList));
    }
    window.dispatchEvent(new Event('elimupulse-assignments-updated'));
  } catch {
    // ignore storage errors
  }

  // Write each assignment under its own ID path so saving/submitting one item never overwrites others
  for (const item of safeList) {
    try {
      const cleanItem = sanitizeForFirebase(item);
      set(ref(rtdb, `${RTDB_ASSIGNMENTS_PATH}/${encodeURIComponent(item.id)}`), cleanItem).catch(() => {});
      if (item.submissions && typeof item.submissions === 'object') {
        for (const [learnerId, sub] of Object.entries(item.submissions)) {
          if (sub && learnerId) {
            set(
              ref(
                rtdb,
                `${RTDB_ASSIGNMENTS_PATH}/${encodeURIComponent(item.id)}/submissions/${encodeURIComponent(learnerId)}`
              ),
              sanitizeForFirebase(sub)
            ).catch(() => {});
          }
        }
      }
    } catch {
      // ignore offline sync errors
    }
  }
}

export function subscribeAssignments(
  onUpdate: (items: LearningAreaAssignmentItem[]) => void
): () => void {
  const mergeWithLocal = (incoming: LearningAreaAssignmentItem[]): LearningAreaAssignmentItem[] => {
    const existing = loadLocalAssignments();
    const byId = new Map<string, LearningAreaAssignmentItem>();
    for (const item of existing) {
      if (item && item.id) byId.set(item.id, item);
    }
    for (const item of incoming) {
      if (!item || !item.id) continue;
      const prev = byId.get(item.id);
      byId.set(item.id, {
        ...prev,
        ...item,
        submissions: {
          ...(prev?.submissions || {}),
          ...(item.submissions || {}),
        },
      });
    }
    return Array.from(byId.values());
  };

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
        let rawList: LearningAreaAssignmentItem[] = [];
        if (Array.isArray(val)) {
          rawList = val.filter(Boolean);
        } else if (val && typeof val === 'object') {
          rawList = Object.values(val).filter(Boolean) as LearningAreaAssignmentItem[];
        }
        if (rawList.length > 0) {
          const merged = mergeWithLocal(rawList);
          try {
            localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // ignore
          }
          onUpdate(merged);
        } else {
          const localList = loadLocalAssignments();
          if (localList.length > 0) {
            onUpdate(localList);
          }
        }
      },
      () => {
        onUpdate(loadLocalAssignments());
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
