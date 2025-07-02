// prisma/seed.cjs
// Para ejecutar: npx prisma db seed
// Asegúrate de que tu variable de entorno PRISMA_DATABASE_URL esté configurada.

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
  console.log("🌱 Iniciando proceso de seeding...");

  // ===============================================
  // 1. LIMPIEZA PREVIA
  // ===============================================
  console.log("🧹 Limpiando tablas existentes...");
  
  // Orden correcto para evitar errores de FK
  await prisma.syncLog.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.userVacation.deleteMany(); // ✅ NUEVO: Limpiar vacaciones
  await prisma.userRole.deleteMany();
  await prisma.taskCategory.deleteMany();
  await prisma.taskType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.brand.deleteMany();
  
  console.log("✅ Tablas limpiadas exitosamente");

  // ===============================================
  // 2. CREAR BRANDS
  // ===============================================
  console.log("🏢 Creando Brands...");
  
  const brandData = [
    {
      id: "901700182493",
      name: "Inszone",
      spaceId: "90170091121",
      folderId: "90120123456",
      teamId: "90170099166",
      isActive: true,
      description: "Main Inszone brand for insurance services",
      defaultStatus: "TO_DO",
      statusMapping: {
        "TO_DO": "to do",
        "IN_PROGRESS": "in progress", 
        "ON_APPROVAL": "review",
        "COMPLETE": "closed"
      }
    },
    {
      id: "901700182489",
      name: "R.E. Chaix",
      spaceId: "90170091121",
      folderId: "90120123456",
      teamId: "90170099166",
      isActive: true,
      description: "R.E. Chaix brand for specialized insurance",
      defaultStatus: "TO_DO",
      statusMapping: {
        "TO_DO": "open",
        "IN_PROGRESS": "in progress",
        "ON_APPROVAL": "pending review", 
        "COMPLETE": "done"
      }
    },
    {
      id: "901704229078",
      name: "Pinney",
      spaceId: "90170091121",
      folderId: "90120123456",
      teamId: "90170099166",
      isActive: true,
      description: "Pinney brand for life insurance solutions",
      defaultStatus: "TO_DO",
      statusMapping: {
        "TO_DO": "open",
        "IN_PROGRESS": "in progress",
        "ON_APPROVAL": "pending review", 
        "COMPLETE": "done"
      }
    },
  ];

  await prisma.brand.createMany({ data: brandData });
  
  const allBrands = await prisma.brand.findMany();
  console.log(`✅ ${allBrands.length} brands creados exitosamente`);

  // ===============================================
  // 3. CREAR TASK TYPES Y CATEGORIES
  // ===============================================
  console.log("📋 Creando TaskTypes y TaskCategories...");
  
  const [uxType, graphicType] = await Promise.all([
    // UX/UI Type con todas sus categorías
    prisma.taskType.create({
      data: {
        name: "UX/UI",
        categories: {
          create: [
            // Tier S - Proyectos más complejos (30 días)
            { name: "Full website with multiple levels", duration: tierDurations.S, tier: "S" },
            { name: "UX/UI for SaaS or B2B platform", duration: tierDurations.S, tier: "S" },
            { name: "Design system with documentation", duration: tierDurations.S, tier: "S" },
            { name: "Mobile app (15+ screens)", duration: tierDurations.S, tier: "S" },
            { name: "Validated MVP prototype", duration: tierDurations.S, tier: "S" },
            { name: "Cross-platform design", duration: tierDurations.S, tier: "S" },
            
            // Tier A - Proyectos grandes (21 días)
            { name: "Complex intranet section", duration: tierDurations.A, tier: "A" },
            { name: "Corporate website (5–7 sections)", duration: tierDurations.A, tier: "A" },
            { name: "Prototype with microinteractions", duration: tierDurations.A, tier: "A" },
            { name: "Intermediate design system", duration: tierDurations.A, tier: "A" },
            { name: "Dashboard with charts and filters", duration: tierDurations.A, tier: "A" },
            { name: "UX for onboarding or sign-up", duration: tierDurations.A, tier: "A" },
            { name: "Full redesign of site/app", duration: tierDurations.A, tier: "A" },
            
            // Tier B - Proyectos medianos (14 días)
            { name: "Simple intranet section", duration: tierDurations.B, tier: "B" },
            { name: "Landing page design", duration: tierDurations.B, tier: "B" },
            { name: "Complex internal pages", duration: tierDurations.B, tier: "B" },
            { name: "3–5 UI screens", duration: tierDurations.B, tier: "B" },
            { name: "Component with states/variants", duration: tierDurations.B, tier: "B" },
            { name: "Simple clickable prototype", duration: tierDurations.B, tier: "B" },
            { name: "Wireframes + simple mockup", duration: tierDurations.B, tier: "B" },
            { name: "Responsive views of same page", duration: tierDurations.B, tier: "B" },
            
            // Tier C - Proyectos pequeños (7 días)
            { name: "New section in existing page", duration: tierDurations.C, tier: "C" },
            { name: "Mobile version of a page", duration: tierDurations.C, tier: "C" },
            { name: "Simple view design", duration: tierDurations.C, tier: "C" },
            { name: "Web banner adaptation", duration: tierDurations.C, tier: "C" },
            { name: "Simple button/component states", duration: tierDurations.C, tier: "C" },
            
            // Tier D - Tareas pequeñas (3 días)
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

    // Graphic Type con todas sus categorías
    prisma.taskType.create({
      data: {
        name: "Graphic",
        categories: {
          create: [
            // Tier S - Proyectos más complejos (30 días)
            { name: "Complete visual identity", duration: tierDurations.S, tier: "S" },
            { name: "Complex brochure", duration: tierDurations.S, tier: "S" },
            
            // Tier A - Proyectos grandes (21 días)
            { name: "Simple brochure (Bi-fold/Tri-fold)", duration: tierDurations.A, tier: "A" },
            { name: "Internal documents", duration: tierDurations.A, tier: "A" },
            { name: "Complex infographic", duration: tierDurations.A, tier: "A" },
            { name: "Basic brand manual", duration: tierDurations.A, tier: "A" },
            { name: "Full packaging design", duration: tierDurations.A, tier: "A" },
            { name: "Event/campaign graphic kit", duration: tierDurations.A, tier: "A" },
            { name: "Ad visuals", duration: tierDurations.A, tier: "A" },
            { name: "Social media for all brands", duration: tierDurations.A, tier: "A" },
            { name: "PowerPoint (19–28 slides)", duration: tierDurations.A, tier: "A" },
            
            // Tier B - Proyectos medianos (14 días)
            { name: "Flyer or poster", duration: tierDurations.B, tier: "B" },
            { name: "PowerPoint template", duration: tierDurations.B, tier: "B" },
            { name: "Basic infographic", duration: tierDurations.B, tier: "B" },
            { name: "Complex updates in artworks", duration: tierDurations.B, tier: "B" },
            { name: "PowerPoint (12–18 slides)", duration: tierDurations.B, tier: "B" },
            
            // Tier C - Proyectos pequeños (7 días)
            { name: "Artwork resizing", duration: tierDurations.C, tier: "C" },
            { name: "Template-based artwork", duration: tierDurations.C, tier: "C" },
            { name: "Business card", duration: tierDurations.C, tier: "C" },
            { name: "Letterhead", duration: tierDurations.C, tier: "C" },
            { name: "Intermediate updates in artworks", duration: tierDurations.C, tier: "C" },
            { name: "PowerPoint (6–11 slides)", duration: tierDurations.C, tier: "C" },
            
            // Tier D - Tareas pequeñas (3 días)
            { name: "Text changes in artworks", duration: tierDurations.D, tier: "D" },
            { name: "Logo/image replacements", duration: tierDurations.D, tier: "D" },
            { name: "File export to other formats", duration: tierDurations.D, tier: "D" },
            { name: "Signature (Formerly operating as)", duration: tierDurations.D, tier: "D" },
            { name: "Simple info updates in artworks", duration: tierDurations.D, tier: "D" },
            
            // Tier E - Tareas muy pequeñas (0.5 días)
            { name: "Signature (Powered by)", duration: tierDurations.E, tier: "E" },
          ],
        },
      },
    }),
  ]);
  
  console.log(`✅ TaskTypes y TaskCategories creados: UX/UI (${uxType.id}), Graphic (${graphicType.id})`);

  // ===============================================
  // 4. CREAR USUARIOS
  // ===============================================
  console.log("👥 Creando Usuarios...");
  
  const userData = [
    { 
      id: "114240449", // ClickUp ID
      name: "Erick Santos", 
      email: "esantos@inszoneins.com",
      active: true
    },
    { 
      id: "114217194", // ClickUp ID
      name: "Diego Ganoza", 
      email: "dganoza@inszoneins.com",
      active: true
    },
    { 
      id: "114217195", // ClickUp ID
      name: "Dayana Viggiani", 
      email: "dviggiani@inszoneins.com",
      active: true
    },
  ];

  await prisma.user.createMany({ data: userData });
  
  const allUsers = await prisma.user.findMany();
  console.log(`✅ ${allUsers.length} usuarios creados exitosamente`);

  // ===============================================
  // 5. CREAR USER ROLES
  // ===============================================
  console.log("🎭 Creando UserRoles...");
  
  const userRoleData = [
    // Erick Santos - Especialista en UX/UI
    { user: allUsers.find(u => u.name === "Erick Santos"), types: [uxType], brandId: null },
    
    // Diego Ganoza - Generalista (UX/UI + Graphic)
    { user: allUsers.find(u => u.name === "Diego Ganoza"), types: [uxType, graphicType], brandId: null },
    
    // Dayana Viggiani - Especialista en Graphic
    { user: allUsers.find(u => u.name === "Dayana Viggiani"), types: [graphicType], brandId: null },
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

  await prisma.userRole.createMany({ data: roles, skipDuplicates: true });
  console.log(`✅ ${roles.length} user roles creados exitosamente`);

  // ===============================================
  // 6. ✅ NUEVO: CREAR VACACIONES DE USUARIOS
  // ===============================================
  console.log("🏖️ Creando vacaciones de usuarios (para testing)...");
  
  const vacationData = [
    // Erick Santos - Vacaciones futuras para testing de reglas de negocio
    {
      userId: "114240449", // Erick Santos
      startDate: new Date("2025-08-15T00:00:00Z"), // 15 de agosto 2025
      endDate: new Date("2025-08-25T23:59:59Z"),   // 25 de agosto 2025 (10 días)
    },
    {
      userId: "114240449", // Erick Santos
      startDate: new Date("2025-12-20T00:00:00Z"), // 20 de diciembre 2025
      endDate: new Date("2026-01-05T23:59:59Z"),   // 5 de enero 2026 (vacaciones navideñas)
    },
    
    // Diego Ganoza - Vacaciones cercanas para testing
    {
      userId: "114217194", // Diego Ganoza
      startDate: new Date("2025-07-20T00:00:00Z"), // 20 de julio 2025
      endDate: new Date("2025-07-27T23:59:59Z"),   // 27 de julio 2025 (1 semana)
    },
    
    // Dayana Viggiani - Sin vacaciones por ahora (para tener un control)
    // Esto permite testear usuarios sin conflictos de vacaciones
  ];

  await prisma.userVacation.createMany({ data: vacationData });
  console.log(`✅ ${vacationData.length} períodos de vacaciones creados`);

  // ===============================================
  // 7. ✅ NUEVO: CREAR TAREAS DE EJEMPLO (OPCIONAL)
  // ===============================================
  console.log("📝 Creando tareas de ejemplo para testing...");
  
  // Obtener algunas categorías para las tareas de ejemplo
  const sampleUXCategory = await prisma.taskCategory.findFirst({
    where: { typeId: uxType.id, tier: "C" }
  });
  
  const sampleGraphicCategory = await prisma.taskCategory.findFirst({
    where: { typeId: graphicType.id, tier: "C" }
  });

  if (sampleUXCategory && sampleGraphicCategory) {
    // Función helper para calcular fechas de trabajo
    const calculateWorkingDates = (startDate, durationDays) => {
      const start = new Date(startDate);
      const deadline = new Date(start);
      deadline.setUTCDate(start.getUTCDate() + durationDays);
      return { start, deadline };
    };

    const baseDate = new Date("2025-07-01T15:00:00Z"); // 1 de julio, 10 AM Perú
    
    const sampleTasks = [
      {
        id: `sample_task_${Date.now()}_1`,
        name: "Sample UX Task - Landing Page Redesign",
        description: "Redesign of the main landing page for better conversion",
        status: "TO_DO",
        priority: "NORMAL",
        ...calculateWorkingDates(baseDate, sampleUXCategory.duration),
        queuePosition: 0,
        typeId: uxType.id,
        categoryId: sampleUXCategory.id,
        brandId: allBrands[0].id, // Inszone
        lastSyncAt: new Date(),
        syncStatus: "SYNCED",
      },
      {
        id: `sample_task_${Date.now()}_2`,
        name: "Sample Graphic Task - Business Card Design",
        description: "New business card design for R.E. Chaix brand",
        status: "TO_DO",
        priority: "LOW",
        ...calculateWorkingDates(new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000), sampleGraphicCategory.duration),
        queuePosition: 0,
        typeId: graphicType.id,
        categoryId: sampleGraphicCategory.id,
        brandId: allBrands[1].id, // R.E. Chaix
        lastSyncAt: new Date(),
        syncStatus: "SYNCED",
      }
    ];

    // Crear las tareas de ejemplo
    for (const taskData of sampleTasks) {
      const { start, deadline, ...taskCreateData } = taskData;
      
      const task = await prisma.task.create({
        data: {
          ...taskCreateData,
          startDate: start,
          deadline: deadline,
        }
      });

      // Asignar la primera tarea a Erick (UX) y la segunda a Dayana (Graphic)
      const assigneeId = taskData.typeId === uxType.id ? "114240449" : "114217195";
      
      await prisma.taskAssignment.create({
        data: {
          userId: assigneeId,
          taskId: task.id,
        }
      });
    }
    
    console.log(`✅ ${sampleTasks.length} tareas de ejemplo creadas`);
  }

  // ===============================================
  // 8. RESUMEN FINAL
  // ===============================================
  console.log("\n🎉 ===============================================");
  console.log("✅ SEED COMPLETADO EXITOSAMENTE!");
  console.log("===============================================");
  console.log(`📊 Resumen de datos creados:`);
  console.log(`   🏢 Brands: ${allBrands.length}`);
  console.log(`   👥 Usuarios: ${allUsers.length}`);
  console.log(`   🎭 User Roles: ${roles.length}`);
  console.log(`   📋 Task Types: 2 (UX/UI, Graphic)`);
  console.log(`   🏷️  Task Categories: ${Object.keys(tierDurations).length * 2} total`);
  console.log(`   🏖️  Vacaciones: ${vacationData.length} períodos`);
  console.log(`   📝 Tareas de ejemplo: 2`);
  console.log("\n💡 Datos listos para testing del sistema de asignación!");
  console.log("🧪 Puedes usar estos datos para probar:");
  console.log("   • Asignación automática vs manual");
  console.log("   • Reglas de prioridad en cola");
  console.log("   • Gestión de vacaciones");
  console.log("   • Cálculo de fechas laborales");
  console.log("===============================================\n");
}

main()
  .catch((e) => {
    console.error("❌ Error durante el seeding:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());