// ==== Supabase Configuration ====
// IMPORTANT: Replace with your actual Supabase project credentials
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

let supabase = null;
let roomChannel = null;

// Initialize Supabase client
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (err) {
  console.error('Supabase init error:', err);
}

const PLAYER_CODES = ["P1", "P2", "P3", "P4", "P5"];
const TOKENS_PER_ROUND = 10;
const FUND_MULTIPLIER = 2.5;
const TOTAL_ROUNDS = 7;
const ROUND_TIME_SEC = 20;
const COOP_BONUS = 2;

const QUICK_MESSAGES = [
  "이번 판은 같이 5 이상 맞춰요",
  "난 이번에 낮게 갈 수도",
  "약속 지키면 다음 라운드도 협력",
  "이번 판은 상황 봐서",
  "믿고 간다",
];

const state = {
  currentRound: 1,
  currentEntryIndex: 0,
  declarationIndex: 0,
  warningIndex: 0,
  contributions: {},
  declarations: {},
  warningsGiven: {},
  warningTally: Object.fromEntries(PLAYER_CODES.map((p) => [p, 0])),
  penalties: Object.fromEntries(PLAYER_CODES.map((p) => [p, 0])),
  totalScores: Object.fromEntries(PLAYER_CODES.map((p) => [p, 0])),
  contributionHistory: Object.fromEntries(PLAYER_CODES.map((p) => [p, []])),
  nicknameMap: Object.fromEntries(PLAYER_CODES.map((p) => [p, p])),
  myCode: "P1",
  inviteCode: "",
  roomId: null,
  players: [],
  isHost: false,
  timer: null,
  remainingSec: ROUND_TIME_SEC,
  roundMessages: [],
};

const els = Object.fromEntries(
  Array.from(document.querySelectorAll('[id]')).map((el) => [el.id, el])
);

// ==== Supabase Room Functions ====
async function createRoom() {
  if (!supabase) return alert('Supabase not configured');
  const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { data, error } = await supabase.from('rooms').insert({
    room_code: roomCode,
    state: { round: 1, phase: 'lobby', players: {} },
    created_at: new Date().toISOString()
  }).select().single();
  
  if (error) {
    console.error('Room creation error:', error);
    alert('방 생성 실패');
    return null;
  }
  return data;
}

async function joinRoom(roomCode) {
  if (!supabase) return alert('Supabase not configured');
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('room_code', roomCode)
    .single();
  
  if (error || !data) {
    alert('방을 찾을 수 없습니다');
    return null;
  }
  return data;
}

