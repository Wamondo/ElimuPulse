import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getDocs,
  collection,
  setDoc,
  deleteDoc,
  writeBatch,
  DocumentData,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);

export const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || '(default)';
export const firebaseProjectId = firebaseConfig.projectId;

// Initialize Firestore with auto-detected long polling + persistent local cache for resilience
function createResilientFirestore(): Firestore {
  const customDbId =
    firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? firebaseConfig.firestoreDatabaseId
      : undefined;

  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      customDbId
    );
  } catch {
    // Already initialized (e.g., module re-evaluated) — reuse existing instance
    return customDbId ? getFirestore(app, customDbId) : getFirestore(app);
  }
}

export const db: Firestore = createResilientFirestore();

// Mandatory Error Handling per Firestore Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isFirestoreOfflineError(error: unknown): boolean {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as any).code) : '';
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    code === 'unavailable' ||
    msg.includes('client is offline') ||
    msg.includes('failed to get document because the client is offline') ||
    msg.includes('network error') ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Check connection to Firestore (CRITICAL per Skill Step 2.1)
export async function testFirestoreConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (isFirestoreOfflineError(error)) {
      console.warn('Firestore offline or connecting...');
      return false;
    }
    // Any other response means we contacted the Firestore server
    return true;
  }
}

/**
 * Recursively removes all `undefined` values from an object or array.
 * Firestore strictly rejects `undefined` values in setDoc, updateDoc, and batch writes.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    // Preserve instances like Date
    if (data instanceof Date) return data;
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizeForFirestore(value);
      }
    }
    return cleanObj as T;
  }
  return data;
}

// Save or update a single document in Firestore
export async function saveDocumentToFirestore<T extends { id: string }>(
  collectionName: string,
  data: T
): Promise<void> {
  const path = `${collectionName}/${data.id}`;
  try {
    const docRef = doc(db, collectionName, data.id);
    const sanitizedData = sanitizeForFirestore(data);
    await setDoc(docRef, sanitizedData as DocumentData, { merge: true });
  } catch (err) {
    if (isFirestoreOfflineError(err)) {
      console.warn(`Firestore offline while saving ${path}; retained in local cache.`);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Fetch a single document from Firestore (with offline cache fallback)
export async function fetchDocumentFromFirestore<T>(
  collectionName: string,
  id: string
): Promise<T | null> {
  const path = `${collectionName}/${id}`;
  const docRef = doc(db, collectionName, id);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try {
      const cachedSnap = await getDocFromCache(docRef);
      return cachedSnap.exists() ? (cachedSnap.data() as T) : null;
    } catch {
      return null;
    }
  }

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as T;
    }
    return null;
  } catch (err) {
    if (isFirestoreOfflineError(err)) {
      try {
        const cachedSnap = await getDocFromCache(docRef);
        if (cachedSnap.exists()) return cachedSnap.data() as T;
      } catch {
        /* ignore cache miss */
      }
      console.warn(`Firestore offline while fetching ${path}; falling back to local cache.`);
      return null;
    }
    handleFirestoreError(err, OperationType.GET, path);
  }
}

// Fetch all documents in a collection
export async function fetchCollectionFromFirestore<T>(
  collectionName: string
): Promise<T[]> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return [];
  }
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const items: T[] = [];
    querySnapshot.forEach((docSnap) => {
      items.push(docSnap.data() as T);
    });
    return items;
  } catch (err) {
    if (isFirestoreOfflineError(err)) {
      console.warn(`Firestore offline while listing ${collectionName}; using local storage.`);
      return [];
    }
    handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}

// Fetch all documents in a collection with explicit ok status (distinguishes genuine empty collection from offline/error)
export async function fetchCollectionSafe<T>(
  collectionName: string
): Promise<{ ok: boolean; items: T[] }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, items: [] };
  }
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const items: T[] = [];
    querySnapshot.forEach((docSnap) => {
      items.push(docSnap.data() as T);
    });
    return { ok: true, items };
  } catch (err) {
    console.warn(`Firestore list failed for ${collectionName}:`, err);
    return { ok: false, items: [] };
  }
}

// Bulk initialize or sync items to Firestore in batches
export async function batchSyncToFirestore<T extends { id: string }>(
  collectionName: string,
  items: T[]
): Promise<void> {
  if (!items || items.length === 0) return;
  try {
    const batch = writeBatch(db);
    items.forEach((item) => {
      const docRef = doc(db, collectionName, item.id);
      const sanitized = sanitizeForFirestore(item);
      batch.set(docRef, sanitized as DocumentData, { merge: true });
    });
    await batch.commit();
  } catch (err) {
    if (isFirestoreOfflineError(err)) {
      console.warn(`Firestore offline during batch sync of ${collectionName}.`);
      return;
    }
    handleFirestoreError(err, OperationType.WRITE, collectionName);
  }
}

// Delete a single document in Firestore
export async function deleteDocumentFromFirestore(
  collectionName: string,
  id: string
): Promise<void> {
  const path = `${collectionName}/${id}`;
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (err) {
    if (isFirestoreOfflineError(err)) {
      console.warn(`Firestore offline while deleting ${path}.`);
      return;
    }
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
