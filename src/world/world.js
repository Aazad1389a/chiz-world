// ============================================================
// AZAD WORLD
// World System
// src/world/world.js
// ============================================================

import * as THREE from "three";

import {
    GAME_CONFIG
} from "../config/game-config.js";

import {
    GAME_GOALS
} from "../config/game-goals.js";

import {
    gameState
} from "../core/game-state.js";

import {
    rendererSystem
} from "../engine/renderer.js";


// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_WORLD = {
    name: "AZAD WORLD",
    seed: "AZAD-001",

    size: 1000,

    ground: {
        enabled: true,
        size: 1000,
        height: 0
    },

    water: {
        enabled: false,
        level: -2
    },

    fog: {
        enabled: true,
        near: 100,
        far: 900
    },

    dayLength: 1200,

    spawn: {
        x: 0,
        y: 0,
        z: 0
    }
};


// ============================================================
// HELPERS
// ============================================================

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function randomSeed(seed) {

    let hash = 0;

    const text = String(seed);

    for (let i = 0; i < text.length; i++) {
        hash =
            ((hash << 5) - hash) +
            text.charCodeAt(i);

        hash |= 0;
    }

    return Math.abs(hash);
}


// ============================================================
// WORLD SYSTEM
// ============================================================

export class WorldSystem {

    constructor(options = {}) {

        this.config = {
            ...DEFAULT_WORLD,
            ...options
        };

        this.initialized = false;
        this.loaded = false;
        this.disposed = false;

        // --------------------------------------------------------
        // Three.js
        // --------------------------------------------------------

        this.scene = null;

        this.root = new THREE.Group();

        this.worldGroup =
            new THREE.Group();

        this.environmentGroup =
            new THREE.Group();

        this.buildingsGroup =
            new THREE.Group();

        this.vegetationGroup =
            new THREE.Group();

        this.propsGroup =
            new THREE.Group();

        this.waterGroup =
            new THREE.Group();

        // --------------------------------------------------------
        // World objects
        // --------------------------------------------------------

        this.ground = null;
        this.water = null;

        this.objects = new Map();
        this.zones = new Map();

        // --------------------------------------------------------
        // World data
        // --------------------------------------------------------

        this.seed =
            this.config.seed;

        this.seedValue =
            randomSeed(this.seed);

        this.timeOfDay = 12;

        this.weather = "clear";

        this.worldTime = 0;

        // --------------------------------------------------------
        // Runtime
        // --------------------------------------------------------

        this.objectId = 0;

        this.lastUpdate = 0;

        // --------------------------------------------------------
        // Events
        // --------------------------------------------------------

        this.listeners = new Map();
    }


    // ============================================================
    // INITIALIZE
    // ============================================================

    initialize(scene = null) {

        if (this.initialized) {
            return this;
        }

        if (this.disposed) {
            throw new Error(
                "WorldSystem has already been disposed."
            );
        }

        // --------------------------------------------------------
        // Get scene
        // --------------------------------------------------------

        this.scene =
            scene ||
            rendererSystem.getScene();

        if (!this.scene) {
            throw new Error(
                "WorldSystem requires a Three.js scene."
            );
        }

        // --------------------------------------------------------
        // Root hierarchy
        // --------------------------------------------------------

        this.root.name =
            "AZAD_WORLD_ROOT";

        this.worldGroup.name =
            "WORLD";

        this.environmentGroup.name =
            "ENVIRONMENT";

        this.buildingsGroup.name =
            "BUILDINGS";

        this.vegetationGroup.name =
            "VEGETATION";

        this.propsGroup.name =
            "PROPS";

        this.waterGroup.name =
            "WATER";

        this.root.add(
            this.worldGroup
        );

        this.root.add(
            this.environmentGroup
        );

        this.root.add(
            this.buildingsGroup
        );

        this.root.add(
            this.vegetationGroup
        );

        this.root.add(
            this.propsGroup
        );

        this.root.add(
            this.waterGroup
        );

        this.scene.add(
            this.root
        );

        // --------------------------------------------------------
        // Create base world
        // --------------------------------------------------------

        this.createGround();

        if (this.config.water.enabled) {
            this.createWater();
        }

        // --------------------------------------------------------
        // State
        // --------------------------------------------------------

        gameState.set(
            "world.name",
            this.config.name
        );

        gameState.set(
            "world.seed",
            this.seed
        );

        gameState.set(
            "world.loaded",
            true
        );

        gameState.set(
            "world.timeOfDay",
            this.timeOfDay
        );

        gameState.set(
            "world.weather",
            this.weather
        );

        this.initialized = true;
        this.loaded = true;

        this.emit(
            "initialized",
            this.getSnapshot()
        );

        return this;
    }


