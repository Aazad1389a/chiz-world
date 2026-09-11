// ============================================================
// AZAD WORLD
// Renderer System
// src/engine/renderer.js
// ============================================================

import * as THREE from "three";

import {
    GAME_CONFIG,
    getMaxPixelRatio,
    getGraphicsQuality
} from "../config/game-config.js";

import {
    GraphicsController,
    createGameRenderer,
    detectGraphicsCapabilities
} from "../../graphics.js";

import { gameState } from "../core/game-state.js";
import { inputManager } from "../core/input-manager.js";

import {
    player,
    updatePlayer
} from "../player/player.js";

import {
    playerCamera,
    updatePlayerCamera
} from "../player/camera.js";

import {
    playerAnimation,
    updatePlayerAnimation
} from "../player/animation.js";


// ============================================================
// CONSTANTS
// ============================================================

const DEFAULTS = {
    background: 0x071018,
    maxDelta: 0.1,
    targetFPS: 60,
    maxPixelRatio: 2,
    autoResize: true,
    autoClear: true,
    shadows: true,
    toneMappingExposure: 1.1
};


// ============================================================
// HELPERS
// ============================================================

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function now() {
    return performance.now();
}


// ============================================================
// RENDERER SYSTEM
// ============================================================

export class RendererSystem {

    constructor(options = {}) {

        this.options = {
            ...DEFAULTS,
            ...options
        };

        // --------------------------------------------------------
        // Core Three.js objects
        // --------------------------------------------------------

        this.renderer = null;
        this.scene = null;
        this.camera = null;

        this.canvas = null;

        // --------------------------------------------------------
        // Graphics
        // --------------------------------------------------------

        this.graphicsController = null;
        this.capabilities = null;

        // --------------------------------------------------------
        // Runtime
        // --------------------------------------------------------

        this.running = false;
        this.paused = false;

        this.animationFrame = null;

        this.lastTime = 0;
        this.elapsedTime = 0;

        this.deltaTime = 0;
        this.frame = 0;

        this.fps = 0;
        this.fpsFrameCount = 0;
        this.fpsTimer = 0;

        this.renderCount = 0;

        // --------------------------------------------------------
        // Resize
        // --------------------------------------------------------

        this.width = 1;
        this.height = 1;
        this.pixelRatio = 1;

        this.resizeObserver = null;

        // --------------------------------------------------------
        // Systems
        // --------------------------------------------------------

        this.systems = new Map();

        // --------------------------------------------------------
        // Event listeners
        // --------------------------------------------------------

        this.listeners = new Map();

        // --------------------------------------------------------
        // Render hooks
        // --------------------------------------------------------

        this.beforeRenderHooks = [];
        this.afterRenderHooks = [];
        this.updateHooks = [];

        // --------------------------------------------------------
        // State
        // --------------------------------------------------------

        this.initialized = false;
        this.disposed = false;
    }


    // ============================================================
    // INITIALIZE
    // ============================================================

