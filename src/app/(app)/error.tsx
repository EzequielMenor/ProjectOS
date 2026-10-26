"use client";

import { RouteError } from "@/components/route-error";

export default function Error(props: { error: unknown; retry: () => void }) {
  return <RouteError {...props} />;
}
