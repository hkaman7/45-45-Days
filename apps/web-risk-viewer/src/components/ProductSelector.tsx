import { PRODUCT_TYPES } from "../config/products";
import { useAppDispatch, useAppState } from "../state/AppStateContext";

export function ProductSelector() {
  const { productType } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="control-group">
      <label className="control-label" htmlFor="product-select">
        Product
      </label>
      <select
        id="product-select"
        className="select"
        value={productType}
        onChange={(e) => dispatch({ type: "SET_PRODUCT_TYPE", productType: e.target.value as typeof productType })}
      >
        {PRODUCT_TYPES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
