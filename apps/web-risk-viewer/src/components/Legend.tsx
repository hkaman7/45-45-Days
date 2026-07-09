import { getLegendBreaks } from "../config/legends";
import { getProductTypeLabel } from "../config/products";
import type { ProductConfig } from "../types/products";

interface Props {
  product: ProductConfig | undefined;
}

export function Legend({ product }: Props) {
  if (!product) return null;
  const breaks = getLegendBreaks(product);

  return (
    <div className="legend">
      {/* Just the product type - crop and week are already shown in the left control panel. */}
      <div className="legend-title">{getProductTypeLabel(product.productType)}</div>
      {!product.dataAvailable && <div className="legend-placeholder-note">Data not yet connected</div>}
      <div className="legend-ramp-horizontal">
        {breaks.map((b) => (
          <div key={b.label} className="legend-swatch-col">
            <span className="legend-swatch" style={{ backgroundColor: b.color }} />
            <span className="legend-swatch-label">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="legend-units">{product.units}</div>
    </div>
  );
}