    initialize(container = null) {

        if (this.initialized) {
            return this;
        }

        if (this.disposed) {
            throw new Error("RendererSystem has already been disposed.");
        }

        // --------------------------------------------------------
        // Find container
        // --------------------------------------------------------

        const target =
            container ||
            document.getElementById("game") ||
            document.body;

        // --------------------------------------------------------
        // Create canvas
        // --------------------------------------------------------

        this.canvas =
            document.getElementById("game-canvas") ||
            document.createElement("canvas");

        if (!this.canvas.parentElement) {
            target.appendChild(this.canvas);
        }

        // --------------------------------------------------------
        // Detect capabilities
        // --------------------------------------------------------

        this.capabilities = detectGraphicsCapabilities();

        // --------------------------------------------------------
        // Graphics controller
        // --------------------------------------------------------

        try {

            this.graphicsController = new GraphicsController({
                quality: getGraphicsQuality()
            });

        } catch (error) {

            console.warn(
                "[AZAD WORLD] GraphicsController initialization failed:",
                error
            );

            this.graphicsController = null;
        }

        // --------------------------------------------------------
        // Create renderer
        // --------------------------------------------------------

        this.renderer = createGameRenderer(
            this.canvas,
            {
                quality: getGraphicsQuality()
            }
        );

        if (!this.renderer) {
            throw new Error(
                "Unable to create WebGL renderer."
            );
        }

        // --------------------------------------------------------
        // Renderer settings
        // --------------------------------------------------------

        this.renderer.autoClear = this.options.autoClear;

        this.renderer.outputColorSpace =
            THREE.SRGBColorSpace;

        this.renderer.toneMapping =
            THREE.ACESFilmicToneMapping;

        this.renderer.toneMappingExposure =
            this.options.toneMappingExposure;

        this.renderer.setPixelRatio(
            Math.min(
                window.devicePixelRatio || 1,
                this.options.maxPixelRatio,
                getMaxPixelRatio()
            )
        );

        // --------------------------------------------------------
        // Scene
        // --------------------------------------------------------

        this.scene = new THREE.Scene();

        this.scene.background =
            new THREE.Color(this.options.background);

        // --------------------------------------------------------
        // Camera
        // --------------------------------------------------------

        this.camera =
            playerCamera?.camera ||
            new THREE.PerspectiveCamera(
                70,
                1,
                0.1,
                5000
            );

        // --------------------------------------------------------
        // Register core systems
        // --------------------------------------------------------

        this.registerSystem(
            "player",
            player
        );

        this.registerSystem(
            "camera",
            playerCamera
        );

        this.registerSystem(
            "animation",
            playerAnimation
        );

        // --------------------------------------------------------
        // Add player to scene
        // --------------------------------------------------------

        if (
            player &&
            typeof player.addToScene === "function"
        ) {

            try {
                player.addToScene(this.scene);
            } catch (error) {
                console.warn(
                    "[AZAD WORLD] Player scene registration failed:",
                    error
                );
            }
        }

        // --------------------------------------------------------
        // Resize
        // --------------------------------------------------------

        if (this.options.autoResize) {
            this.setupResize();
        }

        this.resize();

        // --------------------------------------------------------
        // Input
        // --------------------------------------------------------

        try {

            if (
                inputManager &&
                typeof inputManager.initialize === "function"
            ) {
                inputManager.initialize(this.canvas);
            }

        } catch (error) {

            console.warn(
                "[AZAD WORLD] Input initialization warning:",
                error
            );
        }

        // --------------------------------------------------------
        // State
        // --------------------------------------------------------

        gameState.set(
            "graphics.rendererReady",
            true
        );

        gameState.set(
            "graphics.quality",
            getGraphicsQuality()
        );

        this.initialized = true;

        this.emit(
            "initialized",
            this.getSnapshot()
        );

        return this;
    }


    // ============================================================
    // REGISTER SYSTEM
    // ============================================================

    registerSystem(name, system) {

        if (!name || !system) {
            return false;
        }

        this.systems.set(name, system);

        return true;
    }


    unregisterSystem(name) {

        return this.systems.delete(name);
    }


    getSystem(name) {

        return this.systems.get(name) || null;
    }


    // ============================================================
    // SCENE
    // ============================================================

    add(object) {

        if (!this.scene || !object) {
            return false;
        }

        this.scene.add(object);

        return true;
    }


    remove(object) {

        if (!this.scene || !object) {
            return false;
        }

        this.scene.remove(object);

        return true;
    }


    getScene() {

        return this.scene;
    }


    getCamera() {

        return this.camera;
    }


    getRenderer() {

        return this.renderer;
    }


    getCanvas() {

        return this.canvas;
    }


    // ============================================================
    // UPDATE
    // ============================================================

