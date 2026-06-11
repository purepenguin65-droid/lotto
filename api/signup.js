function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function validatePhone(phone) {
  const normalized = phone.replace(/[^\d]/g, "");
  return /^01[016789]\d{7,8}$/.test(normalized) ? normalized : null;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Supabase 환경변수가 설정되지 않았습니다.",
    });
  }

  const { name, phone, email } = req.body || {};
  const trimmedName = String(name || "").trim();
  const trimmedPhone = String(phone || "").trim();
  const trimmedEmail = String(email || "").trim().toLowerCase();
  const normalizedPhone = validatePhone(trimmedPhone);

  if (!trimmedName || trimmedName.length < 2) {
    return res.status(400).json({ error: "이름을 2자 이상 입력해 주세요." });
  }

  if (!normalizedPhone) {
    return res.status(400).json({
      error: "올바른 전화번호를 입력해 주세요. (예: 010-1234-5678)",
    });
  }

  if (!validateEmail(trimmedEmail)) {
    return res.status(400).json({ error: "올바른 이메일 주소를 입력해 주세요." });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/signups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name: trimmedName,
        phone: normalizedPhone,
        email: trimmedEmail,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const isDuplicate = data?.code === "23505";
      return res.status(isDuplicate ? 409 : response.status).json({
        error: isDuplicate
          ? "이미 가입된 전화번호 또는 이메일입니다."
          : "가입 정보 저장에 실패했습니다.",
        detail: data?.message,
      });
    }

    const saved = Array.isArray(data) ? data[0] : data;

    return res.status(201).json({
      success: true,
      id: saved?.id,
      name: saved?.name,
    });
  } catch (error) {
    return res.status(500).json({
      error: "서버 오류가 발생했습니다.",
      detail: error.message,
    });
  }
};
