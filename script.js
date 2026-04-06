const PLAYER_CODES = ["P1", "P2", "P3", "P4", "P5"];
const TOKENS_PER_ROUND = 10;
const FUND_MULTIPLIER = 2;

const state = {
  started: false,
  totalRounds: 10,
  roundTime: 30,
  currentRound: 1,
  currentEntryIndex: 0,
  contributions: {},
  totalScores: Object.fromEntries(PLAYER_CODES.map((p) => [p, 0])),
  contributionHistory: Object.fromEntries(PLAYER_CODES.map((p) => [p, []])),
  myCode: "P1",
  timer: null,
  remainingSec: 30,
};

const els = {
  setupCard: document.getElementById("setupCard"),
  gameCard: document.getElementById("gameCard"),
  finalCard: document.getElementById("finalCard"),
  roundCount: document.getElementById("roundCount"),
  roundTime: document.getElementById("roundTime"),
  myPlayerCode: document.getElementById("myPlayerCode"),
  startBtn: document.getElementById("startBtn"),
  resetBtn: document.getElementById("resetBtn"),
  restartBtn: document.getElementById("restartBtn"),
  roundTitle: document.getElementById("roundTitle"),
  timer: document.getElementById("timer"),
  entryPanel: document.getElementById("entryPanel"),
  entryTitle: document.getElementById("entryTitle"),
  contributionInput: document.getElementById("contributionInput"),
  submitContribution: document.getElementById("submitContribution"),
  nextPlayer: document.getElementById("nextPlayer"),
  roundResult: document.getElementById("roundResult"),
  totalContribution: document.getElementById("totalContribution"),
  amplifiedFund: document.getElementById("amplifiedFund"),
  sharePerPlayer: document.getElementById("sharePerPlayer"),
  avgContribution: document.getElementById("avgContribution"),
  resultTableBody: document.getElementById("resultTableBody"),
  nextRoundBtn: document.getElementById("nextRoundBtn"),
  meCode: document.getElementById("meCode"),
  myContribution: document.getElementById("myContribution"),
  myShare: document.getElementById("myShare"),
  myRoundScore: document.getElementById("myRoundScore"),
  myTotalScore: document.getElementById("myTotalScore"),
  finalTableBody: document.getElementById("finalTableBody"),
};

function init() {
  PLAYER_CODES.forEach((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    els.myPlayerCode.append(option);
  });

  els.startBtn.addEventListener("click", startGame);
  els.submitContribution.addEventListener("click", submitContribution);
  els.nextPlayer.addEventListener("click", moveToNextPlayer);
  els.nextRoundBtn.addEventListener("click", nextRound);
  els.resetBtn.addEventListener("click", resetToSetup);
  els.restartBtn.addEventListener("click", resetToSetup);
}

function startGame() {
  state.totalRounds = clampInt(els.roundCount.value, 1, 30, 10);
  state.roundTime = clampInt(els.roundTime.value, 10, 180, 30);
  state.myCode = els.myPlayerCode.value;

  state.started = true;
  state.currentRound = 1;
  state.totalScores = Object.fromEntries(PLAYER_CODES.map((p) => [p, 0]));
  state.contributionHistory = Object.fromEntries(PLAYER_CODES.map((p) => [p, []]));

  els.setupCard.classList.add("hidden");
  els.gameCard.classList.remove("hidden");
  els.finalCard.classList.add("hidden");
  setupRound();
}

