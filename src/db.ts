import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  initializeFirestore,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import type { Speaker } from './device';

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export type MessageKind = 'kimochi' | 'kaiketsu';

export type Session = {
  id: string;
  title: string;
  createdAt: Date | null;
};

export type Message = {
  id: string;
  text: string;
  kind: MessageKind;
  speakerId: string;
  speakerName: string;
  createdAt: Date | null;
};

const sessionsCol = collection(db, 'sessions');
const messagesCol = (sessionId: string) => collection(db, 'sessions', sessionId, 'messages');

const toDate = (value: unknown): Date | null =>
  value && typeof (value as Timestamp).toDate === 'function' ? (value as Timestamp).toDate() : null;

// 未送信の serverTimestamp 同士はクエリ順が保証されないため、推定時刻で並べ直す
const byTime = <T extends { createdAt: Date | null }>(a: T, b: T) =>
  (a.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER);

export function watchSessions(
  onChange: (sessions: Session[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(sessionsCol, orderBy('createdAt', 'desc')),
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          return { id: d.id, title: String(data.title ?? ''), createdAt: toDate(data.createdAt) };
        })
          .sort(byTime)
          .reverse(),
      );
    },
    onError,
  );
}

export function watchSession(
  sessionId: string,
  onChange: (session: Session | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'sessions', sessionId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const data = snap.data({ serverTimestamps: 'estimate' });
      onChange({ id: snap.id, title: String(data.title ?? ''), createdAt: toDate(data.createdAt) });
    },
    onError,
  );
}

// オフライン時も画面遷移できるよう、書き込み完了を待たずに ID を返す
export function createSession(
  title: string,
  speaker: Speaker,
): { id: string; written: Promise<void> } {
  const ref = doc(sessionsCol);
  const written = setDoc(ref, {
    title,
    createdAt: serverTimestamp(),
    createdBy: speaker.name,
  });
  return { id: ref.id, written };
}

export function watchMessages(
  sessionId: string,
  onChange: (messages: Message[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(messagesCol(sessionId), orderBy('createdAt', 'asc')),
    (snap) => {
      onChange(
        snap.docs.map((d): Message => {
          const data = d.data({ serverTimestamps: 'estimate' });
          return {
            id: d.id,
            text: String(data.text ?? ''),
            kind: data.kind === 'kaiketsu' ? 'kaiketsu' : 'kimochi',
            speakerId: String(data.speakerId ?? ''),
            speakerName: String(data.speakerName ?? ''),
            createdAt: toDate(data.createdAt),
          };
        })
          .sort(byTime),
      );
    },
    onError,
  );
}

export function sendMessage(
  sessionId: string,
  text: string,
  kind: MessageKind,
  speaker: Speaker,
): Promise<void> {
  return setDoc(doc(messagesCol(sessionId)), {
    text,
    kind,
    speakerId: speaker.id,
    speakerName: speaker.name,
    createdAt: serverTimestamp(),
  });
}