async function subscribeToRoom(roomId) {
  if (!supabase || !roomId) return;
  
  roomChannel = supabase.channel(`room:${roomId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      console.log('Room update:', payload);
      handleRoomUpdate(payload.new);
    })
    .subscribe();
}

function handleRoomUpdate(roomData) {
  if (!roomData || !roomData.state) return;
  // Sync game state from database
  const dbState = roomData.state;
  if (dbState.round) state.currentRound = dbState.round;
  if (dbState.players) {
    state.players = Object.keys(dbState.players);
    updateLobbyStatus();
  }
}

async function updateRoomState(updates) {
  if (!supabase || !state.roomId) return;
  const { data: current } = await supabase
    .from('rooms')
    .select('state')
    .eq('id', state.roomId)
    .single();
  
  const newState = { ...current?.state, ...updates };
  await supabase
    .from('rooms')
    .update({ state: newState })
    .eq('id', state.roomId);
}

function updateLobbyStatus() {
  const count = state.players.length;
  els.lobbyStatus.textContent = `현재 입장: ${count}/5명`;
  els.startBtn.disabled = count < 5;
}

// ==== Init ====
function init() {
  PLAYER_CODES.forEach((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    els.myPlayerCode.append(option);
  });

  QUICK_MESSAGES.forEach((msg) => {
    const option = document.createElement("option");
    option.value = msg;
    option.textContent = msg;
    els.messageSelect.append(option);
  });

  els.generateCodeBtn.addEventListener("click", handleCreateRoom);
  els.joinRoomBtn.addEventListener("click", handleJoinRoom);
  els.startBtn.addEventListener("click", startGame);
  els.submitDeclaration.addEventListener("click", submitDeclaration);
  els.submitMessage.addEventListener("click", submitMessage);
  els.submitContribution.addEventListener("click", submitContribution);
  els.nextPlayer.addEventListener("click", moveToNextPlayer);
  els.submitWarning.addEventListener("click", submitWarning);
  els.nextRoundBtn.addEventListener("click", nextRound);
  els.resetBtn.addEventListener("click", resetToSetup);
  els.restartBtn.addEventListener("click", resetToSetup);

  updateLobbyStatus();
}

async function handleCreateRoom() {
  const room = await createRoom();
  if (!room) return;
  
  state.roomId = room.id;
  state.inviteCode = room.room_code;
  state.isHost = true;
  
  els.inviteCode.textContent = state.inviteCode;
  
  await subscribeToRoom(state.roomId);
  
  // Register self as player
  const myNick = (els.myNickname.value || '나').trim();
  const myCode = els.myPlayerCode.value;
  state.myCode = myCode;
  state.nicknameMap[myCode] = myNick;
  state.players.push(myCode);
  
  await updateRoomState({
    players: { [myCode]: { nickname: myNick, ready: true } }
  });
  
  updateLobbyStatus();
}

async function handleJoinRoom() {
  const roomCode = els.joinCodeInput.value.trim().toUpperCase();
  if (!roomCode) return alert('방 코드를 입력하세요');
  
  const room = await joinRoom(roomCode);
  if (!room) return;
  
  state.roomId = room.id;
  state.inviteCode = room.room_code;
  state.isHost = false;
  
  els.inviteCode.textContent = state.inviteCode;
  
  await subscribeToRoom(state.roomId);
  
  const myNick = (els.myNickname.value || '나').trim();
  const myCode = els.myPlayerCode.value;
  state.myCode = myCode;
  state.nicknameMap[myCode] = myNick;
  
  // Add self to room
  const { data: current } = await supabase
    .from('rooms')
    .select('state')
    .eq('id', state.roomId)
    .single();
  
  const players = current.state.players || {};
  players[myCode] = { nickname: myNick, ready: true };
  
  await updateRoomState({ players });
  
  state.players = Object.keys(players);
  updateLobbyStatus();
}

function startGame() {
  if (!state.isHost) return alert('방장만 시작할 수 있습니다');
  if (state.players.length < 5) return alert('5명이 모여야 시작할 수 있습니다');
  
  state.currentRound = 1;
  state.totalScores = Object.fromEntries(PLAYER_CODES.map((p) => [p, 0]));
  state.warningTally = Object.fromEntries(PLAYER_CODES.map((p) => [p, 0]));
  state.penalties = Object.fromEntries(PLAYER_CODES.map((p) => [p, 0]));
  state.contributionHistory = Object.fromEntries(PLAYER_CODES.map((p) => [p, []]));

  els.lobbyCard.classList.add("hidden");
  els.gameCard.classList.remove("hidden");
  els.finalCard.classList.add("hidden");
  
  updateRoomState({ phase: 'game', round: 1 });
  setupRound();
}

function setupRound() {
  state.currentEntryIndex = 0;
  state.declarationIndex = 0;
  state.warningIndex = 0;
  state.contributions = {};
  state.declarations = {};
  state.warningsGiven = {};
  state.roundMessages = [];
  state.remainingSec = ROUND_TIME_SEC;

  els.roundResult.classList.add("hidden");
  els.warningPanel.classList.add("hidden");
  els.entryPanel.classList.remove("hidden");
  els.declarationInput.value = "5";
  els.contributionInput.value = "0";
  els.submitContribution.disabled = false;
  els.nextPlayer.disabled = true;

  updateHeader();
  updatePenaltyInfo();
  updateDeclarationUi();
  updateMessageUi();
  updateEntryTitle();
  startTimer();
}

function updateHeader() {
  els.roundTitle.textContent = `라운드 ${state.currentRound} / ${TOTAL_ROUNDS}`;
}

function updatePenaltyInfo() {
  const active = PLAYER_CODES.filter((p) => state.penalties[p] > 0)
    .map((p) => `${state.nicknameMap[p]} -${state.penalties[p]}`)
    .join(", ");
  els.roundPenaltyInfo.textContent = active
    ? `이번 라운드 시작 페널티: ${active}`
    : "이번 라운드 시작 페널티 없음";
}

function startTimer() {
  clearInterval(state.timer);
  els.timer.textContent = `남은 시간: ${state.remainingSec}초`;
  state.timer = setInterval(() => {
    state.remainingSec -= 1;
    els.timer.textContent = `남은 시간: ${Math.max(state.remainingSec, 0)}초`;
    if (state.remainingSec <= 0) {
      clearInterval(state.timer);
      autoFillAndFinishRound();
    }
  }, 1000);
}

function updateDeclarationUi() {
  const p = PLAYER_CODES[state.declarationIndex];
  els.declarePlayerLabel.textContent = `${state.nicknameMap[p]} 선언`;
}

function submitDeclaration() {
  if (state.declarationIndex >= PLAYER_CODES.length) return;
  const p = PLAYER_CODES[state.declarationIndex];
  state.declarations[p] = clampInt(els.declarationInput.value, 0, 10, 5);
  state.declarationIndex += 1;
  if (state.declarationIndex < PLAYER_CODES.length) updateDeclarationUi();
  else els.declarePlayerLabel.textContent = "선언 완료";
}

function updateMessageUi() {
  const p = PLAYER_CODES[state.currentEntryIndex];
  els.messagePlayerLabel.textContent = `${state.nicknameMap[p]} 메시지`;
}

function submitMessage() {
  const p = PLAYER_CODES[state.currentEntryIndex];
  const msg = els.messageSelect.value;
  state.roundMessages.push(`${state.nicknameMap[p]}: ${msg}`);
}

function submitContribution() {
  const p = PLAYER_CODES[state.currentEntryIndex];
  state.contributions[p] = clampInt(els.contributionInput.value, 0, 10, 0);
  els.submitContribution.disabled = true;
  els.nextPlayer.disabled = false;
}

function moveToNextPlayer() {
  state.currentEntryIndex += 1;
  els.submitContribution.disabled = false;
  els.nextPlayer.disabled = true;
  if (state.currentEntryIndex >= PLAYER_CODES.length) {
    prepareWarningPhase();
    return;
  }
  els.contributionInput.value = "0";
  updateEntryTitle();
  updateMessageUi();
}

function updateEntryTitle() {
  const p = PLAYER_CODES[state.currentEntryIndex];
  els.entryTitle.textContent = `${state.nicknameMap[p]} 투자 입력`;
}

function prepareWarningPhase() {
  els.entryPanel.classList.add("hidden");
  els.warningPanel.classList.remove("hidden");
  updateWarningUi();
}

function updateWarningUi() {
  const giver = PLAYER_CODES[state.warningIndex];
  els.warningGiverLabel.textContent = `${state.nicknameMap[giver]} 경고 대상`;
  els.warningTarget.innerHTML = "";
  PLAYER_CODES.filter((p) => p !== giver).forEach((target) => {
    const opt = document.createElement("option");
    opt.value = target;
    opt.textContent = state.nicknameMap[target];
    els.warningTarget.append(opt);
  });
}

function submitWarning() {
  const giver = PLAYER_CODES[state.warningIndex];
  const target = els.warningTarget.value;
  state.warningsGiven[giver] = target;
  state.warningTally[target] += 1;
  state.warningIndex += 1;
  if (state.warningIndex >= PLAYER_CODES.length) {
    finishRound();
    return;
  }
  updateWarningUi();
}

function autoFillAndFinishRound() {
  PLAYER_CODES.forEach((p) => {
    if (typeof state.contributions[p] !== "number") state.contributions[p] = 0;
    if (typeof state.declarations[p] !== "number") state.declarations[p] = 0;
  });
  if (Object.keys(state.warningsGiven).length < PLAYER_CODES.length) {
    PLAYER_CODES.forEach((giver) => {
      if (!state.warningsGiven[giver]) {
        const target = PLAYER_CODES.find((p) => p !== giver);
        state.warningsGiven[giver] = target;
        state.warningTally[target] += 1;
      }
    });
  }
  finishRound();
}

function finishRound() {
  clearInterval(state.timer);
  PLAYER_CODES.forEach((p) => {
    if (typeof state.contributions[p] !== "number") state.contributions[p] = 0;
    if (typeof state.declarations[p] !== "number") state.declarations[p] = 0;
  });

  const total = PLAYER_CODES.reduce((sum, p) => sum + state.contributions[p], 0);
  const amplified = total * FUND_MULTIPLIER;
  const share = amplified / PLAYER_CODES.length;
  const coop = PLAYER_CODES.every((p) => state.contributions[p] >= 5);

  els.totalContribution.textContent = String(total);
  els.amplifiedFund.textContent = amplified.toFixed(2);
  els.sharePerPlayer.textContent = share.toFixed(2);
  els.coopBonusInfo.textContent = coop ? `전원 +${COOP_BONUS}토큰` : "없음";

  els.resultTableBody.innerHTML = "";
  PLAYER_CODES.forEach((p) => {
    const contribution = state.contributions[p];
    const penalty = state.penalties[p] || 0;
    const available = TOKENS_PER_ROUND - penalty;
    const kept = Math.max(0, available - contribution);
    const roundScore = kept + share + (coop ? COOP_BONUS : 0);
    state.totalScores[p] += roundScore;
    state.contributionHistory[p].push(contribution);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${state.nicknameMap[p]}</td>
      <td>${state.declarations[p]}</td>
      <td>${contribution}</td>
      <td>${kept.toFixed(2)}</td>
      <td>${roundScore.toFixed(2)}</td>
      <td>${state.totalScores[p].toFixed(2)}</td>
      <td>${state.warningTally[p]}</td>
    `;
    els.resultTableBody.append(tr);
  });

  applyNextRoundPenalties();
  renderMe();
  renderLeaderboard();

  els.warningPanel.classList.add("hidden");
  els.roundResult.classList.remove("hidden");
}

