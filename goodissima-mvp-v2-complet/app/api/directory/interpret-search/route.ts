import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { interpretDirectorySearch, sanitizeDirectorySearchQuery } from "@/lib/directory/directory-search-interpreter";
import { getConfiguredAIProvider } from "@/lib/ai/service";
import { recordAIEvent } from "@/lib/ai/observability";

export async function POST(request: Request) {
  await getCurrentPrismaUser();
  try {
    const body = await request.json() as { query?: unknown };
    const query = sanitizeDirectorySearchQuery(body?.query);
    if (!query) return NextResponse.json({ error: "Saisissez une demande à interpréter." }, { status: 400 });
    return NextResponse.json(await interpretDirectorySearch(query, { provider: getConfiguredAIProvider(), recordEvent: recordAIEvent }));
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
    return NextResponse.json({ error: "Nous n’avons pas pu interpréter cette demande automatiquement. Vous pouvez utiliser les filtres ci-dessous." }, { status: 503 });
  }
}
