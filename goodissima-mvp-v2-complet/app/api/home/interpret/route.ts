import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { interpretHomeIntent } from "@/lib/ai/governance/interpret-home-intent";
import { AIGovernanceError } from "@/lib/ai/governance/types";
import { getDashboardActivity } from "@/lib/dashboard-activity-repository";
import { readFavoritePage } from "@/lib/personal-favorites-repository";
import { homeIntentChoice, isSafeHomeDestination } from "@/lib/home-intent";
import type { HomeIntentChoice } from "@/lib/home-intent";

export const dynamic = "force-dynamic";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim();
}

async function accessibleObjectChoices(ownerId: string, query: string): Promise<HomeIntentChoice[]> {
  const needle = normalized(query);
  if (needle.length < 3) return [];
  const [favorites, activity] = await Promise.all([readFavoritePage(ownerId, 0), getDashboardActivity(ownerId)]);
  const candidates = [
    ...favorites.items.map((item) => ({ title: item.title, href: item.href, label: `Ouvrir ${item.title}` })),
    ...activity.map((item) => ({ title: item.context, href: item.href, label: `Ouvrir ${item.context}` })),
  ];
  const seen = new Set<string>();
  return candidates.filter((item) => {
    if (!isSafeHomeDestination(item.href) || !normalized(item.title).includes(needle) || seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  }).slice(0, 5).map((item) => ({ intent: "OPEN_EXISTING_OBJECT", href: item.href, label: item.label, kind: "NAVIGATION" }));
}

export async function POST(request: Request) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await request.json() as { text?: unknown };
    if (typeof body.text !== "string" || body.text.trim().length < 3 || body.text.length > 500) return NextResponse.json({ error: "Décrivez votre demande en quelques mots (500 caractères maximum)." }, { status: 400 });
    const { interpretation } = await interpretHomeIntent(body.text, owner.id);
    if (interpretation.intent === "UNKNOWN" || interpretation.confidenceBand === "LOW") return NextResponse.json({ kind: "UNKNOWN", message: "Je ne suis pas certain d'avoir compris ce que vous souhaitez faire." });
    if (interpretation.intent === "AMBIGUOUS") return NextResponse.json({ kind: "CHOICES", reformulation: interpretation.reformulation, choices: interpretation.ambiguityOptions!.map(homeIntentChoice) });
    if (interpretation.intent === "OPEN_EXISTING_OBJECT") {
      const choices = await accessibleObjectChoices(owner.id, interpretation.proposedParameters.objectQuery ?? "");
      if (!choices.length) return NextResponse.json({ kind: "UNKNOWN", message: "Je n'ai pas trouvé cet objet parmi vos favoris et activités récentes accessibles. Essayez Mes espaces ou reformulez." });
      return NextResponse.json({ kind: choices.length === 1 ? "PROPOSAL" : "CHOICES", reformulation: interpretation.reformulation, ...(choices.length === 1 ? { action: choices[0] } : { choices }) });
    }
    return NextResponse.json({ kind: "PROPOSAL", reformulation: interpretation.reformulation, action: homeIntentChoice(interpretation.intent) });
  } catch (error) {
    if (error instanceof AIGovernanceError && error.code === "AI_OUTPUT_INVALID") return NextResponse.json({ kind: "UNKNOWN", message: "Je ne suis pas certain d'avoir compris ce que vous souhaitez faire." });
    return NextResponse.json({ error: "L'aide à l'orientation n'est pas disponible actuellement. Vous pouvez utiliser les accès ci-dessous." }, { status: 503 });
  }
}