    // ============================================================
    // GROUND
    // ============================================================

    createGround() {

        if (!this.config.ground.enabled) {
            return null;
        }

        if (this.ground) {
            return this.ground;
        }

        const size =
            this.config.ground.size;

        const geometry =
            new THREE.PlaneGeometry(
                size,
                size,
                64,
                64
            );

        const material =
            new THREE.MeshStandardMaterial({
                color: 0x303a2f,
                roughness: 0.95,
                metalness: 0
            });

        const ground =
            new THREE.Mesh(
                geometry,
                material
            );

        ground.name =
            "WORLD_GROUND";

        ground.rotation.x =
            -Math.PI / 2;

        ground.position.y =
            this.config.ground.height;

        ground.receiveShadow = true;

        this.ground = ground;

        this.worldGroup.add(
            ground
        );

        this.registerObject(
            "ground",
            ground,
            {
                type: "ground",
                static: true,
                collision: true
            }
        );

        return ground;
    }


    // ============================================================
    // WATER
    // ============================================================

    createWater() {

        if (this.water) {
            return this.water;
        }

        const size =
            this.config.size;

        const geometry =
            new THREE.PlaneGeometry(
                size,
                size,
                32,
                32
            );

        const material =
            new THREE.MeshStandardMaterial({
                color: 0x164e63,
                roughness: 0.15,
                metalness: 0.15,
                transparent: true,
                opacity: 0.82
            });

        const water =
            new THREE.Mesh(
                geometry,
                material
            );

        water.name =
            "WORLD_WATER";

        water.rotation.x =
            -Math.PI / 2;

        water.position.y =
            this.config.water.level;

        water.receiveShadow = true;

        this.water = water;

        this.waterGroup.add(
            water
        );

        this.registerObject(
            "water",
            water,
            {
                type: "water",
                static: true,
                collision: false
            }
        );

        return water;
    }


    // ============================================================
    // OBJECT MANAGEMENT
    // ============================================================

    registerObject(
        id,
        object,
        metadata = {}
    ) {

        if (!object) {
            return null;
        }

        const objectId =
            id ||
            `object_${++this.objectId}`;

        object.userData.azadWorld = {
            id: objectId,
            ...metadata
        };

        this.objects.set(
            objectId,
            {
                object,
                metadata: {
                    ...metadata
                }
            }
        );

        this.emit(
            "objectAdded",
            {
                id: objectId,
                object,
                metadata
            }
        );

        return objectId;
    }


    addObject(
        object,
        group = "props",
        id = null,
        metadata = {}
    ) {

        if (!object) {
            return null;
        }

        let targetGroup =
            this.propsGroup;

        switch (group) {

            case "world":
                targetGroup =
                    this.worldGroup;
                break;

            case "environment":
                targetGroup =
                    this.environmentGroup;
                break;

            case "buildings":
                targetGroup =
                    this.buildingsGroup;
                break;

            case "vegetation":
                targetGroup =
                    this.vegetationGroup;
                break;

            case "water":
                targetGroup =
                    this.waterGroup;
                break;

            case "props":
            default:
                targetGroup =
                    this.propsGroup;
                break;
        }

        targetGroup.add(
            object
        );

        return this.registerObject(
            id,
            object,
            metadata
        );
    }


