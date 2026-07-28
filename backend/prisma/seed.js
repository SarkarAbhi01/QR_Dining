const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding demo data...");

  const password = await bcrypt.hash("Password@123", 10);

  // ---- Super Admin (platform owner) ----
  await prisma.user.upsert({
    where: { email: "superadmin@qrdining.com" },
    update: {},
    create: {
      name: "Platform Owner",
      email: "superadmin@qrdining.com",
      password,
      role: "SUPER_ADMIN",
    },
  });

  // ---- Demo Restaurant ----
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "spice-junction-demo" },
    update: {},
    create: {
      name: "Spice Junction",
      slug: "spice-junction-demo",
      address: "MP Nagar, Bhopal",
      phone: "9876543210",
      gstPercent: 5,
      subscriptionPlan: "MONTHLY",
      subscriptionStatus: "ACTIVE",
      subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@spicejunction.com" },
    update: {},
    create: {
      name: "Ramesh Sharma",
      email: "admin@spicejunction.com",
      password,
      role: "RESTAURANT_ADMIN",
      restaurantId: restaurant.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "chef@spicejunction.com" },
    update: {},
    create: {
      name: "Chef Vikram",
      email: "chef@spicejunction.com",
      password,
      role: "CHEF",
      restaurantId: restaurant.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "waiter@spicejunction.com" },
    update: {},
    create: {
      name: "Suresh (Waiter)",
      email: "waiter@spicejunction.com",
      password,
      role: "WAITER",
      restaurantId: restaurant.id,
    },
  });

  // ---- Tables ----
  for (const num of ["T1", "T2", "T3", "T4"]) {
    await prisma.restaurantTable.upsert({
      where: { restaurantId_tableNumber: { restaurantId: restaurant.id, tableNumber: num } },
      update: {},
      create: { restaurantId: restaurant.id, tableNumber: num, capacity: 4 },
    });
  }

  // ---- Menu ----
  const starters = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Starters", sortOrder: 1 },
  });
  const mains = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Main Course", sortOrder: 2 },
  });
  const beverages = await prisma.category.create({
    data: { restaurantId: restaurant.id, name: "Beverages", sortOrder: 3 },
  });

  await prisma.menuItem.createMany({
    data: [
      {
        restaurantId: restaurant.id,
        categoryId: starters.id,
        name: "Paneer Tikka",
        description: "Char-grilled cottage cheese marinated in spiced yogurt",
        price: 220,
        isVeg: true,
        variants: [{ label: "Half", price: 140 }, { label: "Full", price: 220 }],
      },
      {
        restaurantId: restaurant.id,
        categoryId: starters.id,
        name: "Chicken Seekh Kebab",
        description: "Minced chicken skewers with house spices",
        price: 260,
        isVeg: false,
      },
      {
        restaurantId: restaurant.id,
        categoryId: mains.id,
        name: "Dal Makhani",
        description: "Slow-cooked black lentils finished with cream",
        price: 190,
        isVeg: true,
      },
      {
        restaurantId: restaurant.id,
        categoryId: mains.id,
        name: "Butter Chicken",
        description: "Tandoori chicken in a rich tomato-butter gravy",
        price: 280,
        isVeg: false,
      },
      {
        restaurantId: restaurant.id,
        categoryId: beverages.id,
        name: "Masala Chaas",
        description: "Spiced buttermilk",
        price: 60,
        isVeg: true,
      },
    ],
  });

  console.log("✅ Seed complete.");
  console.log("---------------------------------------------");
  console.log("Super Admin  -> superadmin@qrdining.com / Password@123");
  console.log("Restaurant Admin -> admin@spicejunction.com / Password@123");
  console.log("Chef -> chef@spicejunction.com / Password@123");
  console.log("Waiter -> waiter@spicejunction.com / Password@123");
  console.log("---------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
