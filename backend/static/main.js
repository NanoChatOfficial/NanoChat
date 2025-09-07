function scrollMessagesToBottom(container, smooth = false) {
  if (!container) return;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        if (typeof container.scrollTo === 'function') {
          container.scrollTo({ top: container.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
        } else {
          container.scrollTop = container.scrollHeight;
        }
      } catch (e) {

        container.scrollTop = container.scrollHeight;
      }
    });
  });
}

function bufferToHex(buffer) {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuffer(hex) {
  if (typeof hex !== 'string') throw new TypeError('hex must be a string');

  let cleaned;
  try {
    cleaned = hex.trim().replace(/^0x/i, '');
  } catch (e) {
    throw new TypeError('hex must be a string');
  }
  if (cleaned.length === 0) return new ArrayBuffer(0);
  if (cleaned.length % 2 !== 0) throw new Error('hex string length must be even');
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) throw new Error('hex string contains non-hex characters');

  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const pair = cleaned.substr(i * 2, 2);
    const val = parseInt(pair, 16);
    if (Number.isNaN(val)) throw new Error('Invalid hex byte: ' + pair);
    bytes[i] = val & 0xff;
  }
  return bytes.buffer;
}

const dompurifyConfig = {
  ALLOWED_TAGS: ['b','i','em','strong','p','br','ul','ol','li','a'],
  ALLOWED_ATTR: ['href','title','target'],
  ALLOWED_URI_REGEXP: /^(https?:\/\/|\/)/i
};

function sanitizeUsername(name) {
  const raw = String(name || '');
  const sanitized = DOMPurify.sanitize(raw, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

  const tmp = document.createElement('div');
  tmp.innerHTML = sanitized;
  let text = (tmp.textContent || '').trim();
  if (!text) return 'Anonymous';

  if (text.length > 64) text = text.slice(0, 64);
  return text;
}

function sanitizeContent(html) {
  const s = DOMPurify.sanitize(String(html || ''), dompurifyConfig);
  if (s.length > 10000) return s.slice(0, 10000);
  return s;
}

function enforceSafeAnchors(container) {
  if (!container || !container.querySelectorAll) return;
  const anchors = container.querySelectorAll('a[href]');
  anchors.forEach(a => {
    try {
      const href = a.getAttribute('href') || '';
      if (!/^(https?:\/\/|\/)/i.test(href)) {
        a.removeAttribute('href');
      } else {
        if (a.getAttribute('target') === '_blank') {
          const existing = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
          const tokens = new Set(existing);
          tokens.add('noopener');
          tokens.add('noreferrer');
          a.setAttribute('rel', Array.from(tokens).join(' '));
        } else {
          a.removeAttribute('target');
        }
      }
    } catch (e) {
      a.removeAttribute('href');
      a.removeAttribute('target');
      a.removeAttribute('rel');
    }
  });
}

async function getKeyFromUrl() {
  let keyHex = '';
  try {
    keyHex = decodeURIComponent((window.location.hash || '').substring(1) || '');
  } catch (e) {
    console.warn('getKeyFromUrl: failed to decode hash', e);
    return null;
  }
  if (!keyHex) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) return null;
  try {
    const raw = hexToBuffer(keyHex);
    return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
  } catch (e) {
    console.error('getKeyFromUrl: import failed', e);
    return null;
  }
}

async function generateAndStoreKey() {
  const key = await crypto.subtle.generateKey({ name:'AES-GCM', length:256 }, true, ['encrypt','decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  window.location.hash = bufferToHex(raw);
  return key;
}

async function encryptText(text, key) {
  const data = new TextEncoder().encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, data);
  return { cipher: bufferToHex(cipher), iv: bufferToHex(iv) };
}

async function decryptText(cipherHex, ivHex, key) {
  try {
    if (typeof cipherHex !== 'string' || typeof ivHex !== 'string') {
      throw new TypeError('cipherHex and ivHex must be strings');
    }

    const dataBuf = hexToBuffer(cipherHex);
    const ivBuf = hexToBuffer(ivHex);
    const dataView = new Uint8Array(dataBuf);
    const ivView = new Uint8Array(ivBuf);

    if (ivView.length !== 12) {
      throw new Error(`Invalid IV length: ${ivView.length} (expected 12)`);
    }

    if (dataView.length < 16) {
      console.warn('decryptText: ciphertext shorter than expected (length)', dataView.length);
    }

    if (window.__CHAT_DEBUG__) {
      const sample = (u8) => {
        const head = Array.from(u8.slice(0, Math.min(6, u8.length))).map(b => b.toString(16).padStart(2,'0')).join('');
        return `${head}${u8.length > 6 ? '...' : ''} (len=${u8.length})`;
      };
      console.debug('decryptText debug — iv:', sample(ivView), 'cipher:', sample(dataView));
    }

    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv: ivView }, key, dataBuf);
    return new TextDecoder().decode(plain);
  } catch (e) {
    if (e instanceof DOMException) {
    } else {
      console.warn('decryptText error:', e);
    }
    throw e;
  }
}

