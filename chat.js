const SIGNUP_KEY = "lotto_signup_complete";

const signupModal = document.getElementById("signupModal");
const signupForm = document.getElementById("signupForm");
const signupCloseBtn = document.getElementById("signupCloseBtn");
const signupLaterBtn = document.getElementById("signupLaterBtn");
const signupBackdrop = document.getElementById("signupBackdrop");
const signupSubmitBtn = document.getElementById("signupSubmitBtn");

const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatRecommendBtn = document.getElementById("chatRecommendBtn");

let pendingAction = null;
let publicEnv = null;
let chatHistory = [];
let isChatLoading = false;

function isOnlineHost() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

function apiUrl(path) {
  return `${window.location.origin}${path}`;
}

function getSavedSignupInfo() {
  try {
    return JSON.parse(localStorage.getItem("lotto_signup_info") || "null");
  } catch {
    return null;
  }
}

function isSignedUp() {
  if (localStorage.getItem(SIGNUP_KEY) !== "true") return false;

  const info = getSavedSignupInfo();
  if (info?.name && info?.email) return true;

  localStorage.removeItem(SIGNUP_KEY);
  localStorage.removeItem("lotto_signup_info");
  localStorage.removeItem("lotto_signup_done");
  return false;
}

function openSignupModal() {
  if (!signupModal) return;

  signupModal.classList.add("is-open");
  signupModal.removeAttribute("hidden");
  signupModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  document.getElementById("signupError")?.textContent = "";
  signupModal.scrollIntoView({ block: "center" });
  document.getElementById("signupName")?.focus();
}

function closeSignupModal() {
  if (!signupModal) return;
  signupModal.classList.remove("is-open");
  document.body.classList.remove("modal-open");
  pendingAction = null;
}

function requireSignup(action) {
  if (typeof action !== "function") return;

  if (isSignedUp()) {
    action();
    return;
  }

  pendingAction = action;
  openSignupModal();
}

