export function Footer({ restaurantName = "Restaurant" }) {
  return (
    <footer className="mt-auto border-t border-white/10 bg-wood-100/80 backdrop-blur-xl py-6">
      <div className="mx-auto max-w-6xl px-4 text-center text-[15px] text-wood-600">
        <p>© {new Date().getFullYear()} {restaurantName}. All rights reserved.</p>
        <p className="mt-1">
          Developed and managed by{" "}
          <span className="font-medium text-wood-700">Digital Lisbon Software Solution</span>
        </p>
      </div>
    </footer>
  );
}
