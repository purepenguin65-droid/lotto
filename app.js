const MIN = 1;
const MAX = 45;
const COUNT = 6;
const MIX_DURATION = 900;
const ROLL_DURATION = 550;
const HOLD_DURATION = 450;
const FLY_DURATION = 650;
const BETWEEN_DRAW = 250;

const drawBtn = document.getElementById("drawBtn");
const resetBtn = document.getElementById("resetBtn");
const birthDateInput = document.getElementById("birthDate");
const birthdayHint = document.getElementById("birthdayHint");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const bonusBall = document.getElementById("bonusBall");
const machine = document.getElementById("machine");
const machineDrum = document.getElementById("machineDrum");
const drumBalls = document.getElementById("drumBalls");
const neckBall = document.getElementById("neckBall");
const dispenserBall = document.getElementById("dispenserBall");
const machineStatus = document.getElementById("machineStatus");
const flyingBall = document.getElementById("flyingBall");

const balls = [...document.querySelectorAll(".main-balls .ball")];
let isDrawing = false;
let history = [];
let drumBallEls = new Map();

function getBallColor(num) {
  if (num <= 10) return "yellow";
  if (num <= 20) return "blue";
  if (num <= 30) return "red";
  if (num <= 40) return "gray";
  return "green";
}

function generateNumbers() {
  const pool = Array.from({ length: MAX }, (_, i) => i + MIN);
  const drawOrder = [];

  for (let i = 0; i < COUNT; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    drawOrder.push(pool.splice(idx, 1)[0]);
  }

  const bonusIdx = Math.floor(Math.random() * pool.length);
  const bonus = pool[bonusIdx];

  return {
    drawOrder,
    main: [...drawOrder].sort((a, b) => a - b),
    bonus,
  };
}

function initDrumBalls() {
  drumBalls.innerHTML = "";
  drumBallEls.clear();

  for (let num = MIN; num <= MAX; num++) {
    const el = document.createElement("div");
    el.className = `drum-ball ${getBallColor(num)}`;
    el.textContent = num;
    el.dataset.num = num;
    el.style.left = `${8 + Math.random() * 74}%`;
    el.style.top = `${10 + Math.random() * 68}%`;
    el.style.animationDelay = `${Math.random() * 0.8}s`;
    drumBalls.appendChild(el);
    drumBallEls.set(num, el);
  }
}

function setMachineStatus(text) {
  machineStatus.textContent = text;
}

function hideDispenserBall() {
  dispenserBall.hidden = true;
  dispenserBall.className = "dispenser-ball";
}

function hideNeckBall() {
  neckBall.hidden = true;
  neckBall.className = "neck-ball";
}

function showMachineBall(el, num) {
  el.hidden = false;
  el.textContent = num;
  el.className = `${el.classList.contains("neck-ball") ? "neck-ball" : "dispenser-ball"} ${getBallColor(num)}`;
}

