import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { linkId: string } }) {
  const owner = await getCurrentPrismaUser();
  const link = await prisma.gLink.findFirst({ where: { id: params.linkId, ownerId: owner.id }, select: { id: true } });
  if (!link) return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
  const body = await req.json();
  const action = typeof body.action === "string" ? body.action : "update";
  if (action === "archive") {
    await prisma.gLink.update({ where: { id: link.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
    revalidatePath(`/links/${link.id}`);
    revalidatePath("/opportunities", "page");
    revalidatePath("/dashboard");
    return NextResponse.json({ status: "ARCHIVED", archived: true, deleted: false, relationshipsModified: false });
  }
  if (action === "publish") {
    await prisma.gLink.update({ where: { id: link.id }, data: { status: "ACTIVE", archivedAt: null } });
    revalidatePath(`/links/${link.id}`);
    revalidatePath("/opportunities", "page");
    revalidatePath("/dashboard");
    return NextResponse.json({ status: "ACTIVE", published: true, relationshipsModified: false });
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!title) return NextResponse.json({ error: "Le titre de l'annonce est requis." }, { status: 400 });
  const updated = await prisma.gLink.update({ where: { id: link.id }, data: { title, city: typeof body.city === "string" && body.city.trim() ? body.city.trim().slice(0, 120) : null, description: typeof body.description === "string" && body.description.trim() ? body.description.trim().slice(0, 3000) : null } });
  revalidatePath(`/links/${link.id}`);
  revalidatePath("/opportunities");
  return NextResponse.json({ id: updated.id, title: updated.title, city: updated.city, description: updated.description, relationshipsModified: false });
}
