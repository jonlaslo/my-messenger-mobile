const API_BASE = window.APP_CONFIG.SERVER_URL;

// ===== Динамічне завантаження бібліотеки socket.io-client з сервера =====
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Не вдалося завантажити ' + src));
    document.head.appendChild(s);
  });
}

// ===== Елементи екранів авторизації =====
const screenPhone = document.getElementById('screen-phone');
const screenCode = document.getElementById('screen-code');
const screenRegister = document.getElementById('screen-register');
const screenLogin = document.getElementById('screen-login');
const authWrapper = document.getElementById('auth-wrapper');
const appMain = document.getElementById('app-main');

const inputPhone = document.getElementById('input-phone');
const inputCode = document.getElementById('input-code');
const inputName = document.getElementById('input-name');
const inputNewPassword = document.getElementById('input-new-password');
const inputLoginPassword = document.getElementById('input-login-password');

const errorPhone = document.getElementById('error-phone');
const errorCode = document.getElementById('error-code');
const errorRegister = document.getElementById('error-register');
const errorLogin = document.getElementById('error-login');

let currentPhone = '';
let currentVerifyToken = '';
let myName = '';

function showScreen(screen) {
  [screenPhone, screenCode, screenRegister, screenLogin].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function setError(el, message) {
  el.textContent = message || '';
}

// ===== Крок 1: надсилання коду =====
document.getElementById('btn-send-code').addEventListener('click', async () => {
  setError(errorPhone, '');
  const phone = inputPhone.value.trim();
  if (!phone) {
    setError(errorPhone, 'Введіть номер телефону');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();

    if (!data.ok) {
      setError(errorPhone, data.error || 'Помилка відправки коду');
      return;
    }

    currentPhone = phone;
    document.getElementById('code-phone-display').textContent = phone;
    if (data.test) {
      setError(errorCode, 'Тестовий режим: код виведено в консоль сервера (TURBOSMS_TOKEN не задано)');
    }
    showScreen(screenCode);
  } catch (err) {
    setError(errorPhone, 'Немає з’єднання із сервером. Перевірте адресу в config.js');
  }
});

// ===== Крок 2: перевірка коду =====
document.getElementById('btn-verify-code').addEventListener('click', async () => {
  setError(errorCode, '');
  const code = inputCode.value.trim();
  if (!code) {
    setError(errorCode, 'Введіть код з SMS');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentPhone, code })
    });
    const data = await res.json();

    if (!data.ok) {
      setError(errorCode, data.error || 'Невірний код');
      return;
    }

    currentVerifyToken = data.verifyToken;

    if (data.isNewUser) {
      showScreen(screenRegister);
    } else {
      document.getElementById('login-phone-display').textContent = currentPhone;
      showScreen(screenLogin);
    }
  } catch (err) {
    setError(errorCode, 'Немає з’єднання із сервером');
  }
});

document.getElementById('link-resend').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('btn-send-code').click();
});

document.getElementById('link-change-phone').addEventListener('click', (e) => {
  e.preventDefault();
  showScreen(screenPhone);
});

// ===== Крок 3а: реєстрація =====
document.getElementById('btn-register').addEventListener('click', async () => {
  setError(errorRegister, '');
  const name = inputName.value.trim();
  const password = inputNewPassword.value;

  if (!password || password.length < 4) {
    setError(errorRegister, 'Пароль має бути не менше 4 символів');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifyToken: currentVerifyToken, name, password })
    });
    const data = await res.json();

    if (!data.ok) {
      setError(errorRegister, data.error || 'Помилка реєстрації');
      return;
    }

    enterApp(data.token, data.user);
  } catch (err) {
    setError(errorRegister, 'Немає з’єднання із сервером');
  }
});

// ===== Крок 3б: вхід =====
document.getElementById('btn-login').addEventListener('click', async () => {
  setError(errorLogin, '');
  const password = inputLoginPassword.value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentPhone, password })
    });
    const data = await res.json();

    if (!data.ok) {
      setError(errorLogin, data.error || 'Невірний пароль');
      return;
    }

    enterApp(data.token, data.user);
  } catch (err) {
    setError(errorLogin, 'Немає з’єднання із сервером');
  }
});

[inputPhone].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-send-code').click(); }));
[inputCode].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-verify-code').click(); }));
[inputNewPassword, inputName].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-register').click(); }));
[inputLoginPassword].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-login').click(); }));

// ===== Перехід у головний застосунок після успішної авторизації =====
let socket = null;
let myPhone = '';

