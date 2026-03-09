"use client";

import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { RealTimeNotificationProvider } from "@/context/RealTimeNotificationContext";
import { LiveNotificationToast } from "@/components/LiveNotificationToast";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { CartFloatingButton } from "@/components/CartFloatingButton";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "missing-client-id";

export function Providers({ children }) {
  return (
    <SessionProvider>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <AuthProvider>
          <CartProvider>
            <RealTimeNotificationProvider>
              {children}
              <LiveNotificationToast />
            </RealTimeNotificationProvider>
            <CartFloatingButton />
          </CartProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </SessionProvider>
  );
}
