// ============================================================
// AZAD WORLD
// Terrain System
// src/world/terrain.js
// ============================================================

import * as THREE from "three";

import {
    GAME_CONFIG
} from "../config/game-config.js";

import {
    gameState
} from "../core/game-state.js";

import {
    worldSystem
} from "./world.js";


// ============================================================
// DEFAULT CONFIG
// ============================================================

const DEFAULT_TERRAIN = {
    enabled: true,

    size: 1000,

    segments: 128,

    height: 35,

    minHeight: -5,

    maxHeight: 35,

    chunkSize: 128,

    viewDistance: 600,

    lodLevels: 4,

    wireframe: false,

    receiveShadow: true,

    castShadow: false,

    smoothNormals: true,

    procedural: true,

    seed: "AZAD-TERRAIN-001"
};


// ============================================================
// HELPERS
// ============================================================

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function smoothStep(t) {
    return t * t * (3 - 2 * t);
}


// ============================================================
// TERRAIN SYSTEM
// ============================================================

export class TerrainSystem {

    constructor(options = {}) {

        this.config = {
            ...DEFAULT_TERRAIN,
            ...options
        };

        // --------------------------------------------------------
        // State
        // --------------------------------------------------------

        this.initialized = false;
        this.loaded = false;
        this.disposed = false;

        // --------------------------------------------------------
        // Three.js
        // --------------------------------------------------------

        this.root =
            new THREE.Group();

        this.root.name =
            "TERRAIN_ROOT";

        this.terrainMesh = null;

        this.material = null;

        // --------------------------------------------------------
        // Height data
        // --------------------------------------------------------

        this.heightData = null;

        this.heightResolution =
            this.config.segments + 1;

        // --------------------------------------------------------
        // Chunks
        // --------------------------------------------------------

        this.chunks = new Map();

        this.activeChunks = new Set();

        // --------------------------------------------------------
        // Seed
        // --------------------------------------------------------

        this.seed =
            this.config.seed;

        this.seedValue =
            this.hashSeed(
                this.seed
            );

        // --------------------------------------------------------
        // Runtime
        // --------------------------------------------------------

        this.lastPlayerPosition = {
            x: 0,
            y: 0,
            z: 0
        };

        this.elapsedTime = 0;

        // --------------------------------------------------------
        // Events
        // --------------------------------------------------------

        this.listeners = new Map();
    }


    // ============================================================
    // INITIALIZE
    // ============================================================

