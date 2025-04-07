import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import type { Sampler2DMetadata, UniformFieldValue } from "../types/field";
import type { ShaderSampler2DUniform } from "../types/shader-sampler2d-uniform";
import { createSampler2DHandle } from "../types/shader-sampler2d-uniform";
import {
  $Float,
  $NumericValue,
  $Vec2Number,
  ValueType,
} from "../types/shader-uniform";

// Create texture handle for the uniform
export const noiseBlendHandle = createSampler2DHandle("input-1", "u_texture1");

// Define texture uniforms
export const $NoiseTextureUniforms = z.object({
  u_texture1: z.custom<ShaderSampler2DUniform>(),
});

export type NoiseTextureUniforms = z.infer<typeof $NoiseTextureUniforms>;

// Define regular uniforms
export const $NoiseBase = z.object({
  u_period: $NumericValue
    .describe("1/u_period is the frequency of the input of noise function")
    .default(2.0),
  // @todo fix
  u_harmonics: z
    .number()
    .int()
    .min(0)
    .max(8)
    .default(1)
    .describe("amount of iterations of noise."),
  u_harmonic_gain: $NumericValue
    .describe(
      "how much the amplitude changes per iterations (scalar of the amplitude)",
    )
    .default(0.66),
  u_harmonic_spread: $NumericValue
    .describe(
      "how much the frequency changes per iteration (scalar of the frequency)",
    )
    .default(2.0),
  u_amplitude: $NumericValue
    .describe("The overall amplitude scaling for the noise.")
    .default(0.84),
  u_offset: $NumericValue.describe("The offset of the noise.").default(0.412),
  u_exponent: $NumericValue
    .describe("The exponent of the noise.")
    .default(0.63),
});

export const $NoiseTransform = z.object({
  u_scale: $Vec2Number.extend({
    x: $Float
      .describe("X scale (min: 0.1, max: 10)")
      .transform((val) => Math.max(0.1, Math.min(10, val)))
      .default(1),
    y: $Float
      .describe("Y scale (min: 0.1, max: 10)")
      .transform((val) => Math.max(0.1, Math.min(10, val)))
      .default(1),
  }),
  u_translate: $Vec2Number.extend({
    x: $Float
      .describe("X translation (min: -10, max: 10)")
      .transform((val) => Math.max(-10, Math.min(10, val)))
      .default(0),
    y: $Float
      .describe("Y translation (min: -10, max: 10)")
      .transform((val) => Math.max(-10, Math.min(10, val)))
      .default(0),
  }),
  u_rotation: $Vec2Number.extend({
    x: $Float
      .describe("X rotation (min: -180, max: 180)")
      .transform((val) => Math.max(-180, Math.min(180, val)))
      .default(0),
    y: $Float
      .describe("Y rotation (min: -180, max: 180)")
      .transform((val) => Math.max(-180, Math.min(180, val)))
      .default(0),
  }),
});

// Combine all regular uniforms
export const $NoiseRegularUniforms = $NoiseTransform.merge($NoiseBase);

export type NoiseRegularUniforms = z.infer<typeof $NoiseRegularUniforms>;

// Combine texture and regular uniforms for the full shader definition
export const $PerlinNoise3D = $NoiseTextureUniforms.merge(
  $NoiseRegularUniforms,
);

export const PerlinNoiseJsonSchema = zodToJsonSchema(
  $PerlinNoise3D,
) as JSONSchema7;

export type PerlinNoise3DParams = z.infer<typeof $PerlinNoise3D>;

export const PerlinNoise3DDescription =
  "A type of noise functionality based on perlin noise. Allows you to create a 3D noise texture with time-based animation. Use expressions prefixed with 'e.' to create dynamic values, like 'e.2 + Math.sin(me.time.now)'.";

export const createDefaultPerlinNoise3D = (): PerlinNoise3DParams => {
  return {
    // Texture uniform with the new format
    u_texture1: noiseBlendHandle,
    // Regular uniforms
    u_period: 2.0,
    u_harmonics: 1,
    u_harmonic_gain: 0.66,
    u_harmonic_spread: 2.0,
    u_amplitude: 0.84,
    u_offset: 0.412,
    u_exponent: 0.63,
    u_scale: { x: 1, y: 1 },
    u_translate: { x: 0, y: 0 },
    u_rotation: { x: 0, y: 0 },
  };
};

