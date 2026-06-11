const SIGNUP_KEY = "lotto_signup_complete";

const signupModal = document.getElementById("signupModal");
const signupForm = document.getElementById("signupForm");
const signupCloseBtn = document.getElementById("signupCloseBtn");
const signupLaterBtn = document.getElementById("signupLaterBtn");
const signupBackdrop = document.getElementById("signupBackdrop");
const signupSubmitBtn = document.getElementById("signupSubmitBtn");

let pendingAction = null;

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
  return /^01[016789]\d{7,8}$/.test(normalized);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showSignupSuccess(name) {
  closeSignupModal();
  const toast = document.getElementById("signupToast");
  if (!toast) return;
  toast.textContent = `${name}님, 가입이 완료되었습니다! 이제 AI 번호 추천을 받아보세요.`;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

function setSubmitting(loading) {
  if (signupSubmitBtn) signupSubmitBtn.disabled = loading;
}

signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("signupName").value.trim();
  const phone = document.getElementById("signupPhone").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const errorEl = document.getElementById("signupError");

  if (!name || name.length < 2) {
    errorEl.textContent = "이름을 2자 이상 입력해 주세요.";
    return;
  }

  if (!validatePhone(phone)) {
    errorEl.textContent = "올바른 전화번호를 입력해 주세요. (예: 010-1234-5678)";
    return;
  }

  if (!validateEmail(email)) {
    errorEl.textContent = "올바른 이메일 주소를 입력해 주세요.";
    return;
  }

  errorEl.textContent = "";
  setSubmitting(true);

  try {
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || "가입에 실패했습니다.";
      return;
    }

    localStorage.setItem(SIGNUP_KEY, "true");
    localStorage.setItem(
      "lotto_signup_info",
      JSON.stringify({ name, phone, email, joinedAt: new Date().toISOString() })
    );

    const nextAction = pendingAction;
    pendingAction = null;
    showSignupSuccess(name);

    if (nextAction) {
      setTimeout(nextAction, 300);
    }
  } catch {
    errorEl.textContent = "네트워크 오류가 발생했습니다. Vercel 배포 환경에서 다시 시도해 주세요.";
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

window.showSignupModal = openSignupModal;
window.requireSignup = requireSignup;
window.isUserSignedUp = isSignedUp;
