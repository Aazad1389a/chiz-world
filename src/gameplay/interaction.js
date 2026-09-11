// AZAD WORLD
// Interaction System
// Path: src/gameplay/interaction.js

import * as THREE from "three";

import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";
import { playerController } from "../player/controller.js";
import { player } from "../player/player.js";

const DEFAULT_CONFIG = {
    interactionDistance: 3.5,
    raycastDistance: 5,
    maxTargets: 10,
    highlightEnabled: true,
    requireLineOfSight: true,
    updateInterval: 0.05,
};

const INTERACTION_TYPES = Object.freeze({
    GENERIC: "generic",
    DOOR: "door",
    NPC: "npc",
    ITEM: "item",
    CHEST: "chest",
    VEHICLE: "vehicle",
    TERMINAL: "terminal",
    BUTTON: "button",
    PICKUP: "pickup",
    MISSION: "mission",
    SHOP: "shop",
    CUSTOM: "custom",
});

const INTERACTION_ACTIONS = Object.freeze({
    INTERACT: "interact",
    OPEN: "open",
    CLOSE: "close",
    TALK: "talk",
    PICKUP: "pickup",
    ENTER: "enter",
    EXIT: "exit",
    USE: "use",
    INSPECT: "inspect",
    ACTIVATE: "activate",
});

function clone(value) {
    if (value === undefined) return undefined;

    try {
        return structuredClone(value);
    } catch {
        return JSON.parse(JSON.stringify(value));
    }
}

function now() {
    return Date.now();
}

