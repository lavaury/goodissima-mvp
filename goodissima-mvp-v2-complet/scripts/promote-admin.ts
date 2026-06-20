import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const allowedRoles = new Set(["SUPER_ADMIN", "PRODUCT_OWNER"]);
const allowedGoodissimaEnvironments = new Set(["local", "staging", "production"]);
const allowedVercelEnvironments = new Set(["development", "preview", "production"]);
const valueOptions = new Set(["--email", "--role"]);
const flagOptions = new Set(["--confirm-production", "--dry-run"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DeploymentEnvironment = "local" | "staging" | "production";

type Options = {
  email: string;
  role: "SUPER_ADMIN" | "PRODUCT_OWNER";
  confirmProduction: boolean;
  dryRun: boolean;
};

function assertArgumentsAreSafe() {
  const args = process.argv.slice(2);
  const occurrences = new Map<string, number>();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (!valueOptions.has(argument) && !flagOptions.has(argument)) {
      throw new Error(`Unknown argument: ${argument}. No database change was made.`);
    }

    const count = (occurrences.get(argument) ?? 0) + 1;
    occurrences.set(argument, count);
    if (count > 1) {
      throw new Error(`Argument ${argument} may only be provided once. No database change was made.`);
    }

    if (valueOptions.has(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${argument} requires a value.`);
      }
      index += 1;
    }
  }
}

function readOption(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;

  return process.argv[index + 1];
}

function parseOptions(): Options {
  assertArgumentsAreSafe();

  const rawEmail = readOption("--email");
  if (!rawEmail) {
    throw new Error("Explicit email required. Use --email user@example.com.");
  }

  const email = rawEmail.trim().toLowerCase();
  if (
    !emailPattern.test(email) ||
    email.includes("*") ||
    email.includes(",") ||
    email.includes(";")
  ) {
    throw new Error("Provide exactly one valid email address. Wildcards and lists are refused.");
  }

  const rawRole = (readOption("--role") ?? "SUPER_ADMIN").trim().toUpperCase();
  if (!allowedRoles.has(rawRole)) {
    throw new Error("--role must be SUPER_ADMIN or PRODUCT_OWNER.");
  }

  return {
    email,
    role: rawRole as Options["role"],
    confirmProduction: process.argv.includes("--confirm-production"),
    dryRun: process.argv.includes("--dry-run"),
  };
}

function normalizedEnvironmentVariable(name: "GOODISSIMA_ENV" | "VERCEL_ENV") {
  const value = process.env[name]?.trim().toLowerCase();
  return value || null;
}

function assertEnvironmentIsSafe(options: Options): DeploymentEnvironment {
  const goodissimaEnvironment = normalizedEnvironmentVariable("GOODISSIMA_ENV");
  const vercelEnvironment = normalizedEnvironmentVariable("VERCEL_ENV");

  if (!goodissimaEnvironment && !vercelEnvironment) {
    throw new Error(
      "GOODISSIMA_ENV or VERCEL_ENV must explicitly identify the target environment. No database change was made.",
    );
  }

  if (
    goodissimaEnvironment &&
    !allowedGoodissimaEnvironments.has(goodissimaEnvironment)
  ) {
    throw new Error(
      `Unsupported GOODISSIMA_ENV=${goodissimaEnvironment}. No database change was made.`,
    );
  }

  if (vercelEnvironment && !allowedVercelEnvironments.has(vercelEnvironment)) {
    throw new Error(
      `Unsupported VERCEL_ENV=${vercelEnvironment}. No database change was made.`,
    );
  }

  const isProduction =
    goodissimaEnvironment === "production" || vercelEnvironment === "production";

  if (isProduction && !options.confirmProduction) {
    throw new Error(
      "Production promotion requires --confirm-production. No database change was made.",
    );
  }

  if (isProduction) return "production";
  if (goodissimaEnvironment === "staging" || vercelEnvironment === "preview") {
    return "staging";
  }

  return "local";
}

async function main() {
  const options = parseOptions();
  const environment = assertEnvironmentIsSafe(options);

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. No database change was made.");
  }

  const user = await prisma.user.findUnique({
    where: { email: options.email },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    throw new Error(
      `User ${options.email} does not exist. Sign in once or create the account before promotion.`,
    );
  }

  const summary = {
    environment,
    userId: user.id,
    email: user.email,
    previousRole: user.role,
    requestedRole: options.role,
  };

  if (options.dryRun) {
    console.log("[promote-admin] Dry run; no database change made.");
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (user.role === options.role) {
    console.log("[promote-admin] User already has the requested role; no change needed.");
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const promotedUser = await transaction.user.update({
      where: { id: user.id },
      data: { role: options.role },
      select: { role: true },
    });

    await transaction.auditLog.create({
      data: {
        eventType: "ADMIN_ROLE_PROMOTED",
        metadata: {
          source: "scripts/promote-admin.ts",
          environment,
          targetUserId: user.id,
          targetEmail: user.email,
          previousRole: user.role,
          currentRole: promotedUser.role,
        },
      },
    });

    return promotedUser;
  });

  console.log("[promote-admin] Promotion completed.");
  console.log(JSON.stringify({ ...summary, currentRole: updated.role }, null, 2));
}

main()
  .catch((error) => {
    console.error("[promote-admin] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
