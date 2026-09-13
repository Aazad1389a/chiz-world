import * as THREE from "three";

/**
 * AZAD WORLD
 * Graphics / WebGL utilities.
 *
 * This file is loaded directly by the browser and must contain plain
 * JavaScript only; it must never be wrapped in Markdown code fences.
 */

export const GRAPHICS_PROFILES = {
    low: { name: "Low", pixelRatio: 0.75, maxPixelRatio: 1, shadows: false, shadowMapSize: 512, exposure: 1.0, antialias: false, textureAnisotropy: 1 },
    medium: { name: "Medium", pixelRatio: 1, maxPixelRatio: 1.5, shadows: true, shadowMapSize: 1024, exposure: 1.05, antialias: true, textureAnisotropy: 2 },
    high: { name: "High", pixelRatio: 1.25, maxPixelRatio: 2, shadows: true, shadowMapSize: 2048, exposure: 1.1, antialias: true, textureAnisotropy: 4 },
    ultra: { name: "Ultra", pixelRatio: 1.5, maxPixelRatio: 2, shadows: true, shadowMapSize: 4096, exposure: 1.15, antialias: true, textureAnisotropy: 8 }
};

const DEFAULT_QUALITY = "high";

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function normalizeQuality(value) {
    if (typeof value === "string" && GRAPHICS_PROFILES[value]) return value;
    if (value && typeof value === "object" && typeof value.quality === "string") {
        return normalizeQuality(value.quality);
    }
    return DEFAULT_QUALITY;
}

export function detectGraphicsCapabilities(renderer = null) {
    if (!renderer || !renderer.capabilities) {
        return { available: false, webgl2: false, maxTextureSize: 0, maxCubemapSize: 0, maxTextures: 0, maxAttributes: 0, maxVertexUniforms: 0, maxFragmentUniforms: 0, maxAnisotropy: 1, maxSamples: 0, highPrecision: false, precision: "unknown" };
    }

    const capabilities = renderer.capabilities;
    let webgl2 = false;
    try {
        const context = renderer.getContext?.();
        webgl2 = typeof WebGL2RenderingContext !== "undefined" && context instanceof WebGL2RenderingContext;
    } catch {
        webgl2 = false;
    }

    return {
        available: true,
        webgl2,
        maxTextureSize: capabilities.maxTextureSize ?? 0,
        maxCubemapSize: capabilities.maxCubemapSize ?? 0,
        maxTextures: capabilities.maxTextures ?? 0,
        maxAttributes: capabilities.maxAttributes ?? 0,
        maxVertexUniforms: capabilities.maxVertexUniforms ?? 0,
        maxFragmentUniforms: capabilities.maxFragmentUniforms ?? 0,
        maxAnisotropy: capabilities.getMaxAnisotropy?.() ?? 1,
        maxSamples: capabilities.maxSamples ?? 0,
        highPrecision: capabilities.precision === "highp",
        precision: capabilities.precision ?? "unknown"
    };
}

export function getRecommendedAnisotropy(renderer, quality = DEFAULT_QUALITY) {
    if (!renderer?.capabilities) return 1;
    const profile = GRAPHICS_PROFILES[normalizeQuality(quality)];
    const max = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
    return Math.max(1, Math.min(profile.textureAnisotropy, max));
}

export function configureTexture(texture, renderer, quality = DEFAULT_QUALITY) {
    if (!texture || !renderer) return texture;
    texture.anisotropy = getRecommendedAnisotropy(renderer, quality);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

export function configureObjectTextures(object, renderer, quality = DEFAULT_QUALITY) {
    if (!object) return;
    object.traverse?.((child) => {
        if (!child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
            for (const property of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "clearcoatMap", "clearcoatNormalMap", "clearcoatRoughnessMap", "transmissionMap"]) {
                if (material[property]) configureTexture(material[property], renderer, quality);
            }
        }
    });
}

export function configureShadowLight(light, quality = DEFAULT_QUALITY) {
    if (!light?.shadow) return light;
    const size = GRAPHICS_PROFILES[normalizeQuality(quality)].shadowMapSize;
    light.shadow.mapSize?.set(size, size);
    return light;
}

export function configureShadows(renderer, quality = DEFAULT_QUALITY) {
    if (!renderer) return renderer;
    const profile = GRAPHICS_PROFILES[normalizeQuality(quality)];
    renderer.shadowMap.enabled = profile.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    return renderer;
}