    update(deltaTime, elapsedTime) {

        if (!this.initialized || this.paused) {
            return;
        }

        this.deltaTime = clamp(
            deltaTime,
            0,
            this.options.maxDelta
        );

        this.elapsedTime =
            elapsedTime ??
            (this.elapsedTime + this.deltaTime);

        // --------------------------------------------------------
        // Input
        // IMPORTANT:
        // InputManager is updated ONCE here.
        // --------------------------------------------------------

        try {

            if (
                inputManager &&
                typeof inputManager.update === "function"
            ) {
                inputManager.update(
                    this.deltaTime
                );
            }

        } catch (error) {

            console.warn(
                "[AZAD WORLD] Input update error:",
                error
            );
        }

        // --------------------------------------------------------
        // Player controller
        // --------------------------------------------------------

        try {

            const controller =
                player?.controller ||
                null;

            if (
                typeof updatePlayer === "function"
            ) {
                updatePlayer(
                    this.deltaTime
                );
            }

        } catch (error) {

            console.warn(
                "[AZAD WORLD] Player update error:",
                error
            );
        }

        // --------------------------------------------------------
        // Player animation
        // --------------------------------------------------------

        try {

            if (
                typeof updatePlayerAnimation === "function"
            ) {
                updatePlayerAnimation(
                    this.deltaTime
                );
            }

        } catch (error) {

            console.warn(
                "[AZAD WORLD] Animation update error:",
                error
            );
        }

        // --------------------------------------------------------
        // Camera
        // --------------------------------------------------------

        try {

            if (
                typeof updatePlayerCamera === "function"
            ) {
                updatePlayerCamera(
                    this.deltaTime
                );
            }

        } catch (error) {

            console.warn(
                "[AZAD WORLD] Camera update error:",
                error
            );
        }

        // --------------------------------------------------------
        // Custom systems
        // --------------------------------------------------------

        for (const system of this.systems.values()) {

            if (
                !system ||
                typeof system.update !== "function"
            ) {
                continue;
            }

            // Core systems are already updated above.
            if (
                system === player ||
                system === playerCamera ||
                system === playerAnimation
            ) {
                continue;
            }

            try {

                system.update(
                    this.deltaTime,
                    this.elapsedTime
                );

            } catch (error) {

                console.warn(
                    "[AZAD WORLD] System update error:",
                    error
                );
            }
        }

        // --------------------------------------------------------
        // Custom update hooks
        // --------------------------------------------------------

        for (const hook of this.updateHooks) {

            try {

                hook(
                    this.deltaTime,
                    this.elapsedTime,
                    this
                );

            } catch (error) {

                console.warn(
                    "[AZAD WORLD] Update hook error:",
                    error
                );
            }
        }

        this.frame++;

        this.updateFPS();
    }


    // ============================================================
    // RENDER
    // ============================================================

    render() {

        if (
            !this.initialized ||
            !this.renderer ||
            !this.scene ||
            !this.camera ||
            this.paused
        ) {
            return;
        }

        // --------------------------------------------------------
        // Before render
        // --------------------------------------------------------

        for (const hook of this.beforeRenderHooks) {

            try {

                hook(
                    this.scene,
                    this.camera,
                    this.renderer,
                    this
                );

            } catch (error) {

                console.warn(
                    "[AZAD WORLD] Before-render hook error:",
                    error
                );
            }
        }

        // --------------------------------------------------------
        // Render
        // --------------------------------------------------------

        try {

            this.renderer.render(
                this.scene,
                this.camera
            );

            this.renderCount++;

        } catch (error) {

            console.error(
                "[AZAD WORLD] Render error:",
                error
            );

            this.emit(
                "renderError",
                error
            );
        }

        // --------------------------------------------------------
        // After render
        // --------------------------------------------------------

        for (const hook of this.afterRenderHooks) {

            try {

                hook(
                    this.scene,
                    this.camera,
                    this.renderer,
                    this
                );

            } catch (error) {

                console.warn(
                    "[AZAD WORLD] After-render hook error:",
                    error
                );
            }
        }
    }


    // ============================================================
    // GAME LOOP
    // ============================================================

