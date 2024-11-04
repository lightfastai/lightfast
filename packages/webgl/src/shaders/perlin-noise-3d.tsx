import { z } from "zod";

import { createConstrainedVec3 } from "../schema/vec3";

export const $PerlinNoise3D = z.object({
  // dna
  u_seed: z.number().default(0), // Seed value; can be any number

  // noise
  u_period: z.number().min(0.01).max(2).default(1), // Base frequency; max value adjusted to 2
  u_harmonics: z.number().int().min(1).max(10).default(3), // Number of harmonics; max value is 10
  u_harmonic_spread: z.number().min(1).max(20).default(2), // Frequency multiplier; max value adjusted to 20
  u_harmonic_gain: z.number().min(0).max(2).default(0.5), // Amplitude multiplier; max value adjusted to 2
  u_exponent: z.number().min(0.1).max(4).default(1), // Exponent; max value adjusted to 4
  u_amplitude: z.number().min(0).max(2).default(1), // Overall amplitude scaling; max value adjusted to 2
  u_offset: z.number().min(-10).max(1).default(0.5), // Offset; max value adjusted to 1

  // transform
  u_translate: createConstrainedVec3({
    x: { min: -1000, max: 1000, default: 0 },
    y: { min: -1000, max: 1000, default: 0 },
    z: { min: -1000, max: 1000, default: 0 },
  }),
  u_rotate: createConstrainedVec3({
    x: { min: -Math.PI * 2, max: Math.PI * 2, default: 0 },
    y: { min: -Math.PI * 2, max: Math.PI * 2, default: 0 },
    z: { min: -Math.PI * 2, max: Math.PI * 2, default: 0 },
  }),
  u_scale: createConstrainedVec3({
    x: { min: 0.01, max: 100, default: 1 },
    y: { min: 0.01, max: 100, default: 1 },
    z: { min: 0.01, max: 100, default: 1 },
  }),
});

export type PerlinNoise3DParams = z.infer<typeof $PerlinNoise3D>;

export const perlinNoise3DVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const perlinNoise3DFragmentShader = `
  uniform float u_seed;
  uniform float u_period;
  uniform int u_harmonics;
  uniform float u_harmonic_spread;
  uniform float u_harmonic_gain;
  uniform float u_exponent;
  uniform float u_amplitude;
  uniform float u_offset;

  uniform vec3 u_translate;
  uniform vec3 u_rotate;
  uniform vec3 u_scale;

  varying vec2 vUv;

  #define MAX_HARMONICS 10

  // Rotation matrices for X, Y, Z axes
  mat3 rotationX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
      1.0, 0.0, 0.0,
      0.0, c, -s,
      0.0, s, c
    );
  }

  mat3 rotationY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
      c, 0.0, s,
      0.0, 1.0, 0.0,
      -s, 0.0, c
    );
  }

  mat3 rotationZ(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
      c, -s, 0.0,
      s, c, 0.0,
      0.0, 0.0, 1.0
    );
  }

  // 3D Perlin noise functions
  vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
  }

  vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
  }

  vec3 fade(vec3 t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  float perlinNoise(vec3 P) {
    vec3 Pi0 = floor(P);        // Integer part for indexing
    vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P);        // Fractional part for interpolation
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.y, Pi0.y, Pi1.y, Pi1.y);
    vec4 iz0 = vec4(Pi0.z);
    vec4 iz1 = vec4(Pi1.z);
    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);
    vec4 gx0 = fract(ixy0 * (1.0 / 7.0)) * 2.0 - 1.0;
    vec4 gy0 = fract(floor(ixy0 * (1.0 / 7.0)) * (1.0 / 7.0)) * 2.0 - 1.0;
    vec4 gz0 = vec4(1.0) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);
    vec4 gx1 = fract(ixy1 * (1.0 / 7.0)) * 2.0 - 1.0;
    vec4 gy1 = fract(floor(ixy1 * (1.0 / 7.0)) * (1.0 / 7.0)) * 2.0 - 1.0;
    vec4 gz1 = vec4(1.0) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);
    vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
    vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
    vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
    vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
    vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
    vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
    vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
    vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);
    vec4 norm0 = taylorInvSqrt(
      vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110))
    );
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(
      vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111))
    );
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;
    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);
    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(
      vec4(n000, n100, n010, n110),
      vec4(n001, n101, n011, n111),
      fade_xyz.z
    );
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
  }

  void main() {
    vec3 coords = vec3(vUv, 0.0);

    // Apply scaling
    coords *= u_scale;

    // Apply rotation
    coords = rotationX(u_rotate.x) * coords;
    coords = rotationY(u_rotate.y) * coords;
    coords = rotationZ(u_rotate.z) * coords;

    // Apply translation
    coords += u_translate;

    // Incorporate seed
    coords += vec3(u_seed);

    // Initialize noise parameters
    float noiseValue = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0 / u_period;

    // Accumulate harmonics
    for (int i = 0; i < MAX_HARMONICS; i++) {
      if (i >= u_harmonics) break;

      float n = perlinNoise(coords * frequency);
      noiseValue += n * amplitude;

      frequency *= u_harmonic_spread;
      amplitude *= u_harmonic_gain;
    }

    // Apply exponent
    noiseValue = pow(abs(noiseValue), u_exponent);

    // Apply amplitude and offset
    noiseValue = noiseValue * u_amplitude + u_offset;

    // Clamp to [0, 1] range
    noiseValue = clamp(noiseValue, 0.0, 1.0);

    gl_FragColor = vec4(vec3(noiseValue), 1.0);
  }
`;
