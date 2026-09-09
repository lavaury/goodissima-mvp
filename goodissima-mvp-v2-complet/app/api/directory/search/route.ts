import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPrismaDirectorySearchRepository } from "@/lib/directory/directory-search-repository";
import { DirectorySearchCriteriaError, DirectorySearchService } from "@/lib/directory/directory-search-service";

export async function POST(request: Request) {
  await getCurrentPrismaUser();
  try {
    const criteria = await request.json();
    const service = new DirectorySearchService(createPrismaDirectorySearchRepository(prisma));
    return NextResponse.json(await service.search(criteria));
  } catch (error) {
    if (error instanceof DirectorySearchCriteriaError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Critères de recherche invalides." }, { status: 400 });
    }
    throw error;
  }
}
