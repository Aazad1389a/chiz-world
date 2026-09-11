// ============================================================
// AZAD WORLD
// Buildings System
// src/world/buildings.js
// ============================================================

import * as THREE from "three";

import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";
import { worldSystem } from "./world.js";


// ============================================================
// DEFAULT CONFIG
// ============================================================

const DEFAULT_BUILDINGS = {
    enabled: true,

    defaultWidth: 18,
    defaultHeight: 12,
    defaultDepth: 18,

    wallThickness: 0.25,

    floors: 1,

    castShadow: true,
    receiveShadow: true,

    collision: true,

    lodDistance: 500,

    maxBuildings: 500,

    proceduralMaterials: true
};


// ============================================================
// HELPERS
// ============================================================

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function number(value, fallback = 0) {
    const result = Number(value);

    return Number.isFinite(result)
        ? result
        : fallback;
}


// ============================================================
// BUILDINGS SYSTEM
// ============================================================

export class BuildingsSystem {

    constructor(options = {}) {

        this.config = {
            ...DEFAULT_BUILDINGS,
            ...options
        };

        this.initialized = false;
        this.disposed = false;

        // --------------------------------------------------------
        // Root
        // --------------------------------------------------------

        this.root =
            new THREE.Group();

        this.root.name =
            "BUILDINGS_ROOT";

        // --------------------------------------------------------
        // Collections
        // --------------------------------------------------------

        this.buildings = new Map();

        this.interiors = new Map();

        this.doors = new Map();

        this.windows = new Map();

        this.colliders = new Map();

        // --------------------------------------------------------
        // IDs
        // --------------------------------------------------------

        this.nextBuildingId = 1;

        this.nextDoorId = 1;

        this.nextWindowId = 1;

        // --------------------------------------------------------
        // Runtime
        // --------------------------------------------------------

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
                "BuildingsSystem has already been disposed."
            );
        }

        if (!worldSystem.initialized) {
            worldSystem.initialize();
        }

        worldSystem.buildingsGroup.add(
            this.root
        );

        gameState.set(
            "world.buildings.loaded",
            true
        );

        gameState.set(
            "world.buildings.count",
            0
        );

        this.initialized = true;

        this.emit(
            "initialized",
            this.getSnapshot()
        );

        return this;
    }


    // ============================================================
    // MATERIALS
    // ============================================================

    createWallMaterial(
        color = 0x8a8175
    ) {

        return new THREE.MeshStandardMaterial({
            color,
            roughness: 0.85,
            metalness: 0.02
        });
    }


    createRoofMaterial(
        color = 0x3f4145
    ) {

        return new THREE.MeshStandardMaterial({
            color,
            roughness: 0.78,
            metalness: 0.05
        });
    }


    createGlassMaterial(
        color = 0x7da7bd
    ) {

        return new THREE.MeshPhysicalMaterial({

            color,

            roughness: 0.12,

            metalness: 0.05,

            transmission: 0.15,

            transparent: true,

            opacity: 0.72
        });
    }


    // ============================================================
    // CREATE BUILDING
    // ============================================================

    createBuilding(options = {}) {

        if (!this.initialized) {
            this.initialize();
        }

        if (
            this.buildings.size >=
            this.config.maxBuildings
        ) {
            return null;
        }

        const id =
            options.id ||
            `building_${this.nextBuildingId++}`;

        if (
            this.buildings.has(id)
        ) {
            return this.buildings.get(id);
        }

        const width =
            number(
                options.width,
                this.config.defaultWidth
            );

        const depth =
            number(
                options.depth,
                this.config.defaultDepth
            );

        const height =
            number(
                options.height,
                this.config.defaultHeight
            );

        const floors =
            Math.max(
                1,
                Math.floor(
                    number(
                        options.floors,
                        this.config.floors
                    )
                )
            );

        const group =
            new THREE.Group();

        group.name =
            `BUILDING_${id}`;

        group.position.set(
            number(options.x),
            number(options.y),
            number(options.z)
        );

        group.rotation.y =
            number(options.rotation);

        group.userData.azadWorld = {
            type: "building",
            id,
            collision:
                this.config.collision,
            static:
                options.static !== false
        };

        // --------------------------------------------------------
        // Building data
        // --------------------------------------------------------

        const data = {

            id,

            name:
                options.name ||
                id,

            type:
                options.type ||
                "residential",

            position: {
                x: group.position.x,
                y: group.position.y,
                z: group.position.z
            },

            rotation:
                group.rotation.y,

            dimensions: {
                width,
                height,
                depth
            },

            floors,

            enterable:
                options.enterable === true,

            locked:
                options.locked === true,

            visible:
                true,

            group,

            doors: [],

            windows: [],

            metadata:
                options.metadata || {}
        };

        // --------------------------------------------------------
        // Walls
        // --------------------------------------------------------

        this.createWalls(
            group,
            data
        );

        // --------------------------------------------------------
        // Floors
        // --------------------------------------------------------

        this.createFloors(
            group,
            data
        );

        // --------------------------------------------------------
        // Roof
        // --------------------------------------------------------

        this.createRoof(
            group,
            data
        );

        // --------------------------------------------------------
        // Windows
        // --------------------------------------------------------

        if (
            options.windows !== false
        ) {

            this.createWindows(
                group,
                data
            );
        }

        // --------------------------------------------------------
        // Door
        // --------------------------------------------------------

        if (
            options.door !== false
        ) {

            this.createDoor(
                group,
                data
            );
        }

        // --------------------------------------------------------
        // Add
        // --------------------------------------------------------

        this.root.add(
            group
        );

        this.buildings.set(
            id,
            data
        );

        // --------------------------------------------------------
        // Collision
        // --------------------------------------------------------

        if (
            this.config.collision
        ) {

            this.createBuildingCollider(
                data
            );
        }

        gameState.set(
            "world.buildings.count",
            this.buildings.size
        );

        this.emit(
            "buildingCreated",
            data
        );

        return data;
    }


    // ============================================================
    // WALLS
    // ============================================================

    createWalls(
        group,
        data
    ) {

        const {
            width,
            height,
            depth
        } = data.dimensions;

        const thickness =
            this.config.wallThickness;

        const material =
            this.createWallMaterial();

        // --------------------------------------------------------
        // Back
        // --------------------------------------------------------

        const back =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    width,
                    height,
                    thickness
                ),
                material
            );

        back.position.set(
            0,
            height / 2,
            -depth / 2
        );

        // --------------------------------------------------------
        // Left
        // --------------------------------------------------------

        const left =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    thickness,
                    height,
                    depth
                ),
                material
            );

        left.position.set(
            -width / 2,
            height / 2,
            0
        );

        // --------------------------------------------------------
        // Right
        // --------------------------------------------------------

        const right =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    thickness,
                    height,
                    depth
                ),
                material
            );

        right.position.set(
            width / 2,
            height / 2,
            0
        );

        // --------------------------------------------------------
        // Front sections
        // --------------------------------------------------------

        const frontLeft =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    width * 0.38,
                    height,
                    thickness
                ),
                material
            );

        frontLeft.position.set(
            -width * 0.31,
            height / 2,
            depth / 2
        );

        const frontRight =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    width * 0.38,
                    height,
                    thickness
                ),
                material
            );

        frontRight.position.set(
            width * 0.31,
            height / 2,
            depth / 2
        );

        const frontTop =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    width * 0.24,
                    height * 0.62,
                    thickness
                ),
                material
            );

        frontTop.position.set(
            0,
            height * 0.69,
            depth / 2
        );

        const walls = [
            back,
            left,
            right,
            frontLeft,
            frontRight,
            frontTop
        ];

        for (
            const wall of walls
        ) {

            wall.castShadow =
                this.config.castShadow;

            wall.receiveShadow =
                this.config.receiveShadow;

            wall.userData.azadWorld = {
                type: "buildingWall",
                buildingId: data.id,
                collision:
                    this.config.collision
            };

            group.add(
                wall
            );
        }
    }


    // ============================================================
    // FLOORS
    // ============================================================

    createFloors(
        group,
        data
    ) {

        const {
            width,
            depth,
            height
        } = data.dimensions;

        const floorHeight =
            height /
            data.floors;

        const material =
            new THREE.MeshStandardMaterial({
                color: 0x6f6253,
                roughness: 0.9
            });

        for (
            let floor = 0;
            floor <= data.floors;
            floor++
        ) {

            const mesh =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        width,
                        0.2,
                        depth
                    ),
                    material
                );

            mesh.position.y =
                floor *
                floorHeight;

            mesh.receiveShadow =
                this.config.receiveShadow;

            mesh.userData.azadWorld = {
                type: "buildingFloor",
                buildingId: data.id,
                floor
            };

            group.add(
                mesh
            );
        }
    }


    // ============================================================
    // ROOF
    // ============================================================

    createRoof(
        group,
        data
    ) {

        const {
            width,
            height,
            depth
        } = data.dimensions;

        const roof =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    width + 0.5,
                    0.5,
                    depth + 0.5
                ),
                this.createRoofMaterial()
            );

        roof.position.y =
            height + 0.25;

        roof.castShadow =
            this.config.castShadow;

        roof.receiveShadow =
            this.config.receiveShadow;

        roof.userData.azadWorld = {
            type: "buildingRoof",
            buildingId: data.id,
            collision:
                this.config.collision
        };

        group.add(
            roof
        );
    }


    // ============================================================
    // WINDOWS
    // ============================================================

    createWindows(
        group,
        data
    ) {

        const {
            width,
            height
        } = data.dimensions;

        const floors =
            data.floors;

        const glassMaterial =
            this.createGlassMaterial();

        const floorHeight =
            height /
            floors;

        for (
            let floor = 0;
            floor < floors;
            floor++
        ) {

            const y =
                floorHeight *
                floor +
                floorHeight *
                0.55;

            // Front windows
            for (
                let i = -1;
                i <= 1;
                i++
            ) {

                const windowMesh =
                    new THREE.Mesh(
                        new THREE.BoxGeometry(
                            width * 0.14,
                            floorHeight * 0.35,
                            0.08
                        ),
                        glassMaterial
                    );

                windowMesh.position.set(
                    i *
                        width *
                        0.28,
                    y,
                    data.dimensions.depth / 2 +
                        0.04
                );

                windowMesh.userData.azadWorld = {
                    type: "buildingWindow",
                    buildingId: data.id,
                    floor
                };

                windowMesh.castShadow =
                    this.config.castShadow;

                windowMesh.receiveShadow =
                    this.config.receiveShadow;

                group.add(
                    windowMesh
                );

                const windowId =
                    `window_${this.nextWindowId++}`;

                this.windows.set(
                    windowId,
                    {
                        id: windowId,
                        buildingId: data.id,
                        object: windowMesh,
                        floor
                    }
                );

                data.windows.push(
                    windowId
                );
            }
        }
    }


    // ============================================================
    // DOOR
    // ============================================================

    createDoor(
        group,
        data
    ) {

        const {
            width
        } = data.dimensions;

        const door =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    width * 0.16,
                    2.4,
                    0.12
                ),
                new THREE.MeshStandardMaterial({
                    color: 0x33251d,
                    roughness: 0.75
                })
            );

        door.position.set(
            0,
            1.2,
            data.dimensions.depth / 2 +
                0.07
        );

        door.userData.azadWorld = {
            type: "buildingDoor",
            buildingId: data.id,
            locked:
                data.locked
        };

        door.castShadow =
            this.config.castShadow;

        door.receiveShadow =
            this.config.receiveShadow;

        group.add(
            door
        );

        const doorId =
            `door_${this.nextDoorId++}`;

        const doorData = {

            id: doorId,

            buildingId:
                data.id,

            object:
                door,

            open:
                false,

            locked:
                data.locked,

            openRotation:
                -Math.PI / 2,

            closedRotation:
                0
        };

        this.doors.set(
            doorId,
            doorData
        );

        data.doors.push(
            doorId
        );

        return doorData;
    }


    // ============================================================
    // COLLIDER
    // ============================================================

    createBuildingCollider(
        data
    ) {

        const {
            width,
            height,
            depth
        } = data.dimensions;

        const collider =
            new THREE.Box3();

        const center =
            new THREE.Vector3(
                data.position.x,
                data.position.y +
                    height / 2,
                data.position.z
            );

        const half =
            new THREE.Vector3(
                width / 2,
                height / 2,
                depth / 2
            );

        collider.setFromCenterAndSize(
            center,
            half.multiplyScalar(2)
        );

        this.colliders.set(
            data.id,
            {
                id: data.id,
                box: collider,
                buildingId: data.id
            }
        );
    }


    // ============================================================
    // DOOR CONTROL
    // ============================================================

    openDoor(
        doorId
    ) {

        const door =
            this.doors.get(doorId);

        if (!door) {
            return false;
        }

        if (door.locked) {
            return false;
        }

        door.open = true;

        door.object.rotation.y =
            door.openRotation;

        this.emit(
            "doorOpened",
            door
        );

        return true;
    }


    closeDoor(
        doorId
    ) {

        const door =
            this.doors.get(doorId);

        if (!door) {
            return false;
        }

        door.open = false;

        door.object.rotation.y =
            door.closedRotation;

        this.emit(
            "doorClosed",
            door
        );

        return true;
    }


    toggleDoor(
        doorId
    ) {

        const door =
            this.doors.get(doorId);

        if (!door) {
            return false;
        }

        return door.open
            ? this.closeDoor(doorId)
            : this.openDoor(doorId);
    }


    // ============================================================
    // BUILDING ACCESS
    // ============================================================

    canEnterBuilding(
        buildingId
    ) {

        const building =
            this.buildings.get(
                buildingId
            );

        if (!building) {
            return false;
        }

        if (!building.enterable) {
            return false;
        }

        if (building.locked) {
            return false;
        }

        return true;
    }


    setBuildingLocked(
        buildingId,
        locked
    ) {

        const building =
            this.buildings.get(
                buildingId
            );

        if (!building) {
            return false;
        }

        building.locked =
            Boolean(locked);

        for (
            const doorId
            of building.doors
        ) {

            const door =
                this.doors.get(
                    doorId
                );

            if (door) {
                door.locked =
                    building.locked;
            }
        }

        return true;
    }


    // ============================================================
    // GETTERS
    // ============================================================

    getBuilding(
        buildingId
    ) {

        return (
            this.buildings.get(
                buildingId
            ) ||
            null
        );
    }


    getBuildings() {

        return [
            ...this.buildings.values()
        ];
    }


    getDoor(
        doorId
    ) {

        return (
            this.doors.get(
                doorId
            ) ||
            null
        );
    }


    getWindow(
        windowId
    ) {

        return (
            this.windows.get(
                windowId
            ) ||
            null
        );
    }


    getCollisionBoxes() {

        return [
            ...this.colliders.values()
        ];
    }


    // ============================================================
    // REMOVE BUILDING
    // ============================================================

    removeBuilding(
        buildingId
    ) {

        const building =
            this.buildings.get(
                buildingId
            );

        if (!building) {
            return false;
        }

        // --------------------------------------------------------
        // Doors
        // --------------------------------------------------------

        for (
            const doorId
            of building.doors
        ) {

            this.doors.delete(
                doorId
            );
        }

        // --------------------------------------------------------
        // Windows
        // --------------------------------------------------------

        for (
            const windowId
            of building.windows
        ) {

            this.windows.delete(
                windowId
            );
        }

        // --------------------------------------------------------
        // Collider
        // --------------------------------------------------------

        this.colliders.delete(
            buildingId
        );

        // --------------------------------------------------------
        // Object
        // --------------------------------------------------------

        if (
            building.group.parent
        ) {

            building.group.parent.remove(
                building.group
            );
        }

        this.disposeObject(
            building.group
        );

        this.buildings.delete(
            buildingId
        );

        gameState.set(
            "world.buildings.count",
            this.buildings.size
        );

        this.emit(
            "buildingRemoved",
            buildingId
        );

        return true;
    }


    // ============================================================
    // DISTANCE / LOD
    // ============================================================

    updateLOD(
        playerPosition
    ) {

        if (!playerPosition) {
            return;
        }

        for (
            const building
            of this.buildings.values()
        ) {

            const dx =
                building.position.x -
                playerPosition.x;

            const dz =
                building.position.z -
                playerPosition.z;

            const distance =
                Math.sqrt(
                    dx * dx +
                    dz * dz
                );

            building.visible =
                distance <=
                this.config.lodDistance;

            building.group.visible =
                building.visible;
        }
    }


    // ============================================================
    // PROCEDURAL CITY
    // ============================================================

    generateDistrict(
        options = {}
    ) {

        const count =
            clamp(
                Math.floor(
                    number(
                        options.count,
                        25
                    )
                ),
                1,
                this.config.maxBuildings -
                    this.buildings.size
            );

        const spacing =
            number(
                options.spacing,
                45
            );

        const originX =
            number(
                options.x
            );

        const originZ =
            number(
                options.z
            );

        const created = [];

        const columns =
            Math.ceil(
                Math.sqrt(count)
            );

        for (
            let i = 0;
            i < count;
            i++
        ) {

            const row =
                Math.floor(
                    i / columns
                );

            const column =
                i % columns;

            const offset =
                row % 2 === 0
                    ? 0
                    : spacing * 0.5;

            const building =
                this.createBuilding({

                    type:
                        options.type ||
                        "residential",

                    x:
                        originX +
                        column *
                        spacing +
                        offset,

                    y:
                        0,

                    z:
                        originZ +
                        row *
                        spacing,

                    width:
                        16 +
                        Math.random() * 10,

                    depth:
                        16 +
                        Math.random() * 10,

                    height:
                        10 +
                        Math.random() * 18,

                    floors:
                        1 +
                        Math.floor(
                            Math.random() * 3
                        ),

                    enterable:
                        options.enterable === true,

                    door:
                        true,

                    windows:
                        true
                });

            if (building) {
                created.push(
                    building
                );
            }
        }

        this.emit(
            "districtGenerated",
            {
                count:
                    created.length
            }
        );

        return created;
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
            this.disposed
        ) {
            return;
        }

        const delta =
            clamp(
                number(deltaTime),
                0,
                0.1
            );

        this.elapsedTime +=
            delta;

        if (playerPosition) {

            this.updateLOD(
                playerPosition
            );
        }
    }


    // ============================================================
    // DISPOSAL
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

                        material.dispose();
                    }
                }
            }
        );
    }


    // ============================================================
    // SNAPSHOT
    // ============================================================

    getSnapshot() {

        return {

            initialized:
                this.initialized,

            buildings:
                this.buildings.size,

            doors:
                this.doors.size,

            windows:
                this.windows.size,

            colliders:
                this.colliders.size,

            maxBuildings:
                this.config.maxBuildings
        };
    }


    // ============================================================
    // DEBUG
    // ============================================================

    debug() {

        return {

            snapshot:
                this.getSnapshot(),

            root:
                this.root,

            buildings:
                this.buildings,

            doors:
                this.doors,

            windows:
                this.windows,

            colliders:
                this.colliders
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
                    `[AZAD WORLD] Buildings event "${event}" error:`,
                    error
                );
            }
        }
    }


    // ============================================================
    // DISPOSE
    // ============================================================

    destroy() {

        for (
            const id
            of this.buildings.keys()
        ) {

            this.removeBuilding(id);
        }

        this.buildings.clear();
        this.doors.clear();
        this.windows.clear();
        this.colliders.clear();

        if (this.root.parent) {

            this.root.parent.remove(
                this.root
            );
        }

        this.root.clear();

        this.listeners.clear();

        gameState.set(
            "world.buildings.loaded",
            false
        );

        this.initialized = false;
        this.disposed = true;
    }


    dispose() {

        this.destroy();
    }
}


// ============================================================
// SINGLETON
// ============================================================

export const buildingsSystem =
    new BuildingsSystem();


// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

export function initializeBuildings() {

    return buildingsSystem.initialize();
}


export function createBuilding(
    options
) {

    return buildingsSystem.createBuilding(
        options
    );
}


export function removeBuilding(
    id
) {

    return buildingsSystem.removeBuilding(
        id
    );
}


export function getBuilding(
    id
) {

    return buildingsSystem.getBuilding(
        id
    );
}


export function getBuildings() {

    return buildingsSystem.getBuildings();
}


export function updateBuildings(
    deltaTime,
    playerPosition
) {

    return buildingsSystem.update(
        deltaTime,
        playerPosition
    );
}


export function generateDistrict(
    options
) {

    return buildingsSystem.generateDistrict(
        options
    );
}


export function getBuildingsSnapshot() {

    return buildingsSystem.getSnapshot();
}


export default buildingsSystem;
