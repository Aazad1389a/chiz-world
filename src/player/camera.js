import * as THREE from "three";

import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";
import { inputManager } from "../core/input-manager.js";
import { playerController } from "./controller.js";
import { player } from "./player.js";

/**
 * AZAD WORLD
 * Player Camera System
 *
 * امکانات:
 * - دوربین Third Person
 * - آماده برای FPS
 * - چرخش با Mouse
 * - پشتیبانی از Touch
 * - حساسیت قابل تنظیم
 * - Smooth Camera
 * - Camera Collision
 * - Zoom
 * - Follow Player
 * - Pitch / Yaw محدود
 * - Head Bob
 * - FOV
 * - Sprint FOV
 * - Shake
 * - اتصال به GameState
 */

const DEFAULTS = {
    mode: "thirdPerson",

    fov: 70,
    near: 0.05,
    far: 5000,

    distance: 5,
    minDistance: 1.2,
    maxDistance: 12,

    height: 1.55,

    mouseSensitivity: 0.0025,
    touchSensitivity: 0.004,

    minPitch: THREE.MathUtils.degToRad(-75),
    maxPitch: THREE.MathUtils.degToRad(75),

    smoothPosition: 14,
    smoothRotation: 18,

    zoomSpeed: 3,

    sprintFov: 76,
    fovSmooth: 8,

    headBobEnabled: true,
    headBobAmount: 0.035,
    headBobSpeed: 10,

    cameraCollision: true,
    collisionPadding: 0.15,

    maxDeltaTime: 0.05
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(current, target, amount) {
    return current + (target - current) * amount;
}

function damp(current, target, smoothing, deltaTime) {
    const amount =
        1 - Math.exp(
            -smoothing * deltaTime
        );

    return lerp(
        current,
        target,
        amount
    );
}

function createEmitter() {
    const listeners = new Map();

    return {
        on(event, callback) {
            if (typeof callback !== "function") {
                return () => {};
            }

            if (!listeners.has(event)) {
                listeners.set(
                    event,
                    new Set()
                );
            }

            listeners
                .get(event)
                .add(callback);

            return () => {
                listeners
                    .get(event)
                    ?.delete(callback);
            };
        },

        off(event, callback) {
            listeners
                .get(event)
                ?.delete(callback);
        },

        emit(event, data) {
            const callbacks =
                listeners.get(event);

            if (!callbacks) {
                return;
            }

            for (const callback of callbacks) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(
                        `[Camera] Event "${event}" error:`,
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

export class PlayerCamera {
    constructor(options = {}) {
        this.options = options;

        this.config = {
            mode:
                options.mode ??
                getConfigValue(
                    ["camera", "mode"],
                    DEFAULTS.mode
                ),

            fov:
                options.fov ??
                getConfigValue(
                    ["camera", "fov"],
                    DEFAULTS.fov
                ),

            near:
                options.near ??
                DEFAULTS.near,

            far:
                options.far ??
                DEFAULTS.far,

            distance:
                options.distance ??
                getConfigValue(
                    ["camera", "distance"],
                    DEFAULTS.distance
                ),

            minDistance:
                options.minDistance ??
                DEFAULTS.minDistance,

            maxDistance:
                options.maxDistance ??
                DEFAULTS.maxDistance,

            height:
                options.height ??
                DEFAULTS.height,

            mouseSensitivity:
                options.mouseSensitivity ??
                getConfigValue(
                    ["camera", "mouseSensitivity"],
                    DEFAULTS.mouseSensitivity
                ),

            touchSensitivity:
                options.touchSensitivity ??
                DEFAULTS.touchSensitivity,

            minPitch:
                options.minPitch ??
                DEFAULTS.minPitch,

            maxPitch:
                options.maxPitch ??
                DEFAULTS.maxPitch,

            smoothPosition:
                options.smoothPosition ??
                DEFAULTS.smoothPosition,

            smoothRotation:
                options.smoothRotation ??
                DEFAULTS.smoothRotation,

            zoomSpeed:
                options.zoomSpeed ??
                DEFAULTS.zoomSpeed,

            sprintFov:
                options.sprintFov ??
                DEFAULTS.sprintFov,

            fovSmooth:
                options.fovSmooth ??
                DEFAULTS.fovSmooth,

            headBobEnabled:
                options.headBobEnabled ??
                DEFAULTS.headBobEnabled,

            headBobAmount:
                options.headBobAmount ??
                DEFAULTS.headBobAmount,

            headBobSpeed:
                options.headBobSpeed ??
                DEFAULTS.headBobSpeed,

            cameraCollision:
                options.cameraCollision ??
                DEFAULTS.cameraCollision,

            collisionPadding:
                options.collisionPadding ??
                DEFAULTS.collisionPadding,

            maxDeltaTime:
                options.maxDeltaTime ??
                DEFAULTS.maxDeltaTime
        };

        /**
         * Three.js camera.
         */
        this.camera =
            new THREE.PerspectiveCamera(
                this.config.fov,
                window.innerWidth /
                    Math.max(
                        window.innerHeight,
                        1
                    ),
                this.config.near,
                this.config.far
            );

        this.camera.name =
            "PlayerCamera";

        /**
         * Camera root.
         */
        this.object =
            new THREE.Group();

        this.object.name =
            "PlayerCameraRoot";

        this.object.add(
            this.camera
        );

        /**
         * Camera mode.
         */
        this.mode =
            this.config.mode;

        /**
         * Target rotation.
         */
        this.yaw = 0;
        this.pitch = 0;

        /**
         * Smoothed rotation.
         */
        this.currentYaw = 0;
        this.currentPitch = 0;

        /**
         * Camera distance.
         */
        this.distance =
            clamp(
                this.config.distance,
                this.config.minDistance,
                this.config.maxDistance
            );

        this.targetDistance =
            this.distance;

        /**
         * Position.
         */
        this.targetPosition =
            new THREE.Vector3();

        this.currentPosition =
            new THREE.Vector3();

        /**
         * Camera look target.
         */
        this.lookTarget =
            new THREE.Vector3();

        /**
         * Player target.
         */
        this.playerTarget =
            new THREE.Vector3();

        /**
         * Mouse state.
         */
        this.mouseSensitivity =
            this.config.mouseSensitivity;

        /**
         * Camera shake.
         */
        this.shake = {
            active: false,
            intensity: 0,
            duration: 0,
            elapsed: 0
        };

        /**
         * Head bob.
         */
        this.headBobTime = 0;

        /**
         * FOV.
         */
        this.currentFov =
            this.config.fov;

        this.targetFov =
            this.config.fov;

        /**
         * Collision.
         */
        this.collisionEnabled =
            this.config.cameraCollision;

        this.collisionObjects = [];

        /**
         * State.
         */
        this.enabled = true;
        this.initialized = false;

        /**
         * Event system.
         */
        this.emitter =
            createEmitter();

        /**
         * Resize handler.
         */
        this.boundResize =
            () => this.resize();

        /**
         * Pointer movement.
         */
        this.boundMouseMove =
            (event) =>
                this.handleMouseMove(event);

        /**
         * Wheel.
         */
        this.boundWheel =
            (event) =>
                this.handleWheel(event);

        /**
         * Last controller state.
         */
        this.previousState = null;
    }

    /**
     * Initialize camera.
     */
    initialize() {
        if (this.initialized) {
            return this;
        }

        window.addEventListener(
            "resize",
            this.boundResize
        );

        window.addEventListener(
            "mousemove",
            this.boundMouseMove
        );

        window.addEventListener(
            "wheel",
            this.boundWheel,
            {
                passive: true
            }
        );

        /**
         * Start camera behind player.
         */
        const position =
            playerController.getPosition();

        this.yaw =
            playerController.getYaw();

        this.currentYaw =
            this.yaw;

        this.playerTarget.set(
            position.x,
            position.y +
                this.config.height,
            position.z
        );

        this.currentPosition.copy(
            this.playerTarget
        );

        this.updateCameraTransform(
            1 / 60
        );

        this.initialized = true;

        this.emitter.emit(
            "initialized",
            this.getSnapshot()
        );

        return this;
    }

    /**
     * Main camera update.
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
            this.config.maxDeltaTime
        );

        this.updatePlayerTarget();

        this.updateInput();

        this.updateRotation(dt);

        this.updateDistance(dt);

        this.updateFov(dt);

        this.updateCameraTransform(dt);

        this.updateHeadBob(dt);

        this.updateShake(dt);

        this.applyFinalTransform();

        this.syncState();
    }

    /**
     * Get player position as camera target.
     */
    updatePlayerTarget() {
        const position =
            playerController.getPosition();

        this.playerTarget.set(
            position.x,
            position.y +
                this.config.height,
            position.z
        );
    }

    /**
     * Read mouse and wheel input.
     *
     * inputManager does not get updated
     * here. The main loop owns that job.
     */
    updateInput() {
        if (!inputManager) {
            return;
        }

        const mouse =
            inputManager.getMouseState?.();

        if (mouse) {
            if (
                Number.isFinite(
                    mouse.deltaX
                ) &&
                Number.isFinite(
                    mouse.deltaY
                )
            ) {
                /**
                 * Mouse movement is handled
                 * by handleMouseMove when
                 * available.
                 */
            }
        }

        /**
         * Keep controller yaw aligned
         * with camera yaw in first-person.
         */
        if (this.mode === "firstPerson") {
            playerController.setYaw(
                this.yaw
            );
        }
    }

    /**
     * Mouse movement.
     */
    handleMouseMove(event) {
        if (!this.enabled) {
            return;
        }

        /**
         * Only react when pointer lock
         * is active or when the game canvas
         * is being used.
         */
        const locked =
            document.pointerLockElement != null;

        const target =
            event.target;

        const isCanvas =
            target instanceof HTMLCanvasElement;

        if (!locked && !isCanvas) {
            return;
        }

        const movementX =
            event.movementX ?? 0;

        const movementY =
            event.movementY ?? 0;

        this.rotate(
            movementX,
            movementY,
            this.mouseSensitivity
        );
    }

    /**
     * Mouse wheel zoom.
     */
    handleWheel(event) {
        if (!this.enabled) {
            return;
        }

        if (
            this.mode ===
            "firstPerson"
        ) {
            return;
        }

        const delta =
            Math.sign(
                event.deltaY
            );

        this.targetDistance +=
            delta *
            this.config.zoomSpeed *
            0.25;

        this.targetDistance =
            clamp(
                this.targetDistance,
                this.config.minDistance,
                this.config.maxDistance
            );
    }

    /**
     * Rotate camera.
     */
    rotate(
        deltaX = 0,
        deltaY = 0,
        sensitivity =
            this.config.mouseSensitivity
    ) {
        this.yaw -=
            deltaX * sensitivity;

        this.pitch -=
            deltaY * sensitivity;

        this.pitch =
            clamp(
                this.pitch,
                this.config.minPitch,
                this.config.maxPitch
            );

        /**
         * Keep yaw within a reasonable range.
         */
        if (
            this.yaw >
            Math.PI * 2
        ) {
            this.yaw -=
                Math.PI * 2;
        }

        if (
            this.yaw <
            -Math.PI * 2
        ) {
            this.yaw +=
                Math.PI * 2;
        }

        if (
            this.mode ===
            "firstPerson"
        ) {
            playerController.setYaw(
                this.yaw
            );
        }

        this.emitter.emit(
            "rotate",
            {
                yaw: this.yaw,
                pitch: this.pitch
            }
        );
    }

    /**
     * Set camera rotation directly.
     */
    setRotation(
        yaw = 0,
        pitch = 0
    ) {
        this.yaw =
            Number(yaw) || 0;

        this.pitch =
            clamp(
                Number(pitch) || 0,
                this.config.minPitch,
                this.config.maxPitch
            );

        this.currentYaw =
            this.yaw;

        this.currentPitch =
            this.pitch;

        if (
            this.mode ===
            "firstPerson"
        ) {
            playerController.setYaw(
                this.yaw
            );
        }
    }

    /**
     * Change camera mode.
     */
    setMode(mode) {
        const normalized =
            String(mode)
                .toLowerCase();

        if (
            normalized !==
                "firstperson" &&
            normalized !==
                "thirdperson" &&
            normalized !==
                "first-person" &&
            normalized !==
                "third-person"
        ) {
            return false;
        }

        if (
            normalized ===
                "firstperson" ||
            normalized ===
                "first-person"
        ) {
            this.mode =
                "firstPerson";

            this.targetDistance = 0;
            this.distance = 0;
        } else {
            this.mode =
                "thirdPerson";

            this.targetDistance =
                clamp(
                    this.config.distance,
                    this.config.minDistance,
                    this.config.maxDistance
                );

            this.distance =
                this.targetDistance;
        }

        this.emitter.emit(
            "modeChanged",
            this.mode
        );

        return true;
    }

    /**
     * Toggle FPS / Third Person.
     */
    toggleMode() {
        if (
            this.mode ===
            "firstPerson"
        ) {
            return this.setMode(
                "thirdPerson"
            );
        }

        return this.setMode(
            "firstPerson"
        );
    }

    /**
     * Smooth rotation.
     */
    updateRotation(deltaTime) {
        this.currentYaw =
            damp(
                this.currentYaw,
                this.yaw,
                this.config.smoothRotation,
                deltaTime
            );

        this.currentPitch =
            damp(
                this.currentPitch,
                this.pitch,
                this.config.smoothRotation,
                deltaTime
            );
    }

    /**
     * Smooth distance.
     */
    updateDistance(deltaTime) {
        if (
            this.mode ===
            "firstPerson"
        ) {
            this.distance = 0;
            return;
        }

        this.distance =
            damp(
                this.distance,
                this.targetDistance,
                12,
                deltaTime
            );
    }

    /**
     * Update FOV.
     */
    updateFov(deltaTime) {
        const state =
            playerController.getSnapshot();

        if (
            state?.sprinting
        ) {
            this.targetFov =
                this.config.sprintFov;
        } else {
            this.targetFov =
                this.config.fov;
        }

        this.currentFov =
            damp(
                this.currentFov,
                this.targetFov,
                this.config.fovSmooth,
                deltaTime
            );

        this.camera.fov =
            this.currentFov;

        this.camera.updateProjectionMatrix();
    }

    /**
     * Calculate camera position.
     */
    updateCameraTransform(deltaTime) {
        const yaw =
            this.currentYaw;

        const pitch =
            this.currentPitch;

        /**
         * First Person.
         */
        if (
            this.mode ===
            "firstPerson"
        ) {
            this.targetPosition.copy(
                this.playerTarget
            );

            this.currentPosition.lerp(
                this.targetPosition,
                1 -
                    Math.exp(
                        -this.config.smoothPosition *
                        deltaTime
                    )
            );

            return;
        }

        /**
         * Third Person.
         *
         * Camera moves behind the player.
         */
        const cosPitch =
            Math.cos(pitch);

        const sinPitch =
            Math.sin(pitch);

        const offsetX =
            Math.sin(yaw) *
            cosPitch *
            this.distance;

        const offsetY =
            sinPitch *
            this.distance;

        const offsetZ =
            Math.cos(yaw) *
            cosPitch *
            this.distance;

        this.targetPosition.set(
            this.playerTarget.x +
                offsetX,

            this.playerTarget.y +
                offsetY,

            this.playerTarget.z +
                offsetZ
        );

        /**
         * Basic camera collision.
         */
        if (
            this.collisionEnabled
        ) {
            this.applyCameraCollision();
        }

        this.currentPosition.lerp(
            this.targetPosition,
            1 -
                Math.exp(
                    -this.config.smoothPosition *
                    deltaTime
                )
        );
    }

    /**
     * Basic camera collision.
     *
     * This is intentionally lightweight.
     * A full BVH/physics collision system
     * can replace it later.
     */
    applyCameraCollision() {
        if (
            !this.collisionObjects.length
        ) {
            return;
        }

        const direction =
            new THREE.Vector3()
                .subVectors(
                    this.targetPosition,
                    this.playerTarget
                );

        const distance =
            direction.length();

        if (distance <= 0.001) {
            return;
        }

        direction.normalize();

        const raycaster =
            new THREE.Raycaster(
                this.playerTarget,
                direction,
                0,
                distance
            );

        const intersections =
            raycaster.intersectObjects(
                this.collisionObjects,
                true
            );

        if (!intersections.length) {
            return;
        }

        const hit =
            intersections[0];

        const safeDistance =
            Math.max(
                0.1,
                hit.distance -
                    this.config.collisionPadding
            );

        this.targetPosition.copy(
            this.playerTarget
        );

        this.targetPosition.addScaledVector(
            direction,
            safeDistance
        );
    }

    /**
     * Head bob.
     */
    updateHeadBob(deltaTime) {
        if (
            !this.config.headBobEnabled
        ) {
            return;
        }

        const state =
            playerController.getSnapshot();

        if (!state) {
            return;
        }

        const speed =
            Math.sqrt(
                state.velocity.x *
                    state.velocity.x +
                state.velocity.z *
                    state.velocity.z
            );

        if (
            !state.grounded ||
            speed < 0.1
        ) {
            this.headBobTime =
                damp(
                    this.headBobTime,
                    0,
                    8,
                    deltaTime
                );

            return;
        }

        const intensity =
            clamp(
                speed /
                    Math.max(
                        this.config.sprintFov,
                        1
                    ),
                0,
                1
            );

        this.headBobTime +=
            deltaTime *
            this.config.headBobSpeed *
            (0.6 + intensity);

        const bobX =
            Math.cos(
                this.headBobTime * 0.5
            ) *
            this.config.headBobAmount *
            intensity;

        const bobY =
            Math.abs(
                Math.sin(
                    this.headBobTime
                )
            ) *
            this.config.headBobAmount *
            intensity;

        this.camera.position.x =
            bobX;

        this.camera.position.y =
            bobY;
    }

    /**
     * Camera shake.
     */
    updateShake(deltaTime) {
        if (
            !this.shake.active
        ) {
            return;
        }

        this.shake.elapsed +=
            deltaTime;

        const progress =
            clamp(
                this.shake.elapsed /
                    Math.max(
                        this.shake.duration,
                        0.001
                    ),
                0,
                1
            );

        const strength =
            this.shake.intensity *
            (1 - progress);

        this.camera.position.x +=
            (Math.random() * 2 - 1) *
            strength;

        this.camera.position.y +=
            (Math.random() * 2 - 1) *
            strength;

        this.camera.position.z +=
            (Math.random() * 2 - 1) *
            strength;

        if (progress >= 1) {
            this.shake.active =
                false;

            this.shake.intensity =
                0;

            this.shake.duration =
                0;

            this.shake.elapsed =
                0;
        }
    }

    /**
     * Start camera shake.
     */
    startShake(
        intensity = 0.05,
        duration = 0.15
    ) {
        this.shake.active = true;

        this.shake.intensity =
            Math.max(
                0,
                Number(intensity) || 0
            );

        this.shake.duration =
            Math.max(
                0,
                Number(duration) || 0
            );

        this.shake.elapsed = 0;

        this.emitter.emit(
            "shake",
            {
                intensity:
                    this.shake.intensity,
                duration:
                    this.shake.duration
            }
        );
    }

    /**
     * Stop shake.
     */
    stopShake() {
        this.shake.active =
            false;

        this.shake.elapsed = 0;
        this.shake.intensity = 0;
        this.shake.duration = 0;
    }

    /**
     * Apply final camera transform.
     */
    applyFinalTransform() {
        this.object.position.copy(
            this.currentPosition
        );

        /**
         * Camera looks toward player.
         */
        this.lookTarget.copy(
            this.playerTarget
        );

        if (
            this.mode ===
            "firstPerson"
        ) {
            const direction =
                new THREE.Vector3(
                    Math.sin(
                        this.currentYaw
                    ) *
                        Math.cos(
                            this.currentPitch
                        ),

                    Math.sin(
                        this.currentPitch
                    ),

                    Math.cos(
                        this.currentYaw
                    ) *
                        Math.cos(
                            this.currentPitch
                        )
                );

            const target =
                this.currentPosition
                    .clone()
                    .add(direction);

            this.camera.lookAt(
                target
            );
        } else {
            this.camera.lookAt(
                this.lookTarget
            );
        }
    }

    /**
     * Add collision objects.
     */
    setCollisionObjects(
        objects = []
    ) {
        if (!Array.isArray(objects)) {
            this.collisionObjects = [];
            return;
        }

        this.collisionObjects =
            objects.filter(
                Boolean
            );
    }

    /**
     * Add one collision object.
     */
    addCollisionObject(
        object
    ) {
        if (!object) {
            return;
        }

        if (
            !this.collisionObjects.includes(
                object
            )
        ) {
            this.collisionObjects.push(
                object
            );
        }
    }

    /**
     * Remove collision object.
     */
    removeCollisionObject(
        object
    ) {
        const index =
            this.collisionObjects.indexOf(
                object
            );

        if (index !== -1) {
            this.collisionObjects.splice(
                index,
                1
            );
        }
    }

    /**
     * Enable / disable collision.
     */
    setCollisionEnabled(
        enabled
    ) {
        this.collisionEnabled =
            Boolean(enabled);
    }

    /**
     * Change FOV.
     */
    setFov(fov) {
        this.config.fov =
            clamp(
                Number(fov) || 70,
                40,
                120
            );

        this.targetFov =
            this.config.fov;
    }

    /**
     * Set camera distance.
     */
    setDistance(distance) {
        this.targetDistance =
            clamp(
                Number(distance) ||
                    this.config.distance,
                this.config.minDistance,
                this.config.maxDistance
            );
    }

    /**
     * Set sensitivity.
     */
    setSensitivity(
        sensitivity
    ) {
        this.mouseSensitivity =
            clamp(
                Number(sensitivity) ||
                    this.config.mouseSensitivity,
                0.0001,
                0.02
            );
    }

    /**
     * Resize camera.
     */
    resize(
        width = window.innerWidth,
        height = window.innerHeight
    ) {
        const safeWidth =
            Math.max(
                1,
                Number(width) || 1
            );

        const safeHeight =
            Math.max(
                1,
                Number(height) || 1
            );

        this.camera.aspect =
            safeWidth /
            safeHeight;

        this.camera.updateProjectionMatrix();
    }

    /**
     * Enable.
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable.
     */
    disable() {
        this.enabled = false;
    }

    /**
     * Toggle.
     */
    toggle() {
        this.enabled =
            !this.enabled;

        return this.enabled;
    }

    /**
     * Get camera object.
     */
    getCamera() {
        return this.camera;
    }

    /**
     * Get camera root.
     */
    getObject() {
        return this.object;
    }

    /**
     * Get mode.
     */
    getMode() {
        return this.mode;
    }

    /**
     * Get yaw.
     */
    getYaw() {
        return this.yaw;
    }

    /**
     * Get pitch.
     */
    getPitch() {
        return this.pitch;
    }

    /**
     * Get distance.
     */
    getDistance() {
        return this.distance;
    }

    /**
     * Sync with GameState.
     */
    syncState() {
        if (!gameState) {
            return;
        }

        gameState.update(
            "player",
            {
                rotation: {
                    x:
                        playerController
                            .getSnapshot()
                            .rotation.x,

                    y: this.yaw,

                    z:
                        playerController
                            .getSnapshot()
                            .rotation.z
                }
            }
        );
    }

    /**
     * Snapshot.
     */
    getSnapshot() {
        return {
            mode: this.mode,

            position: {
                x:
                    this.object.position.x,

                y:
                    this.object.position.y,

                z:
                    this.object.position.z
            },

            rotation: {
                yaw: this.yaw,
                pitch: this.pitch
            },

            currentRotation: {
                yaw:
                    this.currentYaw,

                pitch:
                    this.currentPitch
            },

            distance:
                this.distance,

            targetDistance:
                this.targetDistance,

            fov:
                this.currentFov,

            enabled:
                this.enabled,

            collisionEnabled:
                this.collisionEnabled
        };
    }

    /**
     * Debug information.
     */
    getDebugInfo() {
        return {
            mode: this.mode,

            position:
                this.object.position.toArray(),

            yaw:
                this.yaw,

            pitch:
                this.pitch,

            distance:
                this.distance,

            targetDistance:
                this.targetDistance,

            fov:
                this.currentFov,

            collision:
                this.collisionEnabled,

            collisionObjects:
                this.collisionObjects.length,

            enabled:
                this.enabled
        };
    }

    /**
     * Events.
     */
    on(event, callback) {
        return this.emitter.on(
            event,
            callback
        );
    }

    off(event, callback) {
        this.emitter.off(
            event,
            callback
        );
    }

    /**
     * Cleanup.
     */
    dispose() {
        window.removeEventListener(
            "resize",
            this.boundResize
        );

        window.removeEventListener(
            "mousemove",
            this.boundMouseMove
        );

        window.removeEventListener(
            "wheel",
            this.boundWheel
        );

        this.stopShake();

        this.collisionObjects = [];

        this.emitter.clear();

        this.initialized = false;
        this.enabled = false;
    }
}

/**
 * Singleton camera.
 */
export const playerCamera =
    new PlayerCamera();

/**
 * Initialize helper.
 */
export function initializePlayerCamera() {
    return playerCamera.initialize();
}

/**
 * Update helper.
 */
export function updatePlayerCamera(
    deltaTime
) {
    playerCamera.update(
        deltaTime
    );
}

/**
 * Get camera helper.
 */
export function getPlayerCamera() {
    return playerCamera;
}

export default playerCamera;
