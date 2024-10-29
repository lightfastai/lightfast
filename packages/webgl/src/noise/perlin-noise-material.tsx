import type * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

import type { Uniform } from "./types";

export const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fragmentShader = `
  uniform float u_time;
  uniform float u_frequency;
  uniform float u_amplitude;
  uniform int u_octaves;
  uniform float u_persistence;
  uniform float u_lacunarity;
  uniform vec2 u_scale;
  uniform vec2 u_offset;
  uniform float u_rotation;

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
    gl_FragColor = vec4(vec3(noiseValue), 1.0);
  }
`;

type PerlinNoiseShaderUniformNames =
  | "u_time"
  | "u_frequency"
  | "u_amplitude"
  | "u_octaves"
  | "u_persistence"
  | "u_lacunarity"
  | "u_scale"
  | "u_offset"
  | "u_rotation";

export type PerlinNoiseShaderUniforms = Record<
  PerlinNoiseShaderUniformNames,
  Uniform
>;

export const PerlinNoiseShaderMaterial = ({
  uniforms,
}: {
  uniforms: PerlinNoiseShaderUniforms;
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (!materialRef.current) return;
    if (!materialRef.current.uniforms.u_time) return;
    materialRef.current.uniforms.u_time.value = state.clock.elapsedTime;
  });

  return (
    <shaderMaterial
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
      ref={materialRef}
    />
  );
};
