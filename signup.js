const SIGNUP_KEY = "lotto_signup_complete";

const signupModal = document.getElementById("signupModal");
const signupForm = document.getElementById("signupForm");
const signupCloseBtn = document.getElementById("signupCloseBtn");
const signupLaterBtn = document.getElementById("signupLaterBtn");
const signupBackdrop = document.getElementById("signupBackdrop");
const signupSubmitBtn = document.getElementById("signupSubmitBtn");

let pendingAction = null;
let publicEnv = null;

function isOnlineHost() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

function apiUrl(path) {
  return `${window.location.origin}${path}`;
}

function isSignedUp() {
  return localStorage.getItem(SIGNUP_KEY) === "true";
}

function openSignupModal() {
  if (!signupModal) return;

  signupModal.classList.add("is-open");
  document.body.classList.add("modal-open");
  document.getElementById("signupName")?.focus();
}

function closeSignupModal() {
  if (!signupModal) return;
  signupModal.classList.remove("is-open");
  document.body.classList.remove("modal-open");
  pendingAction = null;
}

function requireSignup(action) {
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
  const res = await fetch(apiUrl("/api/signup"), {
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

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("signupName").value.trim();
  const phone = document.getElementById("signupPhone").value.trim();
  const email = document.getElementById("signupEmail").value.trim().toLowerCase();
  const errorEl = document.getElementById("signupError");
  const normalizedPhone = validatePhone(phone);

  if (!name || name.length < 2) {
    errorEl.textContent = "이름을 2자 이상 입력해 주세요.";
    return;
  }

  if (!normalizedPhone) {
    errorEl.textContent = "올바른 전화번호를 입력해 주세요. (예: 010-1234-5678)";
    return;
  }

  if (!validateEmail(email)) {
    errorEl.textContent = "올바른 이메일 주소를 입력해 주세요.";
    return;
  }

  if (!isOnlineHost()) {
    errorEl.textContent = getNetworkErrorMessage();
    return;
  }

  errorEl.textContent = "";
  setSubmitting(true);

  try {
    let result = await tryApiSignup(name, phone, email);

    if (!result.ok) {
      const directResult = await tryDirectSupabaseSignup(name, normalizedPhone, email);
      if (directResult.ok) {
        completeSignup(name, phone, email);
        return;
      }

      const detail = result.data.detail || directResult.data.detail || "";
      errorEl.textContent =
        (result.data.error || directResult.data.error || "가입에 실패했습니다.") +
        (detail ? ` (${detail})` : "");
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

    errorEl.textContent = getNetworkErrorMessage();
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

loadPublicEnv();

window.showSignupModal = openSignupModal;
window.requireSignup = requireSignup;
window.isUserSignedUp = isSignedUp;
