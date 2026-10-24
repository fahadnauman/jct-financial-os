import { ImageResponse } from "next/og";

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const px = Math.min(1024, Math.max(64, parseInt(size, 10) || 512));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#040D0E",
        }}
      >
        <div
          style={{
            width: "68%",
            height: "68%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "22%",
            background: "linear-gradient(135deg,#FFD200,#FACC15)",
            color: "#000",
            fontSize: px * 0.3,
            fontWeight: 900,
            border: `${Math.round(px * 0.02)}px solid #00BAC7`,
          }}
        >
          JCT
        </div>
      </div>
    ),
    { width: px, height: px }
  );
}