function validatePhone(phone) {
  const normalized = phone.replace(/[^\d]/g, "");
  return /^01[016789]\d{7,8}$/.test(normalized) ? normalized : null;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showSignupSuccess(name) {
  const nextAction = pendingAction;
  pendingAction = null;

  signupModal?.classList.remove("is-open");
  document.body.classList.remove("modal-open");

  const toast = document.getElementById("signupToast");
  if (toast) {
    toast.textContent = `${name}님, 가입이 완료되었습니다! 이제 AI 번호 추천을 받아보세요.`;
    toast.hidden = false;
    setTimeout(() => {
      toast.hidden = true;
    }, 4000);
  }

  if (nextAction) {
    setTimeout(nextAction, 300);
  }
}

function setSubmitting(loading) {
  if (signupSubmitBtn) signupSubmitBtn.disabled = loading;
}

function completeSignup(name, phone, email) {
  localStorage.setItem(SIGNUP_KEY, "true");
  localStorage.setItem(
    "lotto_signup_info",
    JSON.stringify({ name, phone, email, joinedAt: new Date().toISOString() })
  );
  showSignupSuccess(name);
}

async function loadPublicEnv() {
  if (!isOnlineHost()) return;

  try {
    const res = await fetch(apiUrl("/api/public-env"));
    if (res.ok) {
      publicEnv = await res.json();
    }
  } catch {
    publicEnv = null;
  }
}

async function tryApiSignup(name, phone, email) {
  const res = await fetch(apiUrl("/api/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone, email }),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  return { ok: res.ok, data };
}

async function tryDirectSupabaseSignup(name, normalizedPhone, email) {
  if (!publicEnv?.supabaseUrl || !publicEnv?.supabaseAnonKey) {
    return { ok: false, data: { error: "Supabase 공개 설정이 없습니다." } };
  }

  const res = await fetch(`${publicEnv.supabaseUrl}/rest/v1/signups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publicEnv.supabaseAnonKey,
      Authorization: `Bearer ${publicEnv.supabaseAnonKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name,
      phone: normalizedPhone,
      email,
    }),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const isDuplicate = data?.code === "23505";
    return {
      ok: false,
      data: {
        error: isDuplicate
          ? "이미 가입된 전화번호 또는 이메일입니다."
          : "가입 정보 저장에 실패했습니다.",
        detail: data?.message || data?.hint || "",
      },
    };
  }

  return { ok: true, data };
}

function getNetworkErrorMessage() {
  if (!isOnlineHost()) {
    return "로컬 파일로 열면 API를 사용할 수 없습니다. Vercel 배포 주소(https://...)로 접속해 주세요.";
  }

  return `서버에 연결할 수 없습니다. Vercel에 배포했는지 확인하고 ${apiUrl("/api/health")} 주소가 열리는지 테스트해 주세요.`;
}

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
  if (!chatMessages) return;
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
  if (chatSendBtn) chatSendBtn.disabled = loading;
  if (chatRecommendBtn) chatRecommendBtn.disabled = loading;
  if (chatInput) chatInput.disabled = loading;
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

function startChatRequest(message) {
  const birthCheck = getBirthDateForChat();
  if (!birthCheck.ok) {
    appendErrorMessage(birthCheck.message);
    return;
  }

  requireSignup(() => requestChat(message, birthCheck.birthDate));
}

async function requestChat(message, birthDate) {
  if (message) {
    appendUserMessage(message);
  } else {
    appendUserMessage("생년월일과 오늘 운세를 반영해 로또 번호를 추천해 주세요.");
  }

  setChatLoading(true);
  appendChatMessage("assistant", `<p class="chat-loading">운세를 분석하고 번호를 추천하는 중...</p>`);

  const loadingEl = chatMessages?.lastElementChild;

  if (window.location.protocol === "file:") {
    loadingEl?.remove();
    appendErrorMessage("로컬 파일로 열면 AI API를 사용할 수 없습니다. Vercel 배포 주소로 접속해 주세요.");
    chatHistory.pop();
    setChatLoading(false);
    return;
  }

  try {
    const res = await fetch(`${window.location.origin}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        birthDate,
        today: getTodayForChat(),
        message: message || "",
        history: chatHistory.slice(0, -1),
      }),
    });

    const data = await res.json();
    loadingEl?.remove();

    if (!res.ok) {
      const detail = data.detail ? ` (${data.detail})` : "";
      appendErrorMessage((data.error || "AI 응답을 가져오지 못했습니다.") + detail);
      chatHistory.pop();
      return;
    }

    if (data.numbers?.length === 6 && Number.isInteger(data.bonus)) {
      appendAssistantMessage(data);
    } else {
      appendErrorMessage("추천 번호 형식이 올바르지 않습니다. 다시 시도해 주세요.");
      chatHistory.pop();
    }
  } catch {
    loadingEl?.remove();
    appendErrorMessage(
      `서버에 연결할 수 없습니다. Vercel 배포 주소에서 접속했는지 확인해 주세요. (${window.location.origin}/api/health)`
    );
    chatHistory.pop();
  } finally {
    setChatLoading(false);
  }
}

function initSignup() {
  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("signupName").value.trim();
    const phone = document.getElementById("signupPhone").value.trim();
    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const errorEl = document.getElementById("signupError");
    const normalizedPhone = validatePhone(phone);

    if (!name || name.length < 2) {
      if (errorEl) errorEl.textContent = "이름을 2자 이상 입력해 주세요.";
      return;
    }

    if (!normalizedPhone) {
      if (errorEl) errorEl.textContent = "올바른 전화번호를 입력해 주세요. (예: 010-1234-5678)";
      return;
    }

    if (!validateEmail(email)) {
      if (errorEl) errorEl.textContent = "올바른 이메일 주소를 입력해 주세요.";
      return;
    }

    if (!isOnlineHost()) {
      if (errorEl) errorEl.textContent = getNetworkErrorMessage();
      return;
    }

    if (errorEl) errorEl.textContent = "";
    setSubmitting(true);

    try {
      const result = await tryApiSignup(name, phone, email);

      if (!result.ok) {
        const directResult = await tryDirectSupabaseSignup(name, normalizedPhone, email);
        if (directResult.ok) {
          completeSignup(name, phone, email);
          return;
        }

        const detail = result.data.detail || directResult.data.detail || "";
        if (errorEl) {
          errorEl.textContent =
            (result.data.error || directResult.data.error || "가입에 실패했습니다.") +
            (detail ? ` (${detail})` : "");
        }
        return;
      }

      completeSignup(name, phone, email);
    } catch {
      try {
        const directResult = await tryDirectSupabaseSignup(name, normalizedPhone, email);
        if (directResult.ok) {
          completeSignup(name, phone, email);
          return;
        }
      } catch {
        // fall through
      }

      if (errorEl) errorEl.textContent = getNetworkErrorMessage();
    } finally {
      setSubmitting(false);
    }
  });

  signupCloseBtn?.addEventListener("click", closeSignupModal);
  signupLaterBtn?.addEventListener("click", closeSignupModal);
  signupBackdrop?.addEventListener("click", closeSignupModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && signupModal?.classList.contains("is-open")) {
      closeSignupModal();
    }
  });

  if (new URLSearchParams(window.location.search).get("reset_signup") === "1") {
    localStorage.removeItem(SIGNUP_KEY);
    localStorage.removeItem("lotto_signup_info");
    localStorage.removeItem("lotto_signup_done");
  }

  loadPublicEnv();
}

function initChat() {
  chatRecommendBtn?.addEventListener("click", () => startChatRequest(""));

  chatSendBtn?.addEventListener("click", () => {
    const text = chatInput.value.trim();
    if (!text || isChatLoading) return;
    chatInput.value = "";
    startChatRequest(text);
  });

  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatSendBtn.click();
    }
  });
}

function init() {
  initSignup();
  initChat();
}

window.showSignupModal = openSignupModal;
window.requireSignup = requireSignup;
window.isUserSignedUp = isSignedUp;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
