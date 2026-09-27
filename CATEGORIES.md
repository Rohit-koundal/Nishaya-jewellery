# Categories and subcategories

## Owner workflow

1. Open **Admin → Categories & subcategories** (`/admin/categories`). Create top-level categories such as Earrings, Necklaces, Rings and Bangles. The feature does not insert or replace any live categories automatically.
2. Use **+ Subcategory** beside a category, for example Earrings → Jhumkas → Silver Jhumkas. Images, descriptions, SEO, ordering and visibility are configurable per node. Up to six levels are supported; two or three are usually sufficient for this catalogue.
3. In Add/Edit Product, Quick Add, social import or draft review, select the category followed by the appropriate subcategory. The most specific selected node is saved. Products may still belong directly to a parent.
4. Publish parents before their children. Customer navigation uses published data, including the desktop category menu, mobile menu, category landing pages, filters and product breadcrumbs.

## Compatibility and safety

- There is still one canonical `Product.category` / `ProductDraft.category` reference. Existing product IDs, category IDs, orders, inventory, payments and image storage are not migrated or deleted.
- The historical free-text `subCategory` remains optional **Product type (optional / legacy)**. It is not silently converted into catalogue nodes, deleted, or overwritten when category selection changes. Existing free-text values can be curated into managed categories by the admin if desired.
- `/products?category=<id|slug|name>` continues to work, including stored previous slugs. A parent selection includes descendants. Multiple selected categories form a union without duplicate products. Pagination, search and facet counts use the same hierarchy.
- New child slugs include the parent slug to disambiguate repeated names. Slugs remain editable. Duplicate sibling names/slugs, self-parenting, cycles, invalid depth and cross-store moves are rejected.
- Hiding or archiving a category hides the branch from navigation. This does **not** delete or unpublish its products; separately hide products if they must no longer be purchasable or discoverable through Shop All/search. Restored categories start hidden.
- Move-and-archive reassigns products, drafts and category-targeted coupons from the entire branch. It rejects destinations inside the source branch and uses a MongoDB transaction on Atlas/replica sets. Historical order snapshots are untouched. Standalone MongoDB uses the application's existing sequential transaction fallback; production should use Atlas/replica sets.
- Permanent deletion is blocked while products, drafts, coupons or child categories are linked. Review the impact dialog before archive/reassignment.
- Category-specific product templates resolve from the most specific managed node, falling back to a mapped ancestor; legacy root-category template behaviour remains supported.
- A coupon targeting a parent includes its descendant products, with all other coupon restrictions unchanged. The stored coupon targeting is not expanded or rewritten just to evaluate an order.
- Public hierarchy reads are store-scoped and suppress hidden ancestors, orphans and malformed cycles. Existing platform-admin access rules are unchanged.

## Release checklist

Deploy backend and frontend together (backend first). No new environment variables or destructive migration are required. Production deployment has not been performed by this change.

Before a client demo, create/review the real categories, assign a test product, then check: parent page → child page → product → cart/checkout; mobile and desktop navigation; parent/child coupon preview; hide/restore; and an existing bookmarked category URL. Do not run test fixtures against the live database.

## Tests

The generated managed build requires licence credentials for commerce writes. The explicit **test-only** setup below supplies a licence fixture; it does not change application licensing. The shared test harness clears production credentials and uses an isolated MongoDB test replica set.

```powershell
cd backend
node --test --require ./tests/catalogTestSetup.js --test-concurrency=1 tests/categoryHierarchy.test.js tests/coupons.test.js tests/orders.test.js tests/cart.test.js tests/variants.test.js tests/productPricingService.test.js
```

Frontend coverage includes the category picker, tree utilities, menu, category landing, existing forms/drafts/imports, filters and admin workflows. Run `npm test -- --watch=false --runInBand`, then `npm run build` from the project root.
