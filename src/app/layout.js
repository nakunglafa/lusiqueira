import { Montserrat } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { Footer } from "@/components/Footer";
import { getRestaurant } from "@/lib/api";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "1";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const siteTitle =
  "Lusiqueira Burger & Grill House | Hambúrgueres Artesanais em Alvalade & Best Burgers near Alvalade Metro";
const siteDescription =
  "Descubra a Lusiqueira Burger & Grill House no Campo Grande 232 C, em frente ao Jardim do Campo Grande e a 2 min do Metro de Alvalade. Hambúrgueres artesanais, grelhados premium e refeições rápidas para estudantes, trabalhadores de escritório e moradores de Alvalade. Lusiqueira Burger & Grill House in Campo Grande 232 C, opposite Jardim do Campo Grande and 2 minutes from Alvalade Metro. Artisan burgers, premium grilled meats and quick lunches for university students, office workers and Alvalade locals.";

export const metadata = {
  metadataBase: new URL("https://lusiqueiraburger.pt"),
  title: siteTitle,
  description: siteDescription,
  keywords: [
    "Lusiqueira Burger & Grill House",
    "hambúrguer artesanal Alvalade",
    "hambúrgueres Campo Grande",
    "restaurante hamburgueria Alvalade",
    "grill house Lisboa",
    "burgers near me Lisbon",
    "Jardim do Campo Grande",
    "Metro de Alvalade",
    "Cidade Universitária",
    "Estádio José Alvalade",
  ],
  alternates: {
    canonical: "/",
    languages: {
      "pt-PT": "/",
      "en": "/",
    },
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: "Lusiqueira Burger & Grill House",
    locale: "pt_PT",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/favicon-180x180.png",
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-FXP9H4LTE2"
          strategy="afterInteractive"
        />
        <Script
          id="ga-gtag"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-FXP9H4LTE2');
            `,
          }}
        />
        <Script
          id="restaurant-schema"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Restaurant",
              name: "Lusiqueira Burger & Grill House",
              image: "https://lusiqueiraburger.pt/favicon-32x32.png",
              address: {
                "@type": "PostalAddress",
                streetAddress: "Campo Grande 232 C",
                addressLocality: "Lisboa",
                postalCode: "1700-094",
                addressCountry: "PT",
              },
              geo: {
                "@type": "GeoCoordinates",
                latitude: 38.7512,
                longitude: -9.1465,
              },
              url: "https://lusiqueiraburger.pt",
              telephone: "+351920311793",
              servesCuisine: ["Burgers", "Grill", "Portuguese"],
              priceRange: "$$",
              openingHoursSpecification: [
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ],
                  opens: "12:00",
                  closes: "23:00",
                },
              ],
            }),
          }}
        />
        <div className="flex min-h-screen flex-col">
          <Providers>{children}</Providers>
          <Footer restaurantName={restaurantName} />
        </div>
      </body>
    </html>
  );
}
