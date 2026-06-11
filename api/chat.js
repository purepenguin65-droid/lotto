const MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `당신은 한국 로또 6/45 번호 추천 챗봇입니다.
사용자의 생년월일과 오늘 날짜를 바탕으로 오늘의 운세를 해석하고, 로또 번호 6개(1~45, 중복 없음)와 보너스 번호 1개를 추천합니다.

규칙:
- 반드시 한국어로 답변합니다.
- 운세는 재미와 오락 목적의 창의적 해석입니다. 점술을 사실처럼 단정하지 마세요.
- 당첨을 보장한다는 표현은 사용하지 마세요.
- numbers는 오름차순 6개 정수, bonus는 numbers에 없는 1~45 정수입니다.
- fortune은 오늘의 운세 요약(2~3문장), explanation은 각 번호 또는 조합을 추천한 이유를 생년월일·운세와 연결해 설명합니다(4~8문장).
- message에는 사용자에게 보여줄 친근한 전체 응답 문장을 작성합니다.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    numbers: {
      type: "array",
      items: { type: "integer" },
      description: "추천 로또 번호 6개 (1-45, 중복 없음, 오름차순)",
    },
    bonus: {
      type: "integer",
      description: "보너스 번호 (1-45, numbers에 포함되지 않음)",
    },
    fortune: {
      type: "string",
      description: "오늘의 운세 요약",
    },
    explanation: {
      type: "string",
      description: "번호 추천 이유 상세 설명",
    },
    message: {
      type: "string",
      description: "사용자에게 전달할 전체 메시지",
    },
  },
  required: ["numbers", "bonus", "fortune", "explanation", "message"],
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function validateLottoResult(data) {
  if (!data || !Array.isArray(data.numbers) || data.numbers.length !== 6) {
    return false;
  }

  const nums = data.numbers;
  const unique = new Set(nums);
  if (unique.size !== 6) return false;

  for (const n of nums) {
    if (!Number.isInteger(n) || n < 1 || n > 45) return false;
  }

  if (!Number.isInteger(data.bonus) || data.bonus < 1 || data.bonus > 45) {
    return false;
  }

  if (nums.includes(data.bonus)) return false;

  return true;
}

function buildContents(birthDate, today, userMessage, history = []) {
  const contents = [];

  for (const item of history) {
    contents.push({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.text }],
    });
  }

  const prompt = userMessage?.trim()
    ? userMessage.trim()
    : "생년월일과 오늘 운세를 반영해 로또 번호를 추천해 주세요.";

  contents.push({
    role: "user",
    parts: [
      {
        text: [
          `생년월일: ${birthDate}`,
          `오늘 날짜: ${today}`,
          `요청: ${prompt}`,
        ].join("\n"),
      },
    ],
  });

  return contents;
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다." });
  }

  const { birthDate, today, message, history } = req.body || {};

  if (!birthDate || !today) {
    return res.status(400).json({ error: "생년월일과 오늘 날짜가 필요합니다." });
  }

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: buildContents(birthDate, today, message, history),
        generationConfig: {
          temperature: 0.9,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(geminiRes.status).json({
        error: "Gemini API 요청에 실패했습니다.",
        detail: errText,
      });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return res.status(502).json({ error: "AI 응답을 받지 못했습니다." });
    }

    const parsed = JSON.parse(rawText);

    if (!validateLottoResult(parsed)) {
      return res.status(502).json({ error: "추천 번호 형식이 올바르지 않습니다." });
    }

    parsed.numbers = [...parsed.numbers].sort((a, b) => a - b);

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: "서버 오류가 발생했습니다.",
      detail: error.message,
    });
  }
}
