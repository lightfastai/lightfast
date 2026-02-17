/**
 * Lightweight database SDK for Lightfast infrastructure
 * Provides common database utilities and PlanetScale integration
 */

// Export PlanetScale SDK
export { createPlanetScaleClient, createDatabase } from "./planetscale";
export { drizzle } from "./planetscale";
export { Client } from "./planetscale";
export type { DatabaseConfig, PlanetScaleDatabase, PlanetScaleConfig } from "./planetscale";

// Export Drizzle ORM SQL utilities — value exports
export {
  FakePrimitiveParam,
  isSQLWrapper,
  StringChunk,
  SQL,
  Name,
  name,
  isDriverValueEncoder,
  noopDecoder,
  noopEncoder,
  noopMapper,
  Param,
  param,
  sql,
  Placeholder,
  placeholder,
  fillPlaceholders,
  View,
  isView,
  getViewName,
  bindIfParam,
  eq,
  ne,
  and,
  or,
  not,
  gt,
  gte,
  lt,
  lte,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  exists,
  notExists,
  between,
  notBetween,
  like,
  notLike,
  ilike,
  notIlike,
  arrayContains,
  arrayContained,
  arrayOverlaps,
  asc,
  desc,
  count,
  countDistinct,
  avg,
  avgDistinct,
  sum,
  sumDistinct,
  max,
  min,
  l2Distance,
  l1Distance,
  innerProduct,
  cosineDistance,
  hammingDistance,
  jaccardDistance,
} from "drizzle-orm/sql";
export { alias } from "drizzle-orm/pg-core";

// Export Drizzle ORM SQL utilities — type-only exports
export type {
  Chunk,
  BuildQueryConfig,
  QueryTypingsValue,
  Query,
  QueryWithTypings,
  SQLWrapper,
  GetDecoderResult,
  DriverValueDecoder,
  DriverValueEncoder,
  DriverValueMapper,
  SQLChunk,
  ColumnsSelection,
  InferSelectViewModel,
  BinaryOperator,
} from "drizzle-orm/sql";

// Export shared utilities
export { createSelectSchema, createInsertSchema, createUpdateSchema, createSchemaFactory } from "./utils/drizzle-zod";
export { isColumnType, isWithEnum, isPgEnum } from "./utils/drizzle-zod";
export { bufferSchema, jsonSchema, literalSchema } from "./utils/drizzle-zod";
export type { GetEnumValuesFromColumn, GetBaseColumn, GetZodType, HandleColumn } from "./utils/drizzle-zod";
export type { CreateSelectSchema, CreateInsertSchema, CreateUpdateSchema, CreateSchemaFactoryOptions } from "./utils/drizzle-zod";
export type { Conditions, BuildRefineColumns, BuildRefine, BuildSchema, NoUnknownKeys } from "./utils/drizzle-zod";
export type { Json, IsNever, ArrayHasAtLeastOneValue, ColumnIsGeneratedAlwaysAs, RemoveNever, GetSelection } from "./utils/drizzle-zod";
export { createDrizzleConfig } from "./utils/create-drizzle-config";

// Note: Individual database schemas (chat, cloud) are now in their own packages
// This package provides the shared infrastructure layer
