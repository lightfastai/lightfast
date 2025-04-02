import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type { UniformFieldValue } from "../types/field";
import { $Boolean, $Vec2, ValueType } from "../types/schema";

export enum IndexChannel {
  RGBA_INDEPENDENT = "rgba_independent",
  LUMINANCE = "luminance",
  RGBA_AVERAGE = "rgba_average",
  ALPHA = "alpha",
}

export const $Lookup = z.object({
  u_texture1: z
    .number()
    .nullable()
    .describe("The input texture to apply the lookup table to"),
  u_texture2: z
    .number()
    .nullable()
    .describe("The lookup table texture (1D or 2D)"),
  u_indexRange: $Vec2
    .describe("The index range that maps to the lookup table's start and end")
    .default({ x: 0.0, y: 1.0 }),
  u_indexChannel: z
    .enum([
      IndexChannel.RGBA_INDEPENDENT,
      IndexChannel.LUMINANCE,
      IndexChannel.RGBA_AVERAGE,
      IndexChannel.ALPHA,
    ])
    .describe("How the color from the input is turned into an index")
    .default(IndexChannel.RGBA_INDEPENDENT),
  u_independentAlpha: $Boolean
    .describe("Whether to handle alpha channel independently")
    .default(false),
  u_darkUV: $Vec2
    .describe("UV position for dark end of lookup table")
    .default({ x: 0.0, y: 0.0 }),
  u_lightUV: $Vec2
    .describe("UV position for light end of lookup table")
    .default({ x: 1.0, y: 0.0 }),
  u_displayLookup: $Boolean
    .describe("Output the lookup table itself instead of transformed colors")
    .default(false),
});

export type LookupParams = z.infer<typeof $Lookup>;

export const LookupJsonSchema = zodToJsonSchema($Lookup) as JSONSchema7;

export const LookupDescription =
  "Applies a lookup table transformation to the input texture, allowing for color grading and correction. Uses UV-based lookup tables with various indexing methods.";

export const createDefaultLookup = (): LookupParams => {
  return $Lookup.parse({
    u_texture1: null,
    u_texture2: null,
    u_indexRange: { x: 0.0, y: 1.0 },
    u_indexChannel: IndexChannel.RGBA_INDEPENDENT,
    u_independentAlpha: false,
    u_darkUV: { x: 0.0, y: 0.0 },
    u_lightUV: { x: 1.0, y: 0.0 },
    u_displayLookup: false,
  });
};

// Lookup table for lookup uniform constraints
export const LOOKUP_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_indexRange: {
    type: ValueType.Vec2,
    label: "Index Range",
    constraint: {
      x: { min: 0, max: 1, step: 0.1 },
      y: { min: 0, max: 1, step: 0.1 },
    },
  },
  u_indexChannel: {
    type: ValueType.Enum,
    label: "Index Channel",
    constraint: {
      options: [
        { value: IndexChannel.RGBA_INDEPENDENT, label: "RGBA Independent" },
        { value: IndexChannel.LUMINANCE, label: "Luminance" },
        { value: IndexChannel.RGBA_AVERAGE, label: "RGBA Average" },
        { value: IndexChannel.ALPHA, label: "Alpha" },
      ],
    },
  },
  u_independentAlpha: {
    type: ValueType.Boolean,
    label: "Independent Alpha",
  },
  u_darkUV: {
    type: ValueType.Vec2,
    label: "Dark UV",
    constraint: {
      x: { min: 0, max: 1, step: 0.01 },
      y: { min: 0, max: 1, step: 0.01 },
    },
  },
  u_lightUV: {
    type: ValueType.Vec2,
    label: "Light UV",
    constraint: {
      x: { min: 0, max: 1, step: 0.01 },
      y: { min: 0, max: 1, step: 0.01 },
    },
  },
  u_displayLookup: {
    type: ValueType.Boolean,
    label: "Display Lookup",
  },
};

export const lookupFragmentShader = `
precision highp float;

uniform sampler2D u_texture1; // Input texture
uniform sampler2D u_texture2; // Lookup texture
uniform vec2 u_indexRange;
uniform int u_indexChannel; // 0 = RGBA Independent, 1 = Luminance, 2 = RGBA Average, 3 = Alpha
uniform bool u_independentAlpha;
uniform vec2 u_darkUV;
uniform vec2 u_lightUV;
uniform bool u_displayLookup;
varying vec2 vUv;

// Calculate luminance from RGB
float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

// Calculate average from RGBA
float average(vec4 color) {
  return (color.r + color.g + color.b + color.a) * 0.25;
}

// Map value to index range
float mapToIndexRange(float value) {
  return (value - u_indexRange.x) / (u_indexRange.y - u_indexRange.x);
}

// Clamp value to index range
float clampToIndexRange(float value) {
  return clamp(value, u_indexRange.x, u_indexRange.y);
}

// Get lookup UV based on index
vec2 getLookupUV(float index) {
  return mix(u_darkUV, u_lightUV, clampToIndexRange(index));
}

void main() {
  // If displaying lookup table, output it directly
  if (u_displayLookup) {
    gl_FragColor = texture2D(u_texture2, vUv);
    return;
  }

  // Sample the input texture
  vec4 color = texture2D(u_texture1, vUv);
  
  // Calculate index based on channel selection
  float index;
  if (u_indexChannel == 1) { // Luminance
    index = luminance(color.rgb);
  } else if (u_indexChannel == 2) { // RGBA Average
    index = average(color);
  } else if (u_indexChannel == 3) { // Alpha
    index = color.a;
  } else { // RGBA Independent
    // Handle each channel independently
    vec4 lookupColor;
    lookupColor.r = texture2D(u_texture2, getLookupUV(color.r)).r;
    lookupColor.g = texture2D(u_texture2, getLookupUV(color.g)).g;
    lookupColor.b = texture2D(u_texture2, getLookupUV(color.b)).b;
    
    // Handle alpha based on independent alpha setting
    if (u_independentAlpha) {
      lookupColor.a = texture2D(u_texture2, getLookupUV(color.a)).a;
    } else {
      lookupColor.a = color.a;
    }
    
    gl_FragColor = lookupColor;
    return;
  }
  
  // For non-independent modes, get lookup color
  vec4 lookupColor = texture2D(u_texture2, getLookupUV(index));
  
  // Handle alpha based on independent alpha setting
  if (u_independentAlpha && u_indexChannel != 3) { // Don't apply if using alpha channel
    lookupColor.a = texture2D(u_texture2, getLookupUV(color.a)).a;
  } else {
    lookupColor.a = color.a;
  }
  
  gl_FragColor = lookupColor;
}
`;
