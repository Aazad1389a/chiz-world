import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";
import { inputManager } from "../core/input-manager.js";

/**
 * AZAD WORLD
 * Player Controller
 *
 * مسئول:
 * - حرکت بازیکن
 * - دویدن
 * - پرش
 * - جاذبه
 * - شتاب و کاهش سرعت
 * - Stamina
 * - Ground detection
 * - Health
 * - Damage / Heal
 * - Death / Respawn
 * - هماهنگی با GameState
 *
 * نکته:
 * inputManager.update() نباید اینجا اجرا شود.
 * این کار باید فقط یک بار در حلقه اصلی بازی انجام شود.
 */

const EPSILON = 0.0001;

const DEFAULTS = {
    maxHealth: 100,
    maxStamina: 100,

    walkSpeed: 5,
    sprintSpeed: 9,

    acceleration: 28,
    deceleration: 34,

    jumpForce: 7,
    gravity: 20,

    staminaDrain: 18,
    staminaRecovery: 24,

    playerHeight: 1.8,

    minY: 0,

    maxDeltaTime: 0.05,

    respawnPosition: {
        x: 0,
        y: 0,
        z: 0
    }
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(current, target, amount) {
    return current + (target - current) * amount;
}

function length2D(x, z) {
    return Math.sqrt((x * x) + (z * z));
}

function normalize2D(x, z) {
    const length = length2D(x, z);

    if (length <= EPSILON) {
        return {
            x: 0,
            z: 0
        };
    }

    return {
        x: x / length,
        z: z / length
    };
}

function cloneVector(vector) {
    return {
        x: vector.x,
        y: vector.y,
        z: vector.z
    };
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
                        `[PlayerController] Event "${event}" error:`,
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

export class PlayerController {
    constructor(options = {}) {
        this.options = options;

        this.config = {
            maxHealth: options.maxHealth ??
                getConfigValue(
                    ["player", "maxHealth"],
                    DEFAULTS.maxHealth
                ),

            maxStamina: options.maxStamina ??
                getConfigValue(
                    ["player", "maxStamina"],
                    DEFAULTS.maxStamina
                ),

            walkSpeed: options.walkSpeed ??
                getConfigValue(
                    ["player", "speed"],
                    DEFAULTS.walkSpeed
                ),

            sprintSpeed: options.sprintSpeed ??
                getConfigValue(
                    ["player", "sprint"],
                    DEFAULTS.sprintSpeed
                ),

            acceleration: options.acceleration ??
                getConfigValue(
                    ["player", "acceleration"],
                    DEFAULTS.acceleration
                ),

            deceleration: options.deceleration ??
                getConfigValue(
                    ["player", "deceleration"],
                    DEFAULTS.deceleration
                ),

            jumpForce: options.jumpForce ??
                getConfigValue(
                    ["player", "jump"],
                    DEFAULTS.jumpForce
                ),

            gravity: options.gravity ??
                getConfigValue(
                    ["physics", "gravity"],
                    DEFAULTS.gravity
                ),

            playerHeight: options.playerHeight ??
                getConfigValue(
                    ["player", "height"],
                    DEFAULTS.playerHeight
                ),

            maxDeltaTime: options.maxDeltaTime ??
                DEFAULTS.maxDeltaTime
        };

        this.position = {
            x: 0,
            y: 0,
            z: 0
        };

        this.rotation = {
            x: 0,
            y: 0,
            z: 0
        };

        this.velocity = {
            x: 0,
            y: 0,
            z: 0
        };

        this.moveDirection = {
            x: 0,
            z: 0
        };

        this.grounded = true;
        this.sprinting = false;

        this.health = this.config.maxHealth;
        this.stamina = this.config.maxStamina;

        this.alive = true;

        this.initialized = false;
        this.enabled = true;

        this.totalDistance = 0;
        this.totalPlayTime = 0;

        this.previousGrounded = true;
        this.previousAlive = true;

        this.respawnPosition = {
            ...DEFAULTS.respawnPosition
        };

        this.emitter = createEmitter();

        this._stateUnsubscribe = null;
    }

    /**
     * Initialize controller from GameState.
     */
    initialize() {
        if (this.initialized) {
            return this;
        }

        const playerState = gameState.get("player");

        if (playerState) {
            if (playerState.position) {
                this.position = {
                    x: playerState.position.x ?? 0,
                    y: playerState.position.y ?? 0,
                    z: playerState.position.z ?? 0
                };
            }

            if (playerState.rotation) {
                this.rotation = {
                    x: playerState.rotation.x ?? 0,
                    y: playerState.rotation.y ?? 0,
                    z: playerState.rotation.z ?? 0
                };
            }

            if (playerState.velocity) {
                this.velocity = {
                    x: playerState.velocity.x ?? 0,
                    y: playerState.velocity.y ?? 0,
                    z: playerState.velocity.z ?? 0
                };
            }

            this.grounded = playerState.grounded ?? true;
            this.sprinting = playerState.sprinting ?? false;

            this.health = clamp(
                playerState.health ?? this.config.maxHealth,
                0,
                this.config.maxHealth
            );

            this.stamina = clamp(
                playerState.stamina ?? this.config.maxStamina,
                0,
                this.config.maxStamina
            );

            this.alive = playerState.alive ?? true;
        }

        this.respawnPosition = cloneVector(this.position);

        this.initialized = true;

        this.syncState();

        this.emitter.emit("initialized", this.getSnapshot());

        return this;
    }

    /**
     * Main update.
     *
     * Called once every frame by the main game loop.
     */
    update(deltaTime = 1 / 60) {
        if (!this.initialized) {
            this.initialize();
        }

        if (!this.enabled) {
            return;
        }

        if (!this.alive) {
            return;
        }

        const dt = clamp(
            Number(deltaTime) || 1 / 60,
            0,
            this.config.maxDeltaTime
        );

        this.totalPlayTime += dt;

        this.readInput(dt);
        this.updateMovement(dt);
        this.updateGravity(dt);
        this.updatePosition(dt);
        this.updateStamina(dt);
        this.checkGroundedState();
        this.syncState();
    }

    /**
     * Read movement and action input.
     */
    readInput() {
        if (!inputManager) {
            this.moveDirection.x = 0;
            this.moveDirection.z = 0;
            this.sprinting = false;
            return;
        }

        const movement = inputManager.getMovementVector();

        let inputX = movement?.x ?? 0;
        let inputY = movement?.y ?? 0;

        inputX = clamp(inputX, -1, 1);
        inputY = clamp(inputY, -1, 1);

        const normalized = normalize2D(inputX, inputY);

        /**
         * Input:
         *
         * x = left / right
         * y = forward / backward
         *
         * World:
         * x = horizontal
         * z = depth
         *
         * Negative Z = forward.
         */
        this.moveDirection.x = normalized.x;
        this.moveDirection.z = -normalized.z;

        const wantsSprint =
            inputManager.isActionActive?.("sprint") === true;

        const moving =
            Math.abs(this.moveDirection.x) > EPSILON ||
            Math.abs(this.moveDirection.z) > EPSILON;

        this.sprinting =
            wantsSprint &&
            moving &&
            this.stamina > 0 &&
            this.alive;

        if (
            this.grounded &&
            inputManager.isActionPressed?.("jump")
        ) {
            this.jump();
        }
    }

    /**
     * Update horizontal movement.
     */
    updateMovement(deltaTime) {
        const inputX = this.moveDirection.x;
        const inputZ = this.moveDirection.z;

        const hasMovement =
            Math.abs(inputX) > EPSILON ||
            Math.abs(inputZ) > EPSILON;

        if (!hasMovement) {
            this.velocity.x = lerp(
                this.velocity.x,
                0,
                clamp(
                    this.config.deceleration * deltaTime,
                    0,
                    1
                )
            );

            this.velocity.z = lerp(
                this.velocity.z,
                0,
                clamp(
                    this.config.deceleration * deltaTime,
                    0,
                    1
                )
            );

            return;
        }

        const speed = this.sprinting
            ? this.config.sprintSpeed
            : this.config.walkSpeed;

        /**
         * Rotate movement according to player's Y rotation.
         */
        const yaw = this.rotation.y;

        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);

        const worldX =
            (inputX * cos) -
            (inputZ * sin);

        const worldZ =
            (inputX * sin) +
            (inputZ * cos);

        const targetVelocityX = worldX * speed;
        const targetVelocityZ = worldZ * speed;

        const acceleration = clamp(
            this.config.acceleration * deltaTime,
            0,
            1
        );

        this.velocity.x = lerp(
            this.velocity.x,
            targetVelocityX,
            acceleration
        );

        this.velocity.z = lerp(
            this.velocity.z,
            targetVelocityZ,
            acceleration
        );
    }

    /**
     * Gravity and vertical velocity.
     */
    updateGravity(deltaTime) {
        if (this.grounded) {
            if (this.velocity.y < 0) {
                this.velocity.y = 0;
            }

            return;
        }

        this.velocity.y -=
            this.config.gravity * deltaTime;
    }

    /**
     * Apply velocity to position.
     */
    updatePosition(deltaTime) {
        const oldX = this.position.x;
        const oldY = this.position.y;
        const oldZ = this.position.z;

        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        this.position.z += this.velocity.z * deltaTime;

        /**
         * Basic ground collision.
         *
         * Later this can be replaced with:
         * - Capsule collider
         * - BVH
         * - physics engine
         * - server-authoritative collision
         */
        if (this.position.y <= DEFAULTS.minY) {
            this.position.y = DEFAULTS.minY;

            if (this.velocity.y < 0) {
                this.velocity.y = 0;
            }

            this.grounded = true;
        } else {
            this.grounded = false;
        }

        const dx = this.position.x - oldX;
        const dy = this.position.y - oldY;
        const dz = this.position.z - oldZ;

        const distance = Math.sqrt(
            dx * dx +
            dy * dy +
            dz * dz
        );

        this.totalDistance += distance;
    }

    /**
     * Stamina drain/recovery.
     */
    updateStamina(deltaTime) {
        if (this.sprinting) {
            this.stamina -=
                DEFAULTS.staminaDrain * deltaTime;

            if (this.stamina <= 0) {
                this.stamina = 0;
                this.sprinting = false;
            }

            return;
        }

        this.stamina +=
            DEFAULTS.staminaRecovery * deltaTime;

        this.stamina = clamp(
            this.stamina,
            0,
            this.config.maxStamina
        );
    }

    /**
     * Detect landing / leaving ground.
     */
    checkGroundedState() {
        if (
            !this.previousGrounded &&
            this.grounded
        ) {
            this.emitter.emit("land", {
                position: cloneVector(this.position)
            });
        }

        this.previousGrounded = this.grounded;
    }

    /**
     * Jump.
     */
    jump() {
        if (!this.alive || !this.grounded) {
            return false;
        }

        this.velocity.y = this.config.jumpForce;

        this.grounded = false;

        this.emitter.emit("jump", {
            position: cloneVector(this.position),
            force: this.config.jumpForce
        });

        this.syncState();

        return true;
    }

    /**
     * Rotate player.
     */
    setRotation(x = 0, y = 0, z = 0) {
        this.rotation.x = Number(x) || 0;
        this.rotation.y = Number(y) || 0;
        this.rotation.z = Number(z) || 0;

        this.syncState();
    }

    /**
     * Set only Y rotation.
     */
    setYaw(yaw = 0) {
        this.rotation.y = Number(yaw) || 0;

        this.syncState();
    }

    /**
     * Get current Y rotation.
     */
    getYaw() {
        return this.rotation.y;
    }

    /**
     * Set player position.
     */
    setPosition(x = 0, y = 0, z = 0) {
        this.position.x = Number(x) || 0;
        this.position.y = Math.max(
            DEFAULTS.minY,
            Number(y) || 0
        );
        this.position.z = Number(z) || 0;

        this.velocity.x = 0;
        this.velocity.y = 0;
        this.velocity.z = 0;

        this.grounded =
            this.position.y <= DEFAULTS.minY;

        this.syncState();

        this.emitter.emit("teleport", {
            position: cloneVector(this.position)
        });
    }

    /**
     * Get position.
     */
    getPosition() {
        return cloneVector(this.position);
    }

    /**
     * Get velocity.
     */
    getVelocity() {
        return cloneVector(this.velocity);
    }

    /**
     * Set respawn position.
     */
    setRespawnPosition(x = 0, y = 0, z = 0) {
        this.respawnPosition = {
            x: Number(x) || 0,
            y: Math.max(
                DEFAULTS.minY,
                Number(y) || 0
            ),
            z: Number(z) || 0
        };
    }

    /**
     * Respawn player.
     */
    respawn() {
        this.position = cloneVector(
            this.respawnPosition
        );

        this.velocity = {
            x: 0,
            y: 0,
            z: 0
        };

        this.health = this.config.maxHealth;

        this.stamina = this.config.maxStamina;

        this.grounded =
            this.position.y <= DEFAULTS.minY;

        this.sprinting = false;
        this.alive = true;

        this.previousAlive = true;

        this.syncState();

        this.emitter.emit("respawn", {
            position: cloneVector(this.position),
            health: this.health
        });

        return true;
    }

    /**
     * Damage player.
     */
    damage(amount, source = null) {
        if (!this.alive) {
            return false;
        }

        const damageAmount = Math.max(
            0,
            Number(amount) || 0
        );

        if (damageAmount <= 0) {
            return false;
        }

        this.health = clamp(
            this.health - damageAmount,
            0,
            this.config.maxHealth
        );

        this.emitter.emit("damage", {
            amount: damageAmount,
            source,
            health: this.health
        });

        if (this.health <= 0) {
            this.kill(source);
        }

        this.syncState();

        return true;
    }

    /**
     * Heal player.
     */
    heal(amount) {
        if (!this.alive) {
            return false;
        }

        const healAmount = Math.max(
            0,
            Number(amount) || 0
        );

        if (healAmount <= 0) {
            return false;
        }

        const previousHealth = this.health;

        this.health = clamp(
            this.health + healAmount,
            0,
            this.config.maxHealth
        );

        const actualHeal =
            this.health - previousHealth;

        if (actualHeal > 0) {
            this.emitter.emit("heal", {
                amount: actualHeal,
                health: this.health
            });
        }

        this.syncState();

        return actualHeal;
    }

    /**
     * Kill player.
     */
    kill(source = null) {
        if (!this.alive) {
            return false;
        }

        this.health = 0;
        this.alive = false;
        this.sprinting = false;

        this.velocity.x = 0;
        this.velocity.y = 0;
        this.velocity.z = 0;

        this.previousAlive = false;

        this.emitter.emit("death", {
            source,
            position: cloneVector(this.position)
        });

        this.syncState();

        return true;
    }

    /**
     * Fully restore health.
     */
    restoreHealth() {
        this.health = this.config.maxHealth;

        this.syncState();

        return this.health;
    }

    /**
     * Restore stamina.
     */
    restoreStamina() {
        this.stamina = this.config.maxStamina;

        this.syncState();

        return this.stamina;
    }

    /**
     * Enable controller.
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable controller.
     */
    disable() {
        this.enabled = false;

        this.velocity.x = 0;
        this.velocity.y = 0;
        this.velocity.z = 0;

        this.sprinting = false;

        this.syncState();
    }

    /**
     * Toggle controller.
     */
    toggle() {
        this.enabled = !this.enabled;

        if (!this.enabled) {
            this.velocity.x = 0;
            this.velocity.y = 0;
            this.velocity.z = 0;
            this.sprinting = false;
        }

        this.syncState();

        return this.enabled;
    }

    /**
     * Sync controller data with central GameState.
     */
    syncState() {
        if (!gameState) {
            return;
        }

        gameState.update("player", {
            position: cloneVector(this.position),

            rotation: {
                x: this.rotation.x,
                y: this.rotation.y,
                z: this.rotation.z
            },

            velocity: cloneVector(this.velocity),

            grounded: this.grounded,

            sprinting: this.sprinting,

            health: this.health,

            stamina: this.stamina,

            alive: this.alive
        });
    }

    /**
     * Snapshot.
     */
    getSnapshot() {
        return {
            position: cloneVector(this.position),

            rotation: {
                x: this.rotation.x,
                y: this.rotation.y,
                z: this.rotation.z
            },

            velocity: cloneVector(this.velocity),

            moveDirection: {
                x: this.moveDirection.x,
                z: this.moveDirection.z
            },

            grounded: this.grounded,

            sprinting: this.sprinting,

            health: this.health,

            maxHealth: this.config.maxHealth,

            stamina: this.stamina,

            maxStamina: this.config.maxStamina,

            alive: this.alive,

            enabled: this.enabled,

            totalDistance: this.totalDistance,

            totalPlayTime: this.totalPlayTime
        };
    }

    /**
     * Event listener.
     */
    on(event, callback) {
        return this.emitter.on(event, callback);
    }

    /**
     * Remove event listener.
     */
    off(event, callback) {
        this.emitter.off(event, callback);
    }

    /**
     * Check if player can move.
     */
    canMove() {
        return (
            this.enabled &&
            this.initialized &&
            this.alive
        );
    }

    /**
     * Check if player is moving.
     */
    isMoving() {
        return (
            Math.abs(this.velocity.x) > 0.01 ||
            Math.abs(this.velocity.z) > 0.01
        );
    }

    /**
     * Check if player is sprinting.
     */
    isSprinting() {
        return this.sprinting;
    }

    /**
     * Check if player is grounded.
     */
    isGrounded() {
        return this.grounded;
    }

    /**
     * Health percentage.
     */
    getHealthPercent() {
        return (
            this.health /
            this.config.maxHealth
        );
    }

    /**
     * Stamina percentage.
     */
    getStaminaPercent() {
        return (
            this.stamina /
            this.config.maxStamina
        );
    }

    /**
     * Debug information.
     */
    getDebugInfo() {
        return {
            position: this.getPosition(),
            rotation: { ...this.rotation },
            velocity: this.getVelocity(),

            grounded: this.grounded,
            sprinting: this.sprinting,
            alive: this.alive,

            health: this.health,
            stamina: this.stamina,

            moving: this.isMoving(),

            totalDistance:
                this.totalDistance,

            totalPlayTime:
                this.totalPlayTime
        };
    }

    /**
     * Cleanup.
     */
    dispose() {
        this.enabled = false;

        this._stateUnsubscribe?.();

        this._stateUnsubscribe = null;

        this.emitter.clear();

        this.initialized = false;
    }
}

/**
 * Singleton controller.
 */
export const playerController =
    new PlayerController();

/**
 * Update helper.
 */
export function updatePlayerController(deltaTime) {
    playerController.update(deltaTime);
}

/**
 * Get controller helper.
 */
export function getPlayerController() {
    return playerController;
}

/**
 * Initialize helper.
 */
export function initializePlayerController() {
    return playerController.initialize();
}

export default playerController;
