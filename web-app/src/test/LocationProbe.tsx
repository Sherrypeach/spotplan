import { useLocation } from 'react-router-dom';

/** Renders where the router ended up, so a test can assert on redirects and their state. */
export function LocationProbe() {
  const location = useLocation();
  return (
    <p data-testid="location">
      {location.pathname} {JSON.stringify(location.state ?? null)}
    </p>
  );
}
