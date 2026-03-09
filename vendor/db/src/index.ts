/**
 * Lightweight database SDK for Lightfast infrastructure
 * Provides common database utilities and PlanetScale integration
 */

export { alias } from "drizzle-orm/pg-core";
// Export Drizzle ORM SQL utilities — type-only exports
export type {
  BinaryOperator,
  BuildQueryConfig,
  Chunk,
  ColumnsSelection,
  DriverValueDecoder,
  DriverValueEncoder,
  DriverValueMapper,
  GetDecoderResult,
  InferSelectViewModel,
  Query,
  QueryTypingsValue,
  QueryWithTypings,
  SQLChunk,
  SQLWrapper,
} from "drizzle-orm/sql";
// Export Drizzle ORM SQL utilities — value exports
export {
  and,
  arrayContained,
  arrayContains,
  arrayOverlaps,
  asc,
  avg,
  avgDistinct,
  between,
  bindIfParam,
  cosineDistance,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  FakePrimitiveParam,
  fillPlaceholders,
  getViewName,
  gt,
  gte,
  hammingDistance,
  ilike,
  inArray,
  innerProduct,
  isDriverValueEncoder,
  isNotNull,
  isNull,
  isSQLWrapper,
  isView,
  jaccardDistance,
  l1Distance,
  l2Distance,
  like,
  lt,
  lte,
  max,
  min,
  Name,
  name,
  ne,
  noopDecoder,
  noopEncoder,
  noopMapper,
  not,
  notBetween,
  notExists,
  notIlike,
  notInArray,
  notLike,
  or,
  Param,
  Placeholder,
  param,
  placeholder,
  SQL,
  StringChunk,
  sql,
  sum,
  sumDistinct,
  View,
} from "drizzle-orm/sql";
export type {
  DatabaseConfig,
  PlanetScaleConfig,
  PlanetScaleDatabase,
} from "./planetscale";
// Export PlanetScale SDK
export {
  Client,
  createDatabase,
  createPlanetScaleClient,
  drizzle,
} from "./planetscale";
export { createDrizzleConfig } from "./utils/create-drizzle-config";
export type {
  BuildRefine,
  BuildSchema,
  ColumnIsGeneratedAlwaysAs,
  Conditions,
  CreateInsertSchema,
  CreateSchemaFactoryOptions,
  CreateSelectSchema,
  CreateUpdateSchema,
  GetSelection,
  GetZodType,
  HandleColumn,
  IsNever,
  Json,
  NoUnknownKeys,
} from "./utils/drizzle-zod";
// Export shared utilities
export {
  bufferSchema,
  createInsertSchema,
  createSchemaFactory,
  createSelectSchema,
  createUpdateSchema,
  isColumnType,
  isPgEnum,
  isWithEnum,
  jsonSchema,
  literalSchema,
} from "./utils/drizzle-zod";

// Note: Individual database schemas (chat, cloud) are now in their own packages
// This package provides the shared infrastructure layer