    removeObject(id) {

        const entry =
            this.objects.get(id);

        if (!entry) {
            return false;
        }

        const {
            object
        } = entry;

        if (object.parent) {
            object.parent.remove(
                object
            );
        }

        this.disposeObject(
            object
        );

        this.objects.delete(id);

        this.emit(
            "objectRemoved",
            {
                id
            }
        );

        return true;
    }


    getObject(id) {

        return (
            this.objects.get(id)?.object ||
            null
        );
    }


    getObjects() {

        return [
            ...this.objects.entries()
        ];
    }


    // ============================================================
    // ZONES
    // ============================================================

    createZone(
        id,
        options = {}
    ) {

        if (!id) {
            return null;
        }

        const zone = {

            id,

            name:
                options.name ||
                id,

            type:
                options.type ||
                "generic",

            center: {
                x:
                    options.x ?? 0,

                y:
                    options.y ?? 0,

                z:
                    options.z ?? 0
            },

            size: {
                x:
                    options.width ??
                    options.size ??
                    100,

                y:
                    options.height ??
                    100,

                z:
                    options.depth ??
                    options.size ??
                    100
            },

            enabled:
                options.enabled !== false,

            metadata:
                options.metadata || {}
        };

        this.zones.set(
            id,
            zone
        );

        this.emit(
            "zoneCreated",
            zone
        );

        return zone;
    }


    removeZone(id) {

        return this.zones.delete(id);
    }


    getZone(id) {

        return this.zones.get(id) || null;
    }


    getZones() {

        return [
            ...this.zones.values()
        ];
    }


    isPositionInZone(
        position,
        zoneId
    ) {

        const zone =
            this.getZone(zoneId);

        if (!zone || !position) {
            return false;
        }

        const dx =
            Math.abs(
                position.x -
                zone.center.x
            );

        const dy =
            Math.abs(
                position.y -
                zone.center.y
            );

        const dz =
            Math.abs(
                position.z -
                zone.center.z
            );

        return (
            dx <= zone.size.x / 2 &&
            dy <= zone.size.y / 2 &&
            dz <= zone.size.z / 2
        );
    }


    getZoneAtPosition(
        position
    ) {

        if (!position) {
            return null;
        }

        for (const zone of this.zones.values()) {

            if (
                zone.enabled &&
                this.isPositionInZone(
                    position,
                    zone.id
                )
            ) {
                return zone;
            }
        }

        return null;
    }


    // ============================================================
    // SPAWN
    // ============================================================

    getSpawnPoint() {

        return {
            x:
                this.config.spawn.x,

            y:
                this.config.spawn.y,

            z:
                this.config.spawn.z
        };
    }


    setSpawnPoint(
        x,
        y,
        z
    ) {

        this.config.spawn = {
            x: Number(x) || 0,
            y: Number(y) || 0,
            z: Number(z) || 0
        };

        gameState.set(
            "world.spawn",
            {
                ...this.config.spawn
            }
        );

        this.emit(
            "spawnChanged",
            this.getSpawnPoint()
        );
    }


    // ============================================================
    // WORLD BOUNDS
    // ============================================================

    getBounds() {

        const half =
            this.config.size / 2;

        return {
            min: {
                x: -half,
                y: -100,
                z: -half
            },

            max: {
                x: half,
                y: 500,
                z: half
            }
        };
    }


    clampPosition(
        position
    ) {

        if (!position) {
            return null;
        }

        const bounds =
            this.getBounds();

        return {
            x: clamp(
                position.x,
                bounds.min.x,
                bounds.max.x
            ),

            y: clamp(
                position.y,
                bounds.min.y,
                bounds.max.y
            ),

            z: clamp(
                position.z,
                bounds.min.z,
                bounds.max.z
            )
        };
    }


    // ============================================================
    // TIME
    // ============================================================

    setTimeOfDay(
        hours
    ) {

        this.timeOfDay =
            ((Number(hours) % 24) + 24) % 24;

        gameState.set(
            "world.timeOfDay",
            this.timeOfDay
        );

        this.emit(
            "timeChanged",
            this.timeOfDay
        );
    }


