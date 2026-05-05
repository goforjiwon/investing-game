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
  timer: null,
  remainingSec: ROUND_TIME_SEC,
  roundMessages: [],
};

const els = Object.fromEntries(Array.from(document.querySelectorAll('[id]')).map((el) => [el.id, el]));

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

  els.generateCodeBtn.addEventListener("click", generateInviteCode);
  els.startBtn.addEventListener("click", startGame);
  els.submitDeclaration.addEventListener("click", submitDeclaration);
  els.submitMessage.addEventListener("click", submitMessage);
  els.submitContribution.addEventListener("click", submitContribution);
  els.nextPlayer.addEventListener("click", moveToNextPlayer);
  els.submitWarning.addEventListener("click", submitWarning);
  els.nextRoundBtn.addEventListener("click", nextRound);
  els.resetBtn.addEventListener("click", resetToSetup);
  els.restartBtn.addEventListener("click", resetToSetup);

  generateInviteCode();
}

function generateInviteCode() {
  state.inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  els.inviteCode.textContent = state.inviteCode;
}

function startGame() {
  state.myCode = els.myPlayerCode.value;
  state.currentRound = 1;
  state.totalScores = Object.fromEntries(PLAYER_CODES.map((p) => [p, 0]));
  state.warningTally = Object.fromEntries(PLAYER_CODES.map((p) => [p, 0]));
  state.penalties = Object.fromEntries(PLAYER_CODES.map((p) => [p, 0]));
  state.contributionHistory = Object.fromEntries(PLAYER_CODES.map((p) => [p, []]));

  const baseName = (els.myNickname.value || "나").trim();
  PLAYER_CODES.forEach((p) => (state.nicknameMap[p] = p === state.myCode ? baseName : `${p}-친구`));

  els.setupCard.classList.add("hidden");
  els.gameCard.classList.remove("hidden");
  els.finalCard.classList.add("hidden");
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
  els.roundPenaltyInfo.textContent = active ? `이번 라운드 시작 페널티: ${active}` : "이번 라운드 시작 페널티 없음";
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
  const avgRate = (PLAYER_CODES.reduce((sum, p) => sum + avgContributionRate(p), 0) / PLAYER_CODES.length).toFixed(1);

  els.finalHighlights.innerHTML = `
    <div><strong>우승자</strong><span>${state.nicknameMap[winner]}</span></div>
    <div><strong>협력왕</strong><span>${state.nicknameMap[coopKing]}</span></div>
    <div><strong>전체 평균 기여율</strong><span>${avgRate}%</span></div>
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
  els.setupCard.classList.remove("hidden");
  els.gameCard.classList.add("hidden");
  els.finalCard.classList.add("hidden");
  generateInviteCode();
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

init();
