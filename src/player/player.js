import * as THREE from "three";

import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";
import {
    playerController
} from "./controller.js";

/**
 * AZAD WORLD
 * Player
 *
 * مسئول:
 * - ساخت آبجکت سه‌بعدی بازیکن
 * - اتصال مدل به PlayerController
 * - هماهنگ کردن Position / Rotation
 * - مدیریت مدل بازیکن
 * - نمایش/مخفی کردن بازیکن
 * - Scale
 * - نام بازیکن
 * - آماده‌سازی برای Animation
 * - آماده‌سازی برای Multiplayer
 */

const DEFAULT_PLAYER = {
    height: 1.8,
    width: 0.7,
    depth: 0.7,

    position: {
        x: 0,
        y: 0,
        z: 0
    },

    rotation: {
        x: 0,
        y: 0,
        z: 0
    },

    scale: 1
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function createEmitter() {
    const listeners = new Map();

    return {
        on(event, callback) {
            if (typeof callback !== "function") {
                return () => {};
            }

            if (!listeners.has(event)) {
                listeners.set(event, new Set());
            }

            listeners.get(event).add(callback);

            return () => {
                listeners.get(event)?.delete(callback);
            };
        },

        off(event, callback) {
            listeners.get(event)?.delete(callback);
        },

        emit(event, data) {
            const callbacks = listeners.get(event);

            if (!callbacks) {
                return;
            }

            for (const callback of callbacks) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(
                        `[Player] Event "${event}" error:`,
                        error
                    );
                }
            }
        },

        clear() {
            listeners.clear();
        }
    };
}

function getConfigValue(path, fallback) {
    try {
        let value = GAME_CONFIG;

        for (const key of path) {
            if (value == null) {
                return fallback;
            }

            value = value[key];
        }

        return value ?? fallback;
    } catch {
        return fallback;
    }
}

export class Player {
    constructor(options = {}) {
        this.options = options;

        this.config = {
            height:
                options.height ??
                getConfigValue(
                    ["player", "height"],
                    DEFAULT_PLAYER.height
                ),

            width:
                options.width ??
                getConfigValue(
                    ["player", "width"],
                    DEFAULT_PLAYER.width
                ),

            depth:
                options.depth ??
                getConfigValue(
                    ["player", "depth"],
                    DEFAULT_PLAYER.depth
                ),

            scale:
                options.scale ??
                DEFAULT_PLAYER.scale
        };

        /**
         * Main Three.js container.
         */
        this.object = new THREE.Group();

        this.object.name = "Player";

        /**
         * Container for the visual model.
         */
        this.model = new THREE.Group();

        this.model.name = "PlayerModel";

        this.object.add(this.model);

        /**
         * Optional collision representation.
         */
        this.collider = null;

        /**
         * Current visual model.
         */
        this.currentModel = null;

        /**
         * Animation mixer.
         */
        this.mixer = null;

        /**
         * Loaded animation actions.
         */
        this.animations = new Map();

        this.currentAnimation = null;

        /**
         * Player name.
         */
        this.name = "Player";

        /**
         * Player ID.
         */
        this.id = null;

        /**
         * Local / remote.
         */
        this.isLocal = true;

        /**
         * Visibility.
         */
        this.visible = true;

        /**
         * Enable state.
         */
        this.enabled = true;

        /**
         * Temporary fallback model.
         */
        this.placeholder = null;

        /**
         * Model loading state.
         */
        this.loading = false;
        this.loaded = false;

        /**
         * Scale.
         */
        this.scale = this.config.scale;

        /**
         * Event system.
         */
        this.emitter = createEmitter();

        /**
         * Last controller state.
         */
        this.previousState = null;

        /**
         * Statistics.
         */
        this.updateCount = 0;

        /**
         * Initialization state.
         */
        this.initialized = false;
    }

    /**
     * Initialize player.
     */
    initialize(options = {}) {
        if (this.initialized) {
            return this;
        }

        this.name =
            options.name ??
            this.name;

        this.id =
            options.id ??
            this.id;

        this.isLocal =
            options.isLocal ??
            true;

        /**
         * Create fallback visual.
         *
         * This is temporary until the
         * real GLB/GLTF character is loaded.
         */
        if (!this.currentModel) {
            this.createPlaceholder();
        }

        /**
         * Start from controller state.
         */
        this.syncFromController();

        this.initialized = true;

        this.emitter.emit(
            "initialized",
            this.getSnapshot()
        );

        return this;
    }

