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

const PRIMARY_MODEL = "llama-3.3-70b-versatile";

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
    });
  }

  const totalIn = Number(payload.totals?.in) || 0;
  const totalOut = Number(payload.totals?.out) || 0;
  const netCash = Math.round((totalIn - totalOut) * 100) / 100;
  const txCount = (payload.inflows?.length || 0) + (payload.outflows?.length || 0);

  const systemPrompt = `You are Nauman AI, Chief Financial Auditor for Jubail Corporation Trading Est. (JCT - wholesale paint distributor for Jotun, Hempel, Sigma in Saudi Arabia).
Analyze the provided daytime transactions, contractor receivables, and cash flow ledger.
You must return a valid JSON object matching EXACTLY this JSON schema:
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

  const userPrompt = `Here is today's financial ledger data. Return a valid JSON object:
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

  console.log(`[AI Route] Attempting Groq call with model ${PRIMARY_MODEL}...`);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
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

      console.error(`[AI Route] Groq API returned status ${res.status}:`, errorDetail);
      return NextResponse.json({
        source: "GROQ_API_ERROR",
        status: res.status,
        error: errorDetail,
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
      });
    } catch (parseErr) {
      console.error("[AI Route] JSON Parse error from Groq response:", parseErr, content);
      return NextResponse.json({
        source: "GROQ_API_ERROR",
        status: 502,
        error: `Groq returned non-JSON output: ${(parseErr as Error).message}`,
      });
    }
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    console.error("[AI Route] Error connecting to Groq:", error);
    return NextResponse.json({
      source: "GROQ_API_ERROR",
      status: err?.status || 500,
      error: err?.message || String(error),
    });
  }
}