function setupRound() {
  state.currentEntryIndex = 0;
  state.contributions = {};
  state.remainingSec = state.roundTime;

  els.roundResult.classList.add("hidden");
  els.entryPanel.classList.remove("hidden");
  els.submitContribution.disabled = false;
  els.nextPlayer.disabled = true;

  updateHeader();
  updateEntryTitle();
  els.contributionInput.value = "0";
  startTimer();
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

function submitContribution() {
  const player = PLAYER_CODES[state.currentEntryIndex];
  const value = clampInt(els.contributionInput.value, 0, 10, 0);

  state.contributions[player] = value;
  els.submitContribution.disabled = true;
  els.nextPlayer.disabled = false;
}

function moveToNextPlayer() {
  state.currentEntryIndex += 1;
  els.submitContribution.disabled = false;
  els.nextPlayer.disabled = true;

  if (state.currentEntryIndex >= PLAYER_CODES.length) {
    finishRound();
    return;
  }

  updateEntryTitle();
  els.contributionInput.value = "0";
}

function autoFillAndFinishRound() {
  for (const code of PLAYER_CODES) {
    if (typeof state.contributions[code] !== "number") {
      state.contributions[code] = 0;
    }
  }
  finishRound();
}

function finishRound() {
  clearInterval(state.timer);

  for (const code of PLAYER_CODES) {
    if (typeof state.contributions[code] !== "number") {
      state.contributions[code] = 0;
    }
  }

  const totalContribution = PLAYER_CODES.reduce((sum, p) => sum + state.contributions[p], 0);
  const amplified = totalContribution * FUND_MULTIPLIER;
  const share = amplified / PLAYER_CODES.length;
  const avg = totalContribution / PLAYER_CODES.length;

  els.totalContribution.textContent = String(totalContribution);
  els.amplifiedFund.textContent = String(amplified);
  els.sharePerPlayer.textContent = share.toFixed(2);
  els.avgContribution.textContent = avg.toFixed(2);

  els.resultTableBody.innerHTML = "";
  PLAYER_CODES.forEach((player) => {
    const contribution = state.contributions[player];
    const kept = TOKENS_PER_ROUND - contribution;
    const roundScore = kept + share;

    state.totalScores[player] += roundScore;
    state.contributionHistory[player].push(contribution);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${player}</td>
      <td>${contribution}</td>
      <td>${kept.toFixed(2)}</td>
      <td>${share.toFixed(2)}</td>
      <td>${roundScore.toFixed(2)}</td>
      <td>${state.totalScores[player].toFixed(2)}</td>
    `;
    els.resultTableBody.append(tr);
  });

  const myContribution = state.contributions[state.myCode];
  const myRoundScore = TOKENS_PER_ROUND - myContribution + share;

  els.meCode.textContent = state.myCode;
  els.myContribution.textContent = String(myContribution);
  els.myShare.textContent = share.toFixed(2);
  els.myRoundScore.textContent = myRoundScore.toFixed(2);
  els.myTotalScore.textContent = state.totalScores[state.myCode].toFixed(2);

  els.entryPanel.classList.add("hidden");
  els.roundResult.classList.remove("hidden");
}

function nextRound() {
  if (state.currentRound >= state.totalRounds) {
    showFinal();
    return;
  }

  state.currentRound += 1;
  setupRound();
}

function showFinal() {
  els.gameCard.classList.add("hidden");
  els.finalCard.classList.remove("hidden");
  els.finalTableBody.innerHTML = "";

  PLAYER_CODES.forEach((player) => {
    const arr = state.contributionHistory[player];
    const avgContribution = arr.length
      ? arr.reduce((a, b) => a + b, 0) / arr.length
      : 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${player}</td>
      <td>${state.totalScores[player].toFixed(2)}</td>
      <td>${avgContribution.toFixed(2)}</td>
    `;
    els.finalTableBody.append(tr);
  });
}

function resetToSetup() {
  clearInterval(state.timer);
  state.started = false;

  els.setupCard.classList.remove("hidden");
  els.gameCard.classList.add("hidden");
  els.finalCard.classList.add("hidden");
}

function updateHeader() {
  els.roundTitle.textContent = `라운드 ${state.currentRound} / ${state.totalRounds}`;
}

function updateEntryTitle() {
  const player = PLAYER_CODES[state.currentEntryIndex];
  els.entryTitle.textContent = `${player} 투자 입력`;
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

init();
