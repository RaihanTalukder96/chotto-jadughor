import React, { useState, useEffect, createContext, useContext } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
} from "react-router";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard,
  Package,
  Calculator,
  SlidersHorizontal,
  LogOut,
  Search,
  Plus,
  ArrowUpRight,
  House,
  Heart,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ShieldCheck,
  Boxes,
} from "lucide-react";
import {
  api,
  post,
  setCsrf,
  bdt,
  date,
  downloadPdf,
  type User,
  type Product,
  type Catalog,
  type Category,
} from "./api";
import "./style.css";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: true, staleTime: 10000 },
  },
});
const Context = createContext<User>(null!);
const useUser = () => useContext(Context);
function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="notice error" role="alert">
      {error instanceof Error ? error.message : "Something went wrong"}
    </div>
  );
}
function Loading() {
  return (
    <div className="loading" role="status">
      <img
        className="loading-logo"
        src="/brand/logo-chotto.jpeg"
        alt="Chotto Jadughor"
      />
      Loading your workspace…
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    const handle = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d.addEventListener("cancel", handle);
    return () => {
      d.removeEventListener("cancel", handle);
      d.close();
    };
  }, [onClose]);
  return (
    <dialog ref={ref} aria-label={title}>
      <header>
        <h2>{title}</h2>
        <button className="icon" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function App() {
  const q = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/auth/me"),
    retry: false,
  });
  useEffect(() => {
    const handle = () => {
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      setCsrf("");
      client.setQueryData(["me"], null);
      toast.error("Your session expired. Please sign in again.");
    };
    window.addEventListener("session-expired", handle);
    return () => window.removeEventListener("session-expired", handle);
  }, []);
  useEffect(() => {
    if (q.data) setCsrf(q.data.csrf);
  }, [q.data]);
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Login />;
  return (
    <Context.Provider value={q.data}>
      {q.data.mustChangePassword ? <Password required /> : <Shell />}
    </Context.Provider>
  );
}
const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
});
function Login() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });
  const [error, setError] = useState<unknown>();
  return (
    <div className="login">
      <section className="login-story">
        <Brand />
        <div>
          <span className="eyebrow">A LITTLE CARE. A LOT OF POSSIBILITY.</span>
          <h1>
            Small things.
            <br />
            Beautiful beginnings.
          </h1>
          <p>
            A thoughtful workspace for the products that make growing up a
            little more magical.
          </p>
          <div className="big-brand-art" aria-hidden="true">
            <House size={180} strokeWidth={1} />
            <Heart size={54} className="brand-heart" />
          </div>
        </div>
        <small>Made for Chotto Jadughor · ছোট্ট জাদুঘর</small>
      </section>
      <main className="login-form">
        <div>
          <span className="pill">
            <ShieldCheck size={14} /> PRIVATE STORE WORKSPACE
          </span>
          <h1>Welcome back.</h1>
          <p className="muted">Sign in to take care of your store.</p>
          <form
            onSubmit={handleSubmit(async (values) => {
              try {
                setError(undefined);
                await post("/auth/login", values);
                await client.invalidateQueries({ queryKey: ["me"] });
              } catch (e) {
                setError(e);
              }
            })}
          >
            <label>
              Username
              <input autoComplete="username" {...register("username")} />
              {errors.username && (
                <small className="danger">{errors.username.message}</small>
              )}
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <small className="danger">{errors.password.message}</small>
              )}
            </label>
            {!!error && <ErrorState error={error} />}
            <button className="primary" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in to workspace"}
              <ArrowUpRight size={17} />
            </button>
          </form>
          <p className="muted small">
            Accounts are managed by your administrator.
            <br />
            Need access? Contact your store administrator.
          </p>
        </div>
      </main>
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <img
        className="brand-logo"
        src="/brand/logo-chotto.jpeg"
        alt="ছোট্ট জাদুঘর — Baby & Kids Shop"
        width="303"
        height="280"
      />
      <div>
        <strong>Chotto Jadughor</strong>
        <small>Baby & Kids Shop · Store workspace</small>
      </div>
    </div>
  );
}
function Password({
  required = false,
  onClose,
}: {
  required?: boolean;
  onClose?: () => void;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm"))
      return setError(new Error("Passwords must match"));
    setBusy(true);
    try {
      await post("/auth/password", {
        currentPassword: f.get("currentPassword"),
        password: f.get("password"),
      });
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      setCsrf("");
      client.setQueryData(["me"], null);
      toast.success("Password changed. Sign in with your new password.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={required ? "password-page" : ""}>
      <form onSubmit={submit}>
        {required && <Brand />}
        <h2>{required ? "Set your new password" : "Change password"}</h2>
        <p className="muted">
          Use at least 12 characters with uppercase, lowercase, a number and a
          symbol. All sessions will end.
        </p>
        <label>
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          New password
          <input
            name="password"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>
        {!!error && <ErrorState error={error} />}
        <button className="primary" disabled={busy}>
          Save password
        </button>
        {onClose && (
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
const nav = [
  {
    to: "/",
    label: "Dashboard",
    permission: "dashboard.read",
    icon: LayoutDashboard,
  },
  {
    to: "/products",
    label: "Manage Product",
    permission: "products.read",
    icon: Package,
  },
  {
    to: "/calculations",
    label: "Profit Calculation",
    permission: "calculations.use",
    icon: Calculator,
  },
  {
    to: "/control",
    label: "Menu Control",
    permission: "permissions.manage",
    icon: SlidersHorizontal,
  },
];
function Shell() {
  const user = useUser();
  const [mobile, setMobile] = useState(false);
  const [password, setPassword] = useState(false);
  const navigate = useNavigate();
  const first = nav.find((n) => user.permissions.includes(n.permission));
  async function logout() {
    try {
      await post("/auth/logout", {});
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
      setCsrf("");
      client.setQueryData(["me"], null);
      navigate("/");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="shell">
      <button
        className="mobile-toggle"
        onClick={() => setMobile(!mobile)}
        aria-label="Toggle navigation"
      >
        <Menu />
      </button>
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <Brand />
        <div className="store-label">STORE WORKSPACE</div>
        <nav>
          {nav
            .filter((n) => user.permissions.includes(n.permission))
            .map((n) => (
              <NavLink
                end={n.to === "/"}
                key={n.to}
                to={n.to}
                onClick={() => setMobile(false)}
              >
                <n.icon size={19} />
                {n.label}
                <span className="nav-dot" />
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-note">
          <Heart size={24} />
          <strong>A little care goes a long way.</strong>
          <p>Everything your store needs, in one happy place.</p>
        </div>
        <div className="profile">
          <span className="avatar">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <button onClick={() => setPassword(true)}>
            <strong>{user.username}</strong>
            <small>
              {user.role === "MANAGER"
                ? "Store Manager"
                : user.role === "ADMIN"
                  ? "Administrator"
                  : "Shopkeeper"}
            </small>
          </button>
          <button className="icon" onClick={logout} aria-label="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <div className="topbar">
          <span className="topbar-brand">
            <img className="topbar-logo" src="/brand/logo-chotto.jpeg" alt="" />
            <span>YOUR STORE, THOUGHTFULLY ORGANIZED</span>
          </span>
          <span className="top-status">
            <i /> Chotto Jadughor workspace
          </span>
        </div>
        <Routes>
          <Route
            path="/"
            element={
              user.permissions.includes("dashboard.read") ? (
                <CatalogPage />
              ) : first ? (
                <Navigate to={first.to} />
              ) : (
                <p className="notice">
                  Your administrator has not enabled any menus.
                </p>
              )
            }
          />
          <Route
            path="/products"
            element={
              <Gate permission="products.read">
                <CatalogPage manage />
              </Gate>
            }
          />
          <Route
            path="/calculations"
            element={
              <Gate permission="calculations.use">
                <Calculations />
              </Gate>
            }
          />
          <Route
            path="/control"
            element={
              <Gate permission="permissions.manage">
                <Control />
              </Gate>
            }
          />
          <Route
            path="*"
            element={
              <div className="notice">
                Page not found. <NavLink to="/">Return to workspace</NavLink>
              </div>
            }
          />
        </Routes>
        <footer>
          <span className="footer-brand">
            <img className="footer-logo" src="/brand/logo-chotto.jpeg" alt="" />
            Chotto Jadughor
          </span>{" "}
          <span>Thoughtfully managed. Lovingly chosen.</span>
        </footer>
      </main>
      {password && (
        <Modal title="Your account" onClose={() => setPassword(false)}>
          <Password onClose={() => setPassword(false)} />
        </Modal>
      )}
    </div>
  );
}
function Gate({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  return useUser().permissions.includes(permission) ? (
    children
  ) : (
    <div className="notice error">You don’t have access to this page.</div>
  );
}
function CatalogPage({ manage = false }: { manage?: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [archived, setArchived] = useState(false);
  const [editor, setEditor] = useState<Product | null | undefined>();
  const [detail, setDetail] = useState<Product>();
  const [categories, setCategories] = useState(false);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  const q = useQuery({
    queryKey: ["catalog", manage, debounced, category, sort, page, archived],
    queryFn: () =>
      api<Catalog>(
        `${manage ? "/products" : "/dashboard"}?${new URLSearchParams({ search: debounced, categoryId: category, sort, page: String(page), archived: String(archived) }).toString().replace("categoryId=&", "")}`,
      ),
  });
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/categories"),
  });
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {manage ? "THE DETAILS THAT MATTER" : "A LITTLE OVERVIEW"}
          </span>
          <h1>
            {manage ? "Your product collection" : "Hello, let’s grow together."}
            <Heart className="heading-heart" size={23} aria-hidden="true" />
          </h1>
          <p className="muted">
            {manage
              ? "Keep your catalog, prices and inventory beautifully in order."
              : "Discover your collection and find just what you’re looking for."}
          </p>
        </div>
        {manage ? (
          <button className="primary" onClick={() => setEditor(null)}>
            <Plus size={17} /> Add product
          </button>
        ) : (
          <span className="date-pill">
            {new Date().toLocaleDateString("en-GB", {
              timeZone: "Asia/Dhaka",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        )}
      </div>
      <div className="catalog-banner">
        <div className="banner-icon">
          <Boxes size={30} />
        </div>
        <div>
          <span className="eyebrow">LITTLE WONDERS, ALL IN ONE PLACE</span>
          <h2>
            {manage
              ? "Room for every little wonder."
              : "Big love for little essentials."}
          </h2>
          <p>
            Thoughtfully chosen products for the smallest members of the family.
          </p>
        </div>
        <div className="banner-art">
          <img
            className="banner-logo"
            src="/brand/logo-chotto.jpeg"
            alt="Chotto Jadughor · Baby & Kids Shop"
          />
          <span>
            Baby &
            <br />
            Kids Shop
          </span>
        </div>
      </div>
      <div className="section-title">
        <h2>
          {manage ? "Manage products" : "The collection"}{" "}
          <span className="count">{q.data?.total ?? "—"}</span>
        </h2>
        {manage ? (
          <button className="text-button" onClick={() => setCategories(true)}>
            Manage categories <ArrowUpRight size={15} />
          </button>
        ) : (
          <span className="muted small">
            A little something for every beginning
          </span>
        )}
      </div>
      <div className="filters">
        <div className="search">
          <Search size={18} />
          <input
            aria-label="Search products"
            placeholder="Search by name, product ID or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {cats.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort products"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="name">Name: A to Z</option>
          <option value="newest">Recently added</option>
          <option value="price">Price: low to high</option>
        </select>
        {manage && (
          <label className="check">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => {
                setArchived(e.target.checked);
                setPage(1);
              }}
            />
            Archived
          </label>
        )}
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : q.data?.items.length ? (
        <>
          <div className="product-grid">
            {q.data.items.map((p) => (
              <button
                className="product-card"
                key={p.id}
                onClick={() => setDetail(p)}
              >
                <div className="product-image">
                  {p.images[0] ? (
                    <img
                      src={p.images[0].thumbnail}
                      alt={p.name}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="image-fallback">
                      <img
                        className="product-fallback-logo"
                        src="/brand/logo-chotto.jpeg"
                        alt=""
                      />
                      <small>Product image coming soon</small>
                    </div>
                  )}
                  <span
                    className={
                      "stock " +
                      (p.stock === 0
                        ? "out"
                        : p.stock <= p.lowStockThreshold
                          ? "low"
                          : "")
                    }
                  >
                    {p.stock === 0
                      ? "Out of stock"
                      : p.stock <= p.lowStockThreshold
                        ? "Low stock"
                        : "In stock"}
                  </span>
                </div>
                <div className="product-info">
                  <span className="eyebrow">{p.category.name}</span>
                  <h3>{p.name}</h3>
                  <p className="small muted">
                    {p.productId} · {p.sku}
                  </p>
                  <div className="product-bottom">
                    <strong>
                      {bdt(p.minPrice)} <small>from</small>
                    </strong>
                    <span>
                      {p.stock} in stock <ArrowUpRight size={16} />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="pagination">
            <span className="muted small">
              Page {page} of {q.data.pages} · {q.data.total} products
            </span>
            <div>
              <button
                aria-label="Previous page"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={17} />
              </button>
              <button
                aria-label="Next page"
                disabled={page >= q.data.pages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="empty">
          <Package size={38} />
          <h2>
            {search || category
              ? "No matching little wonders"
              : "Your collection starts here"}
          </h2>
          <p className="muted">
            {manage
              ? "Add a product to start managing your collection."
              : "Products added by your team will appear here."}
          </p>
          {manage && (
            <button className="primary" onClick={() => setEditor(null)}>
              <Plus size={16} /> Add your first product
            </button>
          )}
        </div>
      )}
      {editor !== undefined && (
        <Modal
          title={editor ? "Edit product" : "Add a little wonder"}
          onClose={() => setEditor(undefined)}
        >
          <ProductForm
            product={editor}
            onDone={() => {
              setEditor(undefined);
              client.invalidateQueries({ queryKey: ["catalog"] });
            }}
          />
        </Modal>
      )}
      {detail && (
        <Modal title="Product details" onClose={() => setDetail(undefined)}>
          <ProductDetail
            product={detail}
            manage={manage}
            onEdit={() => {
              setEditor(detail);
              setDetail(undefined);
            }}
            onDone={() => {
              setDetail(undefined);
              client.invalidateQueries({ queryKey: ["catalog"] });
            }}
          />
        </Modal>
      )}
      {categories && (
        <Modal title="Categories" onClose={() => setCategories(false)}>
          <Categories />
        </Modal>
      )}
    </section>
  );
}
const amount = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,10})(\.\d{1,2})?$/,
    "Enter a non-negative amount, up to 2 decimal places",
  );
const formSchema = z
  .object({
    productId: z.string().trim().min(1),
    sku: z.string().trim().min(1),
    name: z.string().trim().min(1),
    categoryId: z.uuid(),
    description: z.string().max(3000),
    buyingPrice: amount,
    minPrice: amount,
    maxPrice: amount,
    stock: z.number().int().nonnegative(),
    lowStockThreshold: z.number().int().nonnegative(),
  })
  .refine((v) => Number(v.maxPrice) >= Number(v.minPrice), {
    path: ["maxPrice"],
    message: "Maximum must be at least minimum price",
  });
function ProductForm({
  product,
  onDone,
}: {
  product: Product | null;
  onDone: () => void;
}) {
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/categories"),
  });
  const [file, setFile] = useState<File>();
  const [error, setError] = useState<unknown>();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: product
      ? {
          ...product,
          buyingPrice: product.buyingPrice!,
          categoryId: product.category.id,
        }
      : {
          productId: "",
          sku: "",
          name: "",
          categoryId: "",
          description: "",
          buyingPrice: "0",
          minPrice: "0",
          maxPrice: "0",
          stock: 0,
          lowStockThreshold: 5,
        },
  });
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        try {
          setError(undefined);
          const p = await post(
            product ? `/products/${product.id}` : "/products",
            { ...values, ...(product ? { version: product.version } : {}) },
            product ? "PUT" : "POST",
          );
          if (file) {
            const data = new FormData();
            data.set("image", file);
            data.set("version", String(p.version));
            try {
              await api(`/products/${p.id}/image`, {
                method: "POST",
                body: data,
              });
            } catch (e) {
              toast.error(
                "Product saved, but image failed: " + (e as Error).message,
              );
            }
          }
          toast.success("Product saved");
          onDone();
        } catch (e) {
          setError(e);
        }
      })}
    >
      <div className="form-grid">
        {[
          ["name", "Product name"],
          ["productId", "Product ID"],
          ["sku", "SKU"],
        ].map(([field, label]) => (
          <label key={field}>
            {label}
            <input
              {...register(field as "name")}
              maxLength={field === "name" ? 200 : 50}
            />
            {errors[field as "name"] && (
              <small className="danger">
                {errors[field as "name"]?.message}
              </small>
            )}
          </label>
        ))}
        <label>
          Category
          <select {...register("categoryId")}>
            <option value="">Choose category</option>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <small className="danger">Choose a category</small>
          )}
        </label>
        {[
          ["buyingPrice", "Buying price (৳)"],
          ["minPrice", "Minimum selling price (৳)"],
          ["maxPrice", "Maximum selling price (৳)"],
        ].map(([f, l]) => (
          <label key={f}>
            {l}
            <input inputMode="decimal" {...register(f as "buyingPrice")} />
            {errors[f as "buyingPrice"] && (
              <small className="danger">
                {errors[f as "buyingPrice"]?.message}
              </small>
            )}
          </label>
        ))}
        <label>
          {product
            ? "Current stock (use Adjust stock to change)"
            : "Opening stock"}
          <input
            type="number"
            min={0}
            readOnly={!!product}
            {...register("stock", { valueAsNumber: true })}
          />
        </label>
        <label>
          Low-stock threshold
          <input
            type="number"
            min={0}
            {...register("lowStockThreshold", { valueAsNumber: true })}
          />
        </label>
      </div>
      <label>
        Description
        <textarea {...register("description")} />
      </label>
      <label>
        Main image · JPEG, PNG or WebP · up to 5 MB
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0])}
        />
      </label>
      {Number(watch("buyingPrice")) > Number(watch("minPrice")) && (
        <p className="notice warning">
          Buying price exceeds minimum selling price. This may produce a loss.
        </p>
      )}
      {!!error && <ErrorState error={error} />}
      <button className="primary" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save product"}
      </button>
    </form>
  );
}
function ProductDetail({
  product: p,
  manage,
  onEdit,
  onDone,
}: {
  product: Product;
  manage: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const [adjust, setAdjust] = useState(false);
  const [error, setError] = useState<unknown>();
  const [confirm, setConfirm] = useState(false);
  const history = useQuery({
    queryKey: ["stock", p.id],
    queryFn: () => api<any[]>(`/products/${p.id}/stock`),
    enabled: manage,
  });
  return (
    <div>
      {p.images[0] && (
        <img className="detail-image" src={p.images[0].url} alt={p.name} />
      )}
      <span className="eyebrow">{p.category.name}</span>
      <h2>{p.name}</h2>
      <p className="muted">
        {p.productId} · {p.sku}
      </p>
      <p className="prewrap">{p.description || "No description added."}</p>
      <div className="metrics">
        <div>
          <small>Selling range</small>
          <strong>
            {bdt(p.minPrice)} – {bdt(p.maxPrice)}
          </strong>
        </div>
        <div>
          <small>Available stock</small>
          <strong>{p.stock} units</strong>
        </div>
        {manage && (
          <div>
            <small>Buying price</small>
            <strong>{bdt(p.buyingPrice!)}</strong>
          </div>
        )}
      </div>
      {manage && (
        <>
          <div className="actions">
            <button className="primary" onClick={onEdit}>
              Edit product
            </button>
            <button onClick={() => setAdjust(!adjust)}>Adjust stock</button>
            <button className="danger" onClick={() => setConfirm(true)}>
              {p.archived ? "Restore" : "Archive"}
            </button>
            {p.images[0] && (
              <button
                onClick={async () => {
                  try {
                    await post(
                      `/products/${p.id}/image`,
                      { version: p.version },
                      "DELETE",
                    );
                    onDone();
                  } catch (e) {
                    setError(e);
                  }
                }}
              >
                Remove image
              </button>
            )}
          </div>
          {confirm && (
            <div className="notice warning">
              <p>
                {p.archived
                  ? "Restore this product to the active catalog?"
                  : "Archive this product? Saved reports will be preserved."}
              </p>
              <button
                onClick={async () => {
                  try {
                    await post(
                      `/products/${p.id}/archive`,
                      { version: p.version, archived: !p.archived },
                      "PATCH",
                    );
                    onDone();
                    toast.success("Product updated");
                  } catch (e) {
                    setError(e);
                  }
                }}
              >
                Confirm {p.archived ? "restore" : "archive"}
              </button>
              <button onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          )}
          {adjust && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  await post(`/products/${p.id}/stock`, {
                    version: p.version,
                    change: Number(f.get("change")),
                    reason: f.get("reason"),
                  });
                  onDone();
                  toast.success("Stock adjusted");
                } catch (e) {
                  setError(e);
                }
              }}
            >
              <label>
                Quantity change (negative to remove)
                <input name="change" type="number" required />
              </label>
              <label>
                Reason
                <input name="reason" maxLength={300} required />
              </label>
              <button className="primary">Save adjustment</button>
            </form>
          )}
          <h3>Recent stock adjustments</h3>
          {history.data?.map((h) => (
            <p className="history-line" key={h.id}>
              <strong>
                {h.change > 0 ? "+" : ""}
                {h.change}
              </strong>{" "}
              {h.reason}
              <small>
                {h.user.username} · {date(h.createdAt)}
              </small>
            </p>
          ))}
        </>
      )}
      {!!error && <ErrorState error={error} />}
    </div>
  );
}
function Categories() {
  const q = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/categories"),
  });
  const [error, setError] = useState<unknown>();
  const [confirm, setConfirm] = useState<string>();
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await client.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category updated");
      setConfirm(undefined);
    } catch (e) {
      setError(e);
    }
  };
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(() => post("/categories", { name: f.get("name") }));
          e.currentTarget.reset();
        }}
      >
        <label>
          New category
          <input name="name" required maxLength={80} />
        </label>
        <button className="primary">Add category</button>
      </form>
      {q.data?.map((c) => (
        <form
          className="category-row"
          key={c.id}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() =>
              post(`/categories/${c.id}`, { name: f.get("name") }, "PATCH"),
            );
          }}
        >
          <input
            aria-label={`Category ${c.name}`}
            name="name"
            defaultValue={c.name}
            maxLength={80}
            required
          />
          <button>Rename</button>
          <button
            type="button"
            className="danger"
            onClick={() => setConfirm(c.id)}
          >
            Delete
          </button>
          {confirm === c.id && (
            <button
              type="button"
              onClick={() =>
                run(() => api(`/categories/${c.id}`, { method: "DELETE" }))
              }
            >
              Confirm delete
            </button>
          )}
        </form>
      ))}
      {!!error && <ErrorState error={error} />}
    </>
  );
}
type DraftLine = { product: Product; quantity: number; customPrice: string };
function Results({ result }: { result: any }) {
  return (
    <>
      <div className="metrics">
        <div>
          <small>Total units</small>
          <strong>{result.totalUnits}</strong>
        </div>
        <div>
          <small>Purchase cost</small>
          <strong>{bdt(result.cost)}</strong>
        </div>
        <div>
          <small>Calculation-level expenses</small>
          <strong>{bdt(result.expenses)}</strong>
        </div>
      </div>
      <div className="scenario-grid">
        {["min", "max", "custom"].map((k) => {
          const s = result.scenarios[k];
          return (
            <article className="scenario" key={k}>
              <span className="eyebrow">
                {k === "min" ? "Minimum" : k === "max" ? "Maximum" : "Custom"}{" "}
                scenario
              </span>
              <h2 className={Number(s.net) < 0 ? "danger" : ""}>
                {bdt(s.net)}
              </h2>
              <small>
                Net estimated {Number(s.net) < 0 ? "loss" : "profit"}
              </small>
              <dl>
                <dt>Revenue</dt>
                <dd>{bdt(s.revenue)}</dd>
                <dt>Gross profit/loss</dt>
                <dd>{bdt(s.profit)}</dd>
                <dt title="Gross profit ÷ revenue × 100">Margin ⓘ</dt>
                <dd>{s.margin === null ? "N/A" : s.margin + "%"}</dd>
                <dt title="Gross profit ÷ purchase cost × 100">Markup ⓘ</dt>
                <dd>{s.markup === null ? "N/A" : s.markup + "%"}</dd>
              </dl>
              {Number(s.net) < 0 && (
                <p className="danger small">
                  This scenario produces an estimated loss.
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className="muted small">
        Margin measures profit as a share of revenue. Markup measures profit as
        a share of buying cost. A zero denominator displays N/A. Custom
        scenarios use minimum prices where no custom price is entered.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Buy / unit</th>
              <th>Min / max / custom price</th>
              <th>Cost</th>
              <th>Min / max / custom revenue</th>
              <th>Min / max / custom profit</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((l: any) => (
              <tr key={l.id}>
                <td>
                  {l.name}
                  <small>
                    {l.productId} · {l.sku}
                  </small>
                  {l.warnings?.map((w: string) => (
                    <small className="danger" key={w}>
                      {w}
                    </small>
                  ))}
                </td>
                <td>{l.quantity}</td>
                <td>{bdt(l.buyingPrice)}</td>
                <td>
                  {bdt(l.minPrice)} / {bdt(l.maxPrice)} /{" "}
                  {bdt(l.customPrice ?? l.minPrice)}
                  {l.customFallback && <small>Custom: minimum fallback</small>}
                </td>
                <td>{bdt(l.cost)}</td>
                <td>
                  {["min", "max", "custom"]
                    .map((k) => bdt(l.scenarios[k].revenue))
                    .join(" / ")}
                </td>
                <td>
                  {["min", "max", "custom"]
                    .map((k) => bdt(l.scenarios[k].profit))
                    .join(" / ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Calculations() {
  const [tab, setTab] = useState("workspace");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [expenses, setExpenses] = useState("0");
  const [result, setResult] = useState<any>();
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState<any>();
  const [source, setSource] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [ack, setAck] = useState(false);
  const products = useQuery({
    queryKey: ["calculation-products", search],
    queryFn: () =>
      api<Catalog>(
        "/calculation-products?limit=20&search=" + encodeURIComponent(search),
      ),
    enabled: tab === "workspace",
  });
  const history = useQuery({
    queryKey: ["calculations", historyPage],
    queryFn: () => api<any[]>("/calculations?page=" + historyPage),
    enabled: tab === "history",
  });
  const body = () => ({
    title,
    notes,
    expenses,
    ...(source ? { sourceId: source } : {}),
    items: lines.map((l) => ({
      productId: l.product.id,
      quantity: l.quantity,
      ...(l.customPrice !== "" ? { customPrice: l.customPrice } : {}),
    })),
  });
  const invalidate = () => {
    setResult(undefined);
    setAck(false);
  };
  const warnings =
    result &&
    (result.lines.some((l: any) => l.warnings.length) ||
      Object.values(result.scenarios).some((s: any) => Number(s.net) < 0));
  async function preview() {
    setBusy(true);
    try {
      setResult(await post("/calculations/preview", body()));
      setError(undefined);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const c = await post("/calculations", body());
      setSaved(await api(`/calculations/${c.id}`));
      client.invalidateQueries({ queryKey: ["calculations"] });
      toast.success("Immutable report saved");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PLAN WITH A LITTLE CONFIDENCE</span>
          <h1>
            Profit Calculation
            <Heart className="heading-heart" size={23} aria-hidden="true" />
          </h1>
          <p className="muted">
            Explore possibilities before making your next move.
          </p>
        </div>
      </div>
      <div className="tabs">
        <button
          className={tab === "workspace" ? "active" : ""}
          onClick={() => setTab("workspace")}
        >
          Calculation workspace
        </button>
        <button
          className={tab === "history" ? "active" : ""}
          onClick={() => setTab("history")}
        >
          Saved reports
        </button>
      </div>
      <div className="notice">
        <Calculator size={19} /> Hypothetical estimates only. Calculations do
        not record sales or change inventory.
      </div>
      {tab === "history" ? (
        <div className="panel">
          {history.isLoading ? (
            <Loading />
          ) : history.error ? (
            <ErrorState error={history.error} />
          ) : history.data?.length ? (
            history.data.map((c) => (
              <button
                key={c.id}
                className="report-row"
                onClick={async () => {
                  try {
                    setSaved(await api(`/calculations/${c.id}`));
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <span>
                  <strong>{c.title}</strong>
                  <small>
                    {c.reportNumber} · {c.preparedBy}
                  </small>
                </span>
                <span>
                  {date(c.createdAt)} <ArrowUpRight size={17} />
                </span>
              </button>
            ))
          ) : (
            <div className="empty">
              <h2>No saved reports yet</h2>
              <p>Your saved estimates will appear here.</p>
            </div>
          )}
          <div className="actions">
            <button
              disabled={historyPage === 1}
              onClick={() => setHistoryPage(historyPage - 1)}
            >
              Previous
            </button>
            <span>Page {historyPage}</span>
            <button
              disabled={(history.data?.length ?? 0) < 20}
              onClick={() => setHistoryPage(historyPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="form-grid">
              <label>
                Calculation title
                <input
                  value={title}
                  maxLength={160}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    invalidate();
                  }}
                  placeholder="e.g. November nursery collection"
                />
              </label>
              <label>
                Additional expenses (৳) · calculation-level
                <input
                  inputMode="decimal"
                  value={expenses}
                  onChange={(e) => {
                    setExpenses(e.target.value);
                    invalidate();
                  }}
                />
              </label>
            </div>
            <label>
              Notes
              <textarea
                value={notes}
                maxLength={3000}
                onChange={(e) => {
                  setNotes(e.target.value);
                  invalidate();
                }}
                placeholder="Add context for this estimate…"
              />
            </label>
            {source && (
              <p className="notice">
                New copy of a historical report. Current prices were explicitly
                refreshed; the original is unchanged.
              </p>
            )}
            <h3>Choose products</h3>
            <div className="search">
              <Search size={18} />
              <input
                aria-label="Find calculation products"
                placeholder="Search active products by name, ID or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="product-picker">
              {products.data?.items.map((p) => (
                <button
                  key={p.id}
                  disabled={lines.some((l) => l.product.id === p.id)}
                  onClick={() => {
                    setLines([
                      ...lines,
                      { product: p, quantity: 1, customPrice: "" },
                    ]);
                    invalidate();
                  }}
                >
                  <Plus size={15} />
                  <span>
                    {p.name}
                    <small>
                      {p.sku} · {bdt(p.minPrice)} – {bdt(p.maxPrice)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            {products.error && <ErrorState error={products.error} />}
            <div className="draft-lines">
              {lines.map((l, i) => (
                <div className="draft-line" key={l.product.id}>
                  <div>
                    <strong>{l.product.name}</strong>
                    <small>
                      {l.product.productId} · {l.product.sku} · Stock:{" "}
                      {l.product.stock}
                    </small>
                    <small>
                      Buying: {bdt(l.product.buyingPrice!)} · Selling:{" "}
                      {bdt(l.product.minPrice)} – {bdt(l.product.maxPrice)}
                    </small>
                  </div>
                  <label>
                    Quantity
                    <input
                      aria-label={`Quantity ${l.product.name}`}
                      type="number"
                      min={1}
                      max={1000000}
                      value={l.quantity}
                      onChange={(e) => {
                        setLines(
                          lines.map((x, j) =>
                            j === i
                              ? { ...x, quantity: Number(e.target.value) }
                              : x,
                          ),
                        );
                        invalidate();
                      }}
                    />
                  </label>
                  <label>
                    Custom price (৳)
                    <input
                      aria-label={`Custom price ${l.product.name}`}
                      inputMode="decimal"
                      placeholder="Minimum fallback"
                      value={l.customPrice}
                      onChange={(e) => {
                        setLines(
                          lines.map((x, j) =>
                            j === i ? { ...x, customPrice: e.target.value } : x,
                          ),
                        );
                        invalidate();
                      }}
                    />
                  </label>
                  <button
                    className="icon"
                    aria-label={`Remove ${l.product.name}`}
                    onClick={() => {
                      setLines(lines.filter((_, j) => i !== j));
                      invalidate();
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
            <button
              className="primary"
              disabled={busy || !lines.length || !title.trim()}
              onClick={preview}
            >
              {busy ? "Calculating…" : "Calculate estimate"}{" "}
              <ArrowUpRight size={17} />
            </button>
          </div>
          {!!error && <ErrorState error={error} />}{" "}
          {result && (
            <div className="panel">
              <h2>Your estimate</h2>
              <Results result={result} />
              {warnings && (
                <label className="check notice warning">
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  I understand the stock, price-range or loss warnings. This
                  remains a hypothetical estimate.
                </label>
              )}
              <button
                className="primary"
                disabled={busy || (warnings && !ack)}
                onClick={save}
              >
                Save immutable report
              </button>
            </div>
          )}
        </>
      )}
      {saved && (
        <Modal
          title="Saved calculation snapshot"
          onClose={() => setSaved(undefined)}
        >
          <h2>{saved.title}</h2>
          <p className="muted small">
            {saved.reportNumber}
            <br />
            {date(saved.createdAt)} · Prepared by {saved.preparedBy}
          </p>
          <p className="notice">
            Historical snapshot. These prices remain unchanged after product
            edits.
          </p>
          <Results result={saved.results} />
          <p className="prewrap">{saved.notes}</p>
          <div className="actions">
            <button
              className="primary"
              onClick={() =>
                downloadPdf(saved.id).catch((e) => toast.error(e.message))
              }
            >
              <Download size={16} /> Download PDF
            </button>
            <button
              onClick={async () => {
                try {
                  const current: DraftLine[] = [];
                  for (const item of saved.items) {
                    const snap = item.snapshot;
                    const q = await api<Catalog>(
                      "/calculation-products?search=" +
                        encodeURIComponent(snap.productId),
                    );
                    const p = q.items.find((p) => p.id === snap.id);
                    if (!p)
                      throw new Error(
                        `${snap.name} is archived or unavailable. Start a new calculation instead.`,
                      );
                    current.push({
                      product: p,
                      quantity: snap.quantity,
                      customPrice: snap.customPrice ?? "",
                    });
                  }
                  setLines(current);
                  setTitle(saved.title + " (copy)");
                  setNotes(saved.notes);
                  setExpenses(saved.expenses);
                  setSource(saved.id);
                  setTab("workspace");
                  setSaved(undefined);
                  invalidate();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Create copy & refresh current prices
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
function Control() {
  const [tab, setTab] = useState("permissions");
  const [error, setError] = useState<unknown>();
  const [editing, setEditing] = useState<any>();
  const [reset, setReset] = useState<any>();
  const [confirm, setConfirm] = useState<any>();
  const [busy, setBusy] = useState(false);
  const permissions = useQuery({
    queryKey: ["permissions"],
    queryFn: () => api<any[]>("/admin/permissions"),
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<any[]>("/admin/users"),
  });
  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: () => api<any[]>("/admin/audit"),
    enabled: tab === "audit",
  });
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await client.invalidateQueries();
      setError(undefined);
      setEditing(undefined);
      setReset(undefined);
      setConfirm(undefined);
      toast.success("Access settings saved");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE RIGHT ACCESS, FOR YOUR TEAM</span>
          <h1>
            Menu Control
            <Heart className="heading-heart" size={23} aria-hidden="true" />
          </h1>
          <p className="muted">
            Manage the people and permissions behind your store.
          </p>
        </div>
      </div>
      <div className="tabs">
        {["permissions", "users", "audit"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "permissions"
              ? "Menu access"
              : t === "users"
                ? "Users"
                : "Audit history"}
          </button>
        ))}
      </div>
      {!!error && <ErrorState error={error} />}
      <div className="panel">
        {tab === "permissions" ? (
          <>
            <h2>Make room for your team</h2>
            <p className="muted">
              Menu changes take effect on the next request. Administrators
              always retain all administrative access.
            </p>
            {permissions.error && <ErrorState error={permissions.error} />}
            <div className="permission-grid">
              {["MANAGER", "SHOPKEEPER"].map((role) => (
                <div className="permission-card" key={role}>
                  <span className="avatar">
                    <ShieldCheck size={20} />
                  </span>
                  <h3>{role === "MANAGER" ? "Store Manager" : "Shopkeeper"}</h3>
                  {[
                    ["Dashboard", "dashboard.read"],
                    ["Manage Product", "products.manage"],
                    ["Profit Calculation", "calculations.use"],
                  ].map(([menu, permission]) => (
                    <label className="toggle-row" key={menu}>
                      <span>{menu}</span>
                      <input
                        type="checkbox"
                        disabled={busy || !permissions.data}
                        checked={
                          permissions.data?.some(
                            (p) =>
                              p.role === role && p.permission === permission,
                          ) ?? false
                        }
                        onChange={(e) =>
                          run(() =>
                            post(
                              "/admin/permissions",
                              { role, menu, enabled: e.target.checked },
                              "PUT",
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <p className="notice">
              Manage Product grants catalog, pricing, category, stock and image
              actions. Profit Calculation grants cost access, calculations and
              PDF exports. Menu Control and Users remain admin-only.
            </p>
          </>
        ) : tab === "users" ? (
          <>
            <div className="section-title">
              <h2>Your team</h2>
              <button className="primary" onClick={() => setEditing({})}>
                <Plus size={16} /> Add user
              </button>
            </div>
            {users.error && <ErrorState error={users.error} />}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data?.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.username}
                        {u.mustChangePassword && (
                          <small>Password change required</small>
                        )}
                      </td>
                      <td>
                        <select
                          aria-label={`Role for ${u.username}`}
                          value={u.role}
                          onChange={(e) =>
                            setConfirm({
                              id: u.id,
                              body: { role: e.target.value },
                              message: `Change ${u.username}'s role? Their sessions will end.`,
                            })
                          }
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="MANAGER">Store Manager</option>
                          <option value="SHOPKEEPER">Shopkeeper</option>
                        </select>
                      </td>
                      <td>
                        <span className={"pill " + (!u.active ? "danger" : "")}>
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <button onClick={() => setReset(u)}>
                            Reset password
                          </button>
                          <button
                            onClick={() =>
                              setConfirm({
                                id: u.id,
                                body: { active: !u.active },
                                message: `${u.active ? "Deactivate" : "Activate"} ${u.username}? Existing sessions will end.`,
                              })
                            }
                          >
                            {u.active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <h2>Recent activity</h2>
            {audit.error && <ErrorState error={audit.error} />}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Time · Dhaka</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data?.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.action}
                        <small>{a.entityId}</small>
                      </td>
                      <td>{a.user?.username ?? "System"}</td>
                      <td>{date(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {editing && (
        <Modal title="Add team member" onClose={() => setEditing(undefined)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(() =>
                post("/admin/users", {
                  username: f.get("username"),
                  password: f.get("password"),
                  role: f.get("role"),
                }),
              );
            }}
          >
            <label>
              Username (spaces allowed)
              <input name="username" required maxLength={80} />
            </label>
            <label>
              Role
              <select name="role">
                <option value="SHOPKEEPER">Shopkeeper</option>
                <option value="MANAGER">Store Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <label>
              Temporary password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            <p className="muted small">
              12+ characters, uppercase, lowercase, number and symbol. Share
              credentials securely. Password change is required at first login.
            </p>
            {!!error && <ErrorState error={error} />}
            <button className="primary" disabled={busy}>
              Create user
            </button>
          </form>
        </Modal>
      )}
      {reset && (
        <Modal
          title={`Reset access for ${reset.username}`}
          onClose={() => setReset(undefined)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(() =>
                post(
                  `/admin/users/${reset.id}`,
                  { password: f.get("password") },
                  "PATCH",
                ),
              );
            }}
          >
            <p className="notice warning">
              All sessions will be revoked. A new password change will be
              required.
            </p>
            <label>
              Strong temporary password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            {!!error && <ErrorState error={error} />}
            <button className="primary" disabled={busy}>
              Reset access
            </button>
          </form>
        </Modal>
      )}
      {confirm && (
        <Modal
          title="Confirm account change"
          onClose={() => setConfirm(undefined)}
        >
          <p>{confirm.message}</p>
          {!!error && <ErrorState error={error} />}
          <div className="actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(() =>
                  post(`/admin/users/${confirm.id}`, confirm.body, "PATCH"),
                )
              }
            >
              Confirm change
            </button>
            <button onClick={() => setConfirm(undefined)}>Cancel</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  </React.StrictMode>,
);
