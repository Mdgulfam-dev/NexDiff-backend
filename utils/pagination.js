const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toPositiveInt = (value, fallback) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const getPagination = (query = {}, options = {}) => {
  const defaultLimit = options.defaultLimit || DEFAULT_LIMIT;
  const maxLimit = options.maxLimit || MAX_LIMIT;
  const page = toPositiveInt(query.page, 1);
  const requestedLimit = toPositiveInt(query.limit, defaultLimit);
  const limit = Math.min(requestedLimit, maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const createPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

module.exports = {
  getPagination,
  createPaginationMeta,
};
