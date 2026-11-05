import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export type UserRole = "OWNER" | "STAFF";

export interface AuthAccount {
  id:
    | "BONGSI"
    | "JCT_HARDWARE_JOTUN"
    | "HEMPEL"
    | "DAMMAM_JOTUN"
    | "SIGMA"
    | "JCT_HQ"
    | "HARDWARE_HQ"
    | "HEMPEL_JUBAIL"
    | "JOTUN_DAMMAM"
    | "SIGMA_JUBAIL";
  username: string;
  aliases: string[];
  passwords: string[];
  name: string;
  role: UserRole;
  branch: string;
  branchCode: string;
}

export const JCT_AUTH_ACCOUNTS: AuthAccount[] = [
  {
    id: "BONGSI",
    username: "owner",
    aliases: ["owner", "bongsi", "nazim", "nadeem", "admin", "owner@jct.sa"],
    passwords: ["jct2026", "owner123", "1234", "admin123", "bongsi"],
    name: "BONGSI (Nazim & Nadeem)",
    role: "OWNER",
    branch: "All Branches",
    branchCode: "JCT_HARDWARE_JOTUN",
  },
  {
    id: "JCT_HARDWARE_JOTUN",
    username: "jct",
    aliases: [
      "staff",
      "jct",
      "jubail",
      "jct_hq",
      "hq",
      "main",
      "hardware",
      "hardware_jotun",
      "jct_hardware_jotun",
      "staff@jct.sa",
    ],
    passwords: ["staff2026", "jct2026", "staff123", "1234"],
    name: "JCT Hardware + Jotun Staff",
    role: "STAFF",
    branch: "JCT Hardware + Jotun",
    branchCode: "JCT_HARDWARE_JOTUN",
  },
  {
    id: "HEMPEL",
    username: "hempel",
    aliases: ["hempel", "hempel_jubail", "hempel@jct.sa"],
    passwords: ["staff2026", "jct2026", "staff123", "1234"],
    name: "Hempel Staff",
    role: "STAFF",
    branch: "Hempel",
    branchCode: "HEMPEL",
  },
  {
    id: "DAMMAM_JOTUN",
    username: "dammam",
    aliases: ["dammam", "jotun", "jotun_dammam", "dammam_jotun", "jotun@jct.sa"],
    passwords: ["staff2026", "jct2026", "staff123", "1234"],
    name: "Dammam Jotun Staff",
    role: "STAFF",
    branch: "Dammam Jotun",
    branchCode: "DAMMAM_JOTUN",
  },
  {
    id: "SIGMA",
    username: "sigma",
    aliases: ["sigma", "sigma_jubail", "sigma@jct.sa"],
    passwords: ["staff2026", "jct2026", "staff123", "1234"],
    name: "Sigma Staff",
    role: "STAFF",
    branch: "Sigma",
    branchCode: "SIGMA",
  },
];

export const NEXTAUTH_FALLBACK_SECRET =
  process.env.NEXTAUTH_SECRET || "jct-financial-os-rbac-production-secret-2026";

export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_FALLBACK_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "JCT Credentials",
      credentials: {
        username: { label: "Username / Terminal ID", type: "text" },
        password: { label: "Password / Security PIN", type: "password" },
        profileId: { label: "Branch Profile", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        const rawUser = (credentials.username || "").trim().toLowerCase();
        const rawPass = (credentials.password || "").trim();
        const rawProfileId = (credentials.profileId || "").trim().toUpperCase();

        if (!rawPass) return null;

        let matchedAccount = JCT_AUTH_ACCOUNTS.find(
          (acc) =>
            (rawProfileId && acc.id === rawProfileId) ||
            (rawUser && acc.aliases.includes(rawUser))
        );

        // If user typed "staff" and also selected a specific branch profileId
        if (
          rawProfileId &&
          rawProfileId !== "BONGSI" &&
          (!matchedAccount || matchedAccount.id === "JCT_HARDWARE_JOTUN" || matchedAccount.id === "JCT_HQ")
        ) {
          const byProfile = JCT_AUTH_ACCOUNTS.find((a) => a.id === rawProfileId);
          if (byProfile) matchedAccount = byProfile;
        }

        if (!matchedAccount) return null;

        const isPasswordValid = matchedAccount.passwords.includes(rawPass);
        if (!isPasswordValid) return null;

        return {
          id: matchedAccount.id,
          name: matchedAccount.name,
          email: `${matchedAccount.username}@jct.sa`,
          role: matchedAccount.role,
          profileId: matchedAccount.id,
          branch: matchedAccount.branch,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as {
          id: string;
          role: UserRole;
          profileId: string;
          branch: string;
        };
        token.id = u.id;
        token.role = u.role;
        token.profileId = u.profileId;
        token.branch = u.branch;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const sUser = session.user as {
          id?: string;
          name?: string | null;
          email?: string | null;
          role?: UserRole;
          profileId?: string;
          branch?: string;
        };
        sUser.id = (token.id as string) || "JCT_HARDWARE_JOTUN";
        sUser.role = (token.role as UserRole) || "STAFF";
        sUser.profileId = (token.profileId as string) || "JCT_HARDWARE_JOTUN";
        sUser.branch = (token.branch as string) || "JCT Hardware + Jotun";
      }
      return session;
    },
  },
};
