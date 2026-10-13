const KEY = 'ohanashi.speaker';

export type Speaker = { id: string; name: string };

export function loadSpeaker(): Speaker | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Speaker>;
    if (typeof parsed.id === 'string' && typeof parsed.name === 'string') {
      return { id: parsed.id, name: parsed.name };
    }
  } catch {
    // 壊れた値は未登録として扱う
  }
  return null;
}

export function saveSpeaker(name: string): Speaker {
  const speaker = { id: crypto.randomUUID(), name };
  localStorage.setItem(KEY, JSON.stringify(speaker));
  return speaker;
}
