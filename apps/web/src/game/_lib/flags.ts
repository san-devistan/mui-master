import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@workspace/backend/api"

// The backend's feature flags (convex/flags.ts): `dev`, the dev tools; `premium`, the holo shop;
// and `proSales`, buying Pro. Only for hiding what's off: the backend refuses it either way. All
// off until known.
export function useFlags() {
  const { data } = useQuery(convexQuery(api.flags.get, {}))
  return data ?? { dev: false, premium: false, proSales: false }
}
