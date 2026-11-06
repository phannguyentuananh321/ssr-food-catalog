const VIEW_MODES = ['pages', 'load-more', 'infinite'];

function normalizePage(value) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value, fallback = 9) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(50, parsed);
}

function normalizeViewMode(value) {
  return VIEW_MODES.includes(value) ? value : 'pages';
}

function buildPagination({ totalItems, page, limit }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  return {
    totalItems,
    totalPages,
    page,
    limit,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    prevPage: page - 1,
    nextPage: page + 1
  };
}

module.exports = {
  VIEW_MODES,
  normalizePage,
  normalizeLimit,
  normalizeViewMode,
  buildPagination
};
