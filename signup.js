const SIGNUP_KEY = "lotto_signup_done";

const signupModal = document.getElementById("signupModal");
const signupForm = document.getElementById("signupForm");
const signupCloseBtn = document.getElementById("signupCloseBtn");
const signupLaterBtn = document.getElementById("signupLaterBtn");
const signupBackdrop = document.getElementById("signupBackdrop");

function isSignedUp() {
  return localStorage.getItem(SIGNUP_KEY) === "true";
}

function openSignupModal() {
  if (isSignedUp()) return;
  signupModal.hidden = false;
  document.body.classList.add("modal-open");
  document.getElementById("signupName")?.focus();
}

function closeSignupModal() {
  signupModal.hidden = true;
  document.body.classList.remove("modal-open");
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
  toast.textContent = `${name}님, 가입이 완료되었습니다! 앞으로 AI 맞춤 번호를 추천해 드릴게요.`;
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

signupForm?.addEventListener("submit", (e) => {
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

  const signupData = {
    name,
    phone,
    email,
    joinedAt: new Date().toISOString(),
  };

  localStorage.setItem(SIGNUP_KEY, "true");
  localStorage.setItem("lotto_signup_info", JSON.stringify(signupData));
  errorEl.textContent = "";
  showSignupSuccess(name);
});

signupCloseBtn?.addEventListener("click", closeSignupModal);
signupLaterBtn?.addEventListener("click", closeSignupModal);
signupBackdrop?.addEventListener("click", closeSignupModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !signupModal.hidden) {
    closeSignupModal();
  }
});

window.showSignupModal = openSignupModal;
