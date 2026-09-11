# THE Cafe — combined design direction

Public menu: `index.html`

Functional reference/admin starter: `admin.html`

Data reference: `data_menu_reference.json`

Assets: `assets/`

## Intended next architecture
- menu_items: one canonical item record
- categories: beverage/food/fitness categories
- item_categories: many-to-many placements so one item can appear in multiple categories
- events: title, poster, date, time, short/long description, registration URL, status, featured, sort order
- site_settings: branding, hero, rotating phrases, contact, hours, social links, footer copy
- Supabase Auth + Storage when moved beyond the static GitHub Pages phase

The current static version deliberately keeps the public site deployable on GitHub Pages.