    start() {

        if (!this.initialized) {
            this.initialize();
        }

        if (this.running) {
            return;
        }

        this.running = true;
        this.paused = false;

        this.lastTime = now();

        this.emit(
            "started",
            this.getSnapshot()
        );

        const loop = (currentTime) => {

            if (!this.running) {
                return;
            }

            const rawDelta =
                (currentTime - this.lastTime) / 1000;

            this.lastTime = currentTime;

            const delta =
                clamp(
                    rawDelta,
                    0,
                    this.options.maxDelta
                );

            this.update(
                delta,
                this.elapsedTime + delta
            );

            this.render();

            this.animationFrame =
                requestAnimationFrame(loop);
        };

        this.animationFrame =
            requestAnimationFrame(loop);
    }


    // ============================================================
    // STOP
    // ============================================================

    stop() {

        this.running = false;

        if (this.animationFrame !== null) {

            cancelAnimationFrame(
                this.animationFrame
            );

            this.animationFrame = null;
        }

        this.emit(
            "stopped",
            this.getSnapshot()
        );
    }


    // ============================================================
    // PAUSE
    // ============================================================

    pause() {

        this.paused = true;

        this.emit(
            "paused",
            this.getSnapshot()
        );
    }


    // ============================================================
    // RESUME
    // ============================================================

    resume() {

        this.paused = false;

        this.lastTime = now();

        this.emit(
            "resumed",
            this.getSnapshot()
        );
    }


    // ============================================================
    // FPS
    // ============================================================

    updateFPS() {

        this.fpsFrameCount++;

        this.fpsTimer += this.deltaTime;

        if (this.fpsTimer >= 0.5) {

            this.fps =
                this.fpsFrameCount /
                this.fpsTimer;

            this.fpsFrameCount = 0;
            this.fpsTimer = 0;

            gameState.set(
                "graphics.fps",
                Math.round(this.fps)
            );
        }
    }


    getFPS() {

        return Math.round(this.fps);
    }


    // ============================================================
    // RESIZE
    // ============================================================

    setupResize() {

        window.addEventListener(
            "resize",
            this.resizeHandler
        );

        if (
            typeof ResizeObserver !== "undefined" &&
            this.canvas
        ) {

            this.resizeObserver =
                new ResizeObserver(() => {
                    this.resize();
                });

            this.resizeObserver.observe(
                this.canvas.parentElement ||
                this.canvas
            );
        }
    }


    resizeHandler = () => {

        this.resize();
    };


    resize() {

        if (
            !this.renderer ||
            !this.camera
        ) {
            return;
        }

        const container =
            this.canvas?.parentElement;

        const width =
            container?.clientWidth ||
            window.innerWidth ||
            1;

        const height =
            container?.clientHeight ||
            window.innerHeight ||
            1;

        this.width = Math.max(1, width);
        this.height = Math.max(1, height);

        this.pixelRatio =
            Math.min(
                window.devicePixelRatio || 1,
                this.options.maxPixelRatio,
                getMaxPixelRatio()
            );

        // --------------------------------------------------------
        // Camera
        // --------------------------------------------------------

        if (this.camera.isPerspectiveCamera) {

            this.camera.aspect =
                this.width / this.height;

            this.camera.updateProjectionMatrix();
        }

        // --------------------------------------------------------
        // Renderer
        // --------------------------------------------------------

        this.renderer.setPixelRatio(
            this.pixelRatio
        );

        this.renderer.setSize(
            this.width,
            this.height,
            false
        );

        // --------------------------------------------------------
        // Player camera system
        // --------------------------------------------------------

        try {

            if (
                playerCamera &&
                typeof playerCamera.resize === "function"
            ) {
                playerCamera.resize(
                    this.width,
                    this.height
                );
            }

        } catch (error) {

            console.warn(
                "[AZAD WORLD] Camera resize warning:",
                error
            );
        }

        // --------------------------------------------------------
        // Graphics system
        // --------------------------------------------------------

        try {

            if (
                this.graphicsController &&
                typeof this.graphicsController.resize === "function"
            ) {
                this.graphicsController.resize(
                    this.width,
                    this.height
                );
            }

        } catch (error) {

            console.warn(
                "[AZAD WORLD] Graphics resize warning:",
                error
            );
        }

        gameState.set(
            "graphics.width",
            this.width
        );

        gameState.set(
            "graphics.height",
            this.height
        );

        gameState.set(
            "graphics.pixelRatio",
            this.pixelRatio
        );

        this.emit(
            "resize",
            {
                width: this.width,
                height: this.height,
                pixelRatio: this.pixelRatio
            }
        );
    }


