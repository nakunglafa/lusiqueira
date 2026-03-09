import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_LARAVEL_URL ? process.env.NEXT_PUBLIC_LARAVEL_URL + "/api" : "");

async function laravelLogin(email, password) {
  const res = await fetch(`${apiUrl.replace(/\/?$/, "")}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Login failed");
  return data;
}

async function laravelAuthGoogle(profile) {
  const res = await fetch(`${apiUrl.replace(/\/?$/, "")}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: profile.name,
      email: profile.email,
      google_id: profile.sub,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Google auth failed");
  return data;
}

const options = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const data = await laravelLogin(credentials.email, credentials.password);
        const user = data.user ?? data;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          role_id: user.role_id,
          restaurants: user.restaurants,
          accessToken: data.access_token,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.id = user.id;
        token.role = user.role;
        token.role_id = user.role_id;
        token.restaurants = user.restaurants;
      }
      if (account?.provider === "google" && profile) {
        try {
          const data = await laravelAuthGoogle(profile);
          const u = data.user ?? data;
          token.accessToken = data.access_token;
          token.id = u.id;
          token.role = u.role;
          token.role_id = u.role_id;
          token.restaurants = u.restaurants;
          token.email = u.email ?? profile.email;
          token.name = u.name ?? profile.name;
        } catch (e) {
          console.error("Laravel Google auth failed", e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.role_id = token.role_id;
        session.user.restaurants = token.restaurants;
      }
      session.accessToken = token.accessToken;
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(options);
export { handler as GET, handler as POST };
