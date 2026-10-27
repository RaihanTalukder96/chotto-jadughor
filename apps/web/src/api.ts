export type User = {
  id: string;
  username: string;
  role: string;
  mustChangePassword: boolean;
  permissions: string[];
  csrf: string;
};
export type Product = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  category: { id: string; name: string };
  description: string;
  buyingPrice?: string;
  minPrice: string;
  maxPrice: string;
  stock: number;
  lowStockThreshold: number;
  archived: boolean;
  version: number;
  images: { thumbnail: string; url: string }[];
};
export type Catalog = {
  items: Product[];
  total: number;
  page: number;
  pages: number;
};
export type Category = { id: string; name: string };
let csrf = "";
export const setCsrf = (value: string) => {
  csrf = value;
};
const base = import.meta.env.VITE_API_BASE ?? "/api";
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (csrf) headers.set("X-CSRF-Token", csrf);
  const res = await fetch(base + path, {
    ...options,
    credentials: "include",
    headers,
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: { message: "Network request failed" } }));
    if (
      res.status === 401 &&
      path !== "/auth/login" &&
      (path !== "/auth/me" || csrf !== "")
    )
      window.dispatchEvent(new Event("session-expired"));
    throw new Error(error.error?.message ?? "Request failed");
  }
  return res.json();
}
export const post = (path: string, body: unknown, method = "POST") =>
  api(path, { method, body: JSON.stringify(body) });
export async function downloadPdf(id: string) {
  const res = await fetch(base + `/calculations/${id}/pdf`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Unable to download report");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `Chotto-Jadughor-${id}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const bdt = (value: string | number) => {
  const raw = String(value);
  const negative = raw.startsWith("-");
  const [whole, fraction = ""] = raw.replace(/^-/, "").split(".");
  return (
    (negative ? "-" : "") +
    "৳" +
    BigInt(whole!).toLocaleString("en-BD") +
    "." +
    fraction.padEnd(2, "0")
  );
};
export const date = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
