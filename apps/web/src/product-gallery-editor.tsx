import { useState } from "react";
import { api, post, type Product } from "./api";
import { toast } from "sonner";
export function ProductGalleryEditor({
  productId,
  images,
  version,
  onChange,
  onBusy,
}: {
  productId: string;
  images: Product["images"];
  version: number;
  onChange: (images: Product["images"], version: number) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(
    imageId: string,
    action: "remove" | "cover" | "replace",
    file?: File,
  ) {
    if (busy) return;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      let result;
      if (action === "replace") {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024)
          throw new Error("Each image must be 5 MB or smaller");
        const data = new FormData();
        data.set("version", String(version));
        data.set("image", file);
        result = await api(`/products/${productId}/images/${imageId}`, {
          method: "POST",
          body: data,
        });
      } else
        result = await post(
          `/products/${productId}/images/${imageId}${action === "cover" ? "/cover" : ""}`,
          { version },
          action === "cover" ? "PATCH" : "DELETE",
        );
      onChange(result.images, result.version);
      toast.success("Product gallery updated");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="admin-gallery">
      <p className="muted">
        Up to 4 images. The cover appears in product lists. Replace, remove and
        cover changes save immediately.
      </p>
      <div className="admin-gallery-grid">
        {images.map((image, i) => (
          <div key={image.id}>
            <img src={image.thumbnail} alt={`Product image ${i + 1}`} />
            <small>{i === 0 ? "Cover image" : `Image ${i + 1}`}</small>
            <div className="actions">
              {i > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(image.id, "cover")}
                >
                  Make cover
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => run(image.id, "remove")}
              >
                Remove image {i + 1}
              </button>
            </div>
            <label>
              Replace image {i + 1}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(e) => {
                  void run(image.id, "replace", e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        ))}
      </div>
      {error && (
        <p className="danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