    /**
     * Create temporary player model.
     *
     * This prevents the world from being
     * empty before the real model loads.
     */
    createPlaceholder() {
        if (this.placeholder) {
            return this.placeholder;
        }

        const group = new THREE.Group();

        group.name = "PlayerPlaceholder";

        /**
         * Body.
         */
        const bodyGeometry =
            new THREE.CapsuleGeometry(
                0.32,
                1.0,
                8,
                16
            );

        const bodyMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x4f7cff,
                roughness: 0.65,
                metalness: 0.05
            });

        const body =
            new THREE.Mesh(
                bodyGeometry,
                bodyMaterial
            );

        body.name = "PlaceholderBody";

        body.position.y = 0.9;

        body.castShadow = true;
        body.receiveShadow = true;

        group.add(body);

        /**
         * Head.
         */
        const headGeometry =
            new THREE.SphereGeometry(
                0.24,
                24,
                16
            );

        const headMaterial =
            new THREE.MeshStandardMaterial({
                color: 0xf0c7a0,
                roughness: 0.8,
                metalness: 0
            });

        const head =
            new THREE.Mesh(
                headGeometry,
                headMaterial
            );

        head.name = "PlaceholderHead";

        head.position.y = 1.65;

        head.castShadow = true;
        head.receiveShadow = true;

        group.add(head);

        /**
         * Simple direction marker.
         */
        const markerGeometry =
            new THREE.BoxGeometry(
                0.08,
                0.08,
                0.35
            );

        const markerMaterial =
            new THREE.MeshStandardMaterial({
                color: 0xffffff,
                emissive: 0x222222
            });

        const marker =
            new THREE.Mesh(
                markerGeometry,
                markerMaterial
            );

        marker.name = "DirectionMarker";

        marker.position.set(
            0,
            1.0,
            -0.28
        );

        group.add(marker);

        this.model.add(group);

        this.placeholder = group;

        this.currentModel = group;

        this.applyShadowSettings(group);

        this.emitter.emit(
            "placeholderCreated",
            group
        );

        return group;
    }

    /**
     * Apply shadow settings recursively.
     */
    applyShadowSettings(object) {
        if (!object) {
            return;
        }

        object.traverse((child) => {
            if (!child.isMesh) {
                return;
            }

            child.castShadow = true;
            child.receiveShadow = true;

            if (child.material) {
                child.material.needsUpdate = true;
            }
        });
    }

    /**
     * Attach a loaded GLTF/GLB model.
     */
    setModel(model, options = {}) {
        if (!model) {
            console.warn(
                "[Player] Invalid model."
            );

            return false;
        }

        /**
         * Remove previous model.
         */
        if (this.currentModel) {
            this.removeCurrentModel();
        }

        this.currentModel = model;

        this.model.add(model);

        /**
         * Apply model scale.
         */
        const modelScale =
            options.scale ??
            this.scale;

        model.scale.setScalar(
            modelScale
        );

        /**
         * Optional model offset.
         */
        if (options.position) {
            model.position.set(
                options.position.x ?? 0,
                options.position.y ?? 0,
                options.position.z ?? 0
            );
        }

        if (options.rotation) {
            model.rotation.set(
                options.rotation.x ?? 0,
                options.rotation.y ?? 0,
                options.rotation.z ?? 0
            );
        }

        this.applyShadowSettings(model);

        /**
         * Setup animations if GLTF data
         * was passed.
         */
        if (options.animations) {
            this.setupAnimations(
                options.animations
            );
        }

        this.loaded = true;

        this.emitter.emit(
            "modelLoaded",
            {
                model,
                options
            }
        );

        return true;
    }

    /**
     * Setup animation mixer.
     */
    setupAnimations(animations = []) {
        if (!this.currentModel) {
            return;
        }

        if (!Array.isArray(animations)) {
            return;
        }

        this.mixer =
            new THREE.AnimationMixer(
                this.currentModel
            );

        this.animations.clear();

        for (const clip of animations) {
            if (!clip?.name) {
                continue;
            }

            const action =
                this.mixer.clipAction(clip);

            this.animations.set(
                clip.name,
                action
            );
        }

        this.emitter.emit(
            "animationsReady",
            {
                count: this.animations.size
            }
        );
    }

    /**
     * Play animation.
     */
    playAnimation(
        name,
        {
            fade = 0.2,
            loop = THREE.LoopRepeat
        } = {}
    ) {
        const action =
            this.animations.get(name);

        if (!action) {
            return false;
        }

        if (
            this.currentAnimation ===
            action
        ) {
            return true;
        }

        if (this.currentAnimation) {
            this.currentAnimation.fadeOut(
                fade
            );
        }

        action
            .reset()
            .fadeIn(fade)
            .setLoop(loop, Infinity)
            .play();

        this.currentAnimation = action;

        this.emitter.emit(
            "animationChanged",
            {
                name,
                action
            }
        );

        return true;
    }

    /**
     * Stop current animation.
     */
    stopAnimation(fade = 0.2) {
        if (!this.currentAnimation) {
            return;
        }

        this.currentAnimation.fadeOut(
            fade
        );

        this.currentAnimation = null;
    }

    /**
     * Remove current visual model.
     */
    removeCurrentModel() {
        if (!this.currentModel) {
            return;
        }

        this.model.remove(
            this.currentModel
        );

        this.disposeObject(
            this.currentModel
        );

        this.currentModel = null;
        this.placeholder = null;
        this.loaded = false;

        this.mixer = null;
        this.animations.clear();
        this.currentAnimation = null;
    }

    /**
     * Main update.
     */
    update(deltaTime = 1 / 60) {
        if (!this.initialized) {
            this.initialize();
        }

        if (!this.enabled) {
            return;
        }

        const dt = clamp(
            Number(deltaTime) || 1 / 60,
            0,
            0.05
        );

        /**
         * Synchronize visual object
         * with player controller.
         */
        this.syncFromController();

        /**
         * Update animation mixer.
         */
        if (this.mixer) {
            this.mixer.update(dt);
        }

        this.updateAnimationState();

        this.updateCount++;
    }

    /**
     * Synchronize Three.js object with
     * PlayerController.
     */
    syncFromController() {
        if (!playerController) {
            return;
        }

        const state =
            playerController.getSnapshot();

        if (!state) {
            return;
        }

        /**
         * Position.
         */
        this.object.position.set(
            state.position.x,
            state.position.y,
            state.position.z
        );

        /**
         * Rotation.
         */
        this.object.rotation.set(
            state.rotation.x,
            state.rotation.y,
            state.rotation.z
        );

        /**
         * Visibility based on alive state.
         */
        this.object.visible =
            this.visible &&
            (state.alive !== false);

        /**
         * Detect meaningful state changes.
         */
        if (this.previousState) {
            if (
                !this.previousState.grounded &&
                state.grounded
            ) {
                this.emitter.emit(
                    "landed",
                    state
                );
            }

            if (
                this.previousState.grounded &&
                !state.grounded
            ) {
                this.emitter.emit(
                    "airborne",
                    state
                );
            }

            if (
                !this.previousState.alive &&
                state.alive
            ) {
                this.emitter.emit(
                    "respawned",
                    state
                );
            }

            if (
                this.previousState.alive &&
                !state.alive
            ) {
                this.emitter.emit(
                    "died",
                    state
                );
            }

            if (
                !this.previousState.sprinting &&
                state.sprinting
            ) {
                this.emitter.emit(
                    "sprintStart",
                    state
                );
            }

            if (
                this.previousState.sprinting &&
                !state.sprinting
            ) {
                this.emitter.emit(
                    "sprintStop",
                    state
                );
            }
        }

        this.previousState = {
            ...state,
            position: {
                ...state.position
            },
            rotation: {
                ...state.rotation
            },
            velocity: {
                ...state.velocity
            }
        };
    }

    /**
     * Select basic animation automatically.
     *
     * Works if animations with these names
     * exist in the model.
     */
    updateAnimationState() {
        if (!this.animations.size) {
            return;
        }

        const state =
            playerController.getSnapshot();

        if (!state) {
            return;
        }

        const horizontalSpeed =
            Math.sqrt(
                state.velocity.x *
                state.velocity.x +
                state.velocity.z *
                state.velocity.z
            );

        let animationName = null;

        if (!state.alive) {
            animationName = "death";
        } else if (!state.grounded) {
            animationName = "jump";
        } else if (
            state.sprinting &&
            horizontalSpeed > 0.1
        ) {
            animationName = "run";
        } else if (
            horizontalSpeed > 0.1
        ) {
            animationName = "walk";
        } else {
            animationName = "idle";
        }

        if (
            this.animations.has(animationName)
        ) {
            this.playAnimation(
                animationName
            );
        }
    }

    /**
     * Add player to a Three.js scene.
     */
    addToScene(scene) {
        if (!scene) {
            return false;
        }

        scene.add(this.object);

        this.emitter.emit(
            "addedToScene",
            scene
        );

        return true;
    }

    /**
     * Remove player from scene.
     */
    removeFromScene(scene) {
        if (!scene) {
            return false;
        }

        scene.remove(this.object);

        this.emitter.emit(
            "removedFromScene",
            scene
        );

        return true;
    }

    /**
     * Set player visibility.
     */
    setVisible(visible) {
        this.visible = Boolean(visible);

        this.object.visible =
            this.visible;

        return this.visible;
    }

    /**
     * Set enabled state.
     */
    setEnabled(enabled) {
        this.enabled =
            Boolean(enabled);

        if (!this.enabled) {
            this.stopAnimation();
        }

        return this.enabled;
    }

    /**
     * Set model scale.
     */
    setScale(scale = 1) {
        const safeScale =
            Math.max(
                0.01,
                Number(scale) || 1
            );

        this.scale = safeScale;

        if (this.currentModel) {
            this.currentModel.scale.setScalar(
                safeScale
            );
        }

        return safeScale;
    }

    /**
     * Set player name.
     */
    setName(name = "Player") {
        this.name =
            String(name || "Player");

        this.emitter.emit(
            "nameChanged",
            this.name
        );

        return this.name;
    }

    /**
     * Set player ID.
     */
    setId(id = null) {
        this.id =
            id == null
                ? null
                : String(id);

        return this.id;
    }

    /**
     * Set local / remote mode.
     */
    setLocal(isLocal = true) {
        this.isLocal =
            Boolean(isLocal);

        return this.isLocal;
    }

    /**
     * Get Three.js object.
     */
    getObject() {
        return this.object;
    }

    /**
     * Get model container.
     */
    getModelContainer() {
        return this.model;
    }

    /**
     * Get current model.
     */
    getModel() {
        return this.currentModel;
    }

    /**
     * Get position.
     */
    getPosition() {
        return {
            x: this.object.position.x,
            y: this.object.position.y,
            z: this.object.position.z
        };
    }

    /**
     * Get rotation.
     */
    getRotation() {
        return {
            x: this.object.rotation.x,
            y: this.object.rotation.y,
            z: this.object.rotation.z
        };
    }

    /**
     * Get player snapshot.
     */
    getSnapshot() {
        const controllerState =
            playerController
                ? playerController.getSnapshot()
                : null;

        return {
            id: this.id,
            name: this.name,
            isLocal: this.isLocal,

            visible: this.visible,
            enabled: this.enabled,

            initialized: this.initialized,
            loaded: this.loaded,

            position: this.getPosition(),
            rotation: this.getRotation(),

            controller:
                controllerState,

            animation: {
                current:
                    this.currentAnimation
                        ? this.currentAnimation
                            .getClip()
                            ?.name ?? null
                        : null,

                count:
                    this.animations.size
            }
        };
    }

    /**
     * Listen to event.
     */
    on(event, callback) {
        return this.emitter.on(
            event,
            callback
        );
    }

    /**
     * Remove listener.
     */
    off(event, callback) {
        this.emitter.off(
            event,
            callback
        );
    }

    /**
     * Dispose Three.js object.
     */
    disposeObject(object) {
        if (!object) {
            return;
        }

        object.traverse((child) => {
            if (!child.isMesh) {
                return;
            }

            if (child.geometry) {
                child.geometry.dispose();
            }

            if (child.material) {
                const materials =
                    Array.isArray(
                        child.material
                    )
                        ? child.material
                        : [child.material];

                for (const material of materials) {
                    this.disposeMaterial(
                        material
                    );
                }
            }
        });
    }

    /**
     * Dispose material and textures.
     */
    disposeMaterial(material) {
        if (!material) {
            return;
        }

        for (const key of Object.keys(material)) {
            const value =
                material[key];

            if (
                value &&
                value.isTexture
            ) {
                value.dispose();
            }
        }

        material.dispose();
    }

    /**
     * Debug information.
     */
    getDebugInfo() {
        return {
            id: this.id,
            name: this.name,

            local: this.isLocal,

            initialized:
                this.initialized,

            loaded:
                this.loaded,

            visible:
                this.visible,

            enabled:
                this.enabled,

            position:
                this.getPosition(),

            rotation:
                this.getRotation(),

            animations:
                this.animations.size,

            currentAnimation:
                this.currentAnimation
                    ? this.currentAnimation
                        .getClip()
                        ?.name ?? null
                    : null,

            updateCount:
                this.updateCount
        };
    }

    /**
     * Cleanup.
     */
    dispose() {
        this.stopAnimation();

        this.removeCurrentModel();

        if (this.object.parent) {
            this.object.parent.remove(
                this.object
            );
        }

        this.emitter.clear();

        this.initialized = false;
        this.enabled = false;
    }
}

/**
 * Singleton local player.
 */
export const player =
    new Player({
        isLocal: true
    });

/**
 * Initialize helper.
 */
export function initializePlayer(options = {}) {
    return player.initialize(
        options
    );
}

/**
 * Update helper.
 */
export function updatePlayer(deltaTime) {
    player.update(deltaTime);
}

/**
 * Get player.
 */
export function getPlayer() {
    return player;
}

export default player;