    // ============================================================
    // QUALITY
    // ============================================================

    setQuality(quality) {

        if (!quality) {
            return false;
        }

        try {

            if (
                this.graphicsController &&
                typeof this.graphicsController.setQuality === "function"
            ) {

                this.graphicsController.setQuality(
                    quality
                );
            }

            gameState.set(
                "graphics.quality",
                quality
            );

            this.emit(
                "qualityChanged",
                quality
            );

            return true;

        } catch (error) {

            console.warn(
                "[AZAD WORLD] Quality change failed:",
                error
            );

            return false;
        }
    }


    getQuality() {

        return (
            gameState.get(
                "graphics.quality"
            ) ||
            getGraphicsQuality()
        );
    }


    // ============================================================
    // RENDER SCALE
    // ============================================================

    setRenderScale(scale) {

        const value =
            clamp(
                Number(scale) || 1,
                0.5,
                2
            );

        if (!this.renderer) {
            return;
        }

        this.renderer.setPixelRatio(
            this.pixelRatio * value
        );

        gameState.set(
            "graphics.renderScale",
            value
        );
    }


    // ============================================================
    // EXPOSURE
    // ============================================================

    setExposure(value) {

        if (!this.renderer) {
            return;
        }

        const exposure =
            clamp(
                Number(value) || 1,
                0.1,
                5
            );

        this.renderer.toneMappingExposure =
            exposure;

        gameState.set(
            "graphics.exposure",
            exposure
        );
    }


    // ============================================================
    // BACKGROUND
    // ============================================================

    setBackground(color) {

        if (!this.scene) {
            return;
        }

        if (color instanceof THREE.Color) {

            this.scene.background =
                color.clone();

            return;
        }

        this.scene.background =
            new THREE.Color(color);
    }


    // ============================================================
    // RENDER HOOKS
    // ============================================================

    addBeforeRenderHook(callback) {

        if (typeof callback !== "function") {
            return false;
        }

        this.beforeRenderHooks.push(
            callback
        );

        return true;
    }


    removeBeforeRenderHook(callback) {

        const index =
            this.beforeRenderHooks.indexOf(
                callback
            );

        if (index === -1) {
            return false;
        }

        this.beforeRenderHooks.splice(
            index,
            1
        );

        return true;
    }


    addAfterRenderHook(callback) {

        if (typeof callback !== "function") {
            return false;
        }

        this.afterRenderHooks.push(
            callback
        );

        return true;
    }


    removeAfterRenderHook(callback) {

        const index =
            this.afterRenderHooks.indexOf(
                callback
            );

        if (index === -1) {
            return false;
        }

        this.afterRenderHooks.splice(
            index,
            1
        );

        return true;
    }


    addUpdateHook(callback) {

        if (typeof callback !== "function") {
            return false;
        }

        this.updateHooks.push(
            callback
        );

        return true;
    }


    removeUpdateHook(callback) {

        const index =
            this.updateHooks.indexOf(
                callback
            );

        if (index === -1) {
            return false;
        }

        this.updateHooks.splice(
            index,
            1
        );

        return true;
    }


    // ============================================================
    // EVENTS
    // ============================================================

    on(event, callback) {

        if (typeof callback !== "function") {
            return () => {};
        }

        if (!this.listeners.has(event)) {
            this.listeners.set(
                event,
                new Set()
            );
        }

        const listeners =
            this.listeners.get(event);

        listeners.add(callback);

        return () => {
            listeners.delete(callback);
        };
    }


    off(event, callback) {

        const listeners =
            this.listeners.get(event);

        if (!listeners) {
            return false;
        }

        return listeners.delete(
            callback
        );
    }


