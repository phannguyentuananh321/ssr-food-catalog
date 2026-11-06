const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');

/**
 * PostgreSQL-native search configuration per entity.
 * The column lists are trusted constants (never user input), which is why they
 * can be interpolated into SQL identifiers safely.
 */
const ENTITY_CONFIG = {
  dish: {
    table: 'Dish',
    nameColumn: 'name',
    columns: ['name', 'description', 'category']
  },
  chef: {
    table: 'Chef',
    nameColumn: 'name',
    columns: ['name', 'title', 'description', 'experience']
  },
  ingredient: {
    table: 'Ingredient',
    nameColumn: 'name',
    columns: ['name', 'description', 'category']
  }
};

const DISH_SORT_SQL = {
  'price-asc': Prisma.sql`"price" ASC, "id" ASC`,
  'price-desc': Prisma.sql`"price" DESC, "id" ASC`,
  'name-asc': Prisma.sql`"name" ASC, "id" ASC`,
  'name-desc': Prisma.sql`"name" DESC, "id" ASC`
};

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function buildDocumentExpression(columns) {
  const textExpression = columns
    .map((column) => `coalesce(${quoteIdentifier(column)}, '')`)
    .join(" || ' ' || ");
  return `to_tsvector('simple', public.immutable_unaccent(${textExpression}))`;
}

/**
 * Build the shared WHERE / ORDER BY fragments for a PostgreSQL search.
 *
 * Search uses three complementary mechanisms, all executed by PostgreSQL:
 *   1. Full-text search  : to_tsvector('simple', ...) @@ websearch_to_tsquery(...)
 *   2. Fuzzy name match  : pg_trgm `%` operator (typo tolerance)
 *   3. Diacritic-insensitive substring match (handles short queries where trigrams
 *      do not produce a match)
 */
function buildSearchFilter({ entity, q, filters = [], sort }) {
  const config = ENTITY_CONFIG[entity];
  if (!config) {
    throw new Error(`Unknown search entity: ${entity}`);
  }

  const doc = Prisma.raw(buildDocumentExpression(config.columns));
  const name = Prisma.raw(quoteIdentifier(config.nameColumn));
  const query = Prisma.sql`public.immutable_unaccent(${q})`;
  const tsQuery = Prisma.sql`websearch_to_tsquery('simple', ${query})`;
  const tsRank = Prisma.sql`ts_rank(${doc}, ${tsQuery})`;
  const similarity = Prisma.sql`similarity(public.immutable_unaccent(${name}), ${query})`;

  const matchesFullText = Prisma.sql`${doc} @@ ${tsQuery}`;
  const matchesFuzzy = Prisma.sql`public.immutable_unaccent(${name}) % ${query}`;
  const matchesSubstring = Prisma.sql`position(lower(${query}) in lower(public.immutable_unaccent(${name}))) > 0`;

  const searchWhere = Prisma.sql`(${matchesFullText} OR ${matchesFuzzy} OR ${matchesSubstring})`;
  const filtersWhere = filters.length
    ? filters.reduce((accumulator, fragment) => Prisma.sql`${accumulator} AND ${fragment}`)
    : Prisma.sql`TRUE`;

  const relevanceOrder = Prisma.sql`(${tsRank} * 2 + ${similarity}) DESC, "createdAt" DESC, "id" DESC`;
  const orderSql = entity === 'dish' && DISH_SORT_SQL[sort]
    ? DISH_SORT_SQL[sort]
    : relevanceOrder;

  return {
    whereSql: Prisma.sql`${searchWhere} AND ${filtersWhere}`,
    orderSql
  };
}

/**
 * Resolve matching IDs inside PostgreSQL (search, filters, sort and pagination),
 * then return only the ID page. Callers hydrate those few rows with Prisma so
 * model relations/counts stay consistent.
 */
async function findMatchingIds({ entity, q, filters = [], sort, take, skip }) {
  const config = ENTITY_CONFIG[entity];
  const { whereSql, orderSql } = buildSearchFilter({ entity, q, filters, sort });
  const table = Prisma.raw(quoteIdentifier(config.table));

  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM ${table}
      WHERE ${whereSql}
    `),
    prisma.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM ${table}
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ${take}
      OFFSET ${skip}
    `)
  ]);

  return {
    totalItems: countRows[0] ? countRows[0].count : 0,
    ids: idRows.map((row) => row.id)
  };
}

module.exports = {
  ENTITY_CONFIG,
  buildDocumentExpression,
  buildSearchFilter,
  findMatchingIds
};
