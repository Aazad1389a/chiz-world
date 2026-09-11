```javascript
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

/**
 * AZAD WORLD
 * Advanced Asset Manager
 *
 * Handles:
 * - GLB / GLTF models
 * - Draco compressed models
 * - KTX2 compressed textures
 * - Texture configuration
 * - Asset caching
 * - Progress tracking
 * - Loading errors
 * - Automatic shadow setup
 */

export class AssetManager {
    constructor(renderer, options = {}) {
        this.renderer = renderer;

        this.basePath =
            options.basePath || "./assets/";

        this.cache = new Map();

        this.loading = new Map();

        this.totalAssets = 0;
        this.loadedAssets = 0;

        this.onProgress =
            options.onProgress || null;

        this.onLoad =
            options.onLoad || null;

        this.onError =
            options.onError || null;

        this.quality =
            options.quality || "high";

        this.gltfLoader =
            new GLTFLoader();

        this.dracoLoader =
            new DRACOLoader();

        this.ktx2Loader =
            new KTX2Loader();

        this.configureLoaders();
    }

    /**
     * Configure Draco decoder.
     */
    configureLoaders() {
        this.dracoLoader.setDecoderPath(
            "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/"
        );

        this.gltfLoader.setDRACOLoader(
            this.dracoLoader
        );

        try {
            this.ktx2Loader
                .setTranscoderPath(
                    "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/basis/"
                )
                .detectSupport(
                    this.renderer
                );

            this.gltfLoader.setKTX2Loader(
                this.ktx2Loader
            );
        } catch (error) {
            console.warn(
                "KTX2 support could not be initialized:",
                error
            );
        }
    }

    /**
     * Build an asset URL.
     */
    resolve(path) {
        if (!path) return "";

        if (
            path.startsWith("http://") ||
            path.startsWith("https://") ||
            path.startsWith("/")
        ) {
            return path;
        }

        return `${this.basePath}${path}`;
    }

    /**
     * Load a GLB / GLTF model.
     */
    async loadModel(path, options = {}) {
        const url = this.resolve(path);

        if (!url) {
            throw new Error(
                "AssetManager.loadModel: invalid path."
            );
        }

        if (this.cache.has(url)) {
            return this.cache.get(url);
        }

        if (this.loading.has(url)) {
            return this.loading.get(url);
        }

        this.totalAssets++;

        const promise = new Promise(
            (resolve, reject) => {
                this.gltfLoader.load(
                    url,

                    (gltf) => {
                        try {
                            const asset =
                                this.prepareModel(
                                    gltf,
                                    options
                                );

                            this.cache.set(
                                url,
                                asset
                            );

                            this.loading.delete(
                                url
                            );

                            this.loadedAssets++;

                            this.emitProgress();

                            if (this.onLoad) {
                                this.onLoad(
                                    asset,
                                    url
                                );
                            }

                            resolve(asset);
                        } catch (error) {
                            this.loading.delete(
                                url
                            );

                            this.handleError(
                                error,
                                url
                            );

                            reject(error);
                        }
                    },

                    (event) => {
                        this.handleIndividualProgress(
                            event,
                            url
                        );
                    },

                    (error) => {
                        this.loading.delete(
                            url
                        );

                        this.handleError(
                            error,
                            url
                        );

                        reject(error);
                    }
                );
            }
        );

        this.loading.set(
            url,
            promise
        );

        return promise;
    }

    /**
     * Prepare loaded GLTF model.
     */
    prepareModel(gltf, options = {}) {
        const scene =
            gltf.scene ||
            gltf.scenes?.[0];

        if (!scene) {
            throw new Error(
                "GLTF file does not contain a scene."
            );
        }

        scene.traverse((object) => {
            if (!object.isMesh) return;

            object.castShadow =
                options.castShadow ?? true;

            object.receiveShadow =
                options.receiveShadow ?? true;

            object.frustumCulled = true;

            if (object.material) {
                const materials =
                    Array.isArray(
                        object.material
                    )
                        ? object.material
                        : [object.material];

                for (const material of materials) {
                    this.configureMaterial(
                        material
                    );
                }
            }
        });

        return {
            scene,

            animations:
                gltf.animations || [],

            cameras:
                gltf.cameras || [],

            asset:
                gltf.asset || null,

            parser:
                gltf.parser || null,

            userData: {
                source:
                    gltf.userData || {}
            }
        };
    }

    /**
     * Configure PBR material.
     */
    configureMaterial(material) {
        if (!material) return;

        if (
            material.isMeshStandardMaterial ||
            material.isMeshPhysicalMaterial
        ) {
            material.envMapIntensity =
                this.getEnvironmentIntensity();

            material.needsUpdate = true;
        }

        const textureNames = [
            "map",
            "normalMap",
            "roughnessMap",
            "metalnessMap",
            "aoMap",
            "emissiveMap",
            "alphaMap",
            "clearcoatMap",
            "clearcoatNormalMap",
            "clearcoatRoughnessMap",
            "transmissionMap",
            "thicknessMap",
            "sheenColorMap",
            "sheenRoughnessMap"
        ];

        for (const name of textureNames) {
            const texture =
                material[name];

            if (!texture) continue;

            texture.colorSpace =
                name === "map" ||
                name === "emissiveMap" ||
                name === "sheenColorMap"
                    ? THREE.SRGBColorSpace
                    : THREE.NoColorSpace;

            texture.anisotropy =
                this.getAnisotropy();

            texture.needsUpdate = true;
        }
    }

    /**
     * Calculate texture anisotropy.
     */
    getAnisotropy() {
        if (!this.renderer) {
            return 1;
        }

        const max =
            this.renderer
                .capabilities
                .getMaxAnisotropy?.() || 1;

        const requested = {
            low: 1,
            medium: 2,
            high: 4,
            ultra: 8
        }[this.quality] || 4;

        return Math.min(
            requested,
            max
        );
    }

    /**
     * Environment reflection intensity.
     */
    getEnvironmentIntensity() {
        return {
            low: 0.7,
            medium: 0.9,
            high: 1.1,
            ultra: 1.25
        }[this.quality] || 1.1;
    }

    /**
     * Load multiple models.
     */
    async loadModels(paths, options = {}) {
        if (!Array.isArray(paths)) {
            throw new Error(
                "loadModels expects an array."
            );
        }

        const results =
            await Promise.all(
                paths.map((path) =>
                    this.loadModel(
                        path,
                        options
                    )
                )
            );

        return results;
    }

    /**
     * Load a texture.
     */
    async loadTexture(path, options = {}) {
        const url = this.resolve(path);

        if (this.cache.has(url)) {
            return this.cache.get(url);
        }

        this.totalAssets++;

        const loader =
            new THREE.TextureLoader();

        return new Promise(
            (resolve, reject) => {
                loader.load(
                    url,

                    (texture) => {
                        this.configureTexture(
                            texture,
                            options
                        );

                        this.cache.set(
                            url,
                            texture
                        );

                        this.loadedAssets++;

                        this.emitProgress();

                        resolve(texture);
                    },

                    (event) => {
                        this.handleIndividualProgress(
                            event,
                            url
                        );
                    },

                    (error) => {
                        this.handleError(
                            error,
                            url
                        );

                        reject(error);
                    }
                );
            }
        );
    }

    /**
     * Configure normal/PBR texture.
     */
    configureTexture(
        texture,
        options = {}
    ) {
        if (!texture) return;

        const color =
            options.color === true;

        texture.colorSpace =
            color
                ? THREE.SRGBColorSpace
                : THREE.NoColorSpace;

        texture.anisotropy =
            this.getAnisotropy();

        texture.wrapS =
            options.wrapS ??
            THREE.RepeatWrapping;

        texture.wrapT =
            options.wrapT ??
            THREE.RepeatWrapping;

        texture.minFilter =
            THREE.LinearMipmapLinearFilter;

        texture.magFilter =
            THREE.LinearFilter;

        texture.needsUpdate = true;

        return texture;
    }

    /**
     * Clone a loaded model.
     */
    cloneModel(asset) {
        if (!asset?.scene) {
            return null;
        }

        const clone =
            asset.scene.clone(true);

        clone.traverse((object) => {
            if (!object.isMesh) return;

            if (object.material) {
                object.material =
                    Array.isArray(
                        object.material
                    )
                        ? object.material.map(
                            (material) =>
                                material.clone()
                        )
                        : object.material.clone();
            }
        });

        return {
            scene: clone,

            animations:
                asset.animations || [],

            cameras:
                asset.cameras || [],

            asset:
                asset.asset || null
        };
    }

    /**
     * Get cached asset.
     */
    get(path) {
        const url = this.resolve(path);

        return this.cache.get(url) || null;
    }

    /**
     * Check cache.
     */
    has(path) {
        const url = this.resolve(path);

        return this.cache.has(url);
    }

    /**
     * Remove asset from cache.
     */
    remove(path) {
        const url = this.resolve(path);

        const asset =
            this.cache.get(url);

        if (!asset) return false;

        this.disposeAsset(asset);

        this.cache.delete(url);

        return true;
    }

    /**
     * Dispose model resources.
     */
    disposeAsset(asset) {
        if (!asset) return;

        const root =
            asset.scene || asset;

        if (!root?.traverse) return;

        root.traverse((object) => {
            if (!object.isMesh) return;

            if (object.geometry) {
                object.geometry.dispose();
            }

            if (object.material) {
                const materials =
                    Array.isArray(
                        object.material
                    )
                        ? object.material
                        : [object.material];

                for (const material of materials) {
                    this.disposeMaterial(
                        material
                    );
                }
            }
        });
    }

    /**
     * Dispose material textures.
     */
    disposeMaterial(material) {
        if (!material) return;

        const textures = [
            "map",
            "normalMap",
            "roughnessMap",
            "metalnessMap",
            "aoMap",
            "emissiveMap",
            "alphaMap",
            "clearcoatMap",
            "clearcoatNormalMap",
            "clearcoatRoughnessMap",
            "transmissionMap",
            "thicknessMap",
            "sheenColorMap",
            "sheenRoughnessMap"
        ];

        for (const name of textures) {
            const texture =
                material[name];

            if (texture) {
                texture.dispose();
            }
        }

        material.dispose();
    }

    /**
     * Clear all cached assets.
     */
    clearCache() {
        for (const asset of this.cache.values()) {
            this.disposeAsset(asset);
        }

        this.cache.clear();
    }

    /**
     * Progress callback.
     */
    emitProgress() {
        const progress =
            this.totalAssets > 0
                ? this.loadedAssets /
                  this.totalAssets
                : 1;

        if (this.onProgress) {
            this.onProgress({
                loaded:
                    this.loadedAssets,

                total:
                    this.totalAssets,

                progress
            });
        }
    }

    /**
     * Individual network progress.
     */
    handleIndividualProgress(
        event,
        url
    ) {
        if (!this.onProgress) return;

        if (
            event &&
            event.lengthComputable
        ) {
            this.onProgress({
                loaded:
                    event.loaded,

                total:
                    event.total,

                progress:
                    event.total > 0
                        ? event.loaded /
                          event.total
                        : 0,

                asset: url
            });
        }
    }

    /**
     * Error handling.
     */
    handleError(error, url) {
        console.error(
            `AZAD WORLD asset error: ${url}`,
            error
        );

        if (this.onError) {
            this.onError(
                error,
                url
            );
        }
    }

    /**
     * Destroy manager.
     */
    dispose() {
        this.clearCache();

        this.dracoLoader.dispose();

        this.ktx2Loader.dispose();

        this.cache.clear();

        this.loading.clear();
    }
}

export default AssetManager;
```