    initialize() {

        if (this.initialized) {
            return this;
        }

        if (this.disposed) {
            throw new Error(
                "TerrainSystem has already been disposed."
            );
        }

        const scene =
            worldSystem.scene ||
            worldSystem.root;

        if (!scene) {
            throw new Error(
                "TerrainSystem requires an initialized WorldSystem."
            );
        }

        // --------------------------------------------------------
        // Root
        // --------------------------------------------------------

        worldSystem.worldGroup.add(
            this.root
        );

        // --------------------------------------------------------
        // Generate height data
        // --------------------------------------------------------

        if (this.config.procedural) {
            this.generateHeightData();
        } else {
            this.createFlatHeightData();
        }

        // --------------------------------------------------------
        // Create terrain
        // --------------------------------------------------------

        this.createTerrainMesh();

        // --------------------------------------------------------
        // State
        // --------------------------------------------------------

        gameState.set(
            "world.terrain.loaded",
            true
        );

        gameState.set(
            "world.terrain.size",
            this.config.size
        );

        gameState.set(
            "world.terrain.height",
            this.config.height
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
    // SEED
    // ============================================================

    hashSeed(seed) {

        let hash = 2166136261;

        const text =
            String(seed);

        for (let i = 0; i < text.length; i++) {

            hash ^=
                text.charCodeAt(i);

            hash +=
                (hash << 1) +
                (hash << 4) +
                (hash << 7) +
                (hash << 8) +
                (hash << 24);
        }

        return hash >>> 0;
    }


    seededRandom(x, y) {

        let value =
            this.seedValue;

        value ^=
            Math.imul(
                Math.floor(x * 374761393),
                668265263
            );

        value ^=
            Math.imul(
                Math.floor(y * 1274126177),
                2246822519
            );

        value =
            Math.imul(
                value ^ (value >>> 13),
                1274126177
            );

        value ^=
            value >>> 16;

        return (
            value >>> 0
        ) / 4294967296;
    }


    // ============================================================
    // NOISE
    // ============================================================

    valueNoise(x, y) {

        const x0 =
            Math.floor(x);

        const y0 =
            Math.floor(y);

        const x1 =
            x0 + 1;

        const y1 =
            y0 + 1;

        const tx =
            smoothStep(
                x - x0
            );

        const ty =
            smoothStep(
                y - y0
            );

        const a =
            this.seededRandom(
                x0,
                y0
            );

        const b =
            this.seededRandom(
                x1,
                y0
            );

        const c =
            this.seededRandom(
                x0,
                y1
            );

        const d =
            this.seededRandom(
                x1,
                y1
            );

        const top =
            lerp(
                a,
                b,
                tx
            );

        const bottom =
            lerp(
                c,
                d,
                tx
            );

        return lerp(
            top,
            bottom,
            ty
        );
    }


    fractalNoise(x, y) {

        let value = 0;

        let amplitude = 1;

        let frequency = 1;

        let totalAmplitude = 0;

        const octaves = 5;

        for (
            let i = 0;
            i < octaves;
            i++
        ) {

            value +=
                this.valueNoise(
                    x * frequency,
                    y * frequency
                ) *
                amplitude;

            totalAmplitude +=
                amplitude;

            amplitude *= 0.5;

            frequency *= 2;
        }

        return (
            value /
            totalAmplitude
        );
    }


    // ============================================================
    // HEIGHT GENERATION
    // ============================================================

    generateHeightData() {

        const resolution =
            this.heightResolution;

        this.heightData =
            new Float32Array(
                resolution *
                resolution
            );

        for (
            let z = 0;
            z < resolution;
            z++
        ) {

            for (
                let x = 0;
                x < resolution;
                x++
            ) {

                const normalizedX =
                    x /
                    (resolution - 1);

                const normalizedZ =
                    z /
                    (resolution - 1);

                const worldX =
                    normalizedX *
                    8;

                const worldZ =
                    normalizedZ *
                    8;

                // Large landscape shape
                const large =
                    this.fractalNoise(
                        worldX * 0.35,
                        worldZ * 0.35
                    );

                // Medium terrain details
                const medium =
                    this.fractalNoise(
                        worldX * 1.2,
                        worldZ * 1.2
                    );

                // Small surface variation
                const small =
                    this.fractalNoise(
                        worldX * 4,
                        worldZ * 4
                    );

                let height =
                    large * 0.7 +
                    medium * 0.22 +
                    small * 0.08;

                // Normalize
                height =
                    height * 2 - 1;

                // Flatten central spawn area
                const centerX =
                    normalizedX - 0.5;

                const centerZ =
                    normalizedZ - 0.5;

                const distance =
                    Math.sqrt(
                        centerX * centerX +
                        centerZ * centerZ
                    );

                const flatten =
                    clamp(
                        1 -
                        distance / 0.12,
                        0,
                        1
                    );

                height =
                    lerp(
                        height,
                        0,
                        flatten
                    );

                const finalHeight =
                    lerp(
                        this.config.minHeight,
                        this.config.maxHeight,
                        (height + 1) / 2
                    );

                this.heightData[
                    z * resolution + x
                ] = finalHeight;
            }
        }

        this.emit(
            "heightDataGenerated",
            {
                resolution
            }
        );
    }


    // ============================================================
    // FLAT TERRAIN
    // ============================================================

    createFlatHeightData() {

        const resolution =
            this.heightResolution;

        this.heightData =
            new Float32Array(
                resolution *
                resolution
            );

        this.heightData.fill(
            this.config.minHeight
        );
    }


    // ============================================================
    // TERRAIN MESH
    // ============================================================

    createTerrainMesh() {

        if (this.terrainMesh) {
            this.removeTerrainMesh();
        }

        const resolution =
            this.heightResolution;

        const geometry =
            new THREE.PlaneGeometry(
                this.config.size,
                this.config.size,
                this.config.segments,
                this.config.segments
            );

        const position =
            geometry.attributes.position;

        for (
            let z = 0;
            z < resolution;
            z++
        ) {

            for (
                let x = 0;
                x < resolution;
                x++
            ) {

                const index =
                    z * resolution + x;

                const vertexIndex =
                    index;

                const height =
                    this.heightData[index];

                position.setY(
                    vertexIndex,
                    height
                );
            }
        }

        geometry.computeVertexNormals();

        if (
            this.config.smoothNormals
        ) {
            geometry.normalizeNormals();
        }

        this.material =
            new THREE.MeshStandardMaterial({
                color: 0x46583a,

                roughness: 0.92,

                metalness: 0,

                wireframe:
                    this.config.wireframe
            });

        this.terrainMesh =
            new THREE.Mesh(
                geometry,
                this.material
            );

        this.terrainMesh.name =
            "MAIN_TERRAIN";

        this.terrainMesh.rotation.x =
            -Math.PI / 2;

        this.terrainMesh.position.y =
            0;

        this.terrainMesh.receiveShadow =
            this.config.receiveShadow;

        this.terrainMesh.castShadow =
            this.config.castShadow;

        this.terrainMesh.userData.azadWorld = {
            type: "terrain",
            collision: true,
            static: true
        };

        this.root.add(
            this.terrainMesh
        );

        this.emit(
            "terrainCreated",
            this.terrainMesh
        );
    }


    // ============================================================
    // HEIGHT LOOKUP
    // ============================================================

    getHeightAt(
        worldX,
        worldZ
    ) {

        if (
            !this.heightData
        ) {
            return 0;
        }

        const half =
            this.config.size / 2;

        const normalizedX =
            (worldX + half) /
            this.config.size;

        const normalizedZ =
            (worldZ + half) /
            this.config.size;

        const x =
            clamp(
                normalizedX,
                0,
                1
            ) *
            (this.heightResolution - 1);

        const z =
            clamp(
                normalizedZ,
                0,
                1
            ) *
            (this.heightResolution - 1);

        const x0 =
            Math.floor(x);

        const z0 =
            Math.floor(z);

        const x1 =
            Math.min(
                x0 + 1,
                this.heightResolution - 1
            );

        const z1 =
            Math.min(
                z0 + 1,
                this.heightResolution - 1
            );

        const tx =
            x - x0;

        const tz =
            z - z0;

        const h00 =
            this.heightData[
                z0 *
                this.heightResolution +
                x0
            ];

        const h10 =
            this.heightData[
                z0 *
                this.heightResolution +
                x1
            ];

        const h01 =
            this.heightData[
                z1 *
                this.heightResolution +
                x0
            ];

        const h11 =
            this.heightData[
                z1 *
                this.heightResolution +
                x1
            ];

        const h0 =
            lerp(
                h00,
                h10,
                tx
            );

        const h1 =
            lerp(
                h01,
                h11,
                tx
            );

        return lerp(
            h0,
            h1,
            tz
        );
    }


    // ============================================================
    // NORMAL LOOKUP
    // ============================================================

    getNormalAt(
        worldX,
        worldZ
    ) {

        const step =
            this.config.size /
            this.config.segments;

        const left =
            this.getHeightAt(
                worldX - step,
                worldZ
            );

        const right =
            this.getHeightAt(
                worldX + step,
                worldZ
            );

        const down =
            this.getHeightAt(
                worldX,
                worldZ - step
            );

        const up =
            this.getHeightAt(
                worldX,
                worldZ + step
            );

        const normal =
            new THREE.Vector3(
                left - right,
                step * 2,
                down - up
            );

        normal.normalize();

        return normal;
    }


    // ============================================================
    // WORLD POSITION
    // ============================================================

    getTerrainPosition(
        x,
        z
    ) {

        return {
            x,
            y:
                this.getHeightAt(
                    x,
                    z
                ),
            z
        };
    }


    // ============================================================
    // PLAYER GROUND SNAP
    // ============================================================

    getGroundHeight(
        x,
        z,
        playerHeight = 0
    ) {

        return (
            this.getHeightAt(
                x,
                z
            ) +
            playerHeight
        );
    }


    // ============================================================
    // CHUNKS
    // ============================================================

    getChunkKey(
        x,
        z
    ) {

        const chunkX =
            Math.floor(
                x /
                this.config.chunkSize
            );

        const chunkZ =
            Math.floor(
                z /
                this.config.chunkSize
            );

        return `${chunkX}:${chunkZ}`;
    }


    createChunk(
        chunkX,
        chunkZ
    ) {

        const key =
            `${chunkX}:${chunkZ}`;

        if (
            this.chunks.has(key)
        ) {
            return this.chunks.get(key);
        }

        const chunk =
            new THREE.Group();

        chunk.name =
            `TERRAIN_CHUNK_${key}`;

        chunk.position.set(
            chunkX *
                this.config.chunkSize,

            0,

            chunkZ *
                this.config.chunkSize
        );

        chunk.userData.azadWorld = {
            type: "terrainChunk",
            chunkX,
            chunkZ
        };

        this.root.add(
            chunk
        );

        this.chunks.set(
            key,
            chunk
        );

        this.emit(
            "chunkCreated",
            {
                key,
                chunk
            }
        );

        return chunk;
    }


    removeChunk(
        chunkX,
        chunkZ
    ) {

        const key =
            `${chunkX}:${chunkZ}`;

        const chunk =
            this.chunks.get(key);

        if (!chunk) {
            return false;
        }

        if (chunk.parent) {
            chunk.parent.remove(
                chunk
            );
        }

        chunk.traverse(
            child => {

                if (
                    child.geometry
                ) {
                    child.geometry.dispose();
                }

                if (
                    child.material
                ) {

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

                        material.dispose();
                    }
                }
            }
        );

        this.chunks.delete(
            key
        );

        this.activeChunks.delete(
            key
        );

        return true;
    }


    // ============================================================
    // LOD
    // ============================================================

    getLODLevel(
        distance
    ) {

        const viewDistance =
            this.config.viewDistance;

        if (
            distance <
            viewDistance * 0.15
        ) {
            return 0;
        }

        if (
            distance <
            viewDistance * 0.35
        ) {
            return 1;
        }

        if (
            distance <
            viewDistance * 0.65
        ) {
            return 2;
        }

        return Math.min(
            3,
            this.config.lodLevels - 1
        );
    }


    updateLOD(
        playerPosition
    ) {

        if (!playerPosition) {
            return;
        }

        this.lastPlayerPosition = {
            x:
                playerPosition.x,

            y:
                playerPosition.y,

            z:
                playerPosition.z
        };

        // --------------------------------------------------------
        // Chunk streaming foundation
        // --------------------------------------------------------

        const chunkRadius =
            Math.ceil(
                this.config.viewDistance /
                this.config.chunkSize
            );

        const playerChunkX =
            Math.floor(
                playerPosition.x /
                this.config.chunkSize
            );

        const playerChunkZ =
            Math.floor(
                playerPosition.z /
                this.config.chunkSize
            );

        const required =
            new Set();

        for (
            let z = -chunkRadius;
            z <= chunkRadius;
            z++
        ) {

            for (
                let x = -chunkRadius;
                x <= chunkRadius;
                x++
            ) {

                const chunkX =
                    playerChunkX + x;

                const chunkZ =
                    playerChunkZ + z;

                const worldX =
                    chunkX *
                    this.config.chunkSize;

                const worldZ =
                    chunkZ *
                    this.config.chunkSize;

                const dx =
                    worldX -
                    playerPosition.x;

                const dz =
                    worldZ -
                    playerPosition.z;

                const distance =
                    Math.sqrt(
                        dx * dx +
                        dz * dz
                    );

                if (
                    distance <=
                    this.config.viewDistance
                ) {

                    const key =
                        `${chunkX}:${chunkZ}`;

                    required.add(
                        key
                    );

                    if (
                        !this.chunks.has(key)
                    ) {
                        this.createChunk(
                            chunkX,
                            chunkZ
                        );
                    }

                    this.activeChunks.add(
                        key
                    );
                }
            }
        }

        // --------------------------------------------------------
        // Hide distant chunks
        // --------------------------------------------------------

        for (
            const [key, chunk]
            of this.chunks
        ) {

            if (
                !required.has(key)
            ) {

                chunk.visible =
                    false;

                this.activeChunks.delete(
                    key
                );

            } else {

                chunk.visible =
                    true;
            }
        }

        this.emit(
            "lodUpdated",
            {
                activeChunks:
                    this.activeChunks.size
            }
        );
    }


    // ============================================================
    // TERRAIN MATERIAL
    // ============================================================

    setMaterial(
        material
    ) {

        if (!material) {
            return false;
        }

        if (
            this.material &&
            this.material !== material
        ) {
            this.material.dispose();
        }

        this.material =
            material;

        if (this.terrainMesh) {
            this.terrainMesh.material =
                material;
        }

        return true;
    }


    setTexture(
        texture,
        property = "map"
    ) {

        if (!this.material) {
            return false;
        }

        if (!(texture instanceof THREE.Texture)) {
            return false;
        }

        this.material[property] =
            texture;

        texture.colorSpace =
            THREE.SRGBColorSpace;

        texture.anisotropy =
            8;

        texture.needsUpdate =
            true;

        this.material.needsUpdate =
            true;

        return true;
    }


    // ============================================================
    // TERRAIN SIZE
    // ============================================================

    setSize(
        size
    ) {

        const value =
            Math.max(
                10,
                Number(size) || 1000
            );

        this.config.size =
            value;

        return this.rebuild();
    }


    // ============================================================
    // REBUILD
    // ============================================================

    rebuild() {

        if (!this.initialized) {
            return false;
        }

        this.generateHeightData();

        this.createTerrainMesh();

        this.emit(
            "rebuilt",
            this.getSnapshot()
        );

        return true;
    }


    // ============================================================
    // UPDATE
    // ============================================================

    update(
        deltaTime = 0,
        playerPosition = null
    ) {

        if (
            !this.initialized ||
            !this.loaded ||
            this.disposed
        ) {
            return;
        }

        const delta =
            clamp(
                Number(deltaTime) || 0,
                0,
                0.1
            );

        this.elapsedTime +=
            delta;

        if (
            playerPosition
        ) {

            this.updateLOD(
                playerPosition
            );
        }
    }


    // ============================================================
    // COLLISION
    // ============================================================

    getCollisionMesh() {

        return this.terrainMesh;
    }


    isInsideBounds(
        x,
        z
    ) {

        const half =
            this.config.size / 2;

        return (
            x >= -half &&
            x <= half &&
            z >= -half &&
            z <= half
        );
    }


    // ============================================================
    // DEBUG
    // ============================================================

    getSnapshot() {

        return {

            initialized:
                this.initialized,

            loaded:
                this.loaded,

            size:
                this.config.size,

            segments:
                this.config.segments,

            resolution:
                this.heightResolution,

            minHeight:
                this.config.minHeight,

            maxHeight:
                this.config.maxHeight,

            chunkSize:
                this.config.chunkSize,

            viewDistance:
                this.config.viewDistance,

            lodLevels:
                this.config.lodLevels,

            chunks:
                this.chunks.size,

            activeChunks:
                this.activeChunks.size,

            seed:
                this.seed
        };
    }


    debug() {

        return {

            snapshot:
                this.getSnapshot(),

            root:
                this.root,

            terrainMesh:
                this.terrainMesh,

            material:
                this.material,

            heightData:
                this.heightData,

            chunks:
                this.chunks
        };
    }


    // ============================================================
    // EVENTS
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
            this.listeners.get(
                event
            );

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
                    `[AZAD WORLD] Terrain event "${event}" error:`,
                    error
                );
            }
        }
    }


    // ============================================================
    // DISPOSE
    // ============================================================

    removeTerrainMesh() {

        if (!this.terrainMesh) {
            return;
        }

        if (
            this.terrainMesh.parent
        ) {

            this.terrainMesh.parent.remove(
                this.terrainMesh
            );
        }

        if (
            this.terrainMesh.geometry
        ) {

            this.terrainMesh.geometry.dispose();
        }

        if (
            this.terrainMesh.material
        ) {

            this.terrainMesh.material.dispose();
        }

        this.terrainMesh = null;
    }


    dispose() {

        if (this.disposed) {
            return;
        }

        // --------------------------------------------------------
        // Remove terrain
        // --------------------------------------------------------

        this.removeTerrainMesh();

        // --------------------------------------------------------
        // Remove chunks
        // --------------------------------------------------------

        for (
            const key
            of this.chunks.keys()
        ) {

            const [x, z] =
                key.split(":")
                    .map(Number);

            this.removeChunk(
                x,
                z
            );
        }

        // --------------------------------------------------------
        // Root
        // --------------------------------------------------------

        if (this.root.parent) {

            this.root.parent.remove(
                this.root
            );
        }

        this.root.clear();

        // --------------------------------------------------------
        // Data
        // --------------------------------------------------------

        this.heightData = null;

        this.chunks.clear();

        this.activeChunks.clear();

        // --------------------------------------------------------
        // Events
        // --------------------------------------------------------

        this.listeners.clear();

        // --------------------------------------------------------
        // State
        // --------------------------------------------------------

        gameState.set(
            "world.terrain.loaded",
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

export const terrainSystem =
    new TerrainSystem();


// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

export function initializeTerrain() {

    return terrainSystem.initialize();
}


export function updateTerrain(
    deltaTime,
    playerPosition
) {

    return terrainSystem.update(
        deltaTime,
        playerPosition
    );
}


export function getTerrainHeight(
    x,
    z
) {

    return terrainSystem.getHeightAt(
        x,
        z
    );
}


export function getTerrainNormal(
    x,
    z
) {

    return terrainSystem.getNormalAt(
        x,
        z
    );
}


export function getTerrainPosition(
    x,
    z
) {

    return terrainSystem.getTerrainPosition(
        x,
        z
    );
}


export function getTerrain() {

    return terrainSystem;
}


export function getTerrainSnapshot() {

    return terrainSystem.getSnapshot();
}


export default terrainSystem;
