export async function generateMetadata() {
  const title =
    "As Minhas Reservas | Lusiqueira Burger & Grill House – Gerir Reservas";
  const description =
    "Veja e gere as suas reservas na Lusiqueira Burger & Grill House em Campo Grande, Lisboa. Consulte reservas futuras e passadas perto do Metro de Alvalade e do Jardim do Campo Grande.";

  return {
    title,
    description,
    alternates: {
      canonical: "/reservations",
    },
      robots: {
        index: false,
        follow: true,
      },
  };
}

export default function ReservationsLayout({ children }) {
  return children;
}

