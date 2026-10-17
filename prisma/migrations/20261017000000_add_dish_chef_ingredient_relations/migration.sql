-- Add explicit many-to-many relations linking Dish <-> Ingredient and Dish <-> Chef.
-- This migration only ADDS new tables, indexes and foreign keys. It does not modify
-- or delete any existing data.
--
-- Delete policy:
--   * Deleting a Dish cascades to its own join rows (DishIngredient / DishChef).
--   * Deleting an Ingredient or Chef used by a Dish is RESTRICTed at the database
--     level (and additionally guarded in the application layer with a clear message).

-- CreateTable
CREATE TABLE "DishIngredient" (
    "id" SERIAL NOT NULL,
    "dishId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DishIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishChef" (
    "id" SERIAL NOT NULL,
    "dishId" INTEGER NOT NULL,
    "chefId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DishChef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DishIngredient_dishId_idx" ON "DishIngredient"("dishId");

-- CreateIndex
CREATE INDEX "DishIngredient_ingredientId_idx" ON "DishIngredient"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "DishIngredient_dishId_ingredientId_key" ON "DishIngredient"("dishId", "ingredientId");

-- CreateIndex
CREATE INDEX "DishChef_dishId_idx" ON "DishChef"("dishId");

-- CreateIndex
CREATE INDEX "DishChef_chefId_idx" ON "DishChef"("chefId");

-- CreateIndex
CREATE UNIQUE INDEX "DishChef_dishId_chefId_key" ON "DishChef"("dishId", "chefId");

-- AddForeignKey
ALTER TABLE "DishIngredient" ADD CONSTRAINT "DishIngredient_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishIngredient" ADD CONSTRAINT "DishIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishChef" ADD CONSTRAINT "DishChef_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishChef" ADD CONSTRAINT "DishChef_chefId_fkey" FOREIGN KEY ("chefId") REFERENCES "Chef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
