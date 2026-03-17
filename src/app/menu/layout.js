import { getRestaurant } from "@/lib/api";
import { toArray } from "@/lib/owner-utils";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "1";

function collectMenuItemNames(menusRaw) {
  const menus = Array.isArray(menusRaw) ? menusRaw : toArray(menusRaw || []);
  const names = new Set();

  const walkCategories = (categoriesRaw) => {
    const categories = Array.isArray(categoriesRaw) ? categoriesRaw : toArray(categoriesRaw || []);
    categories.forEach((cat) => {
      const items = Array.isArray(cat.items) ? cat.items : toArray(cat.items || []);
      items.forEach((item) => {
        if (item?.name) names.add(item.name);
      });
      if (cat.children) {
        walkCategories(cat.children);
      }
    });
  };

  menus.forEach((menu) => {
    if (menu?.categories) {
      walkCategories(menu.categories);
    }
  });

  return Array.from(names);
}

export async function generateMetadata() {
  try {
    const data = await getRestaurant(RESTAURANT_ID);
    const restaurant = data?.restaurant ?? data?.data ?? data;

    const name = restaurant?.name || "Lusiqueira Burger and Grill Restaurant";
    const address =
      restaurant?.address || "Campo Grande 232 G R/C Loja D, 1700-072 Lisboa";
    const phone = restaurant?.phone || "+351 920 311 793";
    const logoUrl =
      restaurant?.logo_url ||
      "https://lusiqueiraburger.pt/img/cover.jpg";

    const menuItemNames =
      collectMenuItemNames(restaurant?.menus ?? data?.menus ?? []) || [];

    const highlightedItems = menuItemNames.slice(0, 10).join(", ");

    const title =
      "Menu Lusiqueira Burger & Grill House | Hambúrgueres, Grelhados, Smash Burgers & Bebidas em Campo Grande";

    const description =
      `Explore o menu completo de ${name} em ${address}: ` +
      (highlightedItems
        ? `${highlightedItems}. `
        : "") +
      "Entradas, grelhados, hambúrguer smash, sandes, sobremesas, bebidas e vinhos junto ao Jardim do Campo Grande, a 2 minutos do Metro de Alvalade e perto da Cidade Universitária em Lisboa. Reserve ou faça take-away para estudantes, trabalhadores de escritório e moradores de Alvalade.";

    return {
      title,
      description,
      alternates: {
        canonical: "/menu",
      },
      openGraph: {
        title,
        description,
        url: "/menu",
        type: "website",
        siteName: "Lusiqueira Burger & Grill House",
        images: [
          {
            url: logoUrl,
            width: 800,
            height: 800,
            alt: name,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [logoUrl],
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
        },
      },
    };
  } catch {
    const fallbackTitle =
      "Menu Lusiqueira Burger & Grill House | Hambúrgueres & Grelhados em Campo Grande – Alvalade";
    const fallbackDescription =
      "Veja o menu da Lusiqueira Burger & Grill House em Campo Grande, Lisboa: hambúrgueres artesanais, grelhados, entradas, sobremesas e bebidas a poucos minutos do Metro de Alvalade e do Jardim do Campo Grande.";

    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: {
        canonical: "/menu",
      },
    };
  }
}

export default function MenuLayout({ children }) {
  return children;
}

