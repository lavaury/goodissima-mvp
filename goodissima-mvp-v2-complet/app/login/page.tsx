import { Suspense } from "react";
import { LoginEntry } from "@/components/LoginEntry";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginEntry />
    </Suspense>
  );
}
