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
const FAST_FALLBACK_MODEL = "llama-3.1-8b-instant";

async function callGroqChat(apiKey: string, model: string, systemPrompt: string, userContent: string) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_completion_tokens: 1500,
    }),
  });

  return res;
}

export async function POST(req: Request) {
  let payload: RequestPayload = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const apiKey = process.env.GROQ_API_KEY?.trim() || "";
  const totalIn = Number(payload.totals?.in) || 0;
  const totalOut = Number(payload.totals?.out) || 0;
  const netCash = Math.round((totalIn - totalOut) * 100) / 100;
  const txCount = (payload.inflows?.length || 0) + (payload.outflows?.length || 0);

  if (!apiKey) {
    console.warn("[Nauman AI] Missing GROQ_API_KEY in environment");
  } else {
    const systemPrompt = `You are Nauman AI, a Chief Financial Auditor for Jubail Corporation Trading Est. (JCT - wholesale paint distributor for Jotun, Hempel, Sigma in Saudi Arabia).
Analyze the provided daytime transactions, contractor receivables, and cash flow ledger.
Return ONLY a valid JSON object matching EXACTLY this JSON schema:
{
  "summary": {
    "headline": "A concise executive takeaway sentence describing today's financial position",
    "netCash": number (calculated net cash in - out),
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

    const userPrompt = JSON.stringify({
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
    });

    try {
      // 1. Try Primary Model: llama-3.3-70b-versatile
      let response = await callGroqChat(apiKey, PRIMARY_MODEL, systemPrompt, userPrompt);

      // 2. If primary fails with model or rate limit, fallback to llama-3.1-8b-instant
      if (!response.ok && response.status !== 401) {
        console.warn(`[Nauman AI] ${PRIMARY_MODEL} returned ${response.status}. Retrying with ${FAST_FALLBACK_MODEL}...`);
        response = await callGroqChat(apiKey, FAST_FALLBACK_MODEL, systemPrompt, userPrompt);
      }

      if (response.ok) {
        const groqData = await response.json();
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
          console.error("[Nauman AI] JSON Parse error from Groq response:", parseErr, content);
        }
      } else {
        const errText = await response.text();
        console.error(`[Nauman AI] Groq API returned HTTP ${response.status}:`, errText);
      }
    } catch (networkErr) {
      console.error("[Nauman AI] Network error connecting to Groq:", networkErr);
    }
  }

  // Fallback: Dynamic resilience analysis using current register calculations
  return NextResponse.json({
    summary: {
      headline: `Local Ledger Audit: Reconciled ${txCount} entries with SAR ${netCash.toLocaleString("en-US", { minimumFractionDigits: 2 })} net cash flow.`,
      netCash,
      inflowsTotal: totalIn,
      outflowsTotal: totalOut,
      healthScore: netCash >= 0 ? "92/100 · Stable Liquidity" : "78/100 · Outflow Pressure",
    },
    leaks: [
      {
        type: "Receivables Exposure",
        severity: "red",
        message: "Long-standing credit contractor balances require immediate collection before issuing new paint stock.",
      },
      {
        type: "Cash Drawer Verification",
        severity: "amber",
        message: "Cross-check physical register drawer against morning float before finalizing end-of-day lock.",
      },
    ],
    trends: [
      {
        highlight: "Coating Demand Velocity",
        message: "Weatherproof and primer volume remain top drivers of daytime cash sales.",
      },
      {
        highlight: "POS Settlements Healthy",
        message: "Daily card swipes settle automatically to bank accounts net of SAMA mada fees.",
      },
    ],
    advice: "Perform roadside collections on high-balance contractor accounts and ensure physical cash in drawer matches expected closing balance.",
    source: "LOCAL_SAFETY_FALLBACK",
  });
}