function getRoomFromUrl() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  let room = parts[parts.length - 1] || '';

  if (/^[0-9a-f]{16}$/i.test(room)) {
    localStorage.setItem('room', room.toLowerCase());
    return room.toLowerCase();
  }
  const stored = localStorage.getItem('room');
  if (stored && /^[0-9a-f]{16}$/i.test(stored)) {
    history.replaceState(null, '', `/room/${stored}${window.location.hash}`);
    return stored.toLowerCase();
  }
  const rnd = crypto.getRandomValues(new Uint8Array(8));
  const id = Array.from(rnd).map(b => b.toString(16).padStart(2,'0')).join('');
  localStorage.setItem('room', id);
  history.pushState(null, '', `/room/${id}${window.location.hash}`);
  return id;
}

function setupNickname() {
  let nickname = localStorage.getItem("nickname");
  if (!nickname) {
    const raw = prompt("Enter your nickname:") || "Anonymous";
    nickname = sanitizeUsername(raw);
    localStorage.setItem("nickname", nickname);
  } else {
    nickname = sanitizeUsername(nickname);
    localStorage.setItem("nickname", nickname);
  }
  const el = document.getElementById("user");
  if (el) el.value = nickname;
}

function getMessageFingerprint(message) {
  const user = String(message.user || '').trim();
  const content = String(message.content || '').replace(/\s+/g,' ').trim();
  return `${user}::${content}`;
}

function getMessageId(message) {
  const user = String(message.user || '');
  const content = String(message.content || '');
  const timestamp = String(message.timestamp || '');
  return `${user}_${content}_${timestamp}`;
}

function createMessageElement(message) {
  const userSafe = sanitizeUsername(message.user);
  const contentSafe = sanitizeContent(message.content);
  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleString()
    : "";

  const wrapper = document.createElement('div');
  wrapper.className = 'message';
  if (message.pending) wrapper.classList.add('pending');

  const inner = document.createElement('div');
  inner.className = 'message-content';

  const strong = document.createElement('strong');
  strong.textContent = userSafe;

  const p = document.createElement('p');
  p.innerHTML = contentSafe;
  enforceSafeAnchors(p);

  const small = document.createElement('small');
  small.textContent = timeStr;
  small.className = 'msg-timestamp';

  inner.appendChild(strong);
  inner.appendChild(p);
  inner.appendChild(small);
  wrapper.appendChild(inner);
  return wrapper;
}

function updateExistingMessageElement(existingEl, { user, content, timestamp }) {
  existingEl.classList.remove('pending', 'failed');
  const inner = existingEl.querySelector('.message-content');
  if (!inner) return;
  const strong = inner.querySelector('strong');
  if (strong) strong.textContent = sanitizeUsername(user);
  const p = inner.querySelector('p');
  if (p) {
    p.innerHTML = sanitizeContent(content);
    enforceSafeAnchors(p);
  }
  const small = inner.querySelector('.msg-timestamp');
  if (small && timestamp) {
    small.textContent = new Date(timestamp).toLocaleString();
  }
}

let ROOM = null;
let KEY = null;
let lastSentMessage = null;
let LAST_SEEN_ID = 0;
let lastNotifiedAt = 0;
const notifiedIds = new Set();

function isUserNearBottom(container, threshold = 50) {
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("Notifications API not supported by this browser.");
    return Promise.resolve("unsupported");
  }
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    console.log("Notification permission:", Notification.permission);
    return Promise.resolve(Notification.permission);
  }
  return Notification.requestPermission().then(permission => {
    console.log("Notification.requestPermission ->", permission);
    return permission;
  }).catch(err => {
    console.warn("Notification.requestPermission error:", err);
    return "denied";
  });
}