// Lookup table for pnoise uniform constraints
export const PNOISE_UNIFORM_CONSTRAINTS: Record<string, UniformFieldValue> = {
  u_texture1: {
    type: ValueType.Sampler2D,
    label: "Blend Texture",
    constraint: {
      handle: noiseBlendHandle,
      required: false,
      description: "Input texture to combine with noise (optional)",
    } as Sampler2DMetadata,
  },
  u_scale: {
    type: ValueType.Vec2,
    label: "Scale",
    constraint: {
      x: { min: 0.1, max: 10, step: 0.1 },
      y: { min: 0.1, max: 10, step: 0.1 },
    },
  },
  u_translate: {
    type: ValueType.Vec2,
    label: "Translate",
    constraint: {
      x: { min: -10, max: 10, step: 0.1 },
      y: { min: -10, max: 10, step: 0.1 },
    },
  },
  u_rotation: {
    type: ValueType.Vec2,
    label: "Rotation",
    constraint: {
      x: { min: -180, max: 180, step: 1 },
      y: { min: -180, max: 180, step: 1 },
    },
  },
  u_period: {
    type: ValueType.Numeric,
    label: "Period",
    constraint: {
      value: { min: 0.1, max: 10, step: 0.1 },
    },
  },
  u_harmonics: {
    type: ValueType.Numeric,
    label: "Harmonics",
    constraint: {
      value: { min: 1, max: 8, step: 1 },
    },
  },
  u_harmonic_gain: {
    type: ValueType.Numeric,
    label: "Harmonic Gain",
    constraint: {
      value: { min: 0, max: 1, step: 0.1 },
    },
  },
  u_harmonic_spread: {
    type: ValueType.Numeric,
    label: "Harmonic Spread",
    constraint: {
      value: { min: 1, max: 4, step: 0.1 },
    },
  },
  u_amplitude: {
    type: ValueType.Numeric,
    label: "Amplitude",
    constraint: {
      value: { min: 0.1, max: 10, step: 0.1 },
    },
  },
  u_offset: {
    type: ValueType.Numeric,
    label: "Offset",
    constraint: {
      value: { min: -1, max: 1, step: 0.1 },
    },
  },
  u_exponent: {
    type: ValueType.Numeric,
    label: "Exponent",
    constraint: {
      value: { min: 0, max: 10, step: 0.1 },
    },
  },
};

export const pnoiseFragmentShader = `
precision highp float;

// GLSL textureless classic 3D noise
varying vec2 vUv;

uniform float time;
uniform float u_period;
uniform int u_harmonics;
uniform float u_harmonic_spread;
uniform float u_harmonic_gain;
uniform float u_exponent;
uniform float u_amplitude;
uniform float u_offset;

uniform vec2 u_scale;
uniform vec2 u_rotation;
uniform vec2 u_translate;
uniform sampler2D u_texture1;

// Permutation functions
vec3 permute(vec3 x) {
    return mod(((x*34.0)+1.0)*x, 289.0);
}

vec4 permute(vec4 x) {
    return mod(((x*34.0)+1.0)*x, 289.0);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

// 3D Perlin noise implementation
float snoise(vec3 v) { 
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    // First corner
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    // Permutations
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0)) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
           
    // Gradients
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

mat2 rotation(vec2 angle) {
    return mat2(cos(angle.x), -sin(angle.y), sin(angle.x), cos(angle.y));
}

void main() {
    // Transform coordinates
    vec2 uv = vUv * u_scale - u_translate;
    uv = rotation(u_rotation) * uv;
    
    // Base frequency
    float baseFreq = u_period > 0.0 ? 1.0 / u_period : 1.0;
    
    // Initialize result
    float noise = 0.0;
    
    // Use time directly for z-coordinate
    // The time expression is evaluated in JavaScript and passed as 'time'
    float zCoord = time;
    
    // Base noise calculation with time
    vec3 coords = vec3(uv * baseFreq, zCoord);
    noise = snoise(coords);
    
    // Add harmonics
    float amp = 1.0;
    float freq = baseFreq;
    
    for (int i = 0; i < 8; i++) {
        if (i >= u_harmonics) break;
        
        freq *= u_harmonic_spread;
        amp *= u_harmonic_gain;
        
        // Use different z-offsets for each harmonic to create variation
        vec3 harmonicCoords = vec3(uv * freq, zCoord + float(i) * 0.72);
        noise += snoise(harmonicCoords) * amp;
    }
    
    // Apply exponent for more control over detail distribution
    noise = sign(noise) * pow(abs(noise), u_exponent);
    
    // Scale by amplitude and add offset
    noise = noise * u_amplitude + u_offset;
    
    // Mix with texture if provided
    vec4 textureColor = texture2D(u_texture1, vUv);
    vec3 finalColor;
    if (textureColor.a > 0.0) {
        finalColor = mix(textureColor.rgb, vec3(noise), 0.5);
    } else {
        finalColor = vec3(noise);
    }
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;
