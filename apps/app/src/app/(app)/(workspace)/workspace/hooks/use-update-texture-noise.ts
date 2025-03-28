import { useMemo, useRef } from "react";
import * as THREE from "three";

import { baseVertexShader } from "@repo/webgl/shaders/base-vert-shader";
import { perlinNoise3DFragmentShader } from "@repo/webgl/shaders/pnoise";

// TODO: Use proper imports when the module is set up
// import {
//   createTimeContext,
//   evaluateExpression,
//   isExpression
// } from "@repo/webgl/expressions";

import type { WebGLRootState } from "../components/webgl/webgl-primitives";
import type { TextureRenderNode } from "../types/render";
import type { NoiseTexture, Texture } from "~/db/schema/types/Texture";
import { api } from "~/trpc/client/react";
import { useTextureRenderStore } from "../providers/texture-render-store-provider";

// Helper function to check if a value is a string (expression)
const isExpression = (value: any): value is string => typeof value === "string";

// Simple expression parser for time-based expressions
// This is a basic implementation that can be expanded for more complex expressions
const evaluateTimeExpression = (
  expression: string | number,
  context: { time: number; [key: string]: any },
): number => {
  // If it's already a number, return it directly
  if (typeof expression === "number") {
    return expression;
  }

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
    console.error(
      "Error evaluating expression:",
      error,
      "in expression:",
      expression,
    );
    // Return a default value if evaluation fails
    return typeof expression === "string" && expression.includes("time")
      ? context.time * 0.1
      : 0;
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
  const expressionsRef = useRef<Record<string, Record<string, string>>>({});

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

        // Initialize or reset expressions cache for this ID
        if (!expressionsRef.current[id]) {
          expressionsRef.current[id] = {};
        }

        // Store all expressions for this node
        const storeExpression = (key: string, value: any) => {
          if (isExpression(value)) {
            expressionsRef.current[id][key] = value;
          }
        };

        // Store expressions for all potential expression fields
        storeExpression("timeExpression", u.timeExpression);
        storeExpression("u_period", u.u_period);
        storeExpression("u_harmonic_gain", u.u_harmonic_gain);
        storeExpression("u_harmonic_spread", u.u_harmonic_spread);
        storeExpression("u_amplitude", u.u_amplitude);
        storeExpression("u_offset", u.u_offset);
        storeExpression("u_exponent", u.u_exponent);
        storeExpression("u_scale.x", u.u_scale.x);
        storeExpression("u_scale.y", u.u_scale.y);
        storeExpression("u_translate.x", u.u_translate.x);
        storeExpression("u_translate.y", u.u_translate.y);
        storeExpression("u_rotation.x", u.u_rotation.x);
        storeExpression("u_rotation.y", u.u_rotation.y);

        // Initialize uniforms with either numeric values or placeholders for expressions
        const uniforms = {
          time: { value: 0 },
          u_period: {
            value: typeof u.u_period === "number" ? u.u_period : 2.0,
          },
          u_harmonics: { value: u.u_harmonics },
          u_harmonic_gain: {
            value:
              typeof u.u_harmonic_gain === "number" ? u.u_harmonic_gain : 0.66,
          },
          u_harmonic_spread: {
            value:
              typeof u.u_harmonic_spread === "number"
                ? u.u_harmonic_spread
                : 2.0,
          },
          u_scale: {
            value: new THREE.Vector2(
              typeof u.u_scale.x === "number" ? u.u_scale.x : 1,
              typeof u.u_scale.y === "number" ? u.u_scale.y : 1,
            ),
          },
          u_translate: {
            value: new THREE.Vector2(
              typeof u.u_translate.x === "number" ? u.u_translate.x : 0,
              typeof u.u_translate.y === "number" ? u.u_translate.y : 0,
            ),
          },
          u_rotation: {
            value: new THREE.Vector2(
              typeof u.u_rotation.x === "number" ? u.u_rotation.x : 0,
              typeof u.u_rotation.y === "number" ? u.u_rotation.y : 0,
            ),
          },
          u_amplitude: {
            value: typeof u.u_amplitude === "number" ? u.u_amplitude : 0.84,
          },
          u_texture: {
            value: null,
          },
          u_offset: {
            value: typeof u.u_offset === "number" ? u.u_offset : 0.412,
          },
          u_exponent: {
            value: typeof u.u_exponent === "number" ? u.u_exponent : 0.63,
          },
        };

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

            // Evaluate and update all expressions
            const expressions = expressionsRef.current[id] || {};

            // Helper to evaluate and update a uniform
            const updateUniform = (
              uniformName: string,
              expressionKey: string,
            ) => {
              const expr = expressions[expressionKey];
              if (expr && shader.uniforms[uniformName]) {
                const value = evaluateTimeExpression(expr, timeContext);
                shader.uniforms[uniformName].value = value;
              }
            };

            // Helper to update vector uniform components
            const updateVectorUniform = (
              uniformName: string,
              component: "x" | "y",
              expressionKey: string,
            ) => {
              const expr = expressions[expressionKey];
              if (expr && shader.uniforms[uniformName]) {
                const value = evaluateTimeExpression(expr, timeContext);
                shader.uniforms[uniformName].value[component] = value;
              }
            };

            // Update time uniform
            if (shader.uniforms.time) {
              // Always evaluate timeExpression
              const expr = expressions.timeExpression || "time * 0.1";
              shader.uniforms.time.value = evaluateTimeExpression(
                expr,
                timeContext,
              );
            }

            // Update scalar uniforms
            updateUniform("u_period", "u_period");
            updateUniform("u_harmonic_gain", "u_harmonic_gain");
            updateUniform("u_harmonic_spread", "u_harmonic_spread");
            updateUniform("u_amplitude", "u_amplitude");
            updateUniform("u_offset", "u_offset");
            updateUniform("u_exponent", "u_exponent");

            // Update vector uniforms
            updateVectorUniform("u_scale", "x", "u_scale.x");
            updateVectorUniform("u_scale", "y", "u_scale.y");
            updateVectorUniform("u_translate", "x", "u_translate.x");
            updateVectorUniform("u_translate", "y", "u_translate.y");
            updateVectorUniform("u_rotation", "x", "u_rotation.x");
            updateVectorUniform("u_rotation", "y", "u_rotation.y");
          },
        };
      });
  }, [queries, targets]);
};