    emit(event, data) {

        const listeners =
            this.listeners.get(event);

        if (!listeners) {
            return;
        }

        for (const callback of listeners) {

            try {
                callback(data);
            } catch (error) {
                console.warn(
                    `[AZAD WORLD] Renderer event "${event}" error:`,
                    error
                );
            }
        }
    }


    // ============================================================
    // SNAPSHOT
    // ============================================================

    getSnapshot() {

        return {
            initialized: this.initialized,
            running: this.running,
            paused: this.paused,

            width: this.width,
            height: this.height,

            pixelRatio: this.pixelRatio,

            fps: Math.round(this.fps),

            frame: this.frame,

            renderCount: this.renderCount,

            elapsedTime: this.elapsedTime,

            deltaTime: this.deltaTime,

            quality: this.getQuality(),

            capabilities: this.capabilities
                ? {
                    webgl2:
                        this.capabilities.webgl2,
                    maxTextureSize:
                        this.capabilities.maxTextureSize,
                    maxSamples:
                        this.capabilities.maxSamples
                }
                : null
        };
    }


    // ============================================================
    // DEBUG
    // ============================================================

    debug() {

        return {
            renderer: this.renderer,
            scene: this.scene,
            camera: this.camera,

            capabilities: this.capabilities,

            systems: [
                ...this.systems.keys()
            ],

            snapshot:
                this.getSnapshot()
        };
    }


    // ============================================================
    // DISPOSE
    // ============================================================

    dispose() {

        if (this.disposed) {
            return;
        }

        this.stop();

        // --------------------------------------------------------
        // Resize listeners
        // --------------------------------------------------------

        window.removeEventListener(
            "resize",
            this.resizeHandler
        );

        if (this.resizeObserver) {

            this.resizeObserver.disconnect();

            this.resizeObserver = null;
        }

        // --------------------------------------------------------
        // Systems
        // --------------------------------------------------------

        this.systems.clear();

        // --------------------------------------------------------
        // Renderer
        // --------------------------------------------------------

        if (this.renderer) {

            this.renderer.dispose();

            this.renderer.forceContextLoss();

            this.renderer = null;
        }

        // --------------------------------------------------------
        // Scene
        // --------------------------------------------------------

        if (this.scene) {

            this.scene.traverse(
                (object) => {

                    if (
                        object.geometry &&
                        typeof object.geometry.dispose === "function"
                    ) {
                        object.geometry.dispose();
                    }

                    if (object.material) {

                        const materials =
                            Array.isArray(object.material)
                                ? object.material
                                : [object.material];

                        for (
                            const material
                            of materials
                        ) {

                            if (
                                material &&
                                typeof material.dispose === "function"
                            ) {
                                material.dispose();
                            }
                        }
                    }
                }
            );

            this.scene.clear();

            this.scene = null;
        }

        // --------------------------------------------------------
        // Hooks
        // --------------------------------------------------------

        this.beforeRenderHooks.length = 0;
        this.afterRenderHooks.length = 0;
        this.updateHooks.length = 0;

        // --------------------------------------------------------
        // Events
        // --------------------------------------------------------

        this.listeners.clear();

        this.canvas = null;
        this.camera = null;

        this.graphicsController = null;
        this.capabilities = null;

        this.initialized = false;
        this.disposed = true;
    }
}


// ============================================================
// SINGLETON
// ============================================================

export const rendererSystem =
    new RendererSystem();


// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

export function initializeRenderer(
    container = null
) {

    return rendererSystem.initialize(
        container
    );
}


export function startRenderer() {

    return rendererSystem.start();
}


export function stopRenderer() {

    return rendererSystem.stop();
}


export function pauseRenderer() {

    return rendererSystem.pause();
}


export function resumeRenderer() {

    return rendererSystem.resume();
}


export function resizeRenderer() {

    return rendererSystem.resize();
}


export function getRenderer() {

    return rendererSystem.getRenderer();
}


export function getRenderScene() {

    return rendererSystem.getScene();
}


export function getRenderCamera() {

    return rendererSystem.getCamera();
}


export function getRendererSnapshot() {

    return rendererSystem.getSnapshot();
}


export default rendererSystem;
