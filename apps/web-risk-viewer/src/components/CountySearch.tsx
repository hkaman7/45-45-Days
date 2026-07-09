import { useMemo, useState } from "react";
import type { Feature } from "geojson";
import { useAppDispatch } from "../state/AppStateContext";
import type { CountyFeatureProperties } from "../types/products";

interface Props {
  counties: Feature[];
}

export function CountySearch({ counties }: Props) {
  const [query, setQuery] = useState("");
  const dispatch = useAppDispatch();

  const matches = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return counties
      .filter((f) => {
        const props = f.properties as CountyFeatureProperties;
        return props.county_name.toLowerCase().includes(q) || props.state_fips.includes(q);
      })
      .slice(0, 8);
  }, [counties, query]);

  function selectCounty(f: Feature) {
    const props = f.properties as CountyFeatureProperties;
    dispatch({ type: "FLY_TO_COUNTY", geoid: props.geoid });
    setQuery(`${props.county_name} County (FIPS ${props.state_fips})`);
  }

  return (
    <div className="control-group county-search">
      <label className="control-label" htmlFor="county-search-input">
        Search County / State FIPS
      </label>
      <input
        id="county-search-input"
        className="select"
        type="text"
        placeholder="e.g. Story, or state FIPS 19"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length > 0 && (
        <ul className="search-results">
          {matches.map((f) => {
            const props = f.properties as CountyFeatureProperties;
            return (
              <li key={props.geoid}>
                <button onClick={() => selectCounty(f)}>
                  {props.county_name} County <span className="muted">— FIPS {props.state_fips}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
