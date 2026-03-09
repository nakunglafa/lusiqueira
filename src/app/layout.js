import { Montserrat } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Footer } from "@/components/Footer";
import { getRestaurant } from "@/lib/api";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "9";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "Restaurant — Find & Book",
  description: "Discover restaurants and make reservations",
  icons: {
    icon: "/window.svg",
    apple: "/window.svg",
  },
};

export default async function RootLayout({ children }) {
  let restaurantName = process.env.NEXT_PUBLIC_RESTAURANT_NAME || "Restaurant";
  try {
    const data = await getRestaurant(RESTAURANT_ID);
    const rest = data?.restaurant ?? data?.data ?? data;
    if (rest?.name) restaurantName = rest.name;
  } catch (_) {
    // Fallback to env or "Restaurant" if fetch fails
  }

  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} font-sans antialiased text-base`}
      >
        <div className="flex min-h-screen flex-col">
          <Providers>{children}</Providers>
          <Footer restaurantName={restaurantName} />
        </div>
      </body>
    </html>
  );
}
