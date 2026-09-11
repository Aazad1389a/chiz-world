```javascript
import * as THREE from "three";

/**
 * AZAD WORLD
 * Graphics Quality & Renderer Utilities
 *
 * This module centralizes:
 * - Graphics quality profiles
 * - Pixel ratio
 * - Shadow quality
 * - Exposure / tone mapping
 * - WebGL capability detection
 * - Renderer diagnostics
 */

export const GRAPHICS_PROFILES = {
    low: {
        name: "Low",
        pixelRatio: 0.75,
        maxPixelRatio: 1,
        shadows: false,
        shadowMapSize: 512,
        exposure: 1.0,
        antialias: false,
        physicallyCorrectLights: true,
        textureAnisotropy: 1
    },

    medium: {
        name: "Medium",
        pixelRatio: 1,
        maxPixelRatio: 1.5,
        shadows: true,
        shadowMapSize: 1024,
        exposure: 1.05,
        antialias: true,
        physicallyCorrectLights: true,
        textureAnisotropy: 2
    },

    high: {
        name: "High",
        pixelRatio: 1.25,
        maxPixelRatio: 2,
        shadows: true,
        shadowMapSize: 2048,
        exposure: 1.1,
        antialias: true,
        physicallyCorrectLights: true,
        textureAnisotropy: 4
    },

    ultra: {
        name: "Ultra",
        pixelRatio: 1.5,
        maxPixelRatio: 2.5,
        shadows: true,
        shadowMapSize: 4096,
        exposure: 1.15,
        antialias: true,
        physicallyCorrectLights: true,
        textureAnisotropy: 8
    }
};

const DEFAULT_QUALITY = "high";

/**
 * Clamp helper
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Detect basic WebGL capabilities.
 */
export function detectGraphicsCapabilities(renderer) {
    if (!renderer) {
        return {
            webgl2: false,
            maxTextureSize: 0,
            maxAnisotropy: 1,
            maxSamples: 0,
            highPrecision: false
        };
    }

    const capabilities = renderer.capabilities;

    return {
        webgl2:
            typeof WebGL2RenderingContext !== "undefined" &&
            renderer.getContext() instanceof WebGL2RenderingContext,

        maxTextureSize: capabilities.maxTextureSize ?? 0,

        maxAnisotropy:
            typeof capabilities.getMaxAnisotropy === "function"
                ? capabilities.getMaxAnisotropy()
                : 1,

        maxSamples: capabilities.maxSamples ?? 0,

        highPrecision:
            capabilities.precision === "highp"
    };
}

/**
 * Get the best supported anisotropy value
 * for the selected quality level.
 */
export function getRecommendedAnisotropy(renderer, quality = DEFAULT_QUALITY) {
    if (!renderer) return 1;

    const profile =
        GRAPHICS_PROFILES[quality] ??
        GRAPHICS_PROFILES[DEFAULT_QUALITY];

    const maxAnisotropy =
        renderer.capabilities.getMaxAnisotropy?.() ?? 1;

    return Math.max(
        1,
        Math.min(
            profile.textureAnisotropy,
            maxAnisotropy
        )
    );
}

/**
 * Apply texture filtering quality.
 */
export function configureTexture(texture, renderer, quality = DEFAULT_QUALITY) {
    if (!texture || !renderer) return texture;

    const anisotropy = getRecommendedAnisotropy(
        renderer,
        quality
    );

    texture.anisotropy = anisotropy;

    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;

    texture.needsUpdate = true;

    return texture;
}

/**
 * Configure every texture found in a loaded object.
 */
export function configureObjectTextures(
    object,
    renderer,
    quality = DEFAULT_QUALITY
) {
    if (!object) return;

    object.traverse((child) => {
        if (!child.material) return;

        const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

        for (const material of materials) {
            const textureProperties = [
                "map",
                "normalMap",
                "roughnessMap",
                "metalnessMap",
                "aoMap",
                "emissiveMap",
                "clearcoatMap",
                "clearcoatNormalMap",
                "clearcoatRoughnessMap",
                "transmissionMap"
            ];

            for (const property of textureProperties) {
                const texture = material[property];

                if (texture) {
                    configureTexture(
                        texture,
                        renderer,
                        quality
                    );
                }
            }
        }
    });
}

/**
 * Configure renderer according to quality.
 */
export function applyGraphicsProfile(
    renderer,
    quality = DEFAULT_QUALITY,
    options = {}
) {
    if (!renderer) {
        throw new Error(
            "applyGraphicsProfile: renderer is required."
        );
    }

    const profile =
        GRAPHICS_PROFILES[quality] ??
        GRAPHICS_PROFILES[DEFAULT_QUALITY];

    const devicePixelRatio =
        typeof window !== "undefined"
            ? window.devicePixelRatio || 1
            : 1;

    const customRenderScale =
        Number.isFinite(options.renderScale)
            ? options.renderScale
            : 1;

    const targetPixelRatio = clamp(
        devicePixelRatio *
            profile.pixelRatio *
            customRenderScale,
        0.5,
        profile.maxPixelRatio
    );

    renderer.setPixelRatio(targetPixelRatio);

    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure =
        profile.exposure;

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    renderer.shadowMap.enabled =
        profile.shadows;

    renderer.shadowMap.type =
        THREE.PCFSoftShadowMap;

    return {
        quality,
        profile,
        pixelRatio: targetPixelRatio
    };
}

/**
 * Configure a directional light for high-quality shadows.
 */
export function configureShadowLight(
    light,
    quality = DEFAULT_QUALITY
) {
    if (!light) return;

    const profile =
        GRAPHICS_PROFILES[quality] ??
        GRAPHICS_PROFILES[DEFAULT_QUALITY];

    light.castShadow = profile.shadows;

    if (!light.shadow) return;

    light.shadow.mapSize.width =
        profile.shadowMapSize;

    light.shadow.mapSize.height =
        profile.shadowMapSize;

    light.shadow.bias = -0.00015;

    light.shadow.normalBias = 0.02;

    light.shadow.radius =
        quality === "ultra"
            ? 3
            : quality === "high"
                ? 2
                : 1;

    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500;

    light.shadow.camera.left = -150;
    light.shadow.camera.right = 150;
    light.shadow.camera.top = 150;
    light.shadow.camera.bottom = -150;
}

/**
 * Configure objects to participate in shadows.
 */
export function configureShadows(
    root,
    options = {}
) {
    if (!root) return;

    const castShadow =
        options.castShadow ?? true;

    const receiveShadow =
        options.receiveShadow ?? true;

    root.traverse((object) => {
        if (!object.isMesh) return;

        object.castShadow = castShadow;
        object.receiveShadow = receiveShadow;

        if (object.material) {
            const materials =
                Array.isArray(object.material)
                    ? object.material
                    : [object.material];

            for (const material of materials) {
                material.needsUpdate = true;
            }
        }
    });
}

/**
 * Configure a complete loaded 3D asset.
 */
export function prepare3DAsset(
    object,
    renderer,
    quality = DEFAULT_QUALITY,
    options = {}
) {
    if (!object) return object;

    configureShadows(object, {
        castShadow:
            options.castShadow ?? true,

        receiveShadow:
            options.receiveShadow ?? true
    });

    configureObjectTextures(
        object,
        renderer,
        quality
    );

    return object;
}

/**
 * Resize renderer safely.
 */
export function resizeRenderer(
    renderer,
    camera,
    renderScale = 1
) {
    if (!renderer || !camera) return;

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    const currentPixelRatio =
        renderer.getPixelRatio();

    renderer.setSize(
        width,
        height,
        false
    );

    if (renderScale !== 1) {
        renderer.setPixelRatio(
            currentPixelRatio *
                renderScale
        );
    }

    camera.aspect =
        width / height;

    camera.updateProjectionMatrix();
}

/**
 * Automatically select a starting quality
 * according to device characteristics.
 */
export function detectRecommendedQuality(
    renderer
) {
    if (!renderer) {
        return "medium";
    }

    const capabilities =
        detectGraphicsCapabilities(
            renderer
        );

    const memory =
        typeof navigator !== "undefined" &&
        navigator.deviceMemory
            ? navigator.deviceMemory
            : 4;

    const cores =
        typeof navigator !== "undefined" &&
        navigator.hardwareConcurrency
            ? navigator.hardwareConcurrency
            : 4;

    const mobile =
        typeof navigator !== "undefined" &&
        /Android|iPhone|iPad|iPod/i.test(
            navigator.userAgent
        );

    if (mobile) {
        if (
            memory >= 8 &&
            cores >= 8 &&
            capabilities.maxTextureSize >= 4096
        ) {
            return "high";
        }

        if (
            memory >= 4 &&
            cores >= 6
        ) {
            return "medium";
        }

        return "low";
    }

    if (
        memory >= 16 &&
        cores >= 12 &&
        capabilities.maxTextureSize >= 8192 &&
        capabilities.maxAnisotropy >= 8
    ) {
        return "ultra";
    }

    if (
        memory >= 8 &&
        cores >= 8 &&
        capabilities.maxTextureSize >= 4096
    ) {
        return "high";
    }

    if (
        memory >= 4 &&
        cores >= 4
    ) {
        return "medium";
    }

    return "low";
}

/**
 * Create a diagnostics object for debugging.
 */
export function getGraphicsDiagnostics(renderer) {
    if (!renderer) {
        return {
            available: false
        };
    }

    const capabilities =
        renderer.capabilities;

    const context =
        renderer.getContext();

    return {
        available: true,

        renderer:
            context?.getParameter?.(
                context.RENDERER
            ) ?? "Unknown",

        vendor:
            context?.getParameter?.(
                context.VENDOR
            ) ?? "Unknown",

        webglVersion:
            context?.getParameter?.(
                context.VERSION
            ) ?? "Unknown",

        shadingLanguage:
            context?.getParameter?.(
                context.SHADING_LANGUAGE_VERSION
            ) ?? "Unknown",

        maxTextureSize:
            capabilities.maxTextureSize,

        maxCubemapSize:
            capabilities.maxCubemapSize,

        maxTextures:
            capabilities.maxTextures,

        maxAttributes:
            capabilities.maxAttributes,

        maxVertexUniforms:
            capabilities.maxVertexUniforms,

        maxFragmentUniforms:
            capabilities.maxFragmentUniforms,

        maxAnisotropy:
            capabilities.getMaxAnisotropy?.() ?? 1,

        maxSamples:
            capabilities.maxSamples ?? 0,

        precision:
            capabilities.precision,

        logarithmicDepthBuffer:
            capabilities.logarithmicDepthBuffer,

        reversedDepthBuffer:
            capabilities.reversedDepthBuffer
    };
}

/**
 * Create a renderer configured for AZAD WORLD.
 */
export function createGameRenderer(
    canvas,
    quality = DEFAULT_QUALITY
) {
    if (!canvas) {
        throw new Error(
            "createGameRenderer: canvas element was not found."
        );
    }

    const profile =
        GRAPHICS_PROFILES[quality] ??
        GRAPHICS_PROFILES[DEFAULT_QUALITY];

    let renderer;

    try {
        renderer = new THREE.WebGLRenderer({
            canvas,

            antialias:
                profile.antialias,

            alpha: false,

            depth: true,

            stencil: false,

            powerPreference:
                "high-performance",

            logarithmicDepthBuffer:
                true,

            preserveDrawingBuffer:
                false
        });
    } catch (error) {
        console.error(
            "AZAD WORLD renderer creation failed:",
            error
        );

        throw new Error(
            "WebGL2 could not be initialized on this device."
        );
    }

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    renderer.toneMapping =
        THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure =
        profile.exposure;

    renderer.shadowMap.enabled =
        profile.shadows;

    renderer.shadowMap.type =
        THREE.PCFSoftShadowMap;

    applyGraphicsProfile(
        renderer,
        quality
    );

    return renderer;
}

/**
 * Runtime quality controller.
 */
export class GraphicsController {
    constructor(renderer, camera = null) {
        this.renderer = renderer;
        this.camera = camera;

        this.quality =
            DEFAULT_QUALITY;

        this.renderScale = 1;

        this.capabilities =
            detectGraphicsCapabilities(
                renderer
            );
    }

    setCamera(camera) {
        this.camera = camera;
        return this;
    }

    setQuality(quality) {
        if (!GRAPHICS_PROFILES[quality]) {
            console.warn(
    "Unknown graphics quality: " + quality
);
            );

            return this;
        }

        this.quality = quality;

        applyGraphicsProfile(
            this.renderer,
            quality,
            {
                renderScale:
                    this.renderScale
            }
        );

        return this;
    }

    setRenderScale(scale) {
        this.renderScale = clamp(
            Number(scale) || 1,
            0.5,
            1.5
        );

        applyGraphicsProfile(
            this.renderer,
            this.quality,
            {
                renderScale:
                    this.renderScale
            }
        );

        return this;
    }

    setExposure(exposure) {
        if (!this.renderer) return this;

        this.renderer.toneMappingExposure =
            clamp(
                Number(exposure) || 1,
                0.5,
                2
            );

        return this;
    }

    resize() {
        if (!this.camera) return;

        resizeRenderer(
            this.renderer,
            this.camera
        );
    }

    getDiagnostics() {
        return getGraphicsDiagnostics(
            this.renderer
        );
    }

    getProfile() {
        return (
            GRAPHICS_PROFILES[
                this.quality
            ] ??
            GRAPHICS_PROFILES[
                DEFAULT_QUALITY
            ]
        );
    }
}

export default {
    GRAPHICS_PROFILES,
    createGameRenderer,
    applyGraphicsProfile,
    configureShadowLight,
    configureShadows,
    configureObjectTextures,
    prepare3DAsset,
    detectGraphicsCapabilities,
    detectRecommendedQuality,
    getGraphicsDiagnostics,
    resizeRenderer,
    getRecommendedAnisotropy,
    configureTexture,
    GraphicsController
};
```