    getTimeOfDay() {

        return this.timeOfDay;
    }


    advanceTime(
        deltaSeconds
    ) {

        const dayLength =
            Math.max(
                1,
                this.config.dayLength
            );

        this.timeOfDay +=
            (deltaSeconds / dayLength) *
            24;

        if (this.timeOfDay >= 24) {
            this.timeOfDay %= 24;
        }

        gameState.set(
            "world.timeOfDay",
            this.timeOfDay
        );
    }


    // ============================================================
    // WEATHER
    // ============================================================

    setWeather(
        weather
    ) {

        const allowed = [
            "clear",
            "cloudy",
            "rain",
            "storm",
            "fog",
            "snow"
        ];

        if (!allowed.includes(weather)) {
            return false;
        }

        this.weather =
            weather;

        gameState.set(
            "world.weather",
            weather
        );

        this.emit(
            "weatherChanged",
            weather
        );

        return true;
    }


    getWeather() {

        return this.weather;
    }


    // ============================================================
    // RANDOM WORLD UTILITIES
    // ============================================================

    random() {

        this.seedValue =
            (
                this.seedValue * 1664525 +
                1013904223
            ) >>> 0;

        return (
            this.seedValue /
            4294967296
        );
    }


    randomRange(
        min,
        max
    ) {

        return (
            min +
            this.random() *
            (max - min)
        );
    }


    randomPosition(
        radius = null
    ) {

        const worldRadius =
            radius ??
            this.config.size / 2;

        return {
            x: this.randomRange(
                -worldRadius,
                worldRadius
            ),

            y:
                this.config.ground.height,

            z: this.randomRange(
                -worldRadius,
                worldRadius
            )
        };
    }


    // ============================================================
    // UPDATE
    // ============================================================

    update(
        deltaTime = 0
    ) {

        if (
            !this.initialized ||
            !this.loaded ||
            this.disposed
        ) {
            return;
        }

        const delta =
            Math.max(
                0,
                Math.min(
                    Number(deltaTime) || 0,
                    0.1
                )
            );

        this.lastUpdate =
            delta;

        this.worldTime +=
            delta;

        // --------------------------------------------------------
        // World clock
        // --------------------------------------------------------

        this.advanceTime(
            delta
        );

        // --------------------------------------------------------
        // Water animation placeholder
        // --------------------------------------------------------

        if (this.water) {

            this.water.material.opacity =
                0.78 +
                Math.sin(
                    this.worldTime * 0.8
                ) * 0.04;
        }

        // --------------------------------------------------------
        // Future systems
        // --------------------------------------------------------
        // NPCs
        // Vehicles
        // Traffic
        // Weather simulation
        // Dynamic events
        // Multiplayer world state
        // Streaming
        // Procedural world
    }


    // ============================================================
    // COLLISION OBJECTS
    // ============================================================

    getCollisionObjects() {

        const result = [];

        for (
            const entry
            of this.objects.values()
        ) {

            const metadata =
                entry.metadata;

            if (
                metadata.collision === true
            ) {
                result.push(
                    entry.object
                );
            }
        }

        return result;
    }


    // ============================================================
    // OBJECT DISPOSAL
    // ============================================================

    disposeObject(
        object
    ) {

        if (!object) {
            return;
        }

        object.traverse(
            child => {

                if (
                    child.geometry &&
                    typeof child.geometry.dispose ===
                    "function"
                ) {
                    child.geometry.dispose();
                }

                if (child.material) {

                    const materials =
                        Array.isArray(
                            child.material
                        )
                            ? child.material
                            : [child.material];

                    for (
                        const material
                        of materials
                    ) {

                        if (
                            material &&
                            typeof material.dispose ===
                            "function"
                        ) {

                            if (
                                material.map
                            ) {
                                material.map.dispose();
                            }

                            if (
                                material.normalMap
                            ) {
                                material.normalMap.dispose();
                            }

                            if (
                                material.roughnessMap
                            ) {
                                material.roughnessMap.dispose();
                            }

                            if (
                                material.metalnessMap
                            ) {
                                material.metalnessMap.dispose();
                            }

                            if (
                                material.aoMap
                            ) {
                                material.aoMap.dispose();
                            }

                            material.dispose();
                        }
                    }
                }
            }
        );
    }


