// ===== CONFIG =====
const API_BASE = '/api';

// ===== STATE =====
let state = {
  userId: null,
  username: null,
  companion: null,
  currentTab: 'chat',
  selectedType: null,
  selectedPersonality: null,
  selectedAvatar: 'av1',
  selectedTheme: 'dark',
  isVoiceEnabled: false,
  isRecording: false,
  recognition: null,
  currentGame: null,
  roundScore: 0,
  selectedMood: null,
};

// ===== INIT =====
window.addEventListener('DOMContentLoaded', async () => {
  applyTheme(localStorage.getItem('bsai_theme') || 'dark');
  const savedUserId = localStorage.getItem('bsai_userId');
  if (savedUserId) {
    state.userId = savedUserId;
    state.username = localStorage.getItem('bsai_username');
    try {
      await loadUserData();
      showScreen('app');
      showTab('chat');
    } catch {
      showScreen('onboarding');
    }
  } else {
    setTimeout(() => showScreen('onboarding'), 2500);
  }
});

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===== ONBOARDING =====
function nextStep(stepId) {
  const current = document.querySelector('.onboard-step.active');

  // Validate current step
  if (current.id === 'step-name') {
    const name = document.getElementById('input-name').value.trim();
    if (!name) { showToastMsg('Naam toh batao yaar! 😅'); return; }
    state.username = name;
  }
  if (current.id === 'step-type' && !state.selectedType) { showToastMsg('Companion type select karo! 💫'); return; }
  if (current.id === 'step-companion-name') {
    const cname = document.getElementById('input-companion-name').value.trim();
    if (!cname) { showToastMsg('Companion ka naam toh batao! ✨'); return; }
    state.companionName = cname;
  }
  if (current.id === 'step-personality' && !state.selectedPersonality) { showToastMsg('Personality choose karo! 🎭'); return; }
  if (current.id === 'step-avatar' && !state.selectedAvatar) { showToastMsg('Avatar select karo! 🎨'); return; }

  current.classList.remove('active');
  document.getElementById(stepId).classList.add('active');
}

function selectCard(el, type) {
  const group = el.parentElement.querySelectorAll('[data-value]');
  group.forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const val = el.dataset.value;
  if (type === 'type') state.selectedType = val;
  if (type === 'personality') state.selectedPersonality = val;
  if (type === 'avatar') state.selectedAvatar = val;
  if (type === 'theme') { state.selectedTheme = val; applyTheme(val); }
}

async function finishOnboarding() {
  if (!state.selectedTheme) state.selectedTheme = 'dark';

  try {
    // Create user
    const res = await api('POST', '/users', { username: state.username, theme: state.selectedTheme });
    state.userId = res.id;
    localStorage.setItem('bsai_userId', res.id);
    localStorage.setItem('bsai_username', state.username);

    // Save companion
    const avatarMap = { av1:'🧑', av2:'👩', av3:'🧑‍🦱', av4:'👩‍🦰', av5:'🧑‍🦳', av6:'🦸', av7:'🧚', av8:'🧙' };
    await api('PUT', `/users/${state.userId}/companion`, {
      companionName: state.companionName || 'Yaar',
      companionType: state.selectedType || 'bestfriend',
      personality: state.selectedPersonality || 'chill',
      avatarId: state.selectedAvatar || 'av1',
    });

    await loadUserData();
    showScreen('app');
    showTab('chat');

    // Welcome message
    setTimeout(() => addWelcomeMessage(), 500);
  } catch (e) {
    showToastMsg('Kuch gadbad ho gayi! Phir try karo 😅');
  }
}

function addWelcomeMessage() {
  if (!state.companion) return;
  const welcomes = [
    `Heyy ${state.username}! Main ${state.companion.companionName} hoon 🥰 Itna wait karwa diya! Ab bata, kaisa feel ho raha hai?`,
    `Ohh ${state.username}! Finally tu aa gaya/gayi! Main ${state.companion.companionName} hoon, tera naya best companion 💫 Batao batao, din kaisa gaya?`,
    `${state.username}! Welcome yaar! Main hoon ${state.companion.companionName} — ab teri zindagi thodi zyada fun hone wali hai 😄`,
  ];
  const msg = welcomes[Math.floor(Math.random() * welcomes.length)];
  appendMessage(msg, 'incoming', new Date());
}

