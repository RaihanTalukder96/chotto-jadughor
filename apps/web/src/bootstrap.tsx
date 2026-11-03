import { StrictMode, Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Storefront } from "./storefront";
import "./style.css";

// Customer visitors don't need to download staff forms, reports and controls.
const AdminPortal = lazy(() => import("./main"));
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 10000 } },
});
function Metadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const section = pathname.startsWith("/admin")
      ? "Store administration"
      : pathname === "/shop"
        ? "Shop baby essentials"
        : pathname === "/cart"
          ? "Your shopping bag"
          : pathname === "/checkout"
            ? "Checkout"
            : pathname === "/account"
              ? "Your account"
              : pathname === "/track"
                ? "Track your order"
                : "Safe for baby. Easy for parents. Honest price.";
    document.title = `Chotto Jadughor · ${section}`;
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content =
      /^\/(admin|cart|checkout|account|track|wishlist)(\/|$)/.test(pathname)
        ? "noindex,nofollow"
        : "index,follow";
  }, [pathname]);
  return null;
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Metadata />
        <Suspense
          fallback={
            <div className="loading" role="status">
              Loading your workspace…
            </div>
          }
        >
          <Routes>
            <Route path="/admin/*" element={<AdminPortal />} />
            <Route path="*" element={<Storefront />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  </StrictMode>,
);
