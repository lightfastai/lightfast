"use client";

import * as THREE from "three";

import type { RenderTargetOptions, TextureRenderStore } from "../types/render";

/**
 * Creates a standard render target store
 */
export const createRenderTargetStore = (
  defaultOptions: RenderTargetOptions = {},
) => {
  const {
    width = 1024,
    height = 1024,
    wrapS = THREE.ClampToEdgeWrapping,
    wrapT = THREE.ClampToEdgeWrapping,
    minFilter = THREE.LinearFilter,
    magFilter = THREE.LinearFilter,
    format = THREE.RGBAFormat,
    type = THREE.UnsignedByteType,
    stencilBuffer = false,
    depthBuffer = true,
  } = defaultOptions;

  return {
    targets: {} as Record<string, THREE.WebGLRenderTarget>,

    addTarget: (id: string, targetWidth = width, targetHeight = height) => {
      const target = new THREE.WebGLRenderTarget(targetWidth, targetHeight, {
        wrapS,
        wrapT,
        minFilter,
        magFilter,
        format,
        type,
        stencilBuffer,
        depthBuffer,
      });

      return {
        targets: {
          ...this.targets,
          [id]: target,
        },
      };
    },

    removeTarget: (id: string) => {
      const { [id]: removed, ...rest } = this.targets;
      if (removed) {
        removed.dispose();
      }
      return {
        targets: rest,
      };
    },
  } satisfies TextureRenderStore;
};

/**
 * Create a basic implementation of create store function for states like Zustand
 */
export const createStoreCreator = (
  defaultOptions: RenderTargetOptions = {},
) => {
  return () => ({
    targets: {} as Record<string, THREE.WebGLRenderTarget>,

    addTarget: (id: string, width?: number, height?: number) => {
      const {
        width: defaultWidth = 1024,
        height: defaultHeight = 1024,
        wrapS = THREE.ClampToEdgeWrapping,
        wrapT = THREE.ClampToEdgeWrapping,
        minFilter = THREE.LinearFilter,
        magFilter = THREE.LinearFilter,
        format = THREE.RGBAFormat,
        type = THREE.UnsignedByteType,
        stencilBuffer = false,
        depthBuffer = true,
      } = defaultOptions;

      const target = new THREE.WebGLRenderTarget(
        width || defaultWidth,
        height || defaultHeight,
        {
          wrapS,
          wrapT,
          minFilter,
          magFilter,
          format,
          type,
          stencilBuffer,
          depthBuffer,
        },
      );

      return (state: { targets: Record<string, THREE.WebGLRenderTarget> }) => ({
        targets: {
          ...state.targets,
          [id]: target,
        },
      });
    },

    removeTarget: (id: string) => {
      return (state: { targets: Record<string, THREE.WebGLRenderTarget> }) => {
        const { [id]: removed, ...rest } = state.targets;
        if (removed) {
          removed.dispose();
        }
        return {
          targets: rest,
        };
      };
    },
  });
};
