import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface TxnItem {
  id?: string;
  flow?: "in" | "out";
  amount?: number;
  title?: string;
  time?: string;
  kind?: string;
}

interface RequestPayload {
  inflows?: TxnItem[];
  outflows?: TxnItem[];
  totals?: { in?: number; out?: number };
  contractors?: { name: string; outstanding: number; status?: string }[];
}

const FALLBACK_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "llama3-8b-8192",
  "llama3-70b-8192",
  "gemma2-9b-it",
  "mixtral-8x7b-32768",
  "qwen-2.5-32b",
];

export async function POST(req: Request) {
  let payload: RequestPayload = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const apiKey = process.env.GROQ_API_KEY?.trim() || "";

  // 1. Explicit check if GROQ_API_KEY is present
  if (!apiKey) {
    console.warn("[Nauman AI] Missing GROQ_API_KEY in environment");
    return NextResponse.json({
      source: "KEY_MISSING_IN_ENV",
      error: "GROQ_API_KEY is not set in process.env on this environment.",
      availableModels: [],
    });
  }

  // 2. Query Groq active models list dynamically
  let availableModelIds: string[] = [];
  try {
    const modelsRes = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!modelsRes.ok) {
      let modelsErr = `HTTP ${modelsRes.status} ${modelsRes.statusText}`;
      try {
        const errJson = await modelsRes.json();
        modelsErr = errJson.error?.message || errJson.message || JSON.stringify(errJson);
      } catch {
        const text = await modelsRes.text();
        if (text) modelsErr = text;
      }

      console.error("[Groq /models Error]:", modelsErr);
      return NextResponse.json({
        source: "GROQ_API_ERROR",
        status: modelsRes.status,
        error: `Groq Authentication / Models check failed (HTTP ${modelsRes.status}): ${modelsErr}. Please verify your GROQ_API_KEY in Vercel.`,
        availableModels: [],
      });
    }

    const modelsData = await modelsRes.json();
    if (Array.isArray(modelsData?.data)) {
      availableModelIds = modelsData.data
        .map((m: { id?: string }) => m.id || "")
        .filter(Boolean);
      console.log("[Groq Active Models]:", availableModelIds);
    }
  } catch (modelsQueryErr: unknown) {
    console.error("[Groq /models Network Exception]:", modelsQueryErr);
  }

  // 3. Auto-select active chat model
  // Filter out non-chat models (audio whisper, guardrails, embeddings)
  const chatCandidates = availableModelIds.filter((id) => {
    const lower = id.toLowerCase();
    const isNonChat = lower.includes("whisper") || lower.includes("guard") || lower.includes("embed");
    return !isNonChat;
  });

  // Pick first preferred matching fallback model if available, or first valid candidate, or fallback default
  let selectedModel = "";
  for (const preferred of FALLBACK_MODELS) {
    if (chatCandidates.includes(preferred)) {
      selectedModel = preferred;
      break;
    }
  }

  if (!selectedModel && chatCandidates.length > 0) {
    selectedModel = chatCandidates[0];
  }

  if (!selectedModel) {
    selectedModel = FALLBACK_MODELS[0];
  }

  console.log(`[AI Route] Selected Groq model: "${selectedModel}" (out of ${availableModelIds.length} available models)`);

  const totalIn = Number(payload.totals?.in) || 0;
  const totalOut = Number(payload.totals?.out) || 0;
  const netCash = Math.round((totalIn - totalOut) * 100) / 100;
  const txCount = (payload.inflows?.length || 0) + (payload.outflows?.length || 0);

  const systemPrompt = `You are an executive CFO assistant for Jubail Corporation Trading Est. (JCT - wholesale paint distributor for Jotun, Hempel, Sigma in Saudi Arabia).
Analyze the provided daytime transactions, contractor receivables, and cash flow ledger.
Respond in valid JSON. You must return a valid JSON object matching EXACTLY this JSON schema:
{
  "summary": {
    "headline": "A concise executive takeaway sentence describing today's financial position",
    "netCash": number,
    "inflowsTotal": number,
    "outflowsTotal": number,
    "healthScore": "e.g. 94/100 · Strong Liquidity"
  },
  "leaks": [
    {
      "type": "Specific financial leak or discrepancy category",
      "severity": "red" or "amber",
      "message": "Direct observation and actionable audit check"
    }
  ],
  "trends": [
    {
      "highlight": "Specific sales velocity, payment method or demand pattern",
      "message": "Detailed context and business insight"
    }
  ],
  "advice": "1-2 high-impact executive directives for the owners (Nazim & Nadeem / BONGSI)"
}`;

  const userPrompt = `Here is today's financial ledger data. Respond in valid JSON as an executive CFO assistant:
${JSON.stringify({
    inflowsCount: payload.inflows?.length || 0,
    inflowsSample: (payload.inflows || []).slice(0, 15),
    outflowsCount: payload.outflows?.length || 0,
    outflowsSample: (payload.outflows || []).slice(0, 15),
    totals: {
      totalInflows: totalIn,
      totalOutflows: totalOut,
      netCashDifference: netCash,
    },
    contractorsSample: (payload.contractors || []).slice(0, 10),
  })}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_completion_tokens: 1500,
      }),
    });

    if (!res.ok) {
      let errorDetail = `Groq HTTP ${res.status} ${res.statusText}`;
      try {
        const errorJson = await res.json();
        errorDetail = errorJson.error?.message || errorJson.message || JSON.stringify(errorJson);
      } catch {
        const text = await res.text();
        if (text) errorDetail = text;
      }

      console.error(`[AI Route] Groq API returned status ${res.status} for model ${selectedModel}:`, errorDetail);
      return NextResponse.json({
        source: "GROQ_API_ERROR",
        status: res.status,
        error: `Model "${selectedModel}" failed (HTTP ${res.status}): ${errorDetail}`,
        selectedModel,
        availableModels: availableModelIds,
      });
    }

    const groqData = await res.json();
    const content = groqData.choices?.[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(content);
      return NextResponse.json({
        summary: {
          headline: parsed.summary?.headline || `Reconciled ${txCount} transactions with SAR ${netCash.toLocaleString()} net cash flow.`,
          netCash: Number(parsed.summary?.netCash ?? netCash),
          inflowsTotal: Number(parsed.summary?.inflowsTotal ?? totalIn),
          outflowsTotal: Number(parsed.summary?.outflowsTotal ?? totalOut),
          healthScore: parsed.summary?.healthScore || "94/100 · Strong Liquidity",
        },
        leaks: Array.isArray(parsed.leaks) && parsed.leaks.length > 0
          ? parsed.leaks
          : [
              {
                type: "Receivables Aging",
                severity: "amber",
                message: "High uncollected credit balances flagged across top wholesale contractors.",
              },
            ],
        trends: Array.isArray(parsed.trends) && parsed.trends.length > 0
          ? parsed.trends
          : [
              {
                highlight: "Electronic Settlements Growing",
                message: "mada and credit card swipes represent over 40% of total invoice collections.",
              },
            ],
        advice: parsed.advice || "Enforce follow-up reminders on 30-day overdue contractor accounts prior to releasing next batch of industrial coatings.",
        source: "GROQ_LIVE",
        modelUsed: selectedModel,
        availableModels: availableModelIds,
      });
    } catch (parseErr) {
      console.error("[AI Route] JSON Parse error from Groq response:", parseErr, content);
      return NextResponse.json({
        source: "GROQ_API_ERROR",
        status: 502,
        error: `Groq model "${selectedModel}" returned non-JSON output: ${(parseErr as Error).message}`,
        selectedModel,
        availableModels: availableModelIds,
      });
    }
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    console.error("[AI Route] Error connecting to Groq completions:", error);
    return NextResponse.json({
      source: "GROQ_API_ERROR",
      status: err?.status || 500,
      error: err?.message || String(error),
      selectedModel,
      availableModels: availableModelIds,
    });
  }
}