function applyNextRoundPenalties() {
  PLAYER_CODES.forEach((p) => {
    state.penalties[p] = state.warningTally[p] >= 2 ? 2 : 0;
  });
}

function renderMe() {
  const me = state.myCode;
  const contribution = state.contributions[me];
  const penalty = state.penalties[me] || 0;
  const available = TOKENS_PER_ROUND - penalty;
  const total = PLAYER_CODES.reduce((sum, p) => sum + state.contributions[p], 0);
  const share = (total * FUND_MULTIPLIER) / PLAYER_CODES.length;
  const coop = PLAYER_CODES.every((p) => state.contributions[p] >= 5);
  const roundScore = Math.max(0, available - contribution) + share + (coop ? COOP_BONUS : 0);

  els.meCode.textContent = me;
  els.myContribution.textContent = String(contribution);
  els.myRoundScore.textContent = roundScore.toFixed(2);
  els.myTotalScore.textContent = state.totalScores[me].toFixed(2);
}

function renderLeaderboard() {
  const arr = [...PLAYER_CODES].sort((a, b) => state.totalScores[b] - state.totalScores[a]);
  els.leaderboard.innerHTML = "";
  arr.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `${state.nicknameMap[p]} - ${state.totalScores[p].toFixed(2)}점`;
    els.leaderboard.append(li);
  });
}

