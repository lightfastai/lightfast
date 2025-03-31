import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import {
  createConstrainedNumericValue,
  createConstrainedVec2,
  VectorMode,
} from "../../schema/schema";
import { $Shared } from "../shared/schema";

// Define the time expression type for animation
export const $TimeExpression = z
  .string()
  .default("time * 0.1")
  .describe(
    "Expression for time-based animation. Supports variables like 'time', 'me.time.now', 'me.time.delta'. Example: 'time * 0.1' or 'Math.sin(me.time.now * 0.5) * 0.2'",
  );

export const $NoiseBase = z.object({
  u_period: createConstrainedNumericValue({
    min: 0.001,
    max: 100,
    default: 2.0,
    description: "1/u_period is the frequency of the input of noise function",
  }),
  u_harmonics: z
    .number()
    .int()
    .min(0)
    .max(8)
    .default(1)
    .describe("amount of iterations of noise."),
  u_harmonic_gain: createConstrainedNumericValue({
    min: 0,
    max: 1,
    default: 0.66,
    description:
      "how much the amplitude changes per iterations (scalar of the amplitude)",
  }),
  u_harmonic_spread: createConstrainedNumericValue({
    min: 0,
    max: 10,
    default: 2.0,
    description:
      "how much the frequency changes per iteration (scalar of the frequency)",
  }),
  u_amplitude: createConstrainedNumericValue({
    min: 0,
    max: 10,
    default: 0.84,
    description: "The overall amplitude scaling for the noise.",
  }),
  u_offset: createConstrainedNumericValue({
    min: -1,
    max: 1,
    default: 0.412,
    description: "The offset of the noise.",
  }),
  u_exponent: createConstrainedNumericValue({
    min: 0.1,
    max: 10,
    default: 0.63,
    description: "The exponent of the noise.",
  }),
});

export const $NoiseTransform = z.object({
  u_scale: createConstrainedVec2({
    mode: VectorMode.Number,
    components: {
      x: { min: -1000, max: 1000, default: 1 },
      y: { min: -1000, max: 1000, default: 1 },
    },
  }).describe("The scale of the noise."),
  u_translate: createConstrainedVec2({
    mode: VectorMode.Number,
    components: {
      x: { min: -1000, max: 1000, default: 0 },
      y: { min: -1000, max: 1000, default: 0 },
    },
  }).describe("The offset of the noise."),
  u_rotation: createConstrainedVec2({
    mode: VectorMode.Number,
    components: {
      x: { min: -Math.PI, max: Math.PI, default: 0 },
      y: { min: -Math.PI, max: Math.PI, default: 0 },
    },
  }).describe("The rotation of the noise."),
});

export const $PerlinNoise3D = $Shared.merge($NoiseTransform).merge($NoiseBase);

export const u_harmonics = zodToJsonSchema($PerlinNoise3D) as JSONSchema7;

export type PerlinNoise3DParams = z.infer<typeof $PerlinNoise3D>;

export const PerlinNoise3DDescription =
  "A type of noise functionality based on perlin noise. Allows you to create a 3D noise texture with time-based animation. Use expressions prefixed with 'e.' to create dynamic values, like 'e.2 + Math.sin(me.time.now)'.";

export const createDefaultPerlinNoise3D = (): PerlinNoise3DParams => {
  return $PerlinNoise3D.parse({
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
    u_texture: null,
  });
};

export const perlinNoise3DFragmentShader = `
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
uniform sampler2D u_texture;

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
    vec4 textureColor = texture2D(u_texture, vUv);
    vec3 finalColor;
    if (textureColor.a > 0.0) {
        finalColor = mix(textureColor.rgb, vec3(noise), 0.5);
    } else {
        finalColor = vec3(noise);
    }
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;
