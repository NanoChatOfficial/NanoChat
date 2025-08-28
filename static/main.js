function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
function hexToBuffer(hex) {
  if (typeof hex !== 'string') throw new TypeError('hex must be a string');
  const cleaned = hex.trim();
  if (cleaned.length === 0) return new ArrayBuffer(0);
  if (cleaned.length % 2 !== 0) throw new Error('hex string length must be even');
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) throw new Error('hex string contains non-hex characters');
  const bytes = new Uint8Array(cleaned.match(/.{2}/g).map(b => parseInt(b, 16)));
  return bytes.buffer;
}

const dompurifyConfig = {
  ALLOWED_TAGS: ['b','i','em','strong','p','br','ul','ol','li','a'],
  ALLOWED_ATTR: ['href','title','target'],
  ALLOWED_URI_REGEXP: /^(https?:\/\/|\/)/i
};
function sanitizeUsername(name) {
  return DOMPurify.sanitize(String(name || ''), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim() || 'Anonymous';
}
function sanitizeContent(html) {
  return DOMPurify.sanitize(String(html || ''), dompurifyConfig);
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
          a.setAttribute('rel', 'noopener noreferrer');
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
  const keyHex = decodeURIComponent(window.location.hash.substring(1) || '');
  if (!keyHex) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) return null;
  try {
    const raw = hexToBuffer(keyHex);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
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
    const data = hexToBuffer(cipherHex);
    const ivBuff = hexToBuffer(ivHex);
    const ivView = new Uint8Array(ivBuff);
    if (ivView.length !== 12) throw new Error('Invalid IV length');
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv: ivView }, key, data);
    return new TextDecoder().decode(plain);
  } catch (e) {
    throw e;
  }
}

function getRoomFromUrl() {
  const parts = window.location.pathname.split('/');
  let room = parts[parts.length - 1];
  if (/^[0-9a-f]{16}$/.test(room)) {
    localStorage.setItem('room', room);
    return room;
  }
  const stored = localStorage.getItem('room');
  if (/^[0-9a-f]{16}$/.test(stored)) {
    history.replaceState(null, '', `/room/${stored}${window.location.hash}`);
    return stored;
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

let ROOM = null;
let KEY = null;
let lastSentMessage = null;

function isUserNearBottom(container, threshold = 50) {
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
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

let lastNotifiedAt = 0;

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

const notifiedIds = new Set();

async function fetchMessages() {
  try {
    if (!ROOM) return;
    if (!KEY) {
      KEY = await getKeyFromUrl();
      if (!KEY) return;
    }

    const res = await fetch(`/api/messages/${encodeURIComponent(ROOM)}`);
    if (!res.ok) return;
    const messages = await res.json();

    const messagesDiv = document.getElementById('messages');
    if (!messagesDiv) return;

    messagesDiv.style.overflowAnchor = 'none';

    const userWasNearBottom = isUserNearBottom(messagesDiv, 50);

    const existingMap = new Map(
      Array.from(messagesDiv.children)
        .filter(el => el.dataset.id)
        .map(el => [el.dataset.id, el])
    );

    const decrypted = [];
    for (const message of messages) {
      try {
        const user = await decryptText(message.user, message.user_iv, KEY);
        const content = await decryptText(message.content, message.iv, KEY);

        if (!message.timestamp) {
          console.warn("Message missing timestamp, skipping:", message);
          continue;
        }

        decrypted.push({ user, content, timestamp: message.timestamp });
      } catch (e) {
        console.warn('Skipping message (decrypt/error):', e);
      }
    }

    const frag = document.createDocumentFragment();
    const prevScrollTop = messagesDiv.scrollTop;
    const prevScrollHeight = messagesDiv.scrollHeight;

    const myName = sanitizeUsername(localStorage.getItem("nickname") || "Anonymous");

    for (const m of decrypted) {
      const id = getMessageId(m);

      if (existingMap.has(id)) {
        const existingEl = existingMap.get(id);
        if (existingEl.classList.contains('pending') || existingEl.classList.contains('failed')) {
          updateExistingMessageElement(existingEl, m);
        }
        continue;
      }

      const elem = createMessageElement(m);
      elem.dataset.id = id;
      frag.appendChild(elem);

      if (!notifiedIds.has(id)) {
        if (Notification.permission === "granted") {
          console.debug("🔔 Showing notification for", id);
          showNotification(m);
        }
        notifiedIds.add(id);
      }
    }

    if (frag.childNodes.length) messagesDiv.appendChild(frag);

    const newScrollHeight = messagesDiv.scrollHeight;
    const dh = newScrollHeight - prevScrollHeight;

    if (userWasNearBottom) {
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } else {
      messagesDiv.scrollTop = prevScrollTop + dh;
    }

    messagesDiv._lastKnownScrollHeight = messagesDiv.scrollHeight;
  } catch (e) {
    console.error('fetchMessages error', e);
  }
}

async function createMessage() {
  const rawUserEl = document.getElementById('user');
  const rawContentEl = document.getElementById('content');
  if (!rawContentEl) return;

  const rawUser = sanitizeUsername(rawUserEl ? rawUserEl.value.trim() : 'Anonymous');
  const rawContent = sanitizeContent(rawContentEl.value.trim());
  if (!rawContent) return;

  const newMessageSignature = `${rawUser}::${rawContent}`;
  if (newMessageSignature === lastSentMessage) {
    console.warn('Duplicate message blocked');
    return;
  }
  lastSentMessage = newMessageSignature;

  rawContentEl.value = '';

  if (!KEY) KEY = await getKeyFromUrl();
  if (!KEY) { console.error('No key'); return; }
  if (!ROOM) ROOM = getRoomFromUrl();

  try {
    const { cipher: content, iv } = await encryptText(rawContent, KEY);
    const { cipher: user, iv: user_iv } = await encryptText(rawUser, KEY);

    fetch(`/api/messages/${encodeURIComponent(ROOM)}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ user, user_iv, content, iv })
    }).catch(err => {
      console.error('Failed to send message', err);
      const pendingEl = messagesDiv ? messagesDiv.querySelector(`[data-id="${elem.dataset.id}"]`) : null;
      if (pendingEl) pendingEl.classList.remove('pending'), pendingEl.classList.add('failed');
    });
  } catch (e) {
    console.error('Encryption/send failed', e);
    const pendingEl = messagesDiv ? messagesDiv.querySelector(`[data-id="${elem.dataset.id}"]`) : null;
    if (pendingEl) pendingEl.classList.remove('pending'), pendingEl.classList.add('failed');
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
  setInterval(fetchMessages, 3000);
})();