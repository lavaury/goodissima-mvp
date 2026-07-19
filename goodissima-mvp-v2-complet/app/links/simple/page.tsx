import { getCurrentPrismaUser } from "@/lib/auth";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { SimpleLinkBuilder } from "./simple-link-builder";

export const dynamic = "force-dynamic";

export default async function SimpleLinkPage() {
  const owner = await getCurrentPrismaUser();
  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <PlatformNavigation active="opportunities" organizationName={organizationName} />
      <SimpleLinkBuilder />
    </main>
  );
}
