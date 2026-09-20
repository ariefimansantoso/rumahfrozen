export const MAX_MEGA_MENU_DEPTH = 3;
export const MAX_MEGA_MENU_ROOT_ITEMS = 7;
export const MAX_MEGA_MENU_LEVEL_2_ITEMS = 8;
export const MAX_MEGA_MENU_LEVEL_3_ITEMS = 7;

export type NestedMenuItem = {
  children?: NestedMenuItem[];
};

export function countMenuTreeItems(items: NestedMenuItem[] = []): number {
  return items.reduce(
    (count, item) => count + 1 + countMenuTreeItems(item.children || []),
    0,
  );
}

export function getMenuTreeMaxDepth(
  items: NestedMenuItem[] = [],
  depth = 1,
): number {
  return items.reduce((maxDepth, item) => {
    const itemDepth = Math.max(
      depth,
      getMenuTreeMaxDepth(item.children || [], depth + 1),
    );
    return Math.max(maxDepth, itemDepth);
  }, 0);
}

export function trimMenuTreeDepth<T extends { children?: T[] }>(
  items: T[] = [],
  maxDepth = MAX_MEGA_MENU_DEPTH,
  depth = 1,
): { items: T[]; trimmedCount: number } {
  let trimmedCount = 0;

  const trimmedItems = items.map((item) => {
    const children = Array.isArray(item.children) ? item.children : [];
    if (depth >= maxDepth) {
      trimmedCount += countMenuTreeItems(children);
      return { ...item, children: [] };
    }

    const trimmed = trimMenuTreeDepth(children, maxDepth, depth + 1);
    trimmedCount += trimmed.trimmedCount;
    return { ...item, children: trimmed.items };
  });

  return { items: trimmedItems, trimmedCount };
}