// ===== USER DATA LOAD =====
async function loadUserData() {
  const [companion, stats] = await Promise.all([
    api('GET', `/users/${state.userId}/companion`).catch(() => null),
    api('GET', `/users/${state.userId}/stats`).catch(() => null),
  ]);

  state.companion = companion;

  // Update UI
  const avatarMap = { av1:'🧑', av2:'👩', av3:'🧑‍🦱', av4:'👩‍🦰', av5:'🧑‍🦳', av6:'🦸', av7:'🧚', av8:'🧙' };
  if (companion) {
    const emojiAvatar = avatarMap[companion.avatarId] || '🧑';
    document.getElementById('header-avatar').textContent = emojiAvatar;
    document.getElementById('header-name').textContent = companion.companionName;
    document.getElementById('profile-avatar').textContent = emojiAvatar;
    document.getElementById('profile-companion-info').textContent = `${companion.companionType} • ${companion.personality} 🌟`;
  }
  if (state.username) document.getElementById('profile-username').textContent = state.username;
  if (stats) updateStatsUI(stats);
}

function updateStatsUI(stats) {
  setEl('stat-streak', stats.streakCount ?? 0);
  setEl('stat-messages', stats.totalMessages ?? 0);
  setEl('stat-bond', stats.bondLevel ?? 1);
  setEl('stat-games', stats.totalGamesPlayed ?? 0);
  setEl('streak-display', `🔥 ${stats.streakCount ?? 0} day streak`);
}

// ===== TABS =====
function showTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  if (tab === 'chat') loadMessages();
  if (tab === 'daily') loadDailyContent();
  if (tab === 'mood') loadMoodHistory();
  if (tab === 'profile') loadProfile();
  if (tab === 'games') loadGameProgress();
}

// ===== CHAT =====
async function loadMessages() {
  if (!state.userId) return;
  try {
    const msgs = await api('GET', `/users/${state.userId}/messages`);
    const container = document.getElementById('chat-messages');
    container.innerHTML = '<div class="chat-date-divider">Today</div>';
    msgs.forEach(m => appendMessage(m.content, m.role === 'user' ? 'outgoing' : 'incoming', new Date(m.createdAt)));
    scrollChatToBottom();
  } catch {}
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const content = input.value.trim();
  if (!content || !state.userId) return;

  input.value = '';
  autoResizeInput(input);

  // Show user message immediately
  appendMessage(content, 'outgoing', new Date());
  scrollChatToBottom();
  showTypingIndicator();

  try {
    const res = await api('POST', `/users/${state.userId}/chat`, { content });
    removeTypingIndicator();
    appendMessage(res.companionMessage.content, 'incoming', new Date(res.companionMessage.createdAt));
    scrollChatToBottom();

    if (res.relationshipUpdate?.newAchievement) {
      showAchievementToast(res.relationshipUpdate.newAchievement);
    }

    // TTS if voice enabled
    if (state.isVoiceEnabled) {
      playTTS(res.companionMessage.content);
    }

    // Update stats
    if (state.userId) {
      api('GET', `/users/${state.userId}/stats`).then(updateStatsUI).catch(() => {});
    }
  } catch (e) {
    removeTypingIndicator();
    appendMessage('Arre yaar, kuch gadbad ho gayi! Phir se try karo 😅', 'incoming', new Date());
  }
}

function appendMessage(content, direction, time) {
  const container = document.getElementById('chat-messages');
  const wrap = document.createElement('div');
  wrap.className = `msg-bubble-wrap ${direction}`;

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = content;

  const meta = document.createElement('div');
  meta.className = 'msg-time';
  meta.textContent = formatTime(time);
  if (direction === 'outgoing') meta.innerHTML += ' <span class="msg-read">✓✓</span>';

  wrap.appendChild(bubble);
  wrap.appendChild(meta);
  container.appendChild(wrap);
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const wrap = document.createElement('div');
  wrap.className = 'msg-bubble-wrap incoming';
  wrap.id = 'typing-bubble';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble typing-indicator';
  bubble.innerHTML = '<span></span><span></span><span></span>';
  wrap.appendChild(bubble);
  container.appendChild(wrap);
  scrollChatToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-bubble');
  if (el) el.remove();
}

function scrollChatToBottom() {
  const c = document.getElementById('chat-messages');
  c.scrollTop = c.scrollHeight;
}

function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResizeInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// ===== VOICE =====
function toggleVoice() {
  state.isVoiceEnabled = !state.isVoiceEnabled;
  const btn = document.getElementById('voice-toggle');
  btn.style.background = state.isVoiceEnabled ? 'var(--gradient)' : '';
  showToastMsg(state.isVoiceEnabled ? '🔊 Voice replies on!' : '🔇 Voice replies off');
}

