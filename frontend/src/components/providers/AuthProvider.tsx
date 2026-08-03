"use client";

import SWRProvider from "@/components/providers/SWRProvider";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SWRProvider>{children}</SWRProvider>;
}
