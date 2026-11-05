"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Crown,
  Store,
  PaintRoller,
  SprayCan,
  Landmark,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

type ProfileId = "BONGSI" | "JCT_HQ" | "HARDWARE_HQ" | "HEMPEL_JUBAIL" | "JOTUN_DAMMAM" | "SIGMA_JUBAIL";

interface LoginProfileCard {
  id: ProfileId;
  emoji: string;
  name: string;
  label: string;
  badge: string;
  username: string;
  isOwner: boolean;
  icon: typeof Crown;
}

const LOGIN_PROFILES: LoginProfileCard[] = [
  {
    id: "BONGSI",
    emoji: "👑",
    name: "Owner",
    label: "Nazim & Nadeem (Owner)",
    badge: "Owner · All Branches",
    username: "owner",
    isOwner: true,
    icon: Crown,
  },
  {
    id: "JCT_HQ",
    emoji: "🏢",
    name: "JCT",
    label: "Main Outlet",
    badge: "Paints & Decor",
    username: "jubail",
    isOwner: false,
    icon: Store,
  },
  {
    id: "HARDWARE_HQ",
    emoji: "🔧",
    name: "Hardware HQ",
    label: "Tools & Equipment",
    badge: "Hardware Outlet",
    username: "hardware",
    isOwner: false,
    icon: Landmark,
  },
  {
    id: "HEMPEL_JUBAIL",
    emoji: "🎨",
    name: "Hempel",
    label: "Hempel Branch",
    badge: "Hempel Paints",
    username: "hempel",
    isOwner: false,
    icon: PaintRoller,
  },
  {
    id: "JOTUN_DAMMAM",
    emoji: "🖌️",
    name: "Jotun Dammam",
    label: "Dammam Franchise",
    badge: "Jotun Paints",
    username: "jotun",
    isOwner: false,
    icon: SprayCan,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [signingInId, setSigningInId] = useState<ProfileId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectProfile = async (profile: LoginProfileCard) => {
    setError(null);
    setSigningInId(profile.id);

    try {
      const res = await signIn("credentials", {
        username: profile.username,
        password: process.env.NEXT_PUBLIC_DEFAULT_PIN || "jct2026",
        profileId: profile.id,
        redirect: false,
      });

      if (res?.error) {
        setError("Unable to authenticate this profile. Please try again.");
        setSigningInId(null);
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("jct_user_profile", profile.id);
      }

      router.replace(profile.isOwner ? "/" : "/daily-register");
      router.refresh();
    } catch {
      setError("Authentication service error. Please try again.");
      setSigningInId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-[#0A0A0A] px-6 py-10 text-white select-none">
      {/* Subtle Ambient Glows */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 h-96 w-[650px] rounded-full bg-jct-turquoise/10 blur-[130px]" />
      <div className="pointer-events-none fixed -bottom-40 right-1/4 h-80 w-96 rounded-full bg-jct-yellow/5 blur-[120px]" />

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-jct-turquoise font-display text-base font-black text-jct-charcoal shadow-[0_0_20px_rgba(45,226,230,0.3)]">
            JCT
          </div>
          <span className="font-display text-lg font-extrabold tracking-tight text-white">
            JCT Financial OS
          </span>
        </div>

        <h1 className="mt-6 text-2xl md:text-4xl font-extrabold text-white tracking-tight text-center">
          Who is signing in?
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 text-center">
          Select your profile to launch your terminal session
        </p>

        {error && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300">
            <AlertTriangle size={15} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-10 grid w-full grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {LOGIN_PROFILES.map((p) => {
            const Icon = p.icon;
            const isBusy = signingInId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={signingInId !== null}
                onClick={() => handleSelectProfile(p)}
                className="group flex flex-col items-center gap-3 text-center outline-none disabled:opacity-60"
              >
                <div
                  className={`flex aspect-square w-full max-w-[160px] items-center justify-center bg-[#111111] shadow-lg border rounded-2xl p-6 transition-all duration-200 group-hover:scale-105 ${
                    p.isOwner
                      ? "border-jct-yellow/40 group-hover:border-jct-yellow group-hover:shadow-[0_0_25px_rgba(255,222,89,0.25)]"
                      : "border-[#1F1F1F] group-hover:border-jct-turquoise group-hover:shadow-[0_0_25px_rgba(45,226,230,0.25)]"
                  }`}
                >
                  {isBusy ? (
                    <Sparkles
                      size={48}
                      className={`animate-spin ${
                        p.isOwner ? "text-jct-yellow" : "text-jct-turquoise"
                      }`}
                    />
                  ) : (
                    <Icon
                      size={54}
                      strokeWidth={1.5}
                      className={p.isOwner ? "text-jct-yellow" : "text-jct-turquoise"}
                    />
                  )}
                </div>
                <div>
                  <p className="text-base font-extrabold text-white group-hover:text-jct-turquoise transition-colors">
                    {p.emoji} {p.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.label}</p>
                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-0.5 text-[10px] font-extrabold ${
                      p.isOwner
                        ? "bg-jct-yellow text-jct-charcoal"
                        : "bg-jct-turquoise text-jct-charcoal"
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