    // ============================================================
    // EVENT SYSTEM
    // ============================================================

    on(
        event,
        callback
    ) {

        if (
            typeof callback !==
            "function"
        ) {
            return () => {};
        }

        if (
            !this.listeners.has(event)
        ) {
            this.listeners.set(
                event,
                new Set()
            );
        }

        const listeners =
            this.listeners.get(event);

        listeners.add(
            callback
        );

        return () => {
            listeners.delete(
                callback
            );
        };
    }


    off(
        event,
        callback
    ) {

        const listeners =
            this.listeners.get(event);

        if (!listeners) {
            return false;
        }

        return listeners.delete(
            callback
        );
    }


    emit(
        event,
        data
    ) {

        const listeners =
            this.listeners.get(event);

        if (!listeners) {
            return;
        }

        for (
            const callback
            of listeners
        ) {

            try {

                callback(data);

            } catch (error) {

                console.warn(
                    `[AZAD WORLD] World event "${event}" error:`,
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

            initialized:
                this.initialized,

            loaded:
                this.loaded,

            name:
                this.config.name,

            seed:
                this.seed,

            size:
                this.config.size,

            timeOfDay:
                this.timeOfDay,

            weather:
                this.weather,

            worldTime:
                this.worldTime,

            objects:
                this.objects.size,

            zones:
                this.zones.size,

            spawn:
                this.getSpawnPoint(),

            bounds:
                this.getBounds()
        };
    }


    // ============================================================
    // DEBUG
    // ============================================================

    debug() {

        return {

            snapshot:
                this.getSnapshot(),

            scene:
                this.scene,

            root:
                this.root,

            ground:
                this.ground,

            water:
                this.water,

            objects:
                this.getObjects(),

            zones:
                this.getZones(),

            collisionObjects:
                this.getCollisionObjects()
        };
    }


    // ============================================================
    // DISPOSE
    // ============================================================

    dispose() {

        if (this.disposed) {
            return;
        }

        // --------------------------------------------------------
        // Dispose objects
        // --------------------------------------------------------

        for (
            const entry
            of this.objects.values()
        ) {

            this.disposeObject(
                entry.object
            );
        }

        this.objects.clear();
        this.zones.clear();

        // --------------------------------------------------------
        // Remove root
        // --------------------------------------------------------

        if (this.root.parent) {
            this.root.parent.remove(
                this.root
            );
        }

        // --------------------------------------------------------
        // Clear groups
        // --------------------------------------------------------

        this.root.clear();

        this.worldGroup.clear();
        this.environmentGroup.clear();
        this.buildingsGroup.clear();
        this.vegetationGroup.clear();
        this.propsGroup.clear();
        this.waterGroup.clear();

        this.ground = null;
        this.water = null;
        this.scene = null;

        // --------------------------------------------------------
        // Events
        // --------------------------------------------------------

        this.listeners.clear();

        // --------------------------------------------------------
        // State
        // --------------------------------------------------------

        gameState.set(
            "world.loaded",
            false
        );

        this.initialized = false;
        this.loaded = false;
        this.disposed = true;
    }
}


// ============================================================
// SINGLETON
// ============================================================

export const worldSystem =
    new WorldSystem();


// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

export function initializeWorld(
    scene = null
) {

    return worldSystem.initialize(
        scene
    );
}


export function updateWorld(
    deltaTime
) {

    return worldSystem.update(
        deltaTime
    );
}


export function getWorld() {

    return worldSystem;
}


export function getWorldSnapshot() {

    return worldSystem.getSnapshot();
}


export default worldSystem;
