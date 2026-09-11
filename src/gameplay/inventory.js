// AZAD WORLD
// Inventory & Item System
// Path: src/gameplay/inventory.js

import { GAME_CONFIG } from "../config/game-config.js";
import { gameState } from "../core/game-state.js";

const DEFAULT_CONFIG = {
    maxSlots: 40,
    defaultMaxStack: 99,
    autoSave: true,
    allowDrop: true,
    allowUse: true,
    allowEquip: true,
};

const ITEM_TYPES = Object.freeze({
    CONSUMABLE: "consumable",
    MATERIAL: "material",
    QUEST: "quest",
    WEAPON: "weapon",
    ARMOR: "armor",
    TOOL: "tool",
    VEHICLE: "vehicle",
    KEY: "key",
    CURRENCY: "currency",
    CUSTOM: "custom",
});

const ITEM_ACTIONS = Object.freeze({
    USE: "use",
    EQUIP: "equip",
    UNEQUIP: "unequip",
    DROP: "drop",
    REMOVE: "remove",
    INSPECT: "inspect",
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

function createId(prefix = "item") {
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

function normalizeItem(item = {}) {
    return {
        id: item.id || createId(),

        name: item.name || "Unknown Item",

        description: item.description || "",

        type: item.type || ITEM_TYPES.CUSTOM,

        icon: item.icon || null,

        model: item.model || null,

        quantity: Math.max(
            1,
            number(item.quantity, 1)
        ),

        maxStack: Math.max(
            1,
            number(item.maxStack, DEFAULT_CONFIG.defaultMaxStack)
        ),

        weight: Math.max(
            0,
            number(item.weight, 0)
        ),

        rarity: item.rarity || "common",

        value: Math.max(
            0,
            number(item.value, 0)
        ),

        usable: item.usable !== false,

        equippable: Boolean(item.equippable),

        droppable: item.droppable !== false,

        metadata: clone(item.metadata || {}),

        createdAt: item.createdAt || now(),
    };
}

class InventoryManager {
    constructor(config = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
        };

        this.items = new Map();

        this.equipped = new Map();

        this.listeners = new Map();

        this.initialized = false;
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
                    `[InventoryManager] ${event}`,
                    error
                );
            }
        }
    }

    // ==================================================
    // INITIALIZE
    // ==================================================

    initialize() {
        if (this.initialized) {
            return this;
        }

        this.initialized = true;

        this.loadFromState();

        this.emit("initialized", {
            itemCount: this.items.size,
        });

        return this;
    }

    // ==================================================
    // ITEM REGISTRATION
    // ==================================================

    registerItem(item) {
        const normalized =
            normalizeItem(item);

        this.items.set(
            normalized.id,
            normalized
        );

        this.saveToState();

        this.emit("itemRegistered", {
            item: clone(normalized),
        });

        return normalized;
    }

    registerItems(items = []) {
        return items.map(item =>
            this.registerItem(item)
        );
    }

    unregisterItem(itemId) {
        if (!this.items.has(itemId)) {
            return false;
        }

        this.items.delete(itemId);

        for (const [
            slot,
            equippedId
        ] of this.equipped.entries()) {
            if (equippedId === itemId) {
                this.equipped.delete(slot);
            }
        }

        this.saveToState();

        this.emit("itemUnregistered", {
            itemId,
        });

        return true;
    }

    // ==================================================
    // INVENTORY INFO
    // ==================================================

    getItem(itemId) {
        return (
            this.items.get(itemId) ||
            null
        );
    }

    hasItem(itemId, quantity = 1) {
        const item =
            this.getItem(itemId);

        if (!item) return false;

        return item.quantity >= quantity;
    }

    getQuantity(itemId) {
        const item =
            this.getItem(itemId);

        return item
            ? item.quantity
            : 0;
    }

    getAllItems() {
        return [...this.items.values()]
            .map(clone);
    }

    getItemsByType(type) {
        return this.getAllItems()
            .filter(item =>
                item.type === type
            );
    }

    getItemCount() {
        return this.items.size;
    }

    getTotalQuantity() {
        let total = 0;

        for (const item of this.items.values()) {
            total += item.quantity;
        }

        return total;
    }

    getTotalWeight() {
        let weight = 0;

        for (const item of this.items.values()) {
            weight +=
                item.weight *
                item.quantity;
        }

        return weight;
    }

    // ==================================================
    // CAPACITY
    // ==================================================

    getMaxSlots() {
        return this.config.maxSlots;
    }

    getFreeSlots() {
        return Math.max(
            0,
            this.config.maxSlots -
                this.items.size
        );
    }

    isFull() {
        return (
            this.items.size >=
            this.config.maxSlots
        );
    }

    canAddItem(item, quantity = 1) {
        if (!item) return false;

        const existing =
            this.getItem(item.id);

        if (existing) {
            return (
                existing.quantity +
                    quantity <=
                existing.maxStack
            );
        }

        return !this.isFull();
    }

    // ==================================================
    // ADD ITEMS
    // ==================================================

    addItem(item, quantity = 1) {
        quantity = Math.max(
            1,
            number(quantity, 1)
        );

        let existing =
            this.getItem(item.id);

        if (!existing) {
            if (this.isFull()) {
                return {
                    success: false,
                    reason: "inventory_full",
                };
            }

            existing =
                normalizeItem({
                    ...item,
                    quantity: 0,
                });

            this.items.set(
                existing.id,
                existing
            );
        }

        const available =
            existing.maxStack -
            existing.quantity;

        const added =
            Math.min(
                available,
                quantity
            );

        if (added <= 0) {
            return {
                success: false,
                reason: "stack_full",
            };
        }

        existing.quantity += added;

        this.saveToState();

        this.emit("itemAdded", {
            item: clone(existing),
            amount: added,
        });

        return {
            success: true,
            item: clone(existing),
            added,
            remaining:
                quantity - added,
        };
    }

    // ==================================================
    // REMOVE ITEMS
    // ==================================================

    removeItem(
        itemId,
        quantity = 1
    ) {
        const item =
            this.getItem(itemId);

        if (!item) {
            return {
                success: false,
                reason: "item_not_found",
            };
        }

        quantity = Math.max(
            1,
            number(quantity, 1)
        );

        if (
            item.quantity <
            quantity
        ) {
            return {
                success: false,
                reason: "not_enough_items",
            };
        }

        item.quantity -= quantity;

        if (item.quantity <= 0) {
            this.items.delete(itemId);

            for (const [
                slot,
                equippedId
            ] of this.equipped.entries()) {
                if (equippedId === itemId) {
                    this.equipped.delete(slot);
                }
            }
        }

        this.saveToState();

        this.emit("itemRemoved", {
            itemId,
            amount: quantity,
        });

        return {
            success: true,
            itemId,
            removed: quantity,
            remaining:
                this.getQuantity(itemId),
        };
    }

    // ==================================================
    // USE ITEM
    // ==================================================

    useItem(
        itemId,
        context = {}
    ) {
        if (!this.config.allowUse) {
            return {
                success: false,
                reason: "use_disabled",
            };
        }

        const item =
            this.getItem(itemId);

        if (!item) {
            return {
                success: false,
                reason: "item_not_found",
            };
        }

        if (!item.usable) {
            return {
                success: false,
                reason: "item_not_usable",
            };
        }

        if (item.quantity <= 0) {
            return {
                success: false,
                reason: "empty_stack",
            };
        }

        this.emit("itemUsed", {
            item: clone(item),
            context: clone(context),
        });

        if (
            item.metadata.consumeOnUse !==
            false
        ) {
            this.removeItem(
                itemId,
                1
            );
        }

        return {
            success: true,
            item: clone(item),
        };
    }

    // ==================================================
    // EQUIPMENT
    // ==================================================

    equipItem(
        itemId,
        slot = "default"
    ) {
        if (!this.config.allowEquip) {
            return {
                success: false,
                reason: "equip_disabled",
            };
        }

        const item =
            this.getItem(itemId);

        if (!item) {
            return {
                success: false,
                reason: "item_not_found",
            };
        }

        if (!item.equippable) {
            return {
                success: false,
                reason: "item_not_equippable",
            };
        }

        const previous =
            this.equipped.get(slot);

        this.equipped.set(
            slot,
            itemId
        );

        this.emit("itemEquipped", {
            item: clone(item),
            itemId,
            slot,
            previousItemId:
                previous || null,
        });

        this.saveToState();

        return {
            success: true,
            item: clone(item),
            slot,
        };
    }

    unequipItem(slot) {
        const itemId =
            this.equipped.get(slot);

        if (!itemId) {
            return {
                success: false,
                reason: "slot_empty",
            };
        }

        this.equipped.delete(slot);

        this.emit("itemUnequipped", {
            itemId,
            slot,
        });

        this.saveToState();

        return {
            success: true,
            itemId,
            slot,
        };
    }

    getEquipped(slot) {
        const itemId =
            this.equipped.get(slot);

        return itemId
            ? this.getItem(itemId)
            : null;
    }

    getEquippedItems() {
        const result = {};

        for (const [
            slot,
            itemId
        ] of this.equipped.entries()) {
            const item =
                this.getItem(itemId);

            if (item) {
                result[slot] =
                    clone(item);
            }
        }

        return result;
    }

    // ==================================================
    // DROP
    // ==================================================

    dropItem(
        itemId,
        quantity = 1,
        position = null
    ) {
        if (!this.config.allowDrop) {
            return {
                success: false,
                reason: "drop_disabled",
            };
        }

        const item =
            this.getItem(itemId);

        if (!item) {
            return {
                success: false,
                reason: "item_not_found",
            };
        }

        if (!item.droppable) {
            return {
                success: false,
                reason: "item_not_droppable",
            };
        }

        const result =
            this.removeItem(
                itemId,
                quantity
            );

        if (!result.success) {
            return result;
        }

        this.emit("itemDropped", {
            itemId,
            quantity,
            position: clone(position),
            model: item.model,
            icon: item.icon,
        });

        return {
            success: true,
            itemId,
            quantity,
            position,
            model: item.model,
            icon: item.icon,
        };
    }

    // ==================================================
    // SEARCH
    // ==================================================

    search(query = "") {
        const text =
            String(query)
                .trim()
                .toLowerCase();

        if (!text) {
            return this.getAllItems();
        }

        return this.getAllItems()
            .filter(item =>
                item.name
                    .toLowerCase()
                    .includes(text) ||
                item.description
                    .toLowerCase()
                    .includes(text)
            );
    }

    // ==================================================
    // ITEM ACTIONS
    // ==================================================

    inspectItem(itemId) {
        const item =
            this.getItem(itemId);

        if (!item) {
            return null;
        }

        return {
            ...clone(item),
            actions: {
                use:
                    item.usable &&
                    this.config.allowUse,

                equip:
                    item.equippable &&
                    this.config.allowEquip,

                drop:
                    item.droppable &&
                    this.config.allowDrop,
            },
        };
    }

    performAction(
        action,
        itemId,
        options = {}
    ) {
        switch (action) {
            case ITEM_ACTIONS.USE:
                return this.useItem(
                    itemId,
                    options
                );

            case ITEM_ACTIONS.EQUIP:
                return this.equipItem(
                    itemId,
                    options.slot ||
                        "default"
                );

            case ITEM_ACTIONS.UNEQUIP:
                return this.unequipItem(
                    options.slot ||
                        "default"
                );

            case ITEM_ACTIONS.DROP:
                return this.dropItem(
                    itemId,
                    options.quantity || 1,
                    options.position ||
                        null
                );

            case ITEM_ACTIONS.REMOVE:
                return this.removeItem(
                    itemId,
                    options.quantity || 1
                );

            case ITEM_ACTIONS.INSPECT:
                return {
                    success: true,
                    item:
                        this.inspectItem(
                            itemId
                        ),
                };

            default:
                return {
                    success: false,
                    reason: "unknown_action",
                };
        }
    }

    // ==================================================
    // SAVE
    // ==================================================

    getSaveData() {
        return {
            version: 1,

            items:
                [...this.items.values()]
                    .map(clone),

            equipped:
                Object.fromEntries(
                    this.equipped.entries()
                ),

            savedAt: now(),
        };
    }

    saveToState() {
        if (!this.config.autoSave) {
            return;
        }

        try {
            gameState.set(
                "inventory.items",
                this.getAllItems()
            );

            gameState.set(
                "inventory.equipped",
                Object.fromEntries(
                    this.equipped.entries()
                )
            );
        } catch (error) {
            console.warn(
                "[InventoryManager] Save failed:",
                error
            );
        }
    }

    loadFromState() {
        try {
            const savedItems =
                gameState.get(
                    "inventory.items"
                );

            const savedEquipped =
                gameState.get(
                    "inventory.equipped"
                );

            if (Array.isArray(savedItems)) {
                this.items.clear();

                for (const rawItem of savedItems) {
                    const item =
                        normalizeItem(
                            rawItem
                        );

                    this.items.set(
                        item.id,
                        item
                    );
                }
            }

            if (
                savedEquipped &&
                typeof savedEquipped ===
                    "object"
            ) {
                this.equipped.clear();

                for (const [
                    slot,
                    itemId
                ] of Object.entries(
                    savedEquipped
                )) {
                    if (
                        this.items.has(
                            itemId
                        )
                    ) {
                        this.equipped.set(
                            slot,
                            itemId
                        );
                    }
                }
            }
        } catch (error) {
            console.warn(
                "[InventoryManager] Load failed:",
                error
            );
        }
    }

    // ==================================================
    // FULL SNAPSHOT
    // ==================================================

    getSnapshot() {
        return {
            initialized:
                this.initialized,

            slots: {
                used:
                    this.items.size,

                maximum:
                    this.config.maxSlots,

                free:
                    this.getFreeSlots(),
            },

            items:
                this.getAllItems(),

            equipped:
                this.getEquippedItems(),

            totalQuantity:
                this.getTotalQuantity(),

            totalWeight:
                this.getTotalWeight(),
        };
    }

    debug() {
        return {
            config:
                clone(this.config),

            snapshot:
                this.getSnapshot(),
        };
    }

    // ==================================================
    // DISPOSE
    // ==================================================

    dispose() {
        this.items.clear();

        this.equipped.clear();

        this.listeners.clear();

        this.initialized = false;
    }
}

// ======================================================
// SINGLETON
// ======================================================

export const inventoryManager =
    new InventoryManager();

// ======================================================
// HELPERS
// ======================================================

export function initializeInventory(
    config = {}
) {
    if (Object.keys(config).length > 0) {
        inventoryManager.config = {
            ...inventoryManager.config,
            ...config,
        };
    }

    return inventoryManager.initialize();
}

export function addInventoryItem(
    item,
    quantity
) {
    return inventoryManager.addItem(
        item,
        quantity
    );
}

export function removeInventoryItem(
    itemId,
    quantity
) {
    return inventoryManager.removeItem(
        itemId,
        quantity
    );
}

export function useInventoryItem(
    itemId,
    context
) {
    return inventoryManager.useItem(
        itemId,
        context
    );
}

export function equipInventoryItem(
    itemId,
    slot
) {
    return inventoryManager.equipItem(
        itemId,
        slot
    );
}

export function dropInventoryItem(
    itemId,
    quantity,
    position
) {
    return inventoryManager.dropItem(
        itemId,
        quantity,
        position
    );
}

export function getInventory() {
    return inventoryManager;
}

export {
    ITEM_TYPES,
    ITEM_ACTIONS,
};

export default inventoryManager;
