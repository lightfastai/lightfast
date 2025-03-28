import { useMemo, useRef } from "react";
import * as THREE from "three";

import { baseVertexShader } from "@repo/webgl/shaders/base-vert-shader";
import { perlinNoise3DFragmentShader } from "@repo/webgl/shaders/pnoise";

// The import path would need to be adjusted according to your project structure
// For now, temporarily use the older approach until we set up the module

import type { WebGLRootState } from "../components/webgl/webgl-primitives";
import type { TextureRenderNode } from "../types/render";
import type { NoiseTexture, Texture } from "~/db/schema/types/Texture";
import { api } from "~/trpc/client/react";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

// Simple expression parser for time-based expressions
// This is a basic implementation that can be expanded for more complex expressions
const evaluateTimeExpression = (
  expression: string,
  context: { time: number; [key: string]: any },
): number => {
  try {
    // Replace variables with their values from context
    let evalExpression = expression;
    Object.entries(context).forEach(([key, value]) => {
      evalExpression = evalExpression.replace(
        new RegExp(`\\b${key}\\b`, "g"),
        value.toString(),
      );
    });

    // Use Function constructor to safely evaluate the expression
    // This avoids using eval() directly
    const func = new Function("return " + evalExpression);
    return func();
  } catch (error) {
    console.error("Error evaluating time expression:", error);
    // Return a default value if evaluation fails
    return context.time * 0.1;
  }
};

// Create a time context object with current time values
const createTimeContext = (
  elapsedTime: number,
  deltaTime: number,
  frameCount = 0,
  fps = 60,
) => {
  // Get current time
  const now = new Date();

  return {
    time: elapsedTime,
    delta: deltaTime,

    me: {
      time: {
        now: elapsedTime,
        delta: deltaTime,
        elapsed: elapsedTime,

        frame: frameCount,
        fps: fps,

        seconds: now.getSeconds() + now.getMilliseconds() / 1000,
        minutes: now.getMinutes(),
        hours: now.getHours(),
      },
    },
  };
};

export const useUpdateTextureNoise = (): TextureRenderNode[] => {
  const { targets } = useTextureRenderStore((state) => state);
  // Track frame count for time context
  const frameCountRef = useRef<Record<string, number>>({});
  // Cache expressions
  const expressionsRef = useRef<Record<string, string>>({});

  const queries = api.useQueries((t) =>
    Object.entries(targets).map(([id, texture]) =>
      t.tenant.node.data.get<Texture>({
        id,
      }),
    ),
  );

  return useMemo(() => {
    // Create a map of query results with their IDs
    const textureDataMap = Object.entries(targets).reduce<
      Record<string, Texture>
    >((acc, [id], index) => {
      if (queries[index]?.data) {
        acc[id] = queries[index].data;
        return acc;
      } else {
        return acc;
      }
    }, {});

    return Object.entries(textureDataMap)
      .filter((entry): entry is [string, NoiseTexture] => {
        const [_, texture] = entry;
        return texture.type === "Noise";
      })
      .map(([id, texture]) => {
        const { uniforms: u } = texture;
        const uniforms = {
          time: { value: 0 },
          u_period: { value: u.u_period },
          u_harmonics: { value: u.u_harmonics },
          u_harmonic_gain: { value: u.u_harmonic_gain },
          u_harmonic_spread: { value: u.u_harmonic_spread },
          u_scale: { value: new THREE.Vector2(u.u_scale.x, u.u_scale.y) },
          u_translate: {
            value: new THREE.Vector2(u.u_translate.x, u.u_translate.y),
          },
          u_rotation: {
            value: new THREE.Vector2(u.u_rotation.x, u.u_rotation.y),
          },
          u_amplitude: { value: u.u_amplitude },
          u_texture: {
            value: null,
          },
          u_offset: { value: u.u_offset },
          u_exponent: { value: u.u_exponent },
        };

        // Store the time expression for evaluation during animation
        const timeExpression = u.timeExpression || "time * 0.1";
        expressionsRef.current[id] = timeExpression;

        // Initialize frame count for this node if not exists
        if (frameCountRef.current[id] === undefined) {
          frameCountRef.current[id] = 0;
        }

        const shader = new THREE.ShaderMaterial({
          vertexShader: baseVertexShader,
          fragmentShader: perlinNoise3DFragmentShader,
          uniforms: { ...uniforms },
        });

        return {
          id,
          shader,
          onEachFrame: (state: WebGLRootState) => {
            // Increment frame count for this node
            frameCountRef.current[id] = (frameCountRef.current[id] || 0) + 1;

            // Create time context with all available time data
            const timeContext = createTimeContext(
              state.clock.elapsedTime,
              state.clock.getDelta(),
              frameCountRef.current[id],
              state.frameloop === "always" ? 60 : 0, // Basic FPS estimate
            );

            // Evaluate the expression
            const currentExpression =
              expressionsRef.current[id] || "time * 0.1";
            const evaluatedTime = evaluateTimeExpression(
              currentExpression,
              timeContext,
            );

            // Update the shader uniform
            if (shader.uniforms.time) {
              shader.uniforms.time.value = evaluatedTime;
            }
          },
        };
      });
  }, [queries, targets]);
};
