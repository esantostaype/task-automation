// prisma/seed.ts
// Para ejecutar: npx prisma db seed
// Asegúrate de que tu variable de entorno DATABASE_LOCAL esté configurada.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const tierDurations = {
  S: 30,
  A: 21,
  B: 14,
  C: 7,
  D: 3,
  E: 0.5,
};

async function main() {
  console.log("Iniciando proceso de seeding...");

  // Limpieza previa (en orden correcto por dependencias para evitar errores de FK)
  console.log("Limpiando tablas existentes...");
  await prisma.syncLog.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskCategory.deleteMany();
  await prisma.taskType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.brand.deleteMany();
  console.log("Tablas limpiadas.");

  // Crear Brands con configuración completa de ClickUp
  console.log("Creando Brands...");
  await prisma.brand.createMany({
    data: [
      {
        id: "901700182493", // ✅ MODIFICADO: Usar clickupListId como 'id'
        name: "Inszone",
        // clickupListId: "901700182493", // ✅ ELIMINADO
        spaceId: "90170091121", // ✅ RENOMBRADO
        folderId: "90120123456", // ✅ RENOMBRADO
        teamId: "90170099166", // ✅ RENOMBRADO
        isActive: true,
        description: "Main Inszone brand",
        defaultStatus: "TO_DO",
        statusMapping: {
          "TO_DO": "to do",
          "IN_PROGRESS": "in progress", 
          "ON_APPROVAL": "review",
          "COMPLETE": "closed"
        }
      },
      {
        id: "901700182489", // ✅ MODIFICADO
        name: "R.E. Chaix",
        spaceId: "90170091121", // ✅ RENOMBRADO
        folderId: "90120123456", // ✅ RENOMBRADO
        teamId: "90170099166", // ✅ RENOMBRADO
        isActive: true,
        description: "Secondary brand",
        defaultStatus: "TO_DO",
        statusMapping: {
          "TO_DO": "open",
          "IN_PROGRESS": "in progress",
          "ON_APPROVAL": "pending review", 
          "COMPLETE": "done"
        }
      },
      {
        id: "901704229078", // ✅ MODIFICADO
        name: "Pinney",
        spaceId: "90170091121", // ✅ RENOMBRADO
        folderId: "90120123456", // ✅ RENOMBRADO
        teamId: "90170099166", // ✅ RENOMBRADO
        isActive: true,
        description: "Secondary brand",
        defaultStatus: "TO_DO",
        statusMapping: {
          "TO_DO": "open",
          "IN_PROGRESS": "in progress",
          "ON_APPROVAL": "pending review", 
          "COMPLETE": "done"
        }
      },
    ],
  });
  console.log("Brands creados.");

  // Obtener los brands creados
  const allBrands = await prisma.brand.findMany();

  // Crear TaskTypes y TaskCategories
  console.log("Creando TaskTypes y TaskCategories...");
  const [uxType, graphicType] = await Promise.all([
    prisma.taskType.create({
      data: {
        name: "UX/UI",
        categories: {
          create: [
            { name: "Full website with multiple levels", duration: tierDurations.S, tier: "S" },
            { name: "UX/UI for SaaS or B2B platform", duration: tierDurations.S, tier: "S" },
            { name: "Design system with documentation", duration: tierDurations.S, tier: "S" },
            { name: "Mobile app (15+ screens)", duration: tierDurations.S, tier: "S" },
            { name: "Validated MVP prototype", duration: tierDurations.S, tier: "S" },
            { name: "Cross-platform design", duration: tierDurations.S, tier: "S" },
            { name: "Complex intranet section", duration: tierDurations.A, tier: "A" },
            { name: "Corporate website (5–7 sections)", duration: tierDurations.A, tier: "A" },
            { name: "Prototype with microinteractions", duration: tierDurations.A, tier: "A" },
            { name: "Intermediate design system", duration: tierDurations.A, tier: "A" },
            { name: "Dashboard with charts and filters", duration: tierDurations.A, tier: "A" },
            { name: "UX for onboarding or sign-up", duration: tierDurations.A, tier: "A" },
            { name: "Full redesign of site/app", duration: tierDurations.A, tier: "A" },
            { name: "Simple intranet section", duration: tierDurations.B, tier: "B" },
            { name: "Landing page design", duration: tierDurations.B, tier: "B" },
            { name: "Complex internal pages", duration: tierDurations.B, tier: "B" },
            { name: "3–5 UI screens", duration: tierDurations.B, tier: "B" },
            { name: "Component with states/variants", duration: tierDurations.B, tier: "B" },
            { name: "Simple clickable prototype", duration: tierDurations.B, tier: "B" },
            { name: "Wireframes + simple mockup", duration: tierDurations.B, tier: "B" },
            { name: "Responsive views of same page", duration: tierDurations.B, tier: "B" },
            { name: "New section in existing page", duration: tierDurations.C, tier: "C" },
            { name: "Mobile version of a page", duration: tierDurations.C, tier: "C" },
            { name: "Simple view design", duration: tierDurations.C, tier: "C" },
            { name: "Web banner adaptation", duration: tierDurations.C, tier: "C" },
            { name: "Simple button/component states", duration: tierDurations.C, tier: "C" },
            { name: "Copy changes", duration: tierDurations.D, tier: "D" },
            { name: "Icon/image updates", duration: tierDurations.D, tier: "D" },
            { name: "Spacing or padding adjustments", duration: tierDurations.D, tier: "D" },
            { name: "Color or font edits", duration: tierDurations.D, tier: "D" },
            { name: "Naming/layer cleanup", duration: tierDurations.D, tier: "D" },
            { name: "Auto layout adjustments", duration: tierDurations.D, tier: "D" },
          ],
        },
      },
    }),

    prisma.taskType.create({
      data: {
        name: "Graphic",
        categories: {
          create: [
            { name: "Complete visual identity", duration: tierDurations.S, tier: "S" },
            { name: "Complex brochure", duration: tierDurations.S, tier: "S" },
            { name: "Simple brochure (Bi-fold/Tri-fold)", duration: tierDurations.A, tier: "A" },
            { name: "Internal documents", duration: tierDurations.A, tier: "A" },
            { name: "Complex infographic", duration: tierDurations.A, tier: "A" },
            { name: "Basic brand manual", duration: tierDurations.A, tier: "A" },
            { name: "Full packaging design", duration: tierDurations.A, tier: "A" },
            { name: "Event/campaign graphic kit", duration: tierDurations.A, tier: "A" },
            { name: "Ad visuals", duration: tierDurations.A, tier: "A" },
            { name: "Social media for all brands", duration: tierDurations.A, tier: "A" },
            { name: "PowerPoint (19–28 slides)", duration: tierDurations.A, tier: "A" },
            { name: "Flyer or poster", duration: tierDurations.B, tier: "B" },
            { name: "PowerPoint template", duration: tierDurations.B, tier: "B" },
            { name: "Basic infographic", duration: tierDurations.B, tier: "B" },
            { name: "Complex updates in artworks", duration: tierDurations.B, tier: "B" },
            { name: "PowerPoint (12–18 slides)", duration: tierDurations.B, tier: "B" },
            { name: "Artwork resizing", duration: tierDurations.C, tier: "C" },
            { name: "Template-based artwork", duration: tierDurations.C, tier: "C" },
            { name: "Business card", duration: tierDurations.C, tier: "C" },
            { name: "Letterhead", duration: tierDurations.C, tier: "C" },
            { name: "Intermediate updates in artworks", duration: tierDurations.C, tier: "C" },
            { name: "PowerPoint (6–11 slides)", duration: tierDurations.C, tier: "C" },
            { name: "Text changes in artworks", duration: tierDurations.D, tier: "D" },
            { name: "Logo/image replacements", duration: tierDurations.D, tier: "D" },
            { name: "File export to other formats", duration: tierDurations.D, tier: "D" },
            { name: "Signature (Formerly operating as)", duration: tierDurations.D, tier: "D" },
            { name: "Simple info updates in artworks", duration: tierDurations.D, tier: "D" },
            { name: "Signature (Powered by)", duration: tierDurations.E, tier: "E" },
          ],
        },
      },
    }),
  ]);
  console.log("TaskTypes y TaskCategories creados.");

  // Crear usuarios con información de ClickUp
  console.log("Creando Usuarios...");
  await prisma.user.createMany({
    data: [
      { 
        name: "Erick Santos", 
        email: "esantos@inszoneins.com",
        id: "114240449", // ID de ClickUp
        active: true
      },
      { 
        name: "Diego Ganoza", 
        email: "dganoza@inszoneins.com",
        id: "114217194", // ID de ClickUp
        active: true
      },
      { 
        name: "Dayana Viggiani", 
        email: "dviggiani@inszoneins.com",
        id: "114217195", // ID de ClickUp
        active: true
      },
      // Puedes añadir más usuarios aquí si lo necesitas
    ],
  });
  console.log("Usuarios creados.");

  const allUsers = await prisma.user.findMany();

  // UserRoles (sin ratio)
  console.log("Creando UserRoles...");
  const userRoleData = [
    { user: allUsers.find(u => u.name === "Erick Santos"), types: [uxType], brandId: null },
    { user: allUsers.find(u => u.name === "Diego Ganoza"), types: [uxType], brandId: null },
    { user: allUsers.find(u => u.name === "Dayana Viggiani"), types: [graphicType], brandId: null },
    { user: allUsers.find(u => u.name === "Diego Ganoza"), types: [graphicType], brandId: null }
  ];

  const roles = userRoleData.flatMap(({ user, types, brandId }) => {
    if (!user) {
      console.warn(`Usuario no encontrado para crear roles. Saltando.`);
      return [];
    }
    return types.map((type) => ({
      userId: user.id,
      typeId: type.id,
      brandId: brandId,
    }));
  });

  await prisma.userRole.createMany({ data: roles, skipDuplicates: true }); // Usar skipDuplicates por si hay roles ya definidos
  console.log(`Created ${roles.length} user roles.`);

  console.log("✅ Seed completed successfully!");
  console.log(`Created ${allBrands.length} brands`);
  console.log(`Created ${allUsers.length} users`);
  console.log(`Created ${roles.length} user roles`);
}

main()
  .catch((e) => {
    console.error("Error durante el seeding:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
