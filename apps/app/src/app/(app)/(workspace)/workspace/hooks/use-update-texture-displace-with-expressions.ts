import * as THREE from "three";

import { baseVertexShader } from "@repo/webgl/shaders/base-vert-shader";
import { displaceFragmentShader } from "@repo/webgl/shaders/displace";

import type { ExpressionFieldConfig } from "./use-expression-texture-renderer";
import type { DisplaceTexture } from "~/db/schema/types/Texture";
import {
  createExpressionTextureRenderer,
  initializeUniformValue,
  initializeVector2Uniform,
} from "./use-expression-texture-renderer";

// Define the expression fields for displace textures
const displaceExpressionFields: ExpressionFieldConfig[] = [
  { uniformName: "u_displaceWeight", defaultValue: 1.0 },
  { uniformName: "u_displaceOffsetWeight", defaultValue: 1.0 },
  { uniformName: "u_displaceUVWeight", path: "x", defaultValue: 1.0 },
  { uniformName: "u_displaceUVWeight", path: "y", defaultValue: 1.0 },
  { uniformName: "u_displaceMidpoint", path: "x", defaultValue: 0.5 },
  { uniformName: "u_displaceMidpoint", path: "y", defaultValue: 0.5 },
  { uniformName: "u_displaceOffset", path: "x", defaultValue: 0.0 },
  { uniformName: "u_displaceOffset", path: "y", defaultValue: 0.0 },
];

// Create the renderer for displace textures
export const useUpdateTextureDisplaceWithExpressions =
  createExpressionTextureRenderer<DisplaceTexture>(
    "Displace",
    (texture) => {
      const { uniforms: u } = texture;

      // Initialize uniforms - all can potentially be expressions
      return {
        u_texture1: { value: null }, // Source image
        u_texture2: { value: null }, // Displacement map
        u_displaceWeight: {
          value: initializeUniformValue(u.u_displaceWeight, 1.0),
        },
        u_displaceMidpoint: {
          value: initializeVector2Uniform(u.u_displaceMidpoint, {
            x: 0.5,
            y: 0.5,
          }),
        },
        u_displaceOffset: {
          value: initializeVector2Uniform(u.u_displaceOffset, {
            x: 0.0,
            y: 0.0,
          }),
        },
        u_displaceOffsetWeight: {
          value: initializeUniformValue(u.u_displaceOffsetWeight, 1.0),
        },
        u_displaceUVWeight: {
          value: initializeVector2Uniform(u.u_displaceUVWeight, {
            x: 1.0,
            y: 1.0,
          }),
        },
      };
    },
    (uniforms) => {
      return new THREE.ShaderMaterial({
        vertexShader: baseVertexShader,
        fragmentShader: displaceFragmentShader,
        uniforms,
      });
    },
    displaceExpressionFields,
  );

// Usage example:
// const displaceNodes = useUpdateTextureDisplaceWithExpressions(textureDataMap, targets);
