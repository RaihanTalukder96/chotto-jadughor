import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
export function ImageGallery({
  images,
  name,
  compact = false,
}: {
  images: { url: string; thumbnail: string }[];
  name: string;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const active = Math.min(index, Math.max(0, images.length - 1));
  const image = images[active];
  useEffect(() => {
    setFailed(false);
  }, [image?.url]);
  return (
    <div className={`product-gallery${compact ? " compact" : ""}`}>
      <div className="product-gallery-main">
        {image && !failed ? (
          <img
            key={image.url}
            src={image.url}
            alt={`${name} · image ${active + 1}`}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="sf-no-photo">
            <Package size={60} strokeWidth={1} />
            <span>Product photo coming soon</span>
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="gallery-previous"
              aria-label="Previous product image"
              onClick={() =>
                setIndex((active + images.length - 1) % images.length)
              }
            >
              <ChevronLeft size={19} />
            </button>
            <button
              type="button"
              className="gallery-next"
              aria-label="Next product image"
              onClick={() => setIndex((active + 1) % images.length)}
            >
              <ChevronRight size={19} />
            </button>
            <span className="gallery-count" aria-live="polite">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="product-gallery-thumbs" aria-label="Product images">
          {images.map((item, i) => (
            <button
              type="button"
              key={item.url}
              aria-label={`View product image ${i + 1}`}
              aria-pressed={active === i}
              onClick={() => setIndex(i)}
            >
              <img src={item.thumbnail} alt={`${name} thumbnail ${i + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
