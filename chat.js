const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatRecommendBtn = document.getElementById("chatRecommendBtn");

let chatHistory = [];
let isChatLoading = false;

function getBallColor(num) {
  if (num <= 10) return "yellow";
  if (num <= 20) return "blue";
  if (num <= 30) return "red";
  if (num <= 40) return "gray";
  return "green";
}

function renderBallGroup(numbers, bonus) {
  return `
    <div class="chat-balls">
      ${numbers.map((n) => `<span class="history-ball ${getBallColor(n)}">${n}</span>`).join("")}
      <span class="history-plus">+</span>
      <span class="history-ball history-ball-bonus ${getBallColor(bonus)}">${bonus}</span>
    </div>
  `;
}

function appendChatMessage(role, html) {
  const item = document.createElement("li");
  item.className = `chat-message chat-message--${role}`;
  item.innerHTML = html;
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendUserMessage(text) {
  appendChatMessage("user", `<p>${escapeHtml(text)}</p>`);
  chatHistory.push({ role: "user", text });
}

function appendAssistantMessage(data) {
  const html = `
    <div class="chat-recommendation">
      <p class="chat-fortune-title">오늘의 운세</p>
      <p class="chat-fortune">${escapeHtml(data.fortune)}</p>
      ${renderBallGroup(data.numbers, data.bonus)}
      <p class="chat-explanation">${escapeHtml(data.explanation)}</p>
      <p class="chat-message-text">${escapeHtml(data.message)}</p>
    </div>
  `;
  appendChatMessage("assistant", html);
  chatHistory.push({
    role: "assistant",
    text: `${data.message}\n추천번호: ${data.numbers.join(", ")} + ${data.bonus}`,
  });

  setTimeout(() => window.showSignupModal?.(), 600);
}

function appendErrorMessage(text) {
  appendChatMessage("assistant", `<p class="chat-error">${escapeHtml(text)}</p>`);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setChatLoading(loading) {
  isChatLoading = loading;
  chatSendBtn.disabled = loading;
  chatRecommendBtn.disabled = loading;
  chatInput.disabled = loading;
}

function getBirthDateForChat() {
  const input = document.getElementById("birthDate");
  const value = input?.value;

  if (!value) {
    return { ok: false, message: "챗봇 이용 전 생년월일을 먼저 입력해 주세요." };
  }

  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) {
    return { ok: false, message: "올바른 생년월일을 입력해 주세요." };
  }

  return { ok: true, birthDate: value };
}

function getTodayForChat() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function requestChat(message) {
  const birthCheck = getBirthDateForChat();
  if (!birthCheck.ok) {
    appendErrorMessage(birthCheck.message);
    return;
  }

  if (message) {
    appendUserMessage(message);
  } else {
    appendUserMessage("생년월일과 오늘 운세를 반영해 로또 번호를 추천해 주세요.");
  }

  setChatLoading(true);
  appendChatMessage("assistant", `<p class="chat-loading">운세를 분석하고 번호를 추천하는 중...</p>`);

  const loadingEl = chatMessages.lastElementChild;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        birthDate: birthCheck.birthDate,
        today: getTodayForChat(),
        message: message || "",
        history: chatHistory.slice(0, -1),
      }),
    });

    const data = await res.json();
    loadingEl.remove();

    if (!res.ok) {
      appendErrorMessage(data.error || "AI 응답을 가져오지 못했습니다.");
      if (message) chatHistory.pop();
      return;
    }

    if (data.numbers?.length === 6 && Number.isInteger(data.bonus)) {
      appendAssistantMessage(data);
    } else {
      appendErrorMessage("추천 번호 형식이 올바르지 않습니다. 다시 시도해 주세요.");
      chatHistory.pop();
    }
  } catch {
    loadingEl.remove();
    appendErrorMessage("네트워크 오류가 발생했습니다. Vercel 배포 환경에서 다시 시도해 주세요.");
    if (message) chatHistory.pop();
  } finally {
    setChatLoading(false);
  }
}

chatRecommendBtn.addEventListener("click", () => requestChat(""));

chatSendBtn.addEventListener("click", () => {
  const text = chatInput.value.trim();
  if (!text || isChatLoading) return;
  chatInput.value = "";
  requestChat(text);
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatSendBtn.click();
  }
});
