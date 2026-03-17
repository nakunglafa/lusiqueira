export default function sitemap() {
  const baseUrl = "https://lusiqueiraburger.pt";

  const routes = [
    { path: "/", priority: 1.0, changeFrequency: "daily" },
    { path: "/menu", priority: 0.9, changeFrequency: "daily" },
    { path: "/book", priority: 0.9, changeFrequency: "weekly" },
    { path: "/reservations", priority: 0.7, changeFrequency: "weekly" },
    { path: "/orders", priority: 0.7, changeFrequency: "weekly" },
    { path: "/checkout", priority: 0.6, changeFrequency: "weekly" },
    { path: "/login", priority: 0.4, changeFrequency: "monthly" },
    { path: "/register", priority: 0.4, changeFrequency: "monthly" },
    { path: "/profile", priority: 0.5, changeFrequency: "monthly" },
  ];

  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

