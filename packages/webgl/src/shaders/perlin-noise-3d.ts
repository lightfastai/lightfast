import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { createConstrainedVec2 } from "../schema/vec2";

export const $PerlinNoise3D = z.object({
  // noise
  u_time: z.number().default(0).describe("The time value for the noise."),
  u_frequency: z
    .number()
    .min(0.01)
    .max(2)
    .default(1)
    .describe("The base frequency for the noise."), // Base frequency; max value adjusted to 2
  u_octaves: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe("The number of harmonics for the noise."), // Number of harmonics; max value is 10
  u_persistence: z
    .number()
    .min(0)
    .max(2)
    .default(0.5)
    .describe("The amplitude multiplier for the noise."), // Amplitude multiplier; max value adjusted to 2
  u_lacunarity: z
    .number()
    .min(0)
    .max(2)
    .default(2)
    .describe("The frequency multiplier for the noise."), // Frequency multiplier; max value adjusted to 20
  u_amplitude: z
    .number()
    .min(0)
    .max(2)
    .default(1)
    .describe("The overall amplitude scaling for the noise."), // Overall amplitude scaling; max value adjusted to 2

  // transform
  u_scale: createConstrainedVec2({
    x: { min: -1000, max: 1000, default: 0 },
    y: { min: -1000, max: 1000, default: 0 },
  }).describe("The scale of the noise."),
  u_offset: createConstrainedVec2({
    x: { min: -1000, max: 1000, default: 0 },
    y: { min: -1000, max: 1000, default: 0 },
  }).describe("The offset of the noise."),

  // inputs
  u_texture: z.number().nullable(),
});

export const $PerlinNoise3DJsonSchema = zodToJsonSchema(
  $PerlinNoise3D,
) as JSONSchema7;

export type PerlinNoise3DParams = z.infer<typeof $PerlinNoise3D>;

export const PerlinNoise3DDescription =
  "A type of noise functionality based on perlin noise. Allows you to create a 3D noise texture.";

export const createDefaultPerlinNoise3D = (): PerlinNoise3DParams => {
  return $PerlinNoise3D.parse({
    u_time: 0,
    u_frequency: 1,
    u_octaves: 3,
    u_persistence: 0.5,
    u_lacunarity: 2,
    u_amplitude: 1,
    u_scale: { x: 1, y: 1 },
    u_offset: { x: 0, y: 0 },
    u_texture: null,
  });
};

export const perlinNoise3DVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export const perlinNoise3DFragmentShader = `
  uniform float u_time;
  uniform float u_frequency;
  uniform float u_amplitude;
  uniform int u_octaves;
  uniform float u_persistence;
  uniform float u_lacunarity;
  uniform vec2 u_scale;
  uniform vec2 u_offset;
  uniform float u_rotation;
  uniform sampler2D u_texture;

  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float perlinNoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    mat2 rotationMatrix = mat2(cos(u_rotation), -sin(u_rotation), sin(u_rotation), cos(u_rotation));
    vec2 coords = vUv * u_scale - u_offset;
    coords = rotationMatrix * coords;

    float frequency = u_frequency;
    float amplitude = u_amplitude;
    float noiseValue = 0.0;

    for (int i = 0; i < 10; i++) {
      if (i >= u_octaves) break;
      float noise = perlinNoise(coords * frequency + u_time);
      noiseValue += noise * amplitude;
      frequency *= u_lacunarity;
      amplitude *= u_persistence;
    }

    noiseValue = noiseValue * 0.5 + 0.5;
    vec4 textureColor = texture2D(u_texture, vUv);
    vec3 finalColor;
    if (textureColor.a > 0.0) {
      finalColor = mix(textureColor.rgb, vec3(noiseValue), 0.5);
    } else {
      finalColor = vec3(noiseValue);
    }
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