function createId(prefix = "interaction") {
    return `${prefix}_${now()}_${Math.random()
        .toString(36)
        .slice(2, 9)}`;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function number(value, fallback = 0) {
    const result = Number(value);

    return Number.isFinite(result)
        ? result
        : fallback;
}

class InteractionManager {
    constructor(config = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
        };

        this.targets = new Map();

        this.currentTarget = null;

        this.lastTarget = null;

        this.listeners = new Map();

        this.raycaster =
            new THREE.Raycaster();

        this.camera = null;

        this.scene = null;

        this.enabled = true;

        this.elapsed = 0;

        this.initialized = false;

        this.highlightedObject = null;

        this.highlightOriginal = null;
    }

    // ==================================================
    // EVENTS
    // ==================================================

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

        this.listeners
            .get(event)
            .add(callback);

        return () =>
            this.off(event, callback);
    }

    off(event, callback) {
        const listeners =
            this.listeners.get(event);

        if (!listeners) return;

        listeners.delete(callback);

        if (listeners.size === 0) {
            this.listeners.delete(event);
        }
    }

    emit(event, data = {}) {
        const listeners =
            this.listeners.get(event);

        if (!listeners) return;

        for (const callback of listeners) {
            try {
                callback(data);
            } catch (error) {
                console.error(
                    `[InteractionManager] ${event}`,
                    error
                );
            }
        }
    }

    // ==================================================
    // INITIALIZE
    // ==================================================

    initialize({
        scene = null,
        camera = null,
    } = {}) {
        this.scene = scene;
        this.camera = camera;

        this.initialized = true;

        this.emit("initialized");

        return this;
    }

    setScene(scene) {
        this.scene = scene;

        return this;
    }

    setCamera(camera) {
        this.camera = camera;

        return this;
    }

    // ==================================================
    // REGISTER TARGET
    // ==================================================

    registerTarget(object, options = {}) {
        if (!object) {
            return null;
        }

        const id =
            options.id ||
            object.userData?.interactionId ||
            createId();

        const target = {
            id,

            object,

            type:
                options.type ||
                INTERACTION_TYPES.GENERIC,

            name:
                options.name ||
                object.name ||
                "Object",

            prompt:
                options.prompt ||
                "Interact",

            description:
                options.description ||
                "",

            distance: Math.max(
                0.1,
                number(
                    options.distance,
                    this.config.interactionDistance
                )
            ),

            enabled:
                options.enabled !== false,

            visible:
                options.visible !== false,

            actions:
                Array.isArray(options.actions)
                    ? [...options.actions]
                    : [
                          INTERACTION_ACTIONS.INTERACT,
                      ],

            priority: number(
                options.priority,
                0
            ),

            requiresLineOfSight:
                options.requiresLineOfSight !==
                undefined
                    ? Boolean(
                          options.requiresLineOfSight
                      )
                    : this.config
                          .requireLineOfSight,

            metadata:
                clone(options.metadata || {}),

            canInteract:
                typeof options.canInteract ===
                "function"
                    ? options.canInteract
                    : null,

            onInteract:
                typeof options.onInteract ===
                "function"
                    ? options.onInteract
                    : null,

            onEnter:
                typeof options.onEnter ===
                "function"
                    ? options.onEnter
                    : null,

            onExit:
                typeof options.onExit ===
                "function"
                    ? options.onExit
                    : null,
        };

        object.userData =
            object.userData || {};

        object.userData.interactionId = id;

        object.userData.interactable = true;

        this.targets.set(
            id,
            target
        );

        this.emit("targetRegistered", {
            target: clone({
                ...target,
                object: undefined,
            }),
        });

        return target;
    }

    registerMany(objects = []) {
        return objects.map(entry => {
            if (entry.object) {
                return this.registerTarget(
                    entry.object,
                    entry
                );
            }

            return this.registerTarget(
                entry
            );
        });
    }

    unregisterTarget(id) {
        const target =
            this.targets.get(id);

        if (!target) {
            return false;
        }

        if (
            this.currentTarget?.id === id
        ) {
            this.clearCurrentTarget();
        }

        this.targets.delete(id);

        this.emit("targetUnregistered", {
            id,
        });

        return true;
    }

    // ==================================================
    // ENABLE / DISABLE
    // ==================================================

    enable() {
        this.enabled = true;

        this.emit("enabled");

        return this;
    }

    disable() {
        this.enabled = false;

        this.clearCurrentTarget();

        this.emit("disabled");

        return this;
    }

    // ==================================================
    // DISTANCE
    // ==================================================

    getPlayerPosition() {
        const snapshot =
            playerController.getSnapshot();

        return new THREE.Vector3(
            number(
                snapshot.position?.x,
                0
            ),
            number(
                snapshot.position?.y,
                0
            ),
            number(
                snapshot.position?.z,
                0
            )
        );
    }

    getObjectPosition(object) {
        const position =
            new THREE.Vector3();

        object.getWorldPosition(
            position
        );

        return position;
    }

    getDistanceToTarget(target) {
        if (!target?.object) {
            return Infinity;
        }

        const playerPosition =
            this.getPlayerPosition();

        const objectPosition =
            this.getObjectPosition(
                target.object
            );

        return playerPosition.distanceTo(
            objectPosition
        );
    }

    // ==================================================
    // VISIBILITY
    // ==================================================

    isVisible(target) {
        if (!target?.object) {
            return false;
        }

        if (!target.object.visible) {
            return false;
        }

        let object = target.object;

        while (object) {
            if (!object.visible) {
                return false;
            }

            object = object.parent;
        }

        return true;
    }

    // ==================================================
    // LINE OF SIGHT
    // ==================================================

    hasLineOfSight(target) {
        if (!target?.object) {
            return false;
        }

        if (!target.requiresLineOfSight) {
            return true;
        }

        if (!this.camera || !this.scene) {
            return true;
        }

        const cameraPosition =
            new THREE.Vector3();

        this.camera.getWorldPosition(
            cameraPosition
        );

        const targetPosition =
            this.getObjectPosition(
                target.object
            );

        const direction =
            targetPosition
                .clone()
                .sub(cameraPosition)
                .normalize();

        const distance =
            cameraPosition.distanceTo(
                targetPosition
            );

        this.raycaster.set(
            cameraPosition,
            direction
        );

        this.raycaster.far =
            Math.min(
                distance,
                this.config.raycastDistance
            );

        const intersections =
            this.raycaster.intersectObjects(
                this.scene.children,
                true
            );

        if (intersections.length === 0) {
            return true;
        }

        const first =
            intersections[0].object;

        if (
            first === target.object ||
            target.object
                .getObjectById(first.id)
        ) {
            return true;
        }

        let parent = first;

        while (parent) {
            if (
                parent ===
                target.object
            ) {
                return true;
            }

            parent = parent.parent;
        }

        return false;
    }

    // ==================================================
    // CAN INTERACT
    // ==================================================

    canInteract(target) {
        if (!target) {
            return false;
        }

        if (!target.enabled) {
            return false;
        }

        if (!this.isVisible(target)) {
            return false;
        }

        const distance =
            this.getDistanceToTarget(
                target
            );

        if (
            distance >
            target.distance
        ) {
            return false;
        }

        if (
            !this.hasLineOfSight(target)
        ) {
            return false;
        }

        if (target.canInteract) {
            try {
                return Boolean(
                    target.canInteract({
                        target,
                        distance,
                        manager: this,
                    })
                );
            } catch (error) {
                console.error(
                    "[InteractionManager] canInteract error:",
                    error
                );

                return false;
            }
        }

        return true;
    }

    // ==================================================
    // FIND TARGETS
    // ==================================================

    getAvailableTargets() {
        const result = [];

        for (const target of this.targets.values()) {
            if (
                this.canInteract(target)
            ) {
                result.push({
                    target,
                    distance:
                        this.getDistanceToTarget(
                            target
                        ),
                });
            }
        }

        result.sort((a, b) => {
            if (
                b.target.priority !==
                a.target.priority
            ) {
                return (
                    b.target.priority -
                    a.target.priority
                );
            }

            return (
                a.distance -
                b.distance
            );
        });

        return result.slice(
            0,
            this.config.maxTargets
        );
    }

    findTarget() {
        const available =
            this.getAvailableTargets();

        return available.length > 0
            ? available[0].target
            : null;
    }

    // ==================================================
    // CURRENT TARGET
    // ==================================================

    setCurrentTarget(target) {
        if (
            this.currentTarget?.id ===
            target?.id
        ) {
            return;
        }

        this.lastTarget =
            this.currentTarget;

        this.currentTarget = target;

        if (this.lastTarget) {
            this.emit("targetExit", {
                target:
                    clone({
                        ...this.lastTarget,
                        object: undefined,
                    }),
            });

            try {
                this.lastTarget.onExit?.(
                    this.lastTarget
                );
            } catch (error) {
                console.error(error);
            }
        }

        if (target) {
            this.emit("targetEnter", {
                target:
                    clone({
                        ...target,
                        object: undefined,
                    }),
            });

            try {
                target.onEnter?.(target);
            } catch (error) {
                console.error(error);
            }
        }

        this.updateHighlight(target);

        gameState.set(
            "ui.interactionTarget",
            target
                ? {
                      id: target.id,
                      name: target.name,
                      prompt: target.prompt,
                      type: target.type,
                      distance:
                          this.getDistanceToTarget(
                              target
                          ),
                  }
                : null
        );
    }

    clearCurrentTarget() {
        if (!this.currentTarget) {
            return;
        }

        const previous =
            this.currentTarget;

        this.currentTarget = null;

        this.updateHighlight(null);

        gameState.set(
            "ui.interactionTarget",
            null
        );

        this.emit("targetCleared", {
            target:
                clone({
                    ...previous,
                    object: undefined,
                }),
        });
    }

    getCurrentTarget() {
        return this.currentTarget;
    }

    // ==================================================
    // HIGHLIGHT
    // ==================================================

    updateHighlight(target) {
        if (!this.config.highlightEnabled) {
            return;
        }

        if (
            this.highlightedObject &&
            this.highlightOriginal
        ) {
            this.highlightedObject.traverse(
                object => {
                    if (
                        object.isMesh &&
                        object.material
                    ) {
                        const material =
                            object.material;

                        if (
                            this.highlightOriginal.has(
                                object.uuid
                            )
                        ) {
                            material.emissiveIntensity =
                                this.highlightOriginal.get(
                                    object.uuid
                                );
                        }
                    }
                }
            );
        }

        this.highlightedObject =
            null;

        this.highlightOriginal =
            null;

        if (!target?.object) {
            return;
        }

        this.highlightedObject =
            target.object;

        this.highlightOriginal =
            new Map();

        target.object.traverse(
            object => {
                if (
                    !object.isMesh ||
                    !object.material
                ) {
                    return;
                }

                const material =
                    object.material;

                if (
                    "emissiveIntensity" in
                    material
                ) {
                    this.highlightOriginal.set(
                        object.uuid,
                        material.emissiveIntensity
                    );

                    material.emissiveIntensity =
                        Math.max(
                            material.emissiveIntensity,
                            0.5
                        );
                }
            }
        );
    }

    // ==================================================
    // INTERACTION
    // ==================================================

    interact(action =
        INTERACTION_ACTIONS.INTERACT) {
        const target =
            this.currentTarget;

        if (!target) {
            return {
                success: false,
                reason: "no_target",
            };
        }

        if (!this.canInteract(target)) {
            return {
                success: false,
                reason: "cannot_interact",
            };
        }

        if (
            !target.actions.includes(action) &&
            !target.actions.includes(
                INTERACTION_ACTIONS.INTERACT
            )
        ) {
            return {
                success: false,
                reason: "action_not_allowed",
            };
        }

        const payload = {
            target,
            action,
            manager: this,
            player,
            playerController,
        };

        let result = {
            success: true,
        };

        if (target.onInteract) {
            try {
                const callbackResult =
                    target.onInteract(
                        payload
                    );

                if (
                    callbackResult !==
                    undefined
                ) {
                    result =
                        callbackResult;
                }
            } catch (error) {
                console.error(
                    "[InteractionManager] Interaction error:",
                    error
                );

                return {
                    success: false,
                    reason: "interaction_error",
                    error,
                };
            }
        }

        this.emit("interacted", {
            target:
                clone({
                    ...target,
                    object: undefined,
                }),
            action,
            result:
                clone(result),
        });

        return {
            success: true,
            target:
                clone({
                    ...target,
                    object: undefined,
                }),
            action,
            result:
                clone(result),
        };
    }

    // ==================================================
    // TYPE HELPERS
    // ==================================================

    getTargetsByType(type) {
        return [...this.targets.values()]
            .filter(
                target =>
                    target.type === type
            )
            .map(target =>
                clone({
                    ...target,
                    object: undefined,
                })
            );
    }

    getTarget(id) {
        return (
            this.targets.get(id) ||
            null
        );
    }

    setTargetEnabled(id, enabled) {
        const target =
            this.targets.get(id);

        if (!target) return false;

        target.enabled =
            Boolean(enabled);

        if (
            !target.enabled &&
            this.currentTarget?.id === id
        ) {
            this.clearCurrentTarget();
        }

        this.emit("targetEnabledChanged", {
            id,
            enabled:
                target.enabled,
        });

        return true;
    }

    setTargetPrompt(id, prompt) {
        const target =
            this.targets.get(id);

        if (!target) return false;

        target.prompt = String(prompt);

        return true;
    }

    // ==================================================
    // UPDATE
    // ==================================================

    update(deltaTime = 0) {
        if (!this.enabled) {
            return;
        }

        this.elapsed += deltaTime;

        if (
            this.elapsed <
            this.config.updateInterval
        ) {
            return;
        }

        this.elapsed = 0;

        const target =
            this.findTarget();

        if (target) {
            this.setCurrentTarget(
                target
            );
        } else {
            this.clearCurrentTarget();
        }
    }

    // ==================================================
    // SNAPSHOT
    // ==================================================

    getSnapshot() {
        return {
            initialized:
                this.initialized,

            enabled:
                this.enabled,

            targetCount:
                this.targets.size,

            currentTarget:
                this.currentTarget
                    ? {
                          id:
                              this
                                  .currentTarget
                                  .id,

                          name:
                              this
                                  .currentTarget
                                  .name,

                          type:
                              this
                                  .currentTarget
                                  .type,

                          prompt:
                              this
                                  .currentTarget
                                  .prompt,

                          distance:
                              this.getDistanceToTarget(
                                  this
                                      .currentTarget
                              ),
                      }
                    : null,
        };
    }

    debug() {
        return {
            config:
                clone(this.config),

            snapshot:
                this.getSnapshot(),

            targets:
                [...this.targets.values()]
                    .map(target =>
                        clone({
                            ...target,
                            object: undefined,
                        })
                    ),
        };
    }

    // ==================================================
    // DISPOSE
    // ==================================================

    dispose() {
        this.clearCurrentTarget();

        this.targets.clear();

        this.listeners.clear();

        this.camera = null;

        this.scene = null;

        this.highlightedObject = null;

        this.highlightOriginal = null;

        this.initialized = false;
    }
}

// ======================================================
// SINGLETON
// ======================================================

export const interactionManager =
    new InteractionManager();

// ======================================================
// HELPERS
// ======================================================

export function initializeInteraction(
    options = {}
) {
    return interactionManager.initialize(
        options
    );
}

export function registerInteraction(
    object,
    options = {}
) {
    return interactionManager.registerTarget(
        object,
        options
    );
}

export function unregisterInteraction(
    id
) {
    return interactionManager.unregisterTarget(
        id
    );
}

export function updateInteraction(
    deltaTime
) {
    return interactionManager.update(
        deltaTime
    );
}

export function interact(
    action = INTERACTION_ACTIONS.INTERACT
) {
    return interactionManager.interact(
        action
    );
}

export function getCurrentInteraction() {
    return interactionManager.getCurrentTarget();
}

export function getInteractionManager() {
    return interactionManager;
}

// ======================================================
// EXPORTS
// ======================================================

export {
    INTERACTION_TYPES,
    INTERACTION_ACTIONS,
};

export default interactionManager;