function removeDrumBall(num) {
  const el = drumBallEls.get(num);
  if (!el) return;
  el.classList.add("picked");
  drumBallEls.delete(num);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setMixing(active) {
  machine.classList.toggle("mixing", active);
  machineDrum.classList.toggle("mixing", active);
}

async function mixDrum(message) {
  setMachineStatus(message);
  setMixing(true);
  await wait(MIX_DURATION);
  setMixing(false);
}

async function rollOutBall(num) {
  hideDispenserBall();
  showMachineBall(neckBall, num);
  neckBall.classList.add("rolling");

  await wait(ROLL_DURATION);
  neckBall.classList.remove("rolling");
  neckBall.hidden = true;

  showMachineBall(dispenserBall, num);
  dispenserBall.classList.add("landed");
  await wait(HOLD_DURATION);
  dispenserBall.classList.remove("landed");
}

async function flyBallToSlot(targetSlot, num) {
  const fromRect = dispenserBall.getBoundingClientRect();
  const toRect = targetSlot.getBoundingClientRect();
  const size = toRect.width;

  flyingBall.hidden = false;
  flyingBall.textContent = num;
  flyingBall.className = `flying-ball ${getBallColor(num)}`;
  flyingBall.style.width = `${size}px`;
  flyingBall.style.height = `${size}px`;

  const startX = fromRect.left + fromRect.width / 2 - size / 2;
  const startY = fromRect.top + fromRect.height / 2 - size / 2;
  const endX = toRect.left + toRect.width / 2 - size / 2;
  const endY = toRect.top + toRect.height / 2 - size / 2;

  flyingBall.style.left = `${startX}px`;
  flyingBall.style.top = `${startY}px`;

  hideDispenserBall();

  await flyingBall.animate(
    [
      { left: `${startX}px`, top: `${startY}px`, transform: "scale(1.15)" },
      { left: `${endX}px`, top: `${endY}px`, transform: "scale(1)" },
    ],
    { duration: FLY_DURATION, easing: "cubic-bezier(0.34, 1.2, 0.64, 1)", fill: "forwards" }
  ).finished;

  flyingBall.hidden = true;
  flyingBall.style.transform = "";
}

async function drawOneNumber(num, targetSlot, message) {
  await mixDrum(message);
  removeDrumBall(num);
  await rollOutBall(num);
  await flyBallToSlot(targetSlot, num);
  setBallState(targetSlot, num, true);
  await wait(BETWEEN_DRAW);
}

function setBallState(ball, num, animate) {
  ball.classList.remove("placeholder", "yellow", "blue", "red", "gray", "green", "reveal", "spinning");

  if (num === null) {
    ball.textContent = "?";
    ball.classList.add("placeholder");
    return;
  }

  ball.textContent = num;
  ball.classList.add(getBallColor(num));
  if (animate) ball.classList.add("reveal");
}

function resetBalls() {
  balls.forEach((ball) => setBallState(ball, null));
  setBallState(bonusBall, null);
  hideDispenserBall();
  hideNeckBall();
  flyingBall.hidden = true;
  setMixing(false);
  initDrumBalls();
  setMachineStatus("추첨기가 준비되었습니다");
}

function formatTime(date) {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getTodayString() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatBirthDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${y}. ${m}. ${d}.`;
}

function validateBirthDate() {
  const value = birthDateInput.value;

  if (!value) {
    return { valid: false, message: "추첨 전 생년월일을 입력해 주세요." };
  }

  const birth = new Date(value);
  const today = new Date(getTodayString());

  if (Number.isNaN(birth.getTime())) {
    return { valid: false, message: "올바른 생년월일을 입력해 주세요." };
  }

  if (birth > today) {
    return { valid: false, message: "미래 날짜는 입력할 수 없습니다." };
  }

  if (birth.getFullYear() < 1900) {
    return { valid: false, message: "1900년 이후 생년월일만 입력할 수 있습니다." };
  }

  return { valid: true, message: "생년월일이 확인되었습니다. 추첨을 시작할 수 있습니다." };
}

function updateDrawButtonState() {
  const { valid, message } = validateBirthDate();
  birthdayHint.textContent = message;
  birthdayHint.classList.toggle("birthday-hint--error", !valid && birthDateInput.value !== "");
  birthdayHint.classList.toggle("birthday-hint--ok", valid);
  drawBtn.disabled = !valid || isDrawing;
}

function renderHistory() {
  if (history.length === 0) {
    historyList.innerHTML = '<li class="history-empty">아직 추첨 기록이 없습니다</li>';
    clearHistoryBtn.hidden = true;
    return;
  }

  clearHistoryBtn.hidden = false;
  historyList.innerHTML = history
    .map(
      (entry, i) => `
      <li class="history-item">
        <span class="history-index">#${history.length - i}</span>
        <div class="history-balls">
          ${entry.numbers
            .map(
              (n) =>
                `<span class="history-ball ${getBallColor(n)}">${n}</span>`
            )
            .join("")}
          <span class="history-plus">+</span>
          <span class="history-ball history-ball-bonus ${getBallColor(entry.bonus)}">${entry.bonus}</span>
        </div>
        <div class="history-meta">
          ${entry.birthDate ? `<span class="history-birth">${formatBirthDate(entry.birthDate)}</span>` : ""}
          <span class="history-time">${entry.time}</span>
        </div>
      </li>`
    )
    .join("");
}

async function drawNumbers() {
  if (isDrawing) return;

  const birthCheck = validateBirthDate();
  if (!birthCheck.valid) {
    birthdayHint.textContent = birthCheck.message;
    birthdayHint.classList.add("birthday-hint--error");
    return;
  }

  const birthDate = birthDateInput.value;
  isDrawing = true;
  drawBtn.disabled = true;
  resetBtn.disabled = true;
  birthDateInput.disabled = true;

  resetBalls();
  const { drawOrder, main, bonus } = generateNumbers();

  for (let i = 0; i < drawOrder.length; i++) {
    const num = drawOrder[i];
    await drawOneNumber(
      num,
      balls[main.indexOf(num)],
      `${i + 1}번째 구슬을 뽑는 중...`
    );
  }

  await drawOneNumber(bonus, bonusBall, "보너스 구슬을 뽑는 중...");
  setMachineStatus("추첨이 완료되었습니다!");

  history.unshift({
    numbers: main,
    bonus,
    birthDate,
    time: formatTime(new Date()),
  });
  if (history.length > 20) history.pop();
  renderHistory();

  isDrawing = false;
  birthDateInput.disabled = false;
  resetBtn.disabled = false;
  updateDrawButtonState();
}

birthDateInput.max = getTodayString();
birthDateInput.addEventListener("input", updateDrawButtonState);
birthDateInput.addEventListener("change", updateDrawButtonState);

drawBtn.addEventListener("click", drawNumbers);

resetBtn.addEventListener("click", () => {
  if (isDrawing) return;
  resetBalls();
  resetBtn.disabled = true;
});

clearHistoryBtn.addEventListener("click", () => {
  history = [];
  renderHistory();
});

const PAST_PAGE_SIZE = 15;
const pastRange = document.getElementById("pastRange");
const pastList = document.getElementById("pastList");
const pastPagination = document.getElementById("pastPagination");
const drawSearch = document.getElementById("drawSearch");
const numberFilter = document.getElementById("numberFilter");
const pastSearchBtn = document.getElementById("pastSearchBtn");
const pastResetBtn = document.getElementById("pastResetBtn");

let pastData = [];
let filteredPast = [];
let pastPage = 1;

function renderBallGroup(numbers, bonus) {
  return `
    ${numbers.map((n) => `<span class="history-ball ${getBallColor(n)}">${n}</span>`).join("")}
    <span class="history-plus">+</span>
    <span class="history-ball history-ball-bonus ${getBallColor(bonus)}">${bonus}</span>
  `;
}

function formatDrawDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getFirstPrizeInfo(draw) {
  const first = draw.divisions?.[0];
  if (!first?.prize) {
    return { prizeText: "1등 당첨자 없음", winnersText: "" };
  }

  const prizeText = `1등 인당 ${first.prize.toLocaleString("ko-KR")}원`;
  const winnersText = first.winners ? `당첨 ${first.winners}명` : "";
  return { prizeText, winnersText };
}

function applyPastFilters() {
  const drawNo = drawSearch.value ? Number(drawSearch.value) : null;
  const includeNum = numberFilter.value ? Number(numberFilter.value) : null;

  filteredPast = pastData.filter((draw) => {
    if (drawNo && draw.draw_no !== drawNo) return false;
    if (includeNum) {
      const hasNumber =
        draw.numbers.includes(includeNum) || draw.bonus_no === includeNum;
      if (!hasNumber) return false;
    }
    return true;
  });

  pastPage = 1;
  renderPastList();
}

function renderPastList() {
  const total = filteredPast.length;
  const totalPages = Math.max(1, Math.ceil(total / PAST_PAGE_SIZE));
  pastPage = Math.min(pastPage, totalPages);
  const start = (pastPage - 1) * PAST_PAGE_SIZE;
  const pageItems = filteredPast.slice(start, start + PAST_PAGE_SIZE);

  if (total === 0) {
    pastList.innerHTML = '<li class="history-empty">검색 결과가 없습니다</li>';
    pastPagination.innerHTML = "";
    return;
  }

  pastList.innerHTML = pageItems
    .map((draw) => {
      const { prizeText, winnersText } = getFirstPrizeInfo(draw);
      return `
      <li class="past-item">
        <div class="past-meta">
          <span class="past-draw">${draw.draw_no}회</span>
          <span class="past-date">${formatDrawDate(draw.date)}</span>
          <span class="past-prize">${prizeText}</span>
          ${winnersText ? `<span class="past-winners">${winnersText}</span>` : ""}
        </div>
        <div class="history-balls">${renderBallGroup(draw.numbers, draw.bonus_no)}</div>
      </li>`;
    })
    .join("");

  pastPagination.innerHTML = `
    <button class="btn-page" type="button" data-dir="prev" ${pastPage <= 1 ? "disabled" : ""}>이전</button>
    <span class="page-info">${pastPage} / ${totalPages}</span>
    <button class="btn-page" type="button" data-dir="next" ${pastPage >= totalPages ? "disabled" : ""}>다음</button>
  `;
}

function loadPastWinners() {
  if (!window.LOTTO_DATA?.length) {
    pastRange.textContent = "";
    pastList.innerHTML =
      '<li class="history-empty">역대 당첨번호를 불러오지 못했습니다</li>';
    return;
  }

  pastData = [...window.LOTTO_DATA].sort((a, b) => b.draw_no - a.draw_no);
  filteredPast = pastData;

  const latest = pastData[0].draw_no;
  const oldest = pastData[pastData.length - 1].draw_no;
  pastRange.textContent = `${oldest}회 ~ ${latest}회`;
  drawSearch.max = latest;

  renderPastList();
}

pastSearchBtn.addEventListener("click", applyPastFilters);
pastResetBtn.addEventListener("click", () => {
  drawSearch.value = "";
  numberFilter.value = "";
  filteredPast = pastData;
  pastPage = 1;
  renderPastList();
});

drawSearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter") applyPastFilters();
});

numberFilter.addEventListener("keydown", (e) => {
  if (e.key === "Enter") applyPastFilters();
});

pastPagination.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-dir]");
  if (!btn || btn.disabled) return;

  pastPage += btn.dataset.dir === "next" ? 1 : -1;
  renderPastList();
});

initDrumBalls();
loadPastWinners();
