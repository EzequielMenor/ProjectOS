"use client";

import { RouteError } from "@/components/route-error";

// Catches what the (app) boundary cannot: failures in the app layout itself (e.g. the database being unreachable).
export default function Error(props: { error: unknown; retry: () => void }) {
  return <RouteError {...props} />;
}
