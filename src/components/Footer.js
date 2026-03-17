export function Footer({ restaurantName = "Restaurant" }) {
  return (
    <footer className="mt-auto site-footer">
      <div className="mx-auto max-w-6xl px-4 text-center text-[13px] text-wood-600">
        <p>© {new Date().getFullYear()} {restaurantName}. All rights reserved.</p>
        <p>
          Developed and managed by{" "}
          <span className="font-medium text-wood-700">Digital Lisbon Software Solution</span>
        </p>
      </div>
    </footer>
  );
}