function toggleMic() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToastMsg('Browser voice support nahi hai 😅');
    return;
  }

  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  state.recognition = new SpeechRecognition();
  state.recognition.lang = 'hi-IN';
  state.recognition.continuous = false;
  state.recognition.interimResults = true;

  state.recognition.onresult = (e) => {
    const transcript = e.results[e.results.length - 1][0].transcript;
    document.getElementById('msg-input').value = transcript;
  };

  state.recognition.onend = () => {
    state.isRecording = false;
    document.getElementById('mic-btn').classList.remove('recording');
    document.getElementById('voice-indicator').style.display = 'none';
    const val = document.getElementById('msg-input').value.trim();
    if (val) sendMessage();
  };

  state.recognition.onerror = () => {
    state.isRecording = false;
    document.getElementById('mic-btn').classList.remove('recording');
    document.getElementById('voice-indicator').style.display = 'none';
  };

  state.recognition.start();
  state.isRecording = true;
  document.getElementById('mic-btn').classList.add('recording');
  document.getElementById('voice-indicator').style.display = 'flex';
}

function stopRecording() {
  if (state.recognition) state.recognition.stop();
  state.isRecording = false;
  document.getElementById('mic-btn').classList.remove('recording');
  document.getElementById('voice-indicator').style.display = 'none';
}

async function playTTS(text) {
  try {
    const res = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.substring(0, 200) }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play().catch(() => {});
    audio.onended = () => URL.revokeObjectURL(url);
  } catch {}
}

// ===== GAMES =====
let gameScoreAccumulated = 0;

async function loadGameProgress() {
  if (!state.userId) return;
  try {
    const progress = await api('GET', `/users/${state.userId}/games`);
    setEl('game-score-badge', `Score: ${progress.totalScore ?? 0}`);
  } catch {}
}

async function startGame(gameType) {
  state.currentGame = gameType;
  state.roundScore = 0;
  gameScoreAccumulated = 0;
  setEl('round-score', '0');
  const gameNames = {
    truth_or_dare: 'Truth or Dare 🎯',
    would_you_rather: 'Would You Rather 🤔',
    compatibility_quiz: 'Compatibility Quiz 💑',
    guess_my_mood: 'Guess My Mood 🔮',
    this_or_that: 'This or That ⚡',
    compliment_battle: 'Compliment Battle 💝',
    personality_quiz: 'Personality Quiz 🧠',
    friendship_challenge: 'Friendship Challenge 🤝',
    memory_challenge: 'Memory Challenge 🧩',
  };
  setEl('game-type-label', gameNames[gameType] || gameType);

  document.getElementById('games-home').style.display = 'none';
  document.getElementById('game-session').style.display = 'flex';

  await fetchGameQuestion();
}

async function fetchGameQuestion() {
  try {
    const data = await api('POST', `/users/${state.userId}/games/session`, { gameType: state.currentGame });
    setEl('game-question', data.content);
    const optContainer = document.getElementById('game-options');
    optContainer.innerHTML = '';
    data.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'game-option-btn';
      btn.textContent = opt;
      btn.onclick = () => {
        optContainer.querySelectorAll('.game-option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        gameScoreAccumulated += 10;
        setEl('round-score', gameScoreAccumulated);
      };
      optContainer.appendChild(btn);
    });
  } catch {
    setEl('game-question', 'Kuch gadbad ho gayi! Next try karo 😅');
  }
}

async function nextGameQuestion() {
  await submitGameScore();
  await fetchGameQuestion();
}

async function submitGameScore() {
  if (!state.userId || !state.currentGame || gameScoreAccumulated === 0) return;
  try {
    await api('POST', `/users/${state.userId}/games/score`, { gameType: state.currentGame, score: gameScoreAccumulated });
    gameScoreAccumulated = 0;
    setEl('round-score', '0');
    await loadGameProgress();
  } catch {}
}

async function exitGame() {
  await submitGameScore();
  state.currentGame = null;
  document.getElementById('game-session').style.display = 'none';
  document.getElementById('games-home').style.display = 'block';
}

// ===== DAILY =====
async function loadDailyContent() {
  if (!state.userId) return;
  try {
    const data = await api('GET', `/users/${state.userId}/daily`);
    setEl('daily-motivation', data.motivation);
    setEl('daily-question', data.question);
    setEl('daily-challenge', data.challenge);
    setEl('streak-display', `🔥 ${data.streakCount} day streak`);

    if (data.checkInCompleted) {
      document.getElementById('checkin-area').querySelector('.checkin-textarea').disabled = true;
      document.getElementById('checkin-btn').style.display = 'none';
      document.getElementById('checkin-done').style.display = 'block';
    } else {
      document.getElementById('checkin-btn').style.display = 'block';
      document.getElementById('checkin-done').style.display = 'none';
    }
  } catch {}
}

async function submitCheckIn() {
  const resp = document.getElementById('checkin-input').value.trim();
  if (!resp) { showToastMsg('Kuch toh likho! 📝'); return; }
  try {
    const res = await api('POST', `/users/${state.userId}/daily`, { response: resp });
    document.getElementById('checkin-btn').style.display = 'none';
    document.getElementById('checkin-done').style.display = 'block';
    setEl('streak-display', `🔥 ${res.streakCount} day streak`);
    showToastMsg(res.message);
    if (res.newAchievement) showAchievementToast(res.newAchievement);
  } catch {}
}