function nextRound() {
  if (state.currentRound >= TOTAL_ROUNDS) return showFinal();
  state.currentRound += 1;
  setupRound();
}

function showFinal() {
  els.gameCard.classList.add("hidden");
  els.finalCard.classList.remove("hidden");
  els.finalTableBody.innerHTML = "";

  const ranking = [...PLAYER_CODES].sort((a, b) => state.totalScores[b] - state.totalScores[a]);
  const winner = ranking[0];
  const coopKing = [...PLAYER_CODES].sort(
    (a, b) => avgContributionRate(b) - avgContributionRate(a)
  )[0];
  const avgRate = (
    PLAYER_CODES.reduce((sum, p) => sum + avgContributionRate(p), 0) / PLAYER_CODES.length
  ).toFixed(1);

  els.finalHighlights.innerHTML = `
    <p><strong>우승자</strong> ${state.nicknameMap[winner]}</p>
    <p><strong>협력왕</strong> ${state.nicknameMap[coopKing]}</p>
    <p><strong>전체 평균 기여율</strong> ${avgRate}%</p>
  `;

  ranking.forEach((p, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${state.nicknameMap[p]}</td>
      <td>${state.totalScores[p].toFixed(2)}</td>
      <td>${avgContributionRate(p).toFixed(1)}</td>
      <td>${state.warningTally[p]}</td>
    `;
    els.finalTableBody.append(tr);
  });
}

function avgContributionRate(player) {
  const arr = state.contributionHistory[player];
  if (!arr.length) return 0;
  return (arr.reduce((a, b) => a + b, 0) / (arr.length * TOKENS_PER_ROUND)) * 100;
}

function resetToSetup() {
  clearInterval(state.timer);
  if (roomChannel) roomChannel.unsubscribe();
  
  state.roomId = null;
  state.inviteCode = "";
  state.players = [];
  state.isHost = false;
  
  els.lobbyCard.classList.remove("hidden");
  els.gameCard.classList.add("hidden");
  els.finalCard.classList.add("hidden");
  els.inviteCode.textContent = "-";
  els.joinCodeInput.value = "";
  updateLobbyStatus();
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

init();