async function enterApp(token, user) {
  authWrapper.classList.add('hidden');
  appMain.classList.remove('hidden');

  myPhone = user.phone;
  myName = user.name || 'Я';
  const initial = myName.charAt(0).toUpperCase();
  document.getElementById('my-avatar').textContent = initial;
  document.getElementById('menu-avatar').textContent = initial;
  document.getElementById('menu-profile-name').textContent = myName;
  document.getElementById('menu-profile-phone').textContent = myPhone;

  try {
    await loadScript(`${API_BASE}/socket.io/socket.io.js`);
  } catch (err) {
    alert('Не вдалося завантажити бібліотеку socket.io з сервера. Перевір адресу в config.js та з’єднання.');
    return;
  }

  connectSocket(token);
}

function connectSocket(token) {
  const chatLog = document.getElementById('chat-log');
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  const statusEl = document.getElementById('connection-status');
  const sidebarLastMsg = document.getElementById('sidebar-last-msg');
  const sidebarLastTime = document.getElementById('sidebar-last-time');

  socket = io(API_BASE, { auth: { token } });

  function formatTime(date) {
    return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  }

  function addBubble(text, mine, name) {
    const now = new Date();
    const timeStr = formatTime(now);

    const row = document.createElement('div');
    row.className = 'bubble-row ' + (mine ? 'mine' : 'theirs');

    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + (mine ? 'mine' : 'theirs');

    if (!mine && name) {
      const nameEl = document.createElement('div');
      nameEl.style.fontWeight = '600';
      nameEl.style.fontSize = '12.5px';
      nameEl.style.color = '#2f80c7';
      nameEl.style.marginBottom = '2px';
      nameEl.textContent = name;
      bubble.appendChild(nameEl);
    }

    bubble.appendChild(document.createTextNode(text));

    const timeSpan = document.createElement('span');
    timeSpan.className = 'bubble-time';
    timeSpan.textContent = timeStr;
    bubble.appendChild(timeSpan);

    row.appendChild(bubble);
    chatLog.appendChild(row);
    chatLog.scrollTop = chatLog.scrollHeight;

    sidebarLastMsg.textContent = (mine ? 'Ви: ' : name + ': ') + text;
    sidebarLastTime.textContent = timeStr;
  }

  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    socket.emit('chat message', { text });
    input.value = '';
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

  socket.on('chat message', (msg) => {
    const mine = msg.senderPhone === myPhone;
    addBubble(msg.text, mine, msg.senderName);
  });

  socket.on('connect', () => {
    statusEl.textContent = 'в мережі';
    statusEl.classList.add('online');
  });

  socket.on('disconnect', () => {
    statusEl.textContent = 'немає з’єднання';
    statusEl.classList.remove('online');
  });

  socket.on('connect_error', () => {
    statusEl.textContent = 'помилка з’єднання';
    statusEl.classList.remove('online');
  });

  setupCalling();
}

// ================= БОКОВЕ МЕНЮ =================
const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu-overlay');
const menuBackdrop = document.getElementById('menu-backdrop');
const settingsOverlay = document.getElementById('settings-overlay');

menuBtn.addEventListener('click', () => menuOverlay.classList.remove('hidden'));
menuBackdrop.addEventListener('click', () => menuOverlay.classList.add('hidden'));

document.getElementById('menu-settings-item').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  settingsOverlay.classList.remove('hidden');
});

document.getElementById('settings-back-btn').addEventListener('click', () => {
  settingsOverlay.classList.add('hidden');
});

document.getElementById('menu-logout-item').addEventListener('click', () => {
  menuOverlay.classList.add('hidden');
  logout();
});

function logout() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  appMain.classList.add('hidden');
  authWrapper.classList.remove('hidden');
  showScreen(screenPhone);
  inputPhone.value = '';
  inputCode.value = '';
  inputName.value = '';
  inputNewPassword.value = '';
  inputLoginPassword.value = '';
  currentPhone = '';
  currentVerifyToken = '';
  document.getElementById('chat-log').innerHTML = '';
}

