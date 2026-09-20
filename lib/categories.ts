import { Product, Category } from "@/models";

/**
 * Update the product count for a single category
 */
export async function updateCategoryProductCount(
  categoryId: string
): Promise<number> {
  const count = await Product.countDocuments({
    category: categoryId,
    status: "active",
  });

  await Category.updateOne({ _id: categoryId }, { productCount: count });
  return count;
}

/**
 * Sync product counts when a product's category changes.
 * Call this after product create/update/delete.
 */
export async function syncProductCategory(
  oldCategoryId: string | null | undefined,
  newCategoryId: string | null | undefined
): Promise<void> {
  const idsToUpdate = new Set<string>();

  if (oldCategoryId) idsToUpdate.add(String(oldCategoryId));
  if (newCategoryId) idsToUpdate.add(String(newCategoryId));

  for (const id of idsToUpdate) {
    await updateCategoryProductCount(id);
  }
}

/**
 * Update product counts for all categories.
 * Useful for background jobs or after bulk product updates.
 */
export async function updateAllCategoryProductCounts(): Promise<void> {
  const categories = await Category.find({}).select("_id").lean();

  for (const category of categories) {
    await updateCategoryProductCount(category._id.toString());
  }
}
