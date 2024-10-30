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
