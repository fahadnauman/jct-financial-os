"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Crown,
  Store,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  PaintRoller,
  SprayCan,
  Landmark,
} from "lucide-react";

type RoleChoice = "OWNER" | "STAFF";
type StaffBranchId = "JCT_HQ" | "HEMPEL_JUBAIL" | "JOTUN_DAMMAM" | "SIGMA_JUBAIL";

const STAFF_BRANCHES: {
  id: StaffBranchId;
  name: string;
  username: string;
  badge: string;
  icon: typeof Store;
}[] = [
  {
    id: "JCT_HQ",
    name: "JCT Main HQ",
    username: "jubail",
    badge: "Jubail - Main Branch",
    icon: Store,
  },
  {
    id: "HEMPEL_JUBAIL",
    name: "Hempel Jubail",
    username: "hempel",
    badge: "Hempel - Jubail",
    icon: PaintRoller,
  },
  {
    id: "JOTUN_DAMMAM",
    name: "Jotun Dammam",
    username: "jotun",
    badge: "Jotun - Dammam",
    icon: SprayCan,
  },
  {
    id: "SIGMA_JUBAIL",
    name: "Sigma Paints",
    username: "sigma",
    badge: "Sigma Paints - Jubail",
    icon: Landmark,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<RoleChoice>("OWNER");
  const [selectedBranch, setSelectedBranch] = useState<StaffBranchId>("JCT_HQ");
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSwitch = (nextRole: RoleChoice) => {
    setRole(nextRole);
    setError(null);
    if (nextRole === "OWNER") {
      setUsername("owner");
    } else {
      const branchMeta = STAFF_BRANCHES.find((b) => b.id === selectedBranch);
      setUsername(branchMeta?.username || "staff");
    }
  };

  const handleBranchSelect = (branchId: StaffBranchId) => {
    setSelectedBranch(branchId);
    setError(null);
    const branchMeta = STAFF_BRANCHES.find((b) => b.id === branchId);
    if (branchMeta) {
      setUsername(branchMeta.username);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const resolvedProfileId = role === "OWNER" ? "BONGSI" : selectedBranch;

    try {
      const res = await signIn("credentials", {
        username: username.trim(),
        password: password.trim(),
        profileId: resolvedProfileId,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid credentials. Please verify your username and security PIN.");
        setIsLoading(false);
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("jct_user_profile", resolvedProfileId);
      }

      if (role === "STAFF") {
        router.replace("/daily-register");
      } else {
        router.replace("/");
      }
      router.refresh();
    } catch {
      setError("Authentication service error. Please try again.");
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (
    targetRole: RoleChoice,
    targetProfileId: "BONGSI" | StaffBranchId,
    defaultUser: string,
    defaultPass: string
  ) => {
    setRole(targetRole);
    if (targetProfileId !== "BONGSI") {
      setSelectedBranch(targetProfileId);
    }
    setUsername(defaultUser);
    setPassword(defaultPass);
    setError(null);
    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        username: defaultUser,
        password: defaultPass,
        profileId: targetProfileId,
        redirect: false,
      });

      if (res?.error) {
        setError("Quick sign-in failed. Please enter credentials manually.");
        setIsLoading(false);
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("jct_user_profile", targetProfileId);
      }

      router.replace(targetRole === "STAFF" ? "/daily-register" : "/");
      router.refresh();
    } catch {
      setError("Unable to complete sign-in.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Subtle Ambient Glows */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 h-96 w-[650px] rounded-full bg-jct-turquoise/10 blur-[130px]" />
      <div className="pointer-events-none fixed -bottom-40 right-1/4 h-80 w-96 rounded-full bg-jct-yellow/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-jct-turquoise to-cyan-500 font-display text-lg font-black text-jct-charcoal shadow-[0_0_25px_rgba(45,226,230,0.35)]">
              JCT
            </div>
            <div className="text-left">
              <h1 className="font-display text-xl font-extrabold tracking-tight text-white">
                JCT Financial OS
              </h1>
              <p className="text-xs text-slate-400">Jubail Corp. Trading Est. · Enterprise RBAC</p>
            </div>
          </div>
        </div>

        {/* Main Login Card */}
        <div className="rounded-2xl border border-white/10 bg-[#111111]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="font-display text-lg font-extrabold tracking-tight text-white">
                Terminal Authentication
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select access role and verify your security credentials
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-jct-turquoise/30 bg-jct-turquoise/10 px-2.5 py-1 text-[10px] font-bold text-jct-turquoise">
              <ShieldCheck size={12} />
              NextAuth RBAC
            </span>
          </div>

          {/* Role Toggle (OWNER vs STAFF) */}
          <div className="grid grid-cols-2 gap-2.5 p-1 rounded-xl bg-[#0A0A0A] border border-white/10">
            <button
              type="button"
              onClick={() => handleRoleSwitch("OWNER")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs font-extrabold transition-all ${
                role === "OWNER"
                  ? "bg-jct-yellow text-jct-charcoal shadow-[0_0_15px_rgba(255,222,89,0.25)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Crown size={15} />
              <span>OWNER (MASTER)</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleSwitch("STAFF")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs font-extrabold transition-all ${
                role === "STAFF"
                  ? "bg-jct-turquoise text-jct-charcoal shadow-[0_0_15px_rgba(45,226,230,0.25)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Store size={15} />
              <span>STAFF (REGISTER)</span>
            </button>
          </div>

          {/* Staff Branch Selector */}
          {role === "STAFF" && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Assign Branch Register Terminal
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STAFF_BRANCHES.map((b) => {
                  const Icon = b.icon;
                  const active = selectedBranch === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleBranchSelect(b.id)}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                        active
                          ? "border-jct-turquoise bg-jct-turquoise/15 text-white"
                          : "border-white/10 bg-[#0A0A0A] text-slate-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <Icon
                        size={16}
                        className={active ? "text-jct-turquoise shrink-0" : "text-slate-500 shrink-0"}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{b.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{b.badge}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Username / Terminal ID
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={role === "OWNER" ? "owner" : "staff / jubail"}
                className="w-full rounded-xl border border-white/15 bg-[#0A0A0A] px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-600 focus:border-jct-turquoise focus:outline-none focus:ring-1 focus:ring-jct-turquoise transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Password / Security PIN
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password or PIN (e.g. jct2026)"
                  className="w-full rounded-xl border border-white/15 bg-[#0A0A0A] pl-4 pr-11 py-3 text-sm font-mono font-bold text-white placeholder:font-sans placeholder:font-normal placeholder:text-slate-600 focus:border-jct-turquoise focus:outline-none focus:ring-1 focus:ring-jct-turquoise transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
                <AlertTriangle size={16} className="shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full rounded-xl py-3.5 px-5 text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 ${
                role === "OWNER"
                  ? "bg-jct-yellow text-jct-charcoal hover:brightness-95"
                  : "bg-jct-turquoise text-jct-charcoal hover:brightness-95"
              }`}
            >
              {isLoading ? (
                <>
                  <Sparkles size={16} className="animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock size={15} />
                  <span>
                    {role === "OWNER"
                      ? "Sign In as Master Owner"
                      : "Sign In to Daily Register"}
                  </span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* One-Tap Quick Terminal Access */}
          <div className="pt-3 border-t border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-bold uppercase tracking-wider">Quick Terminal Access</span>
              <span className="font-mono text-[10px] text-slate-500">Default PIN: jct2026</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickDemoLogin("OWNER", "BONGSI", "owner", "jct2026")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-jct-yellow/30 bg-jct-yellow/10 hover:bg-jct-yellow/20 px-3 py-2 text-xs font-bold text-jct-yellow transition"
              >
                <Crown size={13} />
                <span>👑 Owner Login</span>
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() =>
                  handleQuickDemoLogin("STAFF", selectedBranch, "staff", "jct2026")
                }
                className="flex items-center justify-center gap-1.5 rounded-lg border border-jct-turquoise/30 bg-jct-turquoise/10 hover:bg-jct-turquoise/20 px-3 py-2 text-xs font-bold text-jct-turquoise transition"
              >
                <Store size={13} />
                <span>🏪 Staff Login</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer RBAC Notice */}
        <p className="text-center text-[11px] text-slate-500">
          Protected by NextAuth RBAC · Staff sessions are strictly scoped to{" "}
          <span className="font-mono text-slate-400">/daily-register</span>
        </p>
      </div>
    </div>
  );
}
