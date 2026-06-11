const DEFAULT_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

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
  type: "OBJECT",
  properties: {
    numbers: {
      type: "ARRAY",
      items: { type: "INTEGER" },
    },
    bonus: { type: "INTEGER" },
    fortune: { type: "STRING" },
    explanation: { type: "STRING" },
    message: { type: "STRING" },
  },
  required: ["numbers", "bonus", "fortune", "explanation", "message"],
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getModels() {
  const preferred = process.env.GEMINI_MODEL?.trim();
  if (!preferred) return DEFAULT_MODELS;
  return [preferred, ...DEFAULT_MODELS.filter((m) => m !== preferred)];
}

function validateLottoResult(data) {
  if (!data || !Array.isArray(data.numbers) || data.numbers.length !== 6) {
    return false;
  }

  const nums = data.numbers.map(Number);
  const unique = new Set(nums);
  if (unique.size !== 6) return false;

  for (const n of nums) {
    if (!Number.isInteger(n) || n < 1 || n > 45) return false;
  }

  const bonus = Number(data.bonus);
  if (!Number.isInteger(bonus) || bonus < 1 || bonus > 45) return false;
  if (nums.includes(bonus)) return false;

  data.numbers = nums;
  data.bonus = bonus;
  return true;
}

function buildContents(birthDate, today, userMessage, history = [], jsonOnly = false) {
  const contents = [];

  for (const item of history.slice(-6)) {
    contents.push({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.text }],
    });
  }

  const prompt = userMessage?.trim()
    ? userMessage.trim()
    : "생년월일과 오늘 운세를 반영해 로또 번호를 추천해 주세요.";

  let text = [`생년월일: ${birthDate}`, `오늘 날짜: ${today}`, `요청: ${prompt}`].join("\n");

  if (jsonOnly) {
    text += `\n\n반드시 아래 JSON 형식만 출력하세요. 다른 텍스트는 포함하지 마세요.
{"numbers":[1,2,3,4,5,6],"bonus":7,"fortune":"오늘의 운세","explanation":"추천 이유","message":"전체 메시지"}`;
  }

  contents.push({
    role: "user",
    parts: [{ text }],
  });

  return contents;
}

function extractJsonFromText(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function callGemini(apiKey, model, payload) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { response, data };
}

function getResponseText(geminiData) {
  const candidate = geminiData?.candidates?.[0];
  if (!candidate) return null;

  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    return null;
  }

  return candidate.content?.parts?.map((p) => p.text).filter(Boolean).join("") || null;
}

function parseGeminiError(data, status) {
  const message = data?.error?.message || data?.raw || "알 수 없는 오류";
  return { status, message };
}

async function requestWithModels(apiKey, buildPayload) {
  const models = getModels();
  let lastError = { status: 500, message: "모든 모델 요청에 실패했습니다." };

  for (const model of models) {
    const structuredPayload = buildPayload(model, true);
    let result = await callGemini(apiKey, model, structuredPayload);

    if (result.response.ok) {
      const rawText = getResponseText(result.data);
      const parsed = rawText ? extractJsonFromText(rawText) : null;
      if (parsed && validateLottoResult(parsed)) {
        return { ok: true, parsed, model };
      }
    } else if (result.response.status === 404) {
      lastError = parseGeminiError(result.data, result.response.status);
      continue;
    } else if (result.response.status !== 400) {
      lastError = parseGeminiError(result.data, result.response.status);
    }

    const plainPayload = buildPayload(model, false);
    result = await callGemini(apiKey, model, plainPayload);

    if (result.response.ok) {
      const rawText = getResponseText(result.data);
      const parsed = rawText ? extractJsonFromText(rawText) : null;
      if (parsed && validateLottoResult(parsed)) {
        return { ok: true, parsed, model };
      }
    }

    lastError = parseGeminiError(result.data, result.response.status);
  }

  return { ok: false, error: lastError };
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
    const buildPayload = (model, useSchema) => ({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: buildContents(birthDate, today, message, history, !useSchema),
      generationConfig: useSchema
        ? {
            temperature: 0.9,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          }
        : {
            temperature: 0.9,
          },
    });

    const result = await requestWithModels(apiKey, buildPayload);

    if (!result.ok) {
      const isAuthError = result.error.status === 401 || result.error.status === 403;
      const isRateLimit = result.error.status === 429;

      return res.status(result.error.status || 502).json({
        error: isAuthError
          ? "Gemini API 키가 올바르지 않습니다. Vercel 환경변수를 확인해 주세요."
          : isRateLimit
            ? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."
            : "Gemini API 요청에 실패했습니다.",
        detail: result.error.message,
      });
    }

    result.parsed.numbers = [...result.parsed.numbers].sort((a, b) => a - b);

    return res.status(200).json(result.parsed);
  } catch (error) {
    return res.status(500).json({
      error: "서버 오류가 발생했습니다.",
      detail: error.message,
    });
  }
};
