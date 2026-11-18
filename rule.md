# Rules

## Pagination

If a list or table can have more than 10 items, apply pagination.

- Show 10 items per page. Never show more than 12.
- Use the shared helpers in `src/components/performance/table-pager.tsx`: `PagedTable` for tables and `PagedList` for lists (both work from server components), or `usePaged` plus `TablePager` when a client component filters or sorts its own rows.
- Show no pager when everything fits on one page.
- Go back to page 1 whenever a filter, search or tab changes the list.