// ================= WEBRTC ДЗВІНКИ =================
function setupCalling() {
  const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  let pc = null;
  let localStream = null;
  let currentCallType = null;
  let remoteSocketId = null;
  let pendingIceCandidates = [];
  let pendingIncomingCall = null;
  let isMuted = false;

  const callAudioBtn = document.getElementById('call-audio-btn');
  const callVideoBtn = document.getElementById('call-video-btn');
  const incomingModal = document.getElementById('incoming-call-modal');
  const incomingName = document.getElementById('incoming-call-name');
  const incomingType = document.getElementById('incoming-call-type');
  const incomingAvatar = document.getElementById('incoming-call-avatar');
  const acceptBtn = document.getElementById('accept-call-btn');
  const rejectBtn = document.getElementById('reject-call-btn');

  const callScreen = document.getElementById('call-screen');
  const remoteVideo = document.getElementById('remote-video');
  const localVideo = document.getElementById('local-video');
  const callInfoAudio = document.getElementById('call-info-audio');
  const callAvatar = document.getElementById('call-avatar');
  const callName = document.getElementById('call-name');
  const callStatus = document.getElementById('call-status');
  const muteBtn = document.getElementById('mute-btn');
  const endCallBtn = document.getElementById('end-call-btn');

  function createPeerConnection() {
    pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        if (remoteSocketId) {
          socket.emit('call:ice-candidate', { candidate: e.candidate, targetSocketId: remoteSocketId });
        } else {
          pendingIceCandidates.push(e.candidate);
        }
      }
    };

    pc.ontrack = (e) => {
      remoteVideo.srcObject = e.streams[0];
      if (currentCallType === 'video') {
        remoteVideo.classList.remove('hidden');
        callInfoAudio.classList.add('hidden');
      }
      callStatus.textContent = 'З’єднано';
    };

    pc.onconnectionstatechange = () => {
      if (pc && ['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        endCall(false);
      }
    };
  }

  function showCallUI(callType, peerName) {
    callScreen.classList.remove('hidden');
    callName.textContent = peerName || '—';
    callAvatar.textContent = (peerName || '?').charAt(0).toUpperCase();
    callStatus.textContent = 'Дзвінок...';

    if (callType === 'video') {
      localVideo.classList.remove('hidden');
      localVideo.srcObject = localStream;
    } else {
      localVideo.classList.add('hidden');
      remoteVideo.classList.add('hidden');
      callInfoAudio.classList.remove('hidden');
    }
  }

  function hideCallUI() {
    callScreen.classList.add('hidden');
    remoteVideo.srcObject = null;
    localVideo.srcObject = null;
    remoteVideo.classList.add('hidden');
    localVideo.classList.add('hidden');
    callInfoAudio.classList.remove('hidden');
    muteBtn.classList.remove('active');
    isMuted = false;
  }

  async function startCall(callType) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
    } catch (err) {
      alert('Не вдалося отримати доступ до мікрофона/камери: ' + err.message);
      return;
    }

    currentCallType = callType;
    showCallUI(callType, 'Виклик...');
    createPeerConnection();
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('call:offer', { sdp: offer, callType });
  }

  callAudioBtn.addEventListener('click', () => startCall('audio'));
  callVideoBtn.addEventListener('click', () => startCall('video'));

  socket.on('call:incoming', (data) => {
    if (pc) {
      // вже є активний дзвінок — автоматично відхиляємо новий
      socket.emit('call:reject', { targetSocketId: data.callerSocketId });
      return;
    }
    pendingIncomingCall = data;
    incomingName.textContent = data.callerName;
    incomingAvatar.textContent = data.callerName.charAt(0).toUpperCase();
    incomingType.textContent = data.callType === 'video' ? 'відеодзвінок...' : 'аудіодзвінок...';
    incomingModal.classList.remove('hidden');
  });

  acceptBtn.addEventListener('click', async () => {
    const data = pendingIncomingCall;
    incomingModal.classList.add('hidden');
    if (!data) return;

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: data.callType === 'video'
      });
    } catch (err) {
      alert('Не вдалося отримати доступ до мікрофона/камери: ' + err.message);
      socket.emit('call:reject', { targetSocketId: data.callerSocketId });
      return;
    }

    currentCallType = data.callType;
    remoteSocketId = data.callerSocketId;
    createPeerConnection();
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('call:answer', { sdp: answer, targetSocketId: remoteSocketId });

    showCallUI(data.callType, data.callerName);
  });

  rejectBtn.addEventListener('click', () => {
    if (pendingIncomingCall) {
      socket.emit('call:reject', { targetSocketId: pendingIncomingCall.callerSocketId });
    }
    incomingModal.classList.add('hidden');
    pendingIncomingCall = null;
  });

  socket.on('call:answer', async (data) => {
    remoteSocketId = data.answererSocketId;
    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    pendingIceCandidates.forEach(c => {
      socket.emit('call:ice-candidate', { candidate: c, targetSocketId: remoteSocketId });
    });
    pendingIceCandidates = [];
    callStatus.textContent = 'З’єднання...';
  });

  socket.on('call:ice-candidate', async (data) => {
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error('ICE candidate error:', err);
      }
    }
  });

  socket.on('call:rejected', () => {
    alert('Виклик відхилено');
    endCall(false);
  });

  socket.on('call:ended', () => {
    endCall(false);
  });

  muteBtn.addEventListener('click', () => {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
    muteBtn.classList.toggle('active', isMuted);
  });

  endCallBtn.addEventListener('click', () => endCall(true));

  function endCall(notify) {
    if (notify && remoteSocketId) {
      socket.emit('call:end', { targetSocketId: remoteSocketId });
    }
    if (pc) {
      pc.close();
      pc = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    remoteSocketId = null;
    pendingIceCandidates = [];
    pendingIncomingCall = null;
    currentCallType = null;
    hideCallUI();
  }
}