function showNotification(message) {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") {
      console.debug("Notification not shown: permission is", Notification.permission);
      return;
    }

    if (document.hasFocus()) return;

    const userSafe = sanitizeUsername(message.user);
    const contentSafe = (message.content || '').replace(/<[^>]*>/g, '').trim() || '(no content)';

    const notif = new Notification(userSafe, {
      body: contentSafe,
      tag: `chat-${getRoomFromUrl()}`,
      renotify: false
    });

    notif.onclick = () => {
      try {
        window.focus();
      } catch (e) {
      }
      notif.close();
    };
  } catch (e) {
    console.error("showNotification error:", e);
  }
}

async function fetchMessages() {
  try {
    if (!ROOM || typeof ROOM !== 'string' || !/^[0-9a-f]{16}$/i.test(ROOM)) {
      console.warn('fetchMessages: invalid ROOM, skipping fetch ->', ROOM);
      return;
    }

    if (!KEY) {
      KEY = await getKeyFromUrl();
      if (!KEY) {
        console.warn('fetchMessages: no KEY available, skipping fetch');
        return;
      }
    }

    const limit = 1000;

    const sinceId = (typeof LAST_SEEN_ID === 'number' && LAST_SEEN_ID > 0) ? LAST_SEEN_ID : 0;
    const url = `/api/messages/${encodeURIComponent(ROOM)}?since_id=${sinceId}&order=asc&limit=${limit}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn('fetchMessages: server returned', res.status);
      return;
    }

    const payload = await res.json();
    if (!Array.isArray(payload)) {
      console.error('fetchMessages: server returned non-array payload', payload);
      return;
    }

    const serverMessages = payload.filter(m => {
      if (!m.room || m.room.toLowerCase() !== ROOM.toLowerCase()) return false;
      if (!m.iv || !m.user_iv || !m.content || !m.user) return false;
      if (m.iv.length !== 24 || m.user_iv.length !== 24) return false;
      if (m.content.length < 32 || m.user.length < 32) return false;
      return true;
    });

    if (!serverMessages.length) return;

    const messagesDiv = document.getElementById('messages');
    if (!messagesDiv) return;

    messagesDiv.style.overflowAnchor = 'none';
    const userWasNearBottom = isUserNearBottom(messagesDiv, 50);

    const existingMap = new Map();
    Array.from(messagesDiv.children).forEach(el => {
      if (el.dataset.serverId) existingMap.set(`s:${el.dataset.serverId}`, el);
      if (el.dataset.id) existingMap.set(`id:${el.dataset.id}`, el);
      if (el.dataset.fingerprint) existingMap.set(`fp:${el.dataset.fingerprint}`, el);
    });

    const decrypted = [];
    for (const message of serverMessages) {
      try {
        const user = await decryptText(message.user, message.user_iv, KEY);
        const content = await decryptText(message.content, message.iv, KEY);

        if (!message.timestamp) {
          LAST_SEEN_ID = Math.max(LAST_SEEN_ID, Number(message.id));
          continue;
        }

        decrypted.push({ serverId: message.id, user, content, timestamp: message.timestamp });
        LAST_SEEN_ID = Math.max(LAST_SEEN_ID, Number(message.id));
      } catch (_) {
        LAST_SEEN_ID = Math.max(LAST_SEEN_ID, Number(message.id));
      }
    }

    if (!decrypted.length) return;

    const frag = document.createDocumentFragment();
    const prevScrollTop = messagesDiv.scrollTop;
    const prevScrollHeight = messagesDiv.scrollHeight;

    for (const m of decrypted) {
      const plaintextId = getMessageId({ user: m.user, content: m.content, timestamp: m.timestamp });
      const serverKey = `s:${m.serverId}`;
      const idKey = `id:${plaintextId}`;
      const fingerprint = getMessageFingerprint({ user: m.user, content: m.content });
      const fpKey = `fp:${fingerprint}`;

      let existingEl = existingMap.get(serverKey) || existingMap.get(fpKey) || existingMap.get(idKey);
      if (existingEl) {
        updateExistingMessageElement(existingEl, { user: m.user, content: m.content, timestamp: m.timestamp });
        existingEl.dataset.serverId = String(m.serverId);
        existingEl.dataset.id = plaintextId;
        existingEl.dataset.fingerprint = fingerprint;
      } else {
        const elem = createMessageElement({ user: m.user, content: m.content, timestamp: m.timestamp });
        elem.dataset.serverId = String(m.serverId);
        elem.dataset.id = plaintextId;
        elem.dataset.fingerprint = fingerprint;
        frag.appendChild(elem);

        if (!notifiedIds.has(elem.dataset.id) && Notification.permission === 'granted') {
          showNotification(m);
          notifiedIds.add(elem.dataset.id);
        }
      }
    }

    if (frag.childNodes.length) messagesDiv.appendChild(frag);

    const newScrollHeight = messagesDiv.scrollHeight;
    const dh = newScrollHeight - prevScrollHeight;
    messagesDiv.scrollTop = userWasNearBottom ? messagesDiv.scrollHeight : prevScrollTop + dh;
    messagesDiv._lastKnownScrollHeight = messagesDiv.scrollHeight;

  } catch (e) {
    console.error('fetchMessages error', e);
  }
}

async function createMessage() {
  const rawUserEl = document.getElementById('user');
  const rawContentEl = document.getElementById('content');
  const messagesDiv = document.getElementById('messages');
  if (!rawContentEl) return;

  const rawUser = sanitizeUsername(rawUserEl ? rawUserEl.value.trim() : 'Anonymous');
  const rawContentText = rawContentEl.value.trim();
  if (!rawContentText) return;

  const sanitizedContent = sanitizeContent(rawContentText);

  const newMessageSignature = `${rawUser}::${rawContentText}`;
  if (newMessageSignature === lastSentMessage) {
    console.warn('Duplicate message blocked');
    return;
  }
  lastSentMessage = newMessageSignature;

  const pendingTimestamp = new Date().toISOString();

  const pendingMsgForId = { user: rawUser, content: rawContentText, timestamp: pendingTimestamp, pending: true };
  const elem = createMessageElement({ user: rawUser, content: sanitizedContent, timestamp: pendingTimestamp, pending: true });

  const pendingId = getMessageId(pendingMsgForId);
  const pendingFingerprint = getMessageFingerprint(pendingMsgForId);
  elem.dataset.id = pendingId;
  elem.dataset.fingerprint = pendingFingerprint;

  if (messagesDiv) {
    messagesDiv.appendChild(elem);

    scrollMessagesToBottom(messagesDiv, false);
  }

  rawContentEl.value = '';

  if (!KEY) KEY = await getKeyFromUrl();
  if (!KEY) {
    console.error('No key');
    if (elem) { elem.classList.remove('pending'); elem.classList.add('failed'); }
    return;
  }
  if (!ROOM) ROOM = getRoomFromUrl();

  try {
    const { cipher: content, iv } = await encryptText(rawContentText, KEY);
    const { cipher: user, iv: user_iv } = await encryptText(rawUser, KEY);

    const res = await fetch(`/api/messages/${encodeURIComponent(ROOM)}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ user, user_iv, content, iv })
    });

    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}`);
    }

  } catch (err) {
    console.error('Failed to send message', err);
    if (elem) {
      elem.classList.remove('pending');
      elem.classList.add('failed');
    }
  }
}

const contentEl = document.getElementById("content");
if (contentEl) {
  contentEl.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      createMessage();
    }
  });
}

(async () => {
  if (typeof DOMPurify === 'undefined') {
    console.error('DOMPurify is required for sanitization.');
    return;
  }
  setupNickname();
  requestNotificationPermission();

  ROOM = getRoomFromUrl();
  KEY = await getKeyFromUrl();
  if (!KEY) KEY = await generateAndStoreKey();

  const messagesDiv = document.getElementById('messages');
  if (messagesDiv) {
    messagesDiv.style.overflowAnchor = 'none';
    messagesDiv._lastKnownScrollHeight = messagesDiv.scrollHeight || 0;

    const ro = new ResizeObserver(() => {
      const prev = messagesDiv._lastKnownScrollHeight || 0;
      const curr = messagesDiv.scrollHeight;
      const dh = curr - prev;
      if (dh !== 0) {
        const wasNearBottom = isUserNearBottom(messagesDiv, 50);
        if (wasNearBottom) {
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        } else {
          messagesDiv.scrollTop = (messagesDiv.scrollTop || 0) + dh;
        }
        messagesDiv._lastKnownScrollHeight = curr;
      }
    });
    ro.observe(messagesDiv);
  }

  await fetchMessages();
  setInterval(fetchMessages, 1000);
})();