// ===== MOOD =====
function selectMoodEmoji(el) {
  document.querySelectorAll('.mood-emoji-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  state.selectedMood = { mood: el.dataset.mood, score: parseInt(el.dataset.score) };
}

async function logMood() {
  if (!state.selectedMood) { showToastMsg('Pehle mood select karo! 💜'); return; }
  const note = document.getElementById('mood-note').value.trim();
  try {
    await api('POST', `/users/${state.userId}/mood`, { ...state.selectedMood, note });
    showToastMsg('Mood log ho gaya! 💜');
    state.selectedMood = null;
    document.querySelectorAll('.mood-emoji-option').forEach(e => e.classList.remove('selected'));
    document.getElementById('mood-note').value = '';
    loadMoodHistory();
  } catch {}
}

async function loadMoodHistory() {
  if (!state.userId) return;
  try {
    const entries = await api('GET', `/users/${state.userId}/mood`);
    const list = document.getElementById('mood-list');
    if (!entries.length) {
      list.innerHTML = '<div class="empty-state">Abhi koi mood log nahi hai. Upar se shuru karo! 💜</div>';
      return;
    }
    const moodEmojis = { happy:'😊', excited:'🤩', chill:'😌', okay:'😐', anxious:'😰', sad:'😢', angry:'😤', tired:'😴' };
    list.innerHTML = entries.slice(0, 10).map(e => `
      <div class="mood-item">
        <div class="mood-item-emoji">${moodEmojis[e.mood] || '😐'}</div>
        <div class="mood-item-info">
          <div class="mood-item-label">${capitalize(e.mood)}</div>
          ${e.note ? `<div class="mood-item-note">${e.note}</div>` : ''}
          <div class="mood-score-bar" style="width:${(e.score/5)*100}%"></div>
        </div>
        <div class="mood-item-time">${formatRelTime(new Date(e.createdAt))}</div>
      </div>
    `).join('');
  } catch {}
}

// ===== PROFILE =====
async function loadProfile() {
  if (!state.userId) return;
  try {
    const [stats, achievements] = await Promise.all([
      api('GET', `/users/${state.userId}/stats`),
      api('GET', `/users/${state.userId}/achievements`),
    ]);
    updateStatsUI(stats);
    renderAchievements(achievements);
  } catch {}
}

function renderAchievements(list) {
  const container = document.getElementById('achievements-list');
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">Koi achievements nahi abhi. Baat karo, games khelo! 🎮</div>';
    return;
  }
  container.innerHTML = list.map(a => `
    <div class="achievement-item">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-info">
        <div class="ach-title">${a.title}</div>
        <div class="ach-desc">${a.description}</div>
      </div>
    </div>
  `).join('');
}

// ===== THEME =====
function changeTheme(theme) {
  applyTheme(theme);
  localStorage.setItem('bsai_theme', theme);
  if (state.userId) api('PATCH', `/users/${state.userId}`, { theme }).catch(() => {});
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.selectedTheme = theme;
}

// ===== ACHIEVEMENT TOAST =====
function showAchievementToast(achievement) {
  const toast = document.getElementById('achievement-toast');
  setEl('toast-icon', achievement.icon);
  setEl('toast-achievement', achievement.title);
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 4000);
}

function showToastMsg(msg) {
  // Simple toast using achievement toast system
  const toast = document.getElementById('achievement-toast');
  const icon = document.getElementById('toast-icon');
  const text = document.getElementById('toast-achievement');
  const title = toast.querySelector('.toast-title');
  if (icon) icon.textContent = '';
  if (title) title.style.display = 'none';
  if (text) text.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
    if (title) title.style.display = '';
  }, 2500);
}

// ===== RESET =====
function resetApp() {
  if (!confirm('Sach mein sab kuch reset karna hai? Ye wapas nahi hoga! 😢')) return;
  localStorage.clear();
  state = { userId: null, username: null, companion: null, currentTab: 'chat', selectedType: null, selectedPersonality: null, selectedAvatar: 'av1', selectedTheme: 'dark', isVoiceEnabled: false, isRecording: false, recognition: null, currentGame: null, roundScore: 0, selectedMood: null };
  applyTheme('dark');
  showScreen('onboarding');
  document.querySelector('.onboard-step.active')?.classList.remove('active');
  document.getElementById('step-name').classList.add('active');
}

// ===== API HELPER =====
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ===== UTILS =====
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatRelTime(date) {
  const now = new Date();
  const diff = now - date;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
