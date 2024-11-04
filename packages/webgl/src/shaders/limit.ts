import { z } from "zod";

export const $Limit = z.object({
  u_texture: z.number().nullable(),
  u_quantizationSteps: z.number().min(0.01).max(1).default(0.1),
});

export type LimitParams = z.infer<typeof $Limit>;

export const createDefaultLimit = (): LimitParams => {
  return $Limit.parse({
    u_texture: null,
    u_quantizationSteps: 0.1,
  });
};

export const limitVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const limitFragmentShader = `
  uniform sampler2D u_texture;
  uniform float u_quantizationSteps;
  varying vec2 vUv;

  void main() {
    vec4 color = texture2D(u_texture, vUv);
    if (u_quantizationSteps > 1.0) {
      color.rgb = floor(color.rgb * u_quantizationSteps) / u_quantizationSteps;
    }
    gl_FragColor = color;
  }
`;
