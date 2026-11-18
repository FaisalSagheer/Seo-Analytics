# Rules

## Pagination

If a list or table can have more than 10 items, apply pagination.

- Show 10 items per page. Never show more than 12.
- Use the shared `TablePager` and `PAGE_SIZE` from `src/components/performance/table-pager.tsx`.
- Show no pager when everything fits on one page.
- Go back to page 1 whenever a filter, search or tab changes the list.
