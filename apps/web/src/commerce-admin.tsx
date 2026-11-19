import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Package, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { api, post, bdt, date } from "./api";
import type { StoreSettings } from "./storefront";

type Order = {
  id: string;
  orderNumber: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  district: string;
  zone: string;
  notes: string;
  total: string;
  delivery: string;
  status: string;
  version: number;
  createdAt: string;
  items: {
    name: string;
    sku: string;
    quantity: number;
    lineTotal: string;
    selectedOptions?: Record<string, string>;
  }[];
};
const next: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};
export function CommerceAdmin({ mode }: { mode: "settings" | "orders" }) {
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<{ order: Order; status: string }>();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirm) dialog.current?.showModal();
  }, [confirm]);
  const settings = useQuery({
    queryKey: ["commerce-settings"],
    queryFn: () => api<StoreSettings>("/commerce/settings"),
    enabled: mode === "settings",
  });
  const orders = useQuery({
    queryKey: ["commerce-orders", page, status, search],
    queryFn: () =>
      api<{ items: Order[]; total: number; pages: number }>(
        `/commerce/orders?${new URLSearchParams({ page: String(page), search, ...(status ? { status } : {}) })}`,
      ),
    enabled: mode === "orders",
    refetchInterval: 30000,
  });
  async function update() {
    if (!confirm || busy) return;
    setBusy(true);
    setError("");
    try {
      await post(
        `/commerce/orders/${confirm.order.id}`,
        { status: confirm.status, version: confirm.order.version },
        "PATCH",
      );
      toast.success("Order updated");
      setConfirm(undefined);
      await client.invalidateQueries({ queryKey: ["commerce-orders"] });
      await client.invalidateQueries({ queryKey: ["catalog"] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CHOTTO JADUGHOR · CUSTOMER SHOP</span>
          <h1>{mode === "settings" ? "Online Shop" : "Customer Orders"}</h1>
          <p className="muted">
            {mode === "settings"
              ? "Set your contact details, delivery charges and policies. Publish products from Manage Product."
              : "Manage Cash on Delivery orders. Stock is reserved at checkout and restored once when an order is cancelled."}
          </p>
        </div>
        <a className="text-button" href="/" target="_blank" rel="noreferrer">
          Visit customer shop <ExternalLink size={15} />
        </a>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {mode === "settings" ? (
        settings.isLoading ? (
          <p>Loading shop settings…</p>
        ) : settings.error ? (
          <p role="alert">{settings.error.message}</p>
        ) : (
          settings.data && (
            <form
              className="panel"
              key={settings.data.announcement + settings.data.acceptingOrders}
              onSubmit={async (e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                setBusy(true);
                setError("");
                try {
                  await post(
                    "/commerce/settings",
                    {
                      ...data,
                      acceptingOrders: data.acceptingOrders === "on",
                      dhakaDelivery: data.dhakaDelivery || null,
                      outsideDelivery: data.outsideDelivery || null,
                    },
                    "PUT",
                  );
                  await client.invalidateQueries({
                    queryKey: ["commerce-settings"],
                  });
                  await client.invalidateQueries({
                    queryKey: ["shop-settings"],
                  });
                  toast.success("Shop settings saved");
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="notice">
                <ShoppingBag size={19} />
                Products are private drafts until you add a customer price and
                enable “Publish in customer shop” in Manage Product. Existing
                estimates keep their internal prices.
              </div>
              <label>
                Announcement
                <input
                  name="announcement"
                  maxLength={200}
                  defaultValue={settings.data.announcement}
                />
              </label>
              <div className="form-grid">
                <label>
                  Phone
                  <input
                    name="phone"
                    maxLength={30}
                    defaultValue={settings.data.phone}
                  />
                </label>
                <label>
                  WhatsApp · country code, digits only
                  <input
                    name="whatsapp"
                    pattern="[0-9]{10,15}|^$"
                    placeholder="8801XXXXXXXXX"
                    defaultValue={settings.data.whatsapp}
                  />
                </label>
                <label>
                  Support email
                  <input
                    type="email"
                    name="email"
                    defaultValue={settings.data.email}
                  />
                </label>
                <label>
                  Store / return address
                  <input
                    name="address"
                    maxLength={500}
                    defaultValue={settings.data.address}
                  />
                </label>
                <label>
                  Delivery inside Dhaka (৳)
                  <input
                    name="dhakaDelivery"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={settings.data.dhakaDelivery ?? ""}
                  />
                </label>
                <label>
                  Delivery outside Dhaka (৳)
                  <input
                    name="outsideDelivery"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={settings.data.outsideDelivery ?? ""}
                  />
                </label>
              </div>
              <label>
                Delivery information / expected timing
                <textarea
                  name="deliveryInfo"
                  maxLength={2000}
                  defaultValue={settings.data.deliveryInfo}
                />
              </label>
              <label>
                Return & exchange policy
                <textarea
                  name="returnPolicy"
                  maxLength={5000}
                  defaultValue={settings.data.returnPolicy}
                />
              </label>
              <label>
                Privacy policy
                <textarea
                  name="privacyPolicy"
                  maxLength={5000}
                  defaultValue={settings.data.privacyPolicy}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="acceptingOrders"
                  defaultChecked={settings.data.acceptingOrders}
                />
                Accept Cash on Delivery orders
              </label>
              <p className="muted">
                Contact/address, both delivery fees and all policies must be
                completed before orders can be enabled. Customers can browse
                while ordering is paused.
              </p>
              <button className="primary" disabled={busy}>
                {busy ? "Saving…" : "Save shop settings"}
              </button>
            </form>
          )
        )
      ) : (
        <>
          <div className="toolbar">
            <input
              aria-label="Search orders"
              placeholder="Order number, customer or phone"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Filter order status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {Object.keys(next).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <span>{orders.data?.total ?? 0} orders</span>
          </div>
          {orders.isLoading ? (
            <p>Loading customer orders…</p>
          ) : orders.error ? (
            <div className="notice error">{orders.error.message}</div>
          ) : orders.data?.items.length ? (
            orders.data.items.map((o) => (
              <article className="panel commerce-order" key={o.id}>
                <div className="actions">
                  <h2>{o.orderNumber}</h2>
                  <span className="pill">{o.status}</span>
                  <strong>{bdt(o.total)} · COD</strong>
                </div>
                <p className="muted">{date(o.createdAt)}</p>
                <div className="form-grid">
                  <div>
                    <strong>{o.name}</strong>
                    <p>
                      <a href={`tel:${o.phone}`}>{o.phone}</a>
                      <br />
                      {o.email}
                    </p>
                    <p className="prewrap">
                      {o.address}
                      <br />
                      {o.district} ·{" "}
                      {o.zone === "DHAKA" ? "Inside Dhaka" : "Outside Dhaka"}
                    </p>
                  </div>
                  <div>
                    {o.items.map((i, n) => (
                      <p key={n}>
                        {i.name} · {i.sku} × {i.quantity} — {bdt(i.lineTotal)}
                        {Object.keys(i.selectedOptions ?? {}).length > 0 && (
                          <small className="sf-selected-options">
                            {Object.entries(i.selectedOptions ?? {})
                              .map(([name, value]) => `${name}: ${value}`)
                              .join(" · ")}
                          </small>
                        )}
                      </p>
                    ))}
                    <p>Delivery: {bdt(o.delivery)}</p>
                    {o.notes && (
                      <p className="prewrap">Customer note: {o.notes}</p>
                    )}
                  </div>
                </div>
                <div className="actions">
                  {next[o.status]?.map((s) => (
                    <button
                      key={s}
                      className={s === "CANCELLED" ? "danger" : "primary"}
                      onClick={() => {
                        setError("");
                        setConfirm({ order: o, status: s });
                      }}
                    >
                      {s === "CANCELLED"
                        ? "Cancel & restore stock"
                        : `Mark ${s.toLowerCase()}`}
                    </button>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <div className="empty">
              <Package size={32} />
              <h2>No orders here yet</h2>
              <p>Customer orders will appear here after checkout.</p>
            </div>
          )}
          <div className="actions">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={page >= (orders.data?.pages ?? 1)}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
          {confirm && (
            <dialog
              ref={dialog}
              className="panel"
              role="alertdialog"
              aria-label="Confirm order update"
              onCancel={(e) => {
                e.preventDefault();
                if (!busy) setConfirm(undefined);
              }}
            >
              <h2>Confirm {confirm.order.orderNumber}</h2>
              <p>
                Change to {confirm.status}?{" "}
                {confirm.status === "CANCELLED" &&
                  "Reserved stock will be restored. This cannot be undone."}
              </p>
              {error && (
                <p className="danger" role="alert">
                  {error}
                </p>
              )}
              <div className="actions">
                <button className="primary" disabled={busy} onClick={update}>
                  {busy ? "Updating…" : "Confirm status change"}
                </button>
                <button disabled={busy} onClick={() => setConfirm(undefined)}>
                  Keep current status
                </button>
              </div>
            </dialog>
          )}
        </>
      )}
    </section>
  );
}
