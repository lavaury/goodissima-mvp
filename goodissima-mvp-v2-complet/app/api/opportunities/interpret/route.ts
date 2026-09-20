import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getConfiguredAIProvider } from "@/lib/ai/service";
import { interpretOpportunityPhrase, sanitizeOpportunityPhrase, suggestOpportunityTitle } from "@/lib/opportunities/opportunity-intent";

export async function POST(request: Request) {
  await getCurrentPrismaUser();
  try {
    const body = await request.json();
    const phrase = sanitizeOpportunityPhrase(body?.phrase);
    if (!phrase) return NextResponse.json({ error: "Décrivez ce que vous recherchez ou proposez." }, { status: 400 });
    const intent = await interpretOpportunityPhrase(phrase, { provider: getConfiguredAIProvider(), recordEvent: async () => undefined });
    return NextResponse.json({ intent, title: suggestOpportunityTitle(intent), description: phrase });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
    return NextResponse.json({ error: "Nous n’avons pas pu interpréter automatiquement votre demande. Vous pouvez continuer manuellement." }, { status: 503 });
  }
}
