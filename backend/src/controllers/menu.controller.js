const prisma = require("../config/db");

/** POST /api/restaurants/:restaurantId/categories */
async function createCategory(req, res) {
  const { restaurantId } = req.params;
  const { name, sortOrder } = req.body;
  const category = await prisma.category.create({
    data: { restaurantId, name, sortOrder: sortOrder || 0 },
  });
  res.status(201).json(category);
}

/** GET /api/restaurants/:restaurantId/categories */
async function listCategories(req, res) {
  const categories = await prisma.category.findMany({
    where: { restaurantId: req.params.restaurantId },
    orderBy: { sortOrder: "asc" },
  });
  res.json(categories);
}

/** POST /api/restaurants/:restaurantId/menu-items */
async function createMenuItem(req, res) {
  const { restaurantId } = req.params;
  const { categoryId, name, description, price, imageUrl, isVeg, variants } = req.body;

  const item = await prisma.menuItem.create({
    data: { restaurantId, categoryId, name, description, price, imageUrl, isVeg, variants },
  });
  res.status(201).json(item);
}

/** GET /api/restaurants/:restaurantId/menu-items */
async function listMenuItems(req, res) {
  const items = await prisma.menuItem.findMany({
    where: { restaurantId: req.params.restaurantId },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
}

/** PATCH /api/menu-items/:id — edit price, photo, availability, etc. */
async function updateMenuItem(req, res) {
  const data = req.body;
  const item = await prisma.menuItem.update({ where: { id: req.params.id }, data });
  res.json(item);
}

/** PATCH /api/menu-items/:id/availability — quick 86'd / back-in-stock toggle */
async function toggleAvailability(req, res) {
  const existing = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
  const item = await prisma.menuItem.update({
    where: { id: req.params.id },
    data: { isAvailable: !existing.isAvailable },
  });
  res.json(item);
}

/** DELETE /api/menu-items/:id */
async function deleteMenuItem(req, res) {
  await prisma.menuItem.delete({ where: { id: req.params.id } });
  res.status(204).send();
}

module.exports = {
  createCategory,
  listCategories,
  createMenuItem,
  listMenuItems,
  updateMenuItem,
  toggleAvailability,
  deleteMenuItem,
};