export function applyGraphicsProfile(renderer, quality = DEFAULT_QUALITY, options = {}) {
    if (!renderer) throw new Error("applyGraphicsProfile: renderer is required.");
    const profile = GRAPHICS_PROFILES[normalizeQuality(quality)];
    const renderScale = clamp(Number(options.renderScale) || 1, 0.5, 1.5);
    const deviceRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const pixelRatio = Math.min(deviceRatio * profile.pixelRatio * renderScale, profile.maxPixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = profile.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = profile.exposure;
    return renderer;
}

export function prepare3DAsset(object, renderer, quality = DEFAULT_QUALITY) {
    configureObjectTextures(object, renderer, quality);
    return object;
}

export function detectRecommendedQuality() {
    if (typeof navigator === "undefined") return DEFAULT_QUALITY;
    const memory = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (memory <= 2 || cores <= 2) return "low";
    if (memory <= 4 || cores <= 4) return "medium";
    return DEFAULT_QUALITY;
}

export function getGraphicsDiagnostics(renderer = null) {
    if (!renderer) return { available: false };
    const capabilities = detectGraphicsCapabilities(renderer);
    const context = renderer.getContext?.();
    return {
        ...capabilities,
        renderer: context?.getParameter?.(context.RENDERER) ?? "Unknown",
        vendor: context?.getParameter?.(context.VENDOR) ?? "Unknown",
        webglVersion: context?.getParameter?.(context.VERSION) ?? "Unknown",
        shadingLanguage: context?.getParameter?.(context.SHADING_LANGUAGE_VERSION) ?? "Unknown"
    };
}

export function resizeRenderer(renderer, camera, width = null, height = null) {
    if (!renderer || !camera) return;
    const canvas = renderer.domElement;
    const w = Math.max(1, width ?? canvas.clientWidth ?? window.innerWidth);
    const h = Math.max(1, height ?? canvas.clientHeight ?? window.innerHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

export function createGameRenderer(canvas, quality = DEFAULT_QUALITY) {
    if (!canvas) throw new Error("createGameRenderer: canvas element was not found.");
    const selectedQuality = normalizeQuality(quality);
    const profile = GRAPHICS_PROFILES[selectedQuality];
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: profile.antialias,
            alpha: false,
            depth: true,
            stencil: false,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: true,
            preserveDrawingBuffer: false
        });
    } catch (error) {
        console.error("AZAD WORLD renderer creation failed:", error);
        throw new Error("WebGL could not be initialized on this device.");
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    applyGraphicsProfile(renderer, selectedQuality);
    return renderer;
}

export class GraphicsController {
    constructor(renderer = null, camera = null) {
        if (renderer && !renderer.capabilities && typeof renderer === "object" && renderer.quality) {
            this.renderer = null;
            this.camera = camera;
            this.quality = normalizeQuality(renderer.quality);
        } else {
            this.renderer = renderer;
            this.camera = camera;
            this.quality = DEFAULT_QUALITY;
        }
        this.renderScale = 1;
        this.capabilities = detectGraphicsCapabilities(this.renderer);
    }

    setRenderer(renderer) {
        this.renderer = renderer;
        this.capabilities = detectGraphicsCapabilities(renderer);
        if (renderer) applyGraphicsProfile(renderer, this.quality, { renderScale: this.renderScale });
        return this;
    }

    setCamera(camera) {
        this.camera = camera;
        return this;
    }

    setQuality(quality) {
        this.quality = normalizeQuality(quality);
        if (this.renderer) applyGraphicsProfile(this.renderer, this.quality, { renderScale: this.renderScale });
        return this;
    }

    setRenderScale(scale) {
        this.renderScale = clamp(Number(scale) || 1, 0.5, 1.5);
        if (this.renderer) applyGraphicsProfile(this.renderer, this.quality, { renderScale: this.renderScale });
        return this;
    }

    setExposure(exposure) {
        if (this.renderer) this.renderer.toneMappingExposure = clamp(Number(exposure) || 1, 0.5, 2);
        return this;
    }

    resize() {
        resizeRenderer(this.renderer, this.camera);
    }

    getDiagnostics() {
        return getGraphicsDiagnostics(this.renderer);
    }

    getProfile() {
        return GRAPHICS_PROFILES[this.quality];
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
