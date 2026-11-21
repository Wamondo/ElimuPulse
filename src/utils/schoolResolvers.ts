import { GradeLevel, SchoolProfile, TeacherRecord } from '../types';

const STALE_PLACEHOLDER_NAMES = new Set([
  'mr. marcus thorne',
  'dr. evelyn vance',
  'dr. evelyn vance, ph.d',
]);

export function isJuniorGrade(gradeName: string = ''): boolean {
  const g = gradeName.toLowerCase();
  return (
    g.includes('grade 7') ||
    g.includes('grade 8') ||
    g.includes('grade 9') ||
    g.includes('junior') ||
    g.includes('jss')
  );
}

export function resolveWingName(
  gradeName: string = '',
  schoolProfile?: Partial<SchoolProfile> | null
): string {
  const schoolName = schoolProfile?.name || 'School';
  if (isJuniorGrade(gradeName)) {
    return schoolProfile?.juniorWingName || `${schoolName} Junior School`;
  }
  return schoolProfile?.primaryWingName || `${schoolName} Primary School`;
}

/**
 * Resolves the authoritative Class Teacher name for a grade:
 * 1. Explicit classTeacherId on the GradeLevel record (most authoritative)
 * 2. TeacherRecord with teacherType === 'class_teacher' & assignedGrade === gradeName
 * 3. Any TeacherRecord with assignedGrade === gradeName
 * 4. Optional signature name if not a stale default placeholder
 * 5. Neutral 'Class Teacher'
 */
export function resolveClassTeacherForGrade(
  gradeName: string = '',
  grades: GradeLevel[] = [],
  teachers: TeacherRecord[] = [],
  schoolProfile?: Partial<SchoolProfile> | null
): string {
  const norm = gradeName.trim().toLowerCase();
  if (norm) {
    const gradeObj = grades.find((g) => g.name.trim().toLowerCase() === norm);
    if (gradeObj?.classTeacherId) {
      const assigned = teachers.find((t) => t.id === gradeObj.classTeacherId);
      if (assigned?.name) return assigned.name;
    }

    const byTypeAndGrade = teachers.find(
      (t) => t.teacherType === 'class_teacher' && (t.assignedGrade || '').trim().toLowerCase() === norm
    );
    if (byTypeAndGrade?.name) return byTypeAndGrade.name;

    const byGrade = teachers.find((t) => (t.assignedGrade || '').trim().toLowerCase() === norm);
    if (byGrade?.name) return byGrade.name;
  }

  const sigName = schoolProfile?.signatures?.['class_teacher']?.signatoryName;
  if (sigName && !STALE_PLACEHOLDER_NAMES.has(sigName.trim().toLowerCase())) {
    return sigName;
  }

  return 'Class Teacher';
}

/**
 * Resolves the authoritative Principal / Head of Institution name:
 * 1. schoolProfile.principalName
 * 2. schoolProfile.signatures.hoi.signatoryName
 * 3. Principal teacher record if present
 * 4. Neutral 'Head of Institution'
 */
export function resolvePrincipalName(
  schoolProfile?: Partial<SchoolProfile> | null,
  teachers: TeacherRecord[] = []
): string {
  const direct = (schoolProfile?.principalName || '').trim();
  if (direct && direct.toLowerCase() !== 'head of institution') {
    return direct;
  }

  const sigName = (schoolProfile?.signatures?.['hoi']?.signatoryName || '').trim();
  if (sigName && !STALE_PLACEHOLDER_NAMES.has(sigName.toLowerCase())) {
    return sigName;
  }

  const adminTeacher = teachers.find(
    (t) =>
      (t.department || '').toLowerCase().includes('principal') ||
      (t.department || '').toLowerCase().includes('head of')
  );
  if (adminTeacher?.name) return adminTeacher.name;

  if (direct) return direct;
  return 'Head of Institution';
}

/**
 * Resolves the live Subject Teacher name for a given subject & grade:
 * 1. Teacher assigned to this grade whose registeredSubjects matches
 * 2. Any teacher in the school whose registeredSubjects matches
 * 3. Stored fallback (if valid)
 */
export function resolveSubjectTeacherName(
  subjectName: string = '',
  gradeName: string = '',
  teachers: TeacherRecord[] = [],
  fallbackName?: string
): string {
  const subNorm = subjectName.trim().toLowerCase();
  const gradeNorm = gradeName.trim().toLowerCase();

  if (subNorm && teachers.length > 0) {
    const matchesSub = (t: TeacherRecord) =>
      (t.registeredSubjects || []).some((s) => {
        const sn = s.trim().toLowerCase();
        return sn === subNorm || sn.includes(subNorm) || subNorm.includes(sn);
      });

    if (gradeNorm) {
      const exactMatch = teachers.find(
        (t) => matchesSub(t) && (t.assignedGrade || '').trim().toLowerCase() === gradeNorm
      );
      if (exactMatch?.name) return exactMatch.name;
    }

    const schoolMatch = teachers.find(matchesSub);
    if (schoolMatch?.name) return schoolMatch.name;
  }

  if (fallbackName && fallbackName.trim()) {
    return fallbackName;
  }

  return 'Subject Teacher';
}

/**
 * Ensures institutional remarks dynamically reflect the active school / wing name
 * when seeded sample remarks or old school names remain on stored scorecards.
 */
