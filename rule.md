# Rules

## Pagination

If a list or table can have more than 10 items, apply pagination.

- Show 10 items per page. Never show more than 12.
- Use the shared helpers in `src/components/performance/table-pager.tsx`: `PagedTable` for tables and `PagedList` for lists (both work from server components), or `usePaged` plus `TablePager` when a client component filters or sorts its own rows.
- Show no pager when everything fits on one page.
- Go back to page 1 whenever a filter, search or tab changes the list.

## Filters

When a page shows counts broken down by category (status cards, totals per type), the list below them gets a filter dropdown over those same categories.

- Use a dropdown (`Pick` in `src/components/shopping/fields.tsx`, or `SearchParamSelect` when the server filters), not a row of buttons.
- Put the count in each option, e.g. "Disapproved (28)", counted from the rows the option shows.
- Include an "All" option and select it by default.
