import { getRestaurant } from "@/lib/api";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "1";

export async function generateMetadata() {
  try {
    const data = await getRestaurant(RESTAURANT_ID);
    const restaurant = data?.restaurant ?? data?.data ?? data;

    const name = restaurant?.name || "Lusiqueira Burger and Grill Restaurant";
    const address =
      restaurant?.address || "Campo Grande 232 G R/C Loja D, 1700-072 Lisboa";
    const phone = restaurant?.phone || "+351 920 311 793";

    const title =
      "Reservar Mesa | Lusiqueira Burger & Grill House em Campo Grande – Perto do Metro de Alvalade";

    const description =
      `Reserve a sua mesa em ${name}, ${address}. ` +
      "A poucos minutos do Metro de Alvalade, Jardim do Campo Grande, Cidade Universitária e Estádio José Alvalade. " +
      "Perfeito para jantares de grupo, after-work, estudantes e famílias em Alvalade. Ligue " +
      phone +
      " ou faça a sua reserva online.";

    return {
      title,
      description,
      alternates: {
        canonical: "/book",
      },
      openGraph: {
        title,
        description,
        url: "/book",
        type: "website",
        siteName: "Lusiqueira Burger & Grill House",
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    const fallbackTitle =
      "Reservar Mesa | Lusiqueira Burger & Grill House em Campo Grande – Alvalade";
    const fallbackDescription =
      "Faça a sua reserva na Lusiqueira Burger & Grill House em Campo Grande, Lisboa. Restaurante de hambúrgueres e grelhados perto do Metro de Alvalade e do Jardim do Campo Grande.";

    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: {
        canonical: "/book",
      },
    };
  }
}

export default function BookLayout({ children }) {
  return children;
}

