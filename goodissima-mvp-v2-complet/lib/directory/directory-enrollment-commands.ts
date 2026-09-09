import "server-only";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DirectoryEnrollmentService,
  type AddDeclaredDirectoryAttributeInput,
  type UpdateDeclaredDirectoryAttributeInput,
} from "./directory-enrollment-service.ts";
import { createPrismaDirectoryEnrollmentRepository } from "./directory-enrollment-repository.ts";

function enrollmentService() {
  return new DirectoryEnrollmentService(createPrismaDirectoryEnrollmentRepository(prisma));
}

async function authenticatedEnrollment() {
  const user = await getCurrentPrismaUser();
  return { userId: user.id, service: enrollmentService() };
}

export async function createMyDirectoryDraft(input: { publicName: string }) {
  const { userId, service } = await authenticatedEnrollment();
  return service.createMyDirectoryDraft(userId, input);
}

export async function updateMyDirectoryPublicName(publicId: string, publicName: string) {
  const { userId, service } = await authenticatedEnrollment();
  return service.updateMyDirectoryPublicName(userId, publicId, publicName);
}

export async function addMyDeclaredDirectoryAttribute(publicId: string, input: AddDeclaredDirectoryAttributeInput) {
  const { userId, service } = await authenticatedEnrollment();
  return service.addMyDeclaredAttribute(userId, publicId, input);
}

export async function updateMyDeclaredDirectoryAttribute(
  publicId: string,
  attributeId: string,
  input: UpdateDeclaredDirectoryAttributeInput,
) {
  const { userId, service } = await authenticatedEnrollment();
  return service.updateMyDeclaredAttribute(userId, publicId, attributeId, input);
}

export async function publishMyDirectoryAttribute(publicId: string, attributeId: string) {
  const { userId, service } = await authenticatedEnrollment();
  return service.publishMyDirectoryAttribute(userId, publicId, attributeId);
}

export async function withdrawMyDirectoryAttribute(publicId: string, attributeId: string) {
  const { userId, service } = await authenticatedEnrollment();
  return service.withdrawMyDirectoryAttribute(userId, publicId, attributeId);
}

export async function publishMyDirectoryProfile(publicId: string) {
  const { userId, service } = await authenticatedEnrollment();
  return service.publishMyDirectoryProfile(userId, publicId);
}

export async function disableMyDirectoryProfile(publicId: string) {
  const { userId, service } = await authenticatedEnrollment();
  return service.disableMyDirectoryProfile(userId, publicId);
}

export async function republishMyDirectoryProfile(publicId: string) {
  const { userId, service } = await authenticatedEnrollment();
  return service.republishMyDirectoryProfile(userId, publicId);
}
