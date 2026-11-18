import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Baby,
  Bath,
  Check,
  ChevronRight,
  Heart,
  Leaf,
  Menu,
  Milk,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { bdt, type Category } from "./api";
import "./storefront.css";

export type StoreSettings = {
  acceptingOrders: boolean;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  dhakaDelivery: string | null;
  outsideDelivery: string | null;
  deliveryInfo: string;
  returnPolicy: string;
  privacyPolicy: string;
  announcement: string;
};
type ShopProduct = {
  id: string;
  name: string;
  sku: string;
  description: string;
  retailPrice: string;
  salePrice: string | null;
  stock: number;
  featured: boolean;
  brand: string;
  ageRange: string;
  specifications: string;
  images: { url: string; thumbnail: string }[];
  category: { id: string; name: string };
  subcategory: { id: string; name: string } | null;
};
type CartLine = { product: ShopProduct; quantity: number };
type Receipt = {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: string;
  delivery: string;
  total: string;
  createdAt: string;
  items: {
    name: string;
    sku: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
};
type Customer = { id: string; name: string; email: string };
type Session = { csrf: string; customer: Customer | null };
type Products = {
  items: ShopProduct[];
  total: number;
  pages: number;
  page: number;
  brands: string[];
};
let csrf = "";
export async function shopApi<T = any>(
  path: string,
  body?: unknown,
): Promise<T> {
  if (body !== undefined && !csrf)
    csrf = (await shopApi<Session>("/session")).csrf;
  const res = await fetch(`/api/shop${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(body === undefined ? {} : { "X-CSRF-Token": csrf }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 403) csrf = "";
    throw new Error(data.error?.message ?? "Please try again in a moment.");
  }
  if (path === "/session") csrf = data.csrf;
  return data;
}
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Shopping remains usable with browser storage disabled. */
    }
  }, [key, value]);
  return [value, setValue] as const;
}
const Store = createContext<{
  cart: CartLine[];
  setCart: (v: CartLine[] | ((old: CartLine[]) => CartLine[])) => void;
  wish: ShopProduct[];
  toggleWish: (p: ShopProduct) => void;
  add: (p: ShopProduct, quantity?: number) => void;
  settings?: StoreSettings;
  categories: Category[];
  customer: Customer | null;
}>(null!);
const useStore = () => useContext(Store);
const logo = "/brand/chotto-jadughor-logo.png";
const price = (p: ShopProduct) => p.salePrice ?? p.retailPrice;
const icons = [Baby, Bath, Milk, Sparkles, Heart, Leaf];
function State({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`sf-state ${error ? "sf-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
function ProductImage({
  product,
  large = false,
}: {
  product: ShopProduct;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`sf-product-image ${large ? "sf-large" : ""}`}>
      {product.images[0] && !failed ? (
        <img
          src={large ? product.images[0].url : product.images[0].thumbnail}
          alt={product.name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="sf-no-photo">
          <Package size={large ? 64 : 38} strokeWidth={1} />
          <span>Product photo coming soon</span>
        </div>
      )}
    </div>
  );
}
function ProductCard({ p }: { p: ShopProduct }) {
  const { add, wish, toggleWish } = useStore();
  const saved = wish.some((i) => i.id === p.id);
  const discount = p.salePrice
    ? Math.round((1 - Number(p.salePrice) / Number(p.retailPrice)) * 100)
    : 0;
  return (
    <article className="sf-card">
      <div className="sf-card-visual">
        <Link to={`/product/${p.id}`} aria-label={`View ${p.name}`}>
          <ProductImage product={p} />
        </Link>
        {discount > 0 && <span className="sf-sale">Save {discount}%</span>}
        <button
          className={`sf-wish ${saved ? "selected" : ""}`}
          aria-label={`${saved ? "Remove" : "Save"} ${p.name} ${saved ? "from" : "to"} wishlist`}
          onClick={() => toggleWish(p)}
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="sf-card-body">
        <small>{p.brand || p.category.name}</small>
        <h3>
          <Link to={`/product/${p.id}`}>{p.name}</Link>
        </h3>
        <span className="sf-size">
          {p.ageRange || p.subcategory?.name || "Everyday essentials"}
        </span>
        <div className="sf-prices">
          <strong>{bdt(price(p))}</strong>
          {p.salePrice && <del>{bdt(p.retailPrice)}</del>}
        </div>
        <button
          className="sf-add"
          disabled={p.stock < 1}
          onClick={() => add(p)}
        >
          <ShoppingBag size={16} />
          {p.stock > 0 ? "Add to bag" : "Out of stock"}
        </button>
      </div>
    </article>
  );
}
export function Storefront() {
  const [cart, setCart] = useStored<CartLine[]>("cj-cart-v1", []);
  const [wish, setWish] = useStored<ShopProduct[]>("cj-wishlist-v1", []);
  const [menu, setMenu] = useState(false);
  const settings = useQuery({
    queryKey: ["shop-settings"],
    queryFn: () => shopApi<StoreSettings>("/settings"),
  });
  const categories = useQuery({
    queryKey: ["shop-categories"],
    queryFn: () => shopApi<Category[]>("/categories"),
  });
  const session = useQuery({
    queryKey: ["shop-session"],
    queryFn: () => shopApi<Session>("/session"),
  });
  const add = (p: ShopProduct, quantity = 1) => {
    const existing = cart.find((i) => i.product.id === p.id)?.quantity ?? 0;
    if (existing + quantity > Math.min(p.stock, 50))
      return toast.error("You have reached the available quantity.");
    setCart((old) =>
      old.some((i) => i.product.id === p.id)
        ? old.map((i) =>
            i.product.id === p.id
              ? { ...i, quantity: i.quantity + quantity }
              : i,
          )
        : [...old, { product: p, quantity }],
    );
    toast.success("Added to your bag");
  };
  return (
    <Store.Provider
      value={{
        cart,
        setCart,
        wish,
        toggleWish: (p) =>
          setWish((old) =>
            old.some((i) => i.id === p.id)
              ? old.filter((i) => i.id !== p.id)
              : [...old, p],
          ),
        add,
        settings: settings.data,
        categories: categories.data ?? [],
        customer: session.data?.customer ?? null,
      }}
    >
      <div className="storefront">
        <a className="sf-skip" href="#shop-content">
          Skip to content
        </a>
        <div className="sf-announcement">
          <span>
            <Leaf size={13} />
            {settings.data?.announcement ||
              "Safe for baby. Easy for parents. Honest price."}
          </span>
          <Link to="/track">
            Track your order <ArrowRight size={12} />
          </Link>
        </div>
        <header className="sf-header">
          <Link to="/" className="sf-logo">
            <img src={logo} alt="Chotto Jadughor" width="78" height="78" />
            <span>
              CHOTTO JADUGHOR<small>A little world of care</small>
            </span>
          </Link>
          <form className="sf-search" action="/shop">
            <Search size={19} />
            <input
              name="search"
              aria-label="Search the shop"
              placeholder="Find something for your little one…"
            />
            <button aria-label="Submit search">
              <ArrowRight size={19} />
            </button>
          </form>
          <div className="sf-header-actions">
            <Link to="/account" aria-label="My account">
              <UserRound />
              <small>Account</small>
            </Link>
            <Link to="/wishlist" aria-label="Wishlist">
              <Heart />
              <small>Saved ({wish.length})</small>
            </Link>
            <Link
              to="/cart"
              className="sf-bag"
              aria-label={`Shopping bag, ${cart.reduce((n, i) => n + i.quantity, 0)} items`}
            >
              <ShoppingBag />
              <span>{cart.reduce((n, i) => n + i.quantity, 0)}</span>
              <small>My bag</small>
            </Link>
            <button
              className="sf-menu-button"
              aria-label="Toggle shop navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </header>
        <nav
          className={`sf-nav ${menu ? "open" : ""}`}
          aria-label="Shop navigation"
          onClick={() => setMenu(false)}
        >
          <NavLink to="/shop">Shop all</NavLink>
          {categories.data?.slice(0, 6).map((c) => (
            <Link key={c.id} to={`/shop?categoryId=${c.id}`}>
              {c.name}
            </Link>
          ))}
          <Link className="sf-nav-sale" to="/shop?sale=true">
            Little savings
          </Link>
          <Link className="sf-mobile-link" to="/account">
            Your account
          </Link>
          <Link className="sf-mobile-link" to="/wishlist">
            Saved favourites
          </Link>
          <Link className="sf-mobile-link" to="/track">
            Track an order
          </Link>
        </nav>
        <main id="shop-content">
          {settings.error && (
            <State error>
              We couldn't connect to the shop. Please refresh in a moment.
            </State>
          )}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Catalog />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/account" element={<Account />} />
            <Route path="/track" element={<Tracking />} />
            <Route path="/policies/:kind" element={<Policy />} />
            <Route
              path="*"
              element={
                <State>
                  We couldn't find that page. <Link to="/">Return home</Link>
                </State>
              }
            />
          </Routes>
        </main>
        <section className="sf-promise">
          <div>
            <ShieldCheck />
            <span>
              <strong>Safe for baby</strong>
              <small>Care begins with thoughtful choices.</small>
            </span>
          </div>
          <div>
            <Heart />
            <span>
              <strong>Easy for parents</strong>
              <small>Everyday essentials, all in one place.</small>
            </span>
          </div>
          <div>
            <Leaf />
            <span>
              <strong>Honest price</strong>
              <small>Clear prices. No checkout surprises.</small>
            </span>
          </div>
        </section>
        <footer className="sf-footer">
          <div>
            <Link to="/">
              <img src={logo} width="100" height="100" alt="Chotto Jadughor" />
            </Link>
            <h3>A little world. A lot of love.</h3>
            <p>Safe for baby. Easy for parents. Honest price.</p>
          </div>
          <div>
            <h4>Make yourself at home</h4>
            <Link to="/shop">Explore the shop</Link>
            <Link to="/wishlist">Your saved favourites</Link>
            <Link to="/track">Track an order</Link>
            <Link to="/account">Your account</Link>
          </div>
          <div>
            <h4>Here to help</h4>
            <Link to="/policies/delivery">Delivery information</Link>
            <Link to="/policies/returns">Returns & exchanges</Link>
            <Link to="/policies/privacy">Privacy policy</Link>
            {settings.data?.phone && (
              <a href={`tel:${settings.data.phone}`}>{settings.data.phone}</a>
            )}
            {settings.data?.whatsapp && (
              <a
                href={`https://wa.me/${settings.data.whatsapp}`}
                target="_blank"
                rel="noreferrer"
              >
                Chat on WhatsApp
              </a>
            )}
            {settings.data?.email && (
              <a href={`mailto:${settings.data.email}`}>
                {settings.data.email}
              </a>
            )}
          </div>
          <div className="sf-footer-note">
            <span>MADE FOR YOUR EVERYDAY</span>
            <h3>
              Little things.
              <br />
              Meaningful beginnings.
            </h3>
            <p>{settings.data?.address || "Chotto Jadughor · Bangladesh"}</p>
            <span className="sf-cod">
              <Truck size={16} />
              Cash on delivery
            </span>
          </div>
          <div className="sf-copyright">
            <span>
              © {new Date().getFullYear()} Chotto Jadughor. All rights
              reserved.
            </span>
            <Link to="/admin">
              Store administration <ArrowRight size={13} />
            </Link>
          </div>
        </footer>
      </div>
    </Store.Provider>
  );
}
function Home() {
  const { categories } = useStore();
  const products = useQuery({
    queryKey: ["shop-home"],
    queryFn: () => shopApi<Products>("/products?limit=8"),
  });
  const featured = useQuery({
    queryKey: ["shop-featured"],
    queryFn: () => shopApi<Products>("/products?featured=true&limit=4"),
  });
  return (
    <>
      <section className="sf-hero">
        <div className="sf-hero-copy">
          <span className="sf-kicker">
            <span />A LITTLE WORLD OF CARE
          </span>
          <h1>
            For their little world.
            <br />
            <em>
              And your peace
              <br />
              of mind.
            </em>
          </h1>
          <p>
            From first cuddles to everyday discoveries.
            <br />
            Find the little things that make parenting easier.
          </p>
          <Link className="sf-button" to="/shop">
            Explore the shop <ArrowRight size={18} />
          </Link>
          <div className="sf-hero-foot">
            <Leaf size={16} />
            Thoughtfully chosen. Honestly priced.
          </div>
        </div>
        <div
          className="sf-hero-art"
          aria-label="Baby essentials: comfort, play and everyday care"
        >
          <div className="sf-art-ring" />
          <span className="sf-art-label">
            THE EVERYDAY
            <br />
            LITTLE ESSENTIALS
          </span>
          <div className="sf-art-tile sf-tile-one">
            <Milk size={76} strokeWidth={1} />
            <span>Little mealtimes</span>
          </div>
          <div className="sf-art-tile sf-tile-two">
            <Baby size={86} strokeWidth={1} />
            <span>Big little smiles</span>
          </div>
          <div className="sf-art-tile sf-tile-three">
            <Bath size={62} strokeWidth={1} />
            <span>Gentle moments</span>
          </div>
          <div className="sf-art-seal">
            <Heart size={20} />
            <span>
              WITH CARE,
              <br />
              ALWAYS.
            </span>
          </div>
          <span className="sf-art-spark">✳</span>
        </div>
      </section>
      <section className="sf-section">
        <div className="sf-section-heading">
          <div>
            <span className="sf-kicker">EVERY STAGE, EVERY LITTLE NEED</span>
            <h2>A little something for every day.</h2>
          </div>
          <Link to="/shop">
            Shop everything <ArrowRight size={17} />
          </Link>
        </div>
        <div className="sf-category-grid">
          {categories.map((c, i) => {
            const Icon = icons[i % icons.length]!;
            return (
              <Link key={c.id} to={`/shop?categoryId=${c.id}`}>
                <span>
                  <Icon size={34} strokeWidth={1.2} />
                </span>
                <strong>{c.name}</strong>
                <small>
                  Explore <ChevronRight size={12} />
                </small>
              </Link>
            );
          })}
        </div>
        {!categories.length && (
          <p className="sf-muted">
            Our collections are being carefully prepared.
          </p>
        )}
      </section>
      <section className="sf-section sf-products-section">
        <div className="sf-section-heading">
          <div>
            <span className="sf-kicker">SMALL FINDS. BIG LOVE.</span>
            <h2>
              {featured.data?.items.length
                ? "A few favourites, picked with care."
                : "New to their little world."}
            </h2>
          </div>
          <Link to="/shop">
            View all products <ArrowRight size={17} />
          </Link>
        </div>
        {products.isLoading ? (
          <State>Finding little essentials…</State>
        ) : products.error ? (
          <State error>{products.error.message}</State>
        ) : products.data?.items.length ? (
          <div className="sf-product-grid">
            {(featured.data?.items.length
              ? featured.data.items
              : products.data.items
            ).map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="sf-opening">
            <Sparkles size={34} />
            <h3>Something lovely is on its way.</h3>
            <p>
              We're getting our shelves ready for your little ones.
              <br />
              Come back soon to discover our first collection.
            </p>
          </div>
        )}
      </section>
      <section className="sf-story">
        <div>
          <span className="sf-kicker">OUR LITTLE PROMISE</span>
          <h2>
            Parenting is a big journey.
            <br />
            <em>The little things should be easy.</em>
          </h2>
          <p>
            Chotto Jadughor is built around a simple belief: choosing for your
            baby should feel reassuring. A thoughtful selection, clear
            information and honest prices—so you can focus on the moments that
            matter.
          </p>
          <Link to="/shop">
            Find your little essentials <ArrowRight size={18} />
          </Link>
        </div>
        <div className="sf-story-mark">
          <img src={logo} alt="Chotto Jadughor" />
          <span>
            Safe for baby.
            <br />
            Easy for parents.
            <br />
            <em>Honest price.</em>
          </span>
        </div>
      </section>
    </>
  );
}
function Catalog() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { categories } = useStore();
  const query = params.toString();
  const q = useQuery({
    queryKey: ["shop-products", query],
    queryFn: () => shopApi<Products>(`/products?${query}`),
  });
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    if (key === "categoryId") next.delete("subcategoryId");
    setParams(next);
  };
  const category = categories.find((c) => c.id === params.get("categoryId"));
  return (
    <section className="sf-section sf-catalog">
      <div className="sf-breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} />
        The shop
      </div>
      <div className="sf-catalog-title">
        <div>
          <span className="sf-kicker">FOR EVERY LITTLE CHAPTER</span>
          <h1>
            {params.get("sale")
              ? "A little more, for a little less."
              : category?.name || "Good things for little ones."}
          </h1>
        </div>
        <p>{q.data?.total ?? 0} thoughtful finds</p>
      </div>
      <button
        type="button"
        className="sf-filter-toggle"
        aria-expanded={filtersOpen}
        aria-controls="shop-filters"
        onClick={() => setFiltersOpen((open) => !open)}
      >
        <SlidersHorizontal size={17} />
        {filtersOpen ? "Hide filters" : "Filters"}
        {filtersOpen ? <Minus size={16} /> : <Plus size={16} />}
      </button>
      <div className="sf-catalog-layout">
        <aside
          id="shop-filters"
          className={`sf-filters${filtersOpen ? " is-open" : ""}`}
        >
          <h3>Find your favourites</h3>
          <label>
            Search
            <input
              aria-label="Filter products by search"
              key={params.get("search") ?? ""}
              defaultValue={params.get("search") ?? ""}
              onBlur={(e) => change("search", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") change("search", e.currentTarget.value);
              }}
            />
          </label>
          <label>
            Category
            <select
              value={params.get("categoryId") ?? ""}
              onChange={(e) => change("categoryId", e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subcategory
            <select
              disabled={!category}
              value={params.get("subcategoryId") ?? ""}
              onChange={(e) => change("subcategoryId", e.target.value)}
            >
              <option value="">All subcategories</option>
              {category?.subcategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Brand
            <select
              value={params.get("brand") ?? ""}
              onChange={(e) => change("brand", e.target.value)}
            >
              <option value="">All brands</option>
              {q.data?.brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <div className="sf-price-range">
            <label>
              Min ৳
              <input
                type="number"
                min="0"
                step="0.01"
                defaultValue={params.get("min") ?? ""}
                onBlur={(e) => change("min", e.target.value)}
              />
            </label>
            <label>
              Max ৳
              <input
                type="number"
                min="0"
                step="0.01"
                defaultValue={params.get("max") ?? ""}
                onBlur={(e) => change("max", e.target.value)}
              />
            </label>
          </div>
          <label className="sf-checkbox">
            <input
              type="checkbox"
              checked={params.get("sale") === "true"}
              onChange={(e) => change("sale", e.target.checked ? "true" : "")}
            />
            On sale
          </label>
          <button onClick={() => setParams({})}>Clear filters</button>
          <div className="sf-filter-note">
            <Leaf />
            <p>
              Safe for baby.
              <br />
              Easy for parents.
              <br />
              <strong>Honest price.</strong>
            </p>
          </div>
        </aside>
        <div>
          <div className="sf-sort">
            <span>
              {params.get("search")
                ? `Results for “${params.get("search")}”`
                : "Made for your everyday"}
            </span>
            <label>
              Sort by
              <select
                value={params.get("sort") ?? "newest"}
                onChange={(e) => change("sort", e.target.value)}
              >
                <option value="newest">Newest arrivals</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name: A–Z</option>
              </select>
            </label>
          </div>
          {q.isLoading ? (
            <State>Loading the collection…</State>
          ) : q.error ? (
            <State error>{q.error.message}</State>
          ) : q.data?.items.length ? (
            <div className="sf-product-grid sf-catalog-products">
              {q.data.items.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <State>
              <Package size={36} />
              <h3>No little finds here just yet.</h3>
              <p>Try another category or clear your filters.</p>
            </State>
          )}
          <div className="sf-pagination">
            <button
              disabled={Number(params.get("page") || 1) <= 1}
              onClick={() => {
                const n = new URLSearchParams(params);
                n.set("page", String(Number(params.get("page") || 1) - 1));
                setParams(n);
              }}
            >
              Previous
            </button>
            <span>
              Page {params.get("page") || 1} of{" "}
              {Math.max(1, q.data?.pages ?? 1)}
            </span>
            <button
              disabled={Number(params.get("page") || 1) >= (q.data?.pages ?? 0)}
              onClick={() => {
                const n = new URLSearchParams(params);
                n.set("page", String(Number(params.get("page") || 1) + 1));
                setParams(n);
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
function ProductPage() {
  const { id } = useParams();
  const { add, toggleWish, settings } = useStore();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const q = useQuery({
    queryKey: ["shop-product", id],
    queryFn: () => shopApi<ShopProduct>(`/products/${id}`),
  });
  const related = useQuery({
    queryKey: ["shop-related", q.data?.category.id],
    queryFn: () =>
      shopApi<Products>(`/products?categoryId=${q.data!.category.id}&limit=5`),
    enabled: !!q.data,
  });
  useEffect(() => {
    setQty(1);
    window.scrollTo(0, 0);
  }, [id]);
  if (q.isLoading) return <State>Loading your little find…</State>;
  if (!q.data || q.error)
    return (
      <State error>
        {q.error?.message || "Product unavailable"}
        <Link to="/shop">Continue shopping</Link>
      </State>
    );
  const p = q.data;
  return (
    <section className="sf-section">
      <div className="sf-breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} />
        <Link to={`/shop?categoryId=${p.category.id}`}>{p.category.name}</Link>
        <ChevronRight size={13} />
        {p.name}
      </div>
      <div className="sf-product-detail">
        <ProductImage key={p.id} product={p} large />
        <div>
          <span className="sf-kicker">{p.brand || p.category.name}</span>
          <h1>{p.name}</h1>
          <p className="sf-muted">
            {p.ageRange}
            {p.ageRange && " · "}SKU: {p.sku}
          </p>
          <div className="sf-prices sf-detail-price">
            <strong>{bdt(price(p))}</strong>
            {p.salePrice && <del>{bdt(p.retailPrice)}</del>}
          </div>
          <span className={`sf-stock ${p.stock ? "" : "empty"}`}>
            {p.stock
              ? "Available for your little one"
              : "Currently out of stock"}
          </span>
          <p className="sf-description">{p.description}</p>
          <div className="sf-buy-row">
            <div className="sf-quantity">
              <button
                aria-label="Reduce quantity"
                disabled={qty <= 1}
                onClick={() => setQty(qty - 1)}
              >
                <Minus size={14} />
              </button>
              <span>{qty}</span>
              <button
                aria-label="Increase quantity"
                disabled={qty >= Math.min(50, p.stock)}
                onClick={() => setQty(qty + 1)}
              >
                <Plus size={14} />
              </button>
            </div>
            <button
              className="sf-button"
              disabled={p.stock < 1}
              onClick={() => add(p, qty)}
            >
              <ShoppingBag size={18} />
              Add to bag
            </button>
            <button
              aria-label="Save product to wishlist"
              onClick={() => toggleWish(p)}
            >
              <Heart size={19} />
            </button>
          </div>
          <button
            className="sf-button sf-buy-now"
            disabled={p.stock < 1}
            onClick={() => {
              add(p, qty);
              navigate("/cart");
            }}
          >
            Buy now <ArrowRight size={17} />
          </button>
          <div className="sf-product-delivery">
            <Truck size={20} />
            <div>
              <strong>Cash on delivery</strong>
              <p>
                {settings?.deliveryInfo ||
                  "Delivery details will be confirmed before ordering."}
              </p>
              <Link to="/policies/delivery">Delivery details</Link> ·{" "}
              <Link to="/policies/returns">Returns & exchanges</Link>
            </div>
          </div>
          {settings?.whatsapp && (
            <a
              href={`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(`I'd like to know more about ${p.name} (${p.sku})`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Have a question? Chat with us →
            </a>
          )}
        </div>
      </div>
      <div className="sf-product-info">
        <h2>The little details</h2>
        <p className="sf-description">
          {p.specifications ||
            p.description ||
            "Please contact us for additional product information."}
        </p>
        <p className="sf-muted">
          Always follow the manufacturer's instructions and age guidance.
        </p>
      </div>
      {related.data &&
        related.data.items.filter((i) => i.id !== p.id).length > 0 && (
          <>
            <h2>You might also love</h2>
            <div className="sf-product-grid">
              {related.data.items
                .filter((i) => i.id !== p.id)
                .slice(0, 4)
                .map((i) => (
                  <ProductCard key={i.id} p={i} />
                ))}
            </div>
          </>
        )}
    </section>
  );
}
function Cart() {
  const { cart, setCart } = useStore();
  const fresh = useQuery({
    queryKey: ["shop-cart", cart.map((i) => i.product.id).join(",")],
    queryFn: () =>
      Promise.all(
        cart.map(async (i) => {
          try {
            return await shopApi<ShopProduct>(`/products/${i.product.id}`);
          } catch {
            return null;
          }
        }),
      ),
  });
  if (!cart.length)
    return (
      <section className="sf-section sf-empty-page">
        <ShoppingBag size={50} strokeWidth={1} />
        <h1>A little room for lovely things.</h1>
        <p>Your bag is empty. Let's find something for your little one.</p>
        <Link to="/shop" className="sf-button">
          Explore the shop <ArrowRight size={17} />
        </Link>
      </section>
    );
  const subtotal = cart.reduce(
    (n, i) =>
      n +
      Number(
        price(fresh.data?.find((p) => p?.id === i.product.id) ?? i.product),
      ) *
        i.quantity,
    0,
  );
  return (
    <section className="sf-section">
      <div className="sf-breadcrumb">
        <Link to="/shop">The shop</Link>
        <ChevronRight size={13} />
        Your bag
      </div>
      <h1>Your little bag of essentials.</h1>
      <div className="sf-checkout-grid">
        <div>
          {cart.map((i) => {
            const current = fresh.data?.find((p) => p?.id === i.product.id);
            const unavailable =
              !!fresh.data && (!current || current.stock < i.quantity);
            const p = current ?? i.product;
            return (
              <div className="sf-cart-line" key={p.id}>
                <Link to={`/product/${p.id}`}>
                  <ProductImage product={p} />
                </Link>
                <div>
                  <Link to={`/product/${p.id}`}>
                    <h3>{p.name}</h3>
                  </Link>
                  <small>{bdt(price(p))} each</small>
                  {unavailable && (
                    <p className="sf-error">
                      Unavailable in this quantity. Update or remove it.
                    </p>
                  )}
                  <div className="sf-quantity">
                    <button
                      aria-label={`Reduce ${p.name}`}
                      disabled={i.quantity <= 1}
                      onClick={() =>
                        setCart((old) =>
                          old.map((line) =>
                            line.product.id === p.id
                              ? { ...line, quantity: line.quantity - 1 }
                              : line,
                          ),
                        )
                      }
                    >
                      <Minus size={13} />
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      aria-label={`Increase ${p.name}`}
                      disabled={i.quantity >= Math.min(50, p.stock)}
                      onClick={() =>
                        setCart((old) =>
                          old.map((line) =>
                            line.product.id === p.id
                              ? { ...line, quantity: line.quantity + 1 }
                              : line,
                          ),
                        )
                      }
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <div>
                  <strong>
                    {bdt((Number(price(p)) * i.quantity).toFixed(2))}
                  </strong>
                  <button
                    className="sf-remove"
                    aria-label={`Remove ${p.name}`}
                    onClick={() =>
                      setCart((old) =>
                        old.filter((line) => line.product.id !== p.id),
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
          <Link className="sf-continue" to="/shop">
            ← Keep exploring
          </Link>
        </div>
        <aside className="sf-summary">
          <span className="sf-kicker">A LITTLE RECAP</span>
          <h2>Your order summary</h2>
          <div>
            <span>Subtotal</span>
            <strong>{bdt(subtotal.toFixed(2))}</strong>
          </div>
          <p>
            Delivery is calculated at checkout. Final prices and availability
            are checked before you place your order.
          </p>
          <Link to="/checkout" className="sf-button">
            Continue to checkout <ArrowRight size={16} />
          </Link>
          <small>
            <ShieldCheck size={15} />
            Cash on delivery · No online payment
          </small>
        </aside>
      </div>
    </section>
  );
}
function Checkout() {
  const { cart, setCart, settings, customer } = useStore();
  const [zone, setZone] = useState("DHAKA");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Receipt>();
  const [credentials, setCredentials] = useState(() => {
    try {
      const old = sessionStorage.getItem("cj-pending-checkout");
      if (old)
        return JSON.parse(old) as { requestKey: string; trackingToken: string };
    } catch {
      /* New checkout. */
    }
    const value = {
      requestKey: crypto.randomUUID(),
      trackingToken: Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join(""),
    };
    try {
      sessionStorage.setItem("cj-pending-checkout", JSON.stringify(value));
    } catch {
      /* Still valid in this tab. */
    }
    return value;
  });
  const body = {
    zone,
    items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
  };
  const q = useQuery({
    queryKey: ["shop-quote", JSON.stringify(body)],
    queryFn: () =>
      shopApi<{
        lines: Receipt["items"];
        subtotal: string;
        delivery: string;
        total: string;
      }>("/quote", body),
    enabled: cart.length > 0 && !!settings?.acceptingOrders && !done,
  });
  if (done)
    return (
      <section className="sf-section sf-confirmation">
        <span className="sf-success-icon">
          <Check size={32} />
        </span>
        <span className="sf-kicker">A LITTLE THANK YOU</span>
        <h1>Your order is with us.</h1>
        <p>We'll confirm your order before dispatch. Pay when it arrives.</p>
        <OrderReceipt order={done} />
        <div className="sf-tracking-key">
          <strong>Keep your private tracking key</strong>
          <p>
            Use this with your order number on the tracking page. Do not share
            it publicly.
          </p>
          <code>{credentials.trackingToken}</code>
          <button
            onClick={() => {
              void navigator.clipboard
                .writeText(credentials.trackingToken)
                .then(
                  () => toast.success("Tracking key copied"),
                  () => toast.error("Select and copy the key above"),
                );
            }}
          >
            Copy key
          </button>
        </div>
        <Link className="sf-button" to="/shop">
          Back to the shop <ArrowRight size={17} />
        </Link>
      </section>
    );
  if (!cart.length)
    return (
      <State>
        Your bag is empty. <Link to="/shop">Explore the shop</Link>
      </State>
    );
  if (!settings?.acceptingOrders)
    return (
      <State>
        We're getting ready to welcome your orders.{" "}
        <Link to="/shop">Keep exploring</Link>
      </State>
    );
  return (
    <section className="sf-section">
      <div className="sf-breadcrumb">
        <Link to="/cart">Your bag</Link>
        <ChevronRight size={13} />
        Checkout
      </div>
      <h1>Nearly home, little essentials.</h1>
      <p className="sf-muted">
        Guest checkout is welcome.{" "}
        {customer ? (
          `Ordering as ${customer.name}.`
        ) : (
          <Link to="/account">Sign in to keep your order history.</Link>
        )}
      </p>
      <form
        className="sf-checkout-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!q.data || busy) return;
          setBusy(true);
          setError("");
          const data = Object.fromEntries(new FormData(e.currentTarget));
          // Keep retries idempotent, but start a new request when the shopper
          // changes their cart or delivery details after an earlier attempt.
          const fingerprint = JSON.stringify({ data, cart: body });
          let keys = credentials;
          try {
            const pending = JSON.parse(
              sessionStorage.getItem("cj-pending-checkout") || "null",
            );
            if (pending?.fingerprint && pending.fingerprint !== fingerprint) {
              keys = {
                requestKey: crypto.randomUUID(),
                trackingToken: Array.from(
                  crypto.getRandomValues(new Uint8Array(32)),
                  (b) => b.toString(16).padStart(2, "0"),
                ).join(""),
              };
              setCredentials(keys);
            }
            sessionStorage.setItem(
              "cj-pending-checkout",
              JSON.stringify({ ...keys, fingerprint }),
            );
          } catch {
            /* In-memory keys still protect retries in this tab. */
          }
          try {
            const result = await shopApi<Receipt>("/orders", {
              ...data,
              acceptPolicies: data.acceptPolicies === "on",
              cart: body,
              expectedTotal: q.data.total,
              requestKey: keys.requestKey,
              trackingToken: keys.trackingToken,
            });
            setDone(result);
            setCart([]);
            const history = read<
              { orderNumber: string; trackingToken: string }[]
            >("cj-order-keys", []);
            try {
              localStorage.setItem(
                "cj-order-keys",
                JSON.stringify(
                  [
                    {
                      orderNumber: result.orderNumber,
                      trackingToken: keys.trackingToken,
                    },
                    ...history,
                  ].slice(0, 20),
                ),
              );
              sessionStorage.removeItem("cj-pending-checkout");
            } catch {
              /* Receipt still displays the key. */
            }
            window.scrollTo(0, 0);
          } catch (err) {
            setError((err as Error).message);
            void q.refetch();
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="sf-checkout-fields">
          <h2>Where should we send your order?</h2>
          <div className="sf-form-grid">
            <label>
              Full name
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                defaultValue={customer?.name}
              />
            </label>
            <label>
              Mobile number
              <input
                name="phone"
                type="tel"
                required
                pattern="(?:\+?88)?01[3-9][0-9]{8}"
                placeholder="01XXXXXXXXX"
                autoComplete="tel"
              />
            </label>
          </div>
          <label>
            Email · optional
            <input
              name="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              defaultValue={customer?.email}
            />
          </label>
          <label>
            Full delivery address
            <textarea
              name="address"
              required
              minLength={10}
              maxLength={500}
              autoComplete="street-address"
              placeholder="House / flat, road, area and nearest landmark"
            />
          </label>
          <div className="sf-form-grid">
            <label>
              District
              <input
                name="district"
                required
                minLength={2}
                maxLength={80}
                autoComplete="address-level1"
              />
            </label>
            <label>
              Delivery area
              <select
                aria-label="Delivery area"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              >
                <option value="DHAKA">Inside Dhaka</option>
                <option value="OUTSIDE">Outside Dhaka</option>
              </select>
            </label>
          </div>
          <label>
            Order notes · optional
            <textarea
              name="notes"
              maxLength={500}
              placeholder="Anything we should know for delivery?"
            />
          </label>
          <div className="sf-payment">
            <Check size={19} />
            <div>
              <strong>Cash on Delivery</strong>
              <p>Pay the order total when you receive your delivery.</p>
            </div>
          </div>
          <label className="sf-checkbox">
            <input name="acceptPolicies" type="checkbox" required />I agree to
            the{" "}
            <Link to="/policies/delivery" target="_blank">
              delivery information
            </Link>
            ,{" "}
            <Link to="/policies/returns" target="_blank">
              return policy
            </Link>{" "}
            and{" "}
            <Link to="/policies/privacy" target="_blank">
              privacy policy
            </Link>
            .
          </label>
        </div>
        <aside className="sf-summary">
          <span className="sf-kicker">YOUR LITTLE ESSENTIALS</span>
          <h2>Order summary</h2>
          {q.isLoading ? (
            <State>Checking availability…</State>
          ) : q.error ? (
            <State error>{q.error.message}</State>
          ) : (
            q.data && (
              <>
                {q.data.lines.map((i, n) => (
                  <div key={n}>
                    <span>
                      {i.name} × {i.quantity}
                    </span>
                    <strong>{bdt(i.lineTotal)}</strong>
                  </div>
                ))}
                <div>
                  <span>Subtotal</span>
                  <strong>{bdt(q.data.subtotal)}</strong>
                </div>
                <div>
                  <span>Delivery</span>
                  <strong>{bdt(q.data.delivery)}</strong>
                </div>
                <div className="sf-total">
                  <span>Total to pay</span>
                  <strong>{bdt(q.data.total)}</strong>
                </div>
              </>
            )
          )}
          {error && <State error>{error}</State>}
          <button
            className="sf-button"
            disabled={busy || !q.data || q.isFetching || !!q.error}
          >
            {busy ? "Placing your order…" : "Place order · Cash on Delivery"}
            <ArrowRight size={16} />
          </button>
          <small>
            <ShieldCheck size={15} />
            Your information stays private.
          </small>
        </aside>
      </form>
    </section>
  );
}
function OrderReceipt({ order }: { order: Receipt }) {
  return (
    <div className="sf-receipt">
      <div>
        <strong>{order.orderNumber}</strong>
        <span className="sf-status">{order.status.replaceAll("_", " ")}</span>
      </div>
      <small>{new Date(order.createdAt).toLocaleDateString("en-BD")}</small>
      {order.items.map((i, n) => (
        <div key={n}>
          <span>
            {i.name} × {i.quantity}
          </span>
          <strong>{bdt(i.lineTotal)}</strong>
        </div>
      ))}
      <div>
        <span>Delivery</span>
        <strong>{bdt(order.delivery)}</strong>
      </div>
      <div className="sf-total">
        <span>Total · Cash on Delivery</span>
        <strong>{bdt(order.total)}</strong>
      </div>
    </div>
  );
}
function Wishlist() {
  const { wish } = useStore();
  return (
    <section className="sf-section">
      <span className="sf-kicker">SAVED WITH LOVE</span>
      <h1>Your little favourites.</h1>
      {wish.length ? (
        <>
          <p className="sf-muted">
            Availability and current prices are confirmed when you open a
            product or check out.
          </p>
          <div className="sf-product-grid">
            {wish.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </>
      ) : (
        <State>
          <Heart size={40} />
          <h3>A place for the things you love.</h3>
          <Link to="/shop">Find your favourites →</Link>
        </State>
      )}
    </section>
  );
}
function Account() {
  const { customer, settings } = useStore();
  const client = useQueryClient();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const orders = useQuery({
    queryKey: ["shop-my-orders", customer?.id],
    queryFn: () => shopApi<Receipt[]>("/orders"),
    enabled: !!customer,
  });
  return (
    <section className="sf-section sf-account">
      <span className="sf-kicker">YOUR LITTLE CORNER</span>
      <h1>
        {customer ? `Hello, ${customer.name}.` : "Make yourself at home."}
      </h1>
      {customer ? (
        <>
          <p>{customer.email}</p>
          <button
            onClick={async () => {
              await shopApi("/logout", {});
              client.removeQueries({ queryKey: ["shop-my-orders"] });
              await client.invalidateQueries({ queryKey: ["shop-session"] });
            }}
          >
            Sign out
          </button>
          <h2>Your orders</h2>
          {orders.error ? (
            <State error>{orders.error.message}</State>
          ) : orders.isLoading ? (
            <State>Loading your orders…</State>
          ) : orders.data?.length ? (
            orders.data.map((o) => <OrderReceipt key={o.id} order={o} />)
          ) : (
            <p>
              Your orders will appear here. Guest orders can be found using the
              private tracking key.
            </p>
          )}
          <details className="sf-password">
            <summary>Change password</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setBusy(true);
                try {
                  await shopApi(
                    "/password",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                  await client.invalidateQueries({
                    queryKey: ["shop-session"],
                  });
                  toast.success("Password changed. Sign in again.");
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Current password
                <input
                  type="password"
                  name="currentPassword"
                  required
                  autoComplete="current-password"
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  name="password"
                  minLength={12}
                  required
                  autoComplete="new-password"
                />
              </label>
              <small>
                12+ characters with uppercase, lowercase, a number and a symbol.
              </small>
              <button className="sf-button" disabled={busy}>
                Update password
              </button>
            </form>
          </details>
        </>
      ) : (
        <div className="sf-account-panel">
          <div className="sf-account-tabs">
            <button
              className={!register ? "active" : ""}
              onClick={() => {
                setRegister(false);
                setError("");
              }}
            >
              Sign in
            </button>
            <button
              className={register ? "active" : ""}
              onClick={() => {
                setRegister(true);
                setError("");
              }}
            >
              Create account
            </button>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await shopApi(
                  register ? "/register" : "/login",
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
                await client.invalidateQueries({ queryKey: ["shop-session"] });
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {register && (
              <label>
                Your name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email
              <input type="email" name="email" required autoComplete="email" />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={register ? 12 : 1}
                autoComplete={register ? "new-password" : "current-password"}
              />
            </label>
            {register && (
              <p className="sf-muted">
                Use 12+ characters with uppercase, lowercase, a number and a
                symbol. Creating an account means you accept our{" "}
                <Link to="/policies/privacy">privacy policy</Link>.
              </p>
            )}
            <button className="sf-button" disabled={busy}>
              {busy
                ? "One moment…"
                : register
                  ? "Create my account"
                  : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="sf-muted">
            No account needed to order.{" "}
            <Link to="/shop">Continue shopping</Link>
          </p>
          {!register && (
            <p className="sf-muted">
              Forgot your password? You can still order as a guest and track
              using your private key.
              {settings?.phone ? " Contact the store for help." : ""}
            </p>
          )}
        </div>
      )}
      {error && <State error>{error}</State>}
    </section>
  );
}
function Tracking() {
  const [order, setOrder] = useState<Receipt>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const keys = read<{ orderNumber: string; trackingToken: string }[]>(
    "cj-order-keys",
    [],
  );
  return (
    <section className="sf-section sf-account">
      <span className="sf-kicker">ON ITS WAY TO YOUR LITTLE WORLD</span>
      <h1>Follow your order.</h1>
      <p>Enter your order number and the private key shown after checkout.</p>
      <form
        className="sf-account-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setOrder(undefined);
          try {
            setOrder(
              await shopApi<Receipt>(
                "/track",
                Object.fromEntries(new FormData(e.currentTarget)),
              ),
            );
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Order number
          <input
            name="orderNumber"
            required
            defaultValue={keys[0]?.orderNumber}
          />
        </label>
        <label>
          Private tracking key
          <input
            name="trackingToken"
            required
            minLength={64}
            maxLength={64}
            autoComplete="off"
            defaultValue={keys[0]?.trackingToken}
          />
        </label>
        <button className="sf-button" disabled={busy}>
          {busy ? "Looking up your order…" : "Track order"}
          <ArrowRight size={17} />
        </button>
      </form>
      {error && <State error>{error}</State>}
      {order && <OrderReceipt order={order} />}
    </section>
  );
}
function Policy() {
  const { kind } = useParams();
  const { settings } = useStore();
  const title =
    kind === "delivery"
      ? "Delivery, made simple."
      : kind === "returns"
        ? "Returns & exchanges."
        : "Your privacy matters.";
  return (
    <section className="sf-section sf-policy">
      <span className="sf-kicker">HERE TO HELP</span>
      <h1>{title}</h1>
      <div className="sf-description">
        {kind === "delivery" ? (
          <>
            <p>
              {settings?.deliveryInfo ||
                "Delivery information is being prepared. Ordering will open once it is ready."}
            </p>
            <p>
              Inside Dhaka:{" "}
              {settings?.dhakaDelivery !== null &&
              settings?.dhakaDelivery !== undefined
                ? bdt(settings.dhakaDelivery)
                : "To be confirmed"}
              <br />
              Outside Dhaka:{" "}
              {settings?.outsideDelivery !== null &&
              settings?.outsideDelivery !== undefined
                ? bdt(settings.outsideDelivery)
                : "To be confirmed"}
            </p>
            <p>
              Payment method: Cash on Delivery. Your final delivery charge is
              displayed before placing your order.
            </p>
          </>
        ) : (
          <p>
            {(kind === "returns"
              ? settings?.returnPolicy
              : settings?.privacyPolicy) ||
              "This policy is being prepared. Please contact the store before ordering."}
          </p>
        )}
      </div>
      {settings?.phone && (
        <a href={`tel:${settings.phone}`}>Questions? Call {settings.phone}</a>
      )}
    </section>
  );
}
