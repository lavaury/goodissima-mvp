import { Suspense } from "react";
import { LoginEntry } from "@/components/LoginEntry";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <LoginEntry />
    </Suspense>
  );
}
