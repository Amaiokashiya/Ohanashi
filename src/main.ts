import './style.css';
import { loadSpeaker, saveSpeaker, type Speaker } from './device';
import {
  createSession,
  sendMessage,
  watchMessages,
  watchSession,
  watchSessions,
  type Message,
  type MessageKind,
  type Session,
} from './db';

const root = document.querySelector<HTMLDivElement>('#app')!;
let cleanup: (() => void) | null = null;

type Props = Record<string, string | boolean | EventListener>;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (typeof value === 'boolean') (el as unknown as Record<string, boolean>)[key] = value;
    else el.setAttribute(key, value);
  }
  el.append(...children);
  return el;
}

const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (d: Date) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

let toastTimer = 0;
function toast(message: string) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'alert' }, [message]);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 3000);
}

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}

function renderNameSetup(onDone: (speaker: Speaker) => void) {
  const input = h('input', {
    type: 'text',
    maxlength: '20',
    placeholder: 'なまえ',
    autocomplete: 'off',
  });
  const button = h('button', { type: 'submit', class: 'primary', disabled: true }, ['けってい']);
  input.addEventListener('input', () => {
    button.disabled = input.value.trim() === '';
  });
  const form = h(
    'form',
    {
      class: 'setup',
      onsubmit: (e: Event) => {
        e.preventDefault();
        const name = input.value.trim();
        if (name) onDone(saveSpeaker(name));
      },
    },
    [h('h1', {}, ['あなたのなまえは？']), input, button],
  );
  root.replaceChildren(form);
  input.focus();
}

function renderHome(speaker: Speaker) {
  const list = h('ul', { class: 'session-list' }, [h('li', { class: 'empty' }, ['よみこみちゅう…'])]);

  const input = h('input', {
    type: 'text',
    maxlength: '100',
    placeholder: 'どんなおはなし？',
    autocomplete: 'off',
  });
  const button = h('button', { type: 'submit', class: 'primary', disabled: true }, ['はじめる']);
  input.addEventListener('input', () => {
    button.disabled = input.value.trim() === '';
  });
  const form = h(
    'form',
    {
      class: 'composer new-session',
      onsubmit: (e: Event) => {
        e.preventDefault();
        const title = input.value.trim();
        if (!title) return;
        const { id, written } = createSession(title, speaker);
        written.catch(() => toast('おはなしを作れませんでした'));
        location.hash = `#/s/${id}`;
      },
    },
    [h('h2', {}, ['おはなしをはじめる']), h('div', { class: 'row' }, [input, button])],
  );

  root.replaceChildren(
    h('header', { class: 'bar' }, [h('h1', {}, ['おはなし']), h('span', { class: 'me' }, [speaker.name])]),
    h('main', { class: 'home' }, [h('h2', {}, ['今までのおはなし']), list]),
    form,
  );

  const renderList = (sessions: Session[]) => {
    if (sessions.length === 0) {
      list.replaceChildren(h('li', { class: 'empty' }, ['まだおはなしはありません']));
      return;
    }
    list.replaceChildren(
      ...sessions.map((s) =>
        h('li', {}, [
          h('a', { href: `#/s/${s.id}` }, [
            h('span', { class: 'title' }, [s.title]),
            h('span', { class: 'date' }, [s.createdAt ? formatDate(s.createdAt) : '']),
          ]),
        ]),
      ),
    );
  };

  cleanup = watchSessions(renderList, () => {
    list.replaceChildren(h('li', { class: 'empty' }, ['よみこめませんでした']));
  });
}

function renderSession(sessionId: string, speaker: Speaker) {
  const title = h('h1', {}, ['']);
  const list = h('ol', { class: 'messages' });
  const main = h('main', { class: 'talk' }, [list]);

  const textarea = h('textarea', { rows: '1', maxlength: '2000', placeholder: 'ことばを入力' });
  const kimochi = h('button', { type: 'button', class: 'send kimochi', disabled: true }, ['きもちのことば']);
  const kaiketsu = h('button', { type: 'button', class: 'send kaiketsu', disabled: true }, ['かいけつのことば']);

  const updateButtons = () => {
    const empty = textarea.value.trim() === '';
    kimochi.disabled = empty;
    kaiketsu.disabled = empty;
  };
  textarea.addEventListener('input', () => {
    autoGrow(textarea);
    updateButtons();
  });

  let stickToBottom = true;
  const scrollToBottom = () => {
    main.scrollTop = main.scrollHeight;
  };
  main.addEventListener('scroll', () => {
    stickToBottom = main.scrollHeight - main.scrollTop - main.clientHeight < 40;
  });

  const send = (kind: MessageKind) => {
    const text = textarea.value.trim();
    if (!text) return;
    textarea.value = '';
    autoGrow(textarea);
    updateButtons();
    stickToBottom = true;
    sendMessage(sessionId, text, kind, speaker).catch(() => toast('送れませんでした'));
  };
  kimochi.addEventListener('click', () => send('kimochi'));
  kaiketsu.addEventListener('click', () => send('kaiketsu'));

  root.replaceChildren(
    h('header', { class: 'bar' }, [
      h('a', { class: 'back', href: '#/', 'aria-label': 'もどる' }, ['‹']),
      title,
    ]),
    main,
    h('div', { class: 'composer talk-composer' }, [
      textarea,
      h('div', { class: 'actions' }, [kimochi, kaiketsu]),
    ]),
  );

  const stopSession = watchSession(
    sessionId,
    (s) => {
      title.textContent = s ? s.title : 'おはなしが見つかりません';
    },
    () => {},
  );

  const renderMessages = (messages: Message[]) => {
    const items: HTMLElement[] = [];
    let lastDay = '';
    for (const m of messages) {
      const day = m.createdAt ? formatDate(m.createdAt) : '';
      if (day && day !== lastDay) {
        items.push(h('li', { class: 'day' }, [day]));
        lastDay = day;
      }
      const mine = m.speakerId === speaker.id;
      items.push(
        h('li', { class: `msg ${mine ? 'mine' : 'theirs'} ${m.kind}` }, [
          mine ? '' : h('span', { class: 'name' }, [m.speakerName]),
          h('div', { class: 'line' }, [
            h('div', { class: 'bubble' }, [
              h('span', { class: 'kind' }, [m.kind === 'kimochi' ? 'きもち' : 'かいけつ']),
              h('p', {}, [m.text]),
            ]),
            h('time', {}, [m.createdAt ? formatTime(m.createdAt) : '']),
          ]),
        ]),
      );
    }
    if (items.length === 0) items.push(h('li', { class: 'empty' }, ['ことばを送ってみよう']));
    list.replaceChildren(...items);
    if (stickToBottom) scrollToBottom();
  };

  const stopMessages = watchMessages(sessionId, renderMessages, () => {
    list.replaceChildren(h('li', { class: 'empty' }, ['よみこめませんでした']));
  });
  cleanup = () => {
    stopSession();
    stopMessages();
  };
}

function route() {
  cleanup?.();
  cleanup = null;

  const speaker = loadSpeaker();
  if (!speaker) {
    renderNameSetup(route);
    return;
  }

  const match = location.hash.match(/^#\/s\/([A-Za-z0-9]+)$/);
  if (match) renderSession(match[1], speaker);
  else renderHome(speaker);
}

window.addEventListener('hashchange', route);
route();