export function sanitizeInstitutionalRemark(
  remark: string | undefined,
  schoolProfile?: Partial<SchoolProfile> | null,
  gradeName: string = ''
): string {
  const wing = resolveWingName(gradeName, schoolProfile);
  const schoolName = schoolProfile?.name || wing;

  if (!remark || !remark.trim()) {
    return `Commendable term of academic achievement and integrity. Keep advancing excellence at ${wing}.`;
  }

  if (!schoolName.toLowerCase().includes('mwivona') && remark.toLowerCase().includes('mwivona')) {
    return remark
      .replace(/Mwivona Comprehensive School/gi, schoolName)
      .replace(/Mwivona Junior School/gi, schoolProfile?.juniorWingName || `${schoolName} Junior School`)
      .replace(/Mwivona Primary School/gi, schoolProfile?.primaryWingName || `${schoolName} Primary School`)
      .replace(/Mwivona/gi, schoolName);
  }

  return remark;
}

// ==============================
// OFFICIAL INSTITUTIONAL & EXAMINATION COUNCIL SEALS
// ==============================

export const KNEC_SEAL_URL = '/assets/aistudio/images__1__dd9d8310.jpeg';
export const MWIVONA_COMPREHENSIVE_SEAL_URL = '/assets/aistudio/1794751849312_c5e1e795.jpg';
export const MWIVONA_PRIMARY_SEAL_URL = '/assets/aistudio/1794751724630_8e9b250c.jpg';
export const MWIVONA_JUNIOR_SEAL_URL = '/assets/aistudio/1794751630512_87c0fb85.jpg';

export function isMwivonaSchool(schoolProfile?: Partial<SchoolProfile> | null): boolean {
  if (!schoolProfile) return true;
  const name = (schoolProfile.name || '').toLowerCase();
  return schoolProfile.id === 'sch-001' || name.includes('mwivona');
}

/**
 * Resolves the umbrella/comprehensive institutional seal.
 * Honors custom uploaded/drawn seals first, then uses the official Mwivona Comprehensive seal
 * when Mwivona is the active school, and falls back cleanly for other institutions.
 */
export function resolveComprehensiveSeal(
  schoolProfile?: Partial<SchoolProfile> | null,
  fallbackUrl: string = ''
): string {
  const customSeal = schoolProfile?.signatures?.['seal'];
  if (customSeal?.signatureDataUrl && (customSeal.sourceType === 'upload' || customSeal.sourceType === 'draw')) {
    return customSeal.signatureDataUrl;
  }

  if (isMwivonaSchool(schoolProfile)) {
    return MWIVONA_COMPREHENSIVE_SEAL_URL;
  }

  return customSeal?.signatureDataUrl || fallbackUrl;
}

/**
 * Resolves the wing-specific official seal based on learner grade or wing name:
 * - Grades 7–9 / Junior / JSS -> Mwivona Junior Secondary School Seal
 * - Grades 1–6 / Primary -> Mwivona Primary School Seal
 * Falls back cleanly for non-Mwivona registered institutions.
 */
export function resolveWingSeal(
  gradeOrWing: string = '',
  schoolProfile?: Partial<SchoolProfile> | null,
  fallbackUrl: string = ''
): string {
  const customSeal = schoolProfile?.signatures?.['seal'];
  if (customSeal?.signatureDataUrl && (customSeal.sourceType === 'upload' || customSeal.sourceType === 'draw')) {
    return customSeal.signatureDataUrl;
  }

  if (isMwivonaSchool(schoolProfile)) {
    return isJuniorGrade(gradeOrWing) ? MWIVONA_JUNIOR_SEAL_URL : MWIVONA_PRIMARY_SEAL_URL;
  }

  return customSeal?.signatureDataUrl || fallbackUrl;
}

// ==============================
// IN-MEMORY BASE64 CACHE FOR JSPDF SEAL RENDERING
// ==============================

const sealDataUrlCache: Record<string, string> = {};
let sealsPreloadPromise: Promise<void> | null = null;

async function loadImageAsDataUrl(url: string): Promise<string> {
  if (sealDataUrlCache[url]) return sealDataUrlCache[url];
  if (typeof window === 'undefined') return '';

  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
    if (dataUrl) {
      sealDataUrlCache[url] = dataUrl;
    }
    return dataUrl;
  } catch {
    return '';
  }
}

export function preloadOfficialSeals(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!sealsPreloadPromise) {
    sealsPreloadPromise = Promise.all([
      loadImageAsDataUrl(KNEC_SEAL_URL),
      loadImageAsDataUrl(MWIVONA_COMPREHENSIVE_SEAL_URL),
      loadImageAsDataUrl(MWIVONA_PRIMARY_SEAL_URL),
      loadImageAsDataUrl(MWIVONA_JUNIOR_SEAL_URL),
    ]).then(() => undefined);
  }
  return sealsPreloadPromise;
}

export function getCachedSealDataUrl(urlOrDataUrl?: string | null): string | null {
  if (!urlOrDataUrl) return null;
  if (urlOrDataUrl.startsWith('data:image/')) return urlOrDataUrl;
  return sealDataUrlCache[urlOrDataUrl] || null;
}

// Trigger eager seal preloading on client boot so PDF exports render immediately
if (typeof window !== 'undefined') {
  preloadOfficialSeals();
}

