import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/*
 * AZAD WORLD
 * Multiplayer Backend Connection
 *
 * امکانات پایه:
 * - Supabase connection
 * - Authentication
 * - Realtime
 * - Multiplayer channels
 * - Database access
 * - Secure configuration
 *
 * IMPORTANT:
 * مقدارهای SUPABASE_URL و SUPABASE_ANON_KEY
 * را بعداً با اطلاعات پروژه خودت جایگزین کن.
 */

const SUPABASE_URL = "https://zfyxvvquukhqapujyygv.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_4Pn17itO540ZN5PCp05qaw_MkaZ-Dmo";

const isConfigured =
    SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
    SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

let supabase = null;

if (isConfigured) {
    supabase = createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            },

            realtime: {
                params: {
                    eventsPerSecond: 20
                }
            }
        }
    );
} else {
    console.warn(
        "AZAD WORLD: Supabase is not configured yet."
    );
}

/**
 * Return Supabase client.
 */
export function getSupabase() {
    return supabase;
}

/**
 * Check whether backend is configured.
 */
export function isSupabaseConfigured() {
    return isConfigured;
}

/**
 * Get current authenticated user.
 */
export async function getCurrentUser() {
    if (!supabase) return null;

    const {
        data,
        error
    } = await supabase.auth.getUser();

    if (error) {
        console.error(
            "Failed to get current user:",
            error
        );

        return null;
    }

    return data?.user ?? null;
}

/**
 * Get current session.
 */
export async function getSession() {
    if (!supabase) return null;

    const {
        data,
        error
    } = await supabase.auth.getSession();

    if (error) {
        console.error(
            "Failed to get session:",
            error
        );

        return null;
    }

    return data?.session ?? null;
}

/**
 * Listen for authentication changes.
 */
export function onAuthStateChange(callback) {
    if (!supabase) {
        return {
            unsubscribe() {}
        };
    }

    const {
        data
    } = supabase.auth.onAuthStateChange(
        (event, session) => {
            if (typeof callback === "function") {
                callback(
                    event,
                    session
                );
            }
        }
    );

    return data.subscription;
}

/**
 * Create a Realtime channel.
 *
 * Example:
 *
 * const channel =
 *     createGameChannel("room-001");
 */
export function createGameChannel(
    channelName,
    options = {}
) {
    if (!supabase) {
        console.warn(
            "Supabase is not configured."
        );

        return null;
    }

    return supabase.channel(
        channelName,
        {
            config: {
                broadcast: {
                    self:
                        options.broadcastSelf ??
                        false
                },

                presence: {
                    key:
                        options.presenceKey ??
                        undefined
                }
            }
        }
    );
}

/**
 * Join a multiplayer channel.
 */
export async function joinChannel(
    channel,
    callback
) {
    if (!channel) {
        return {
            success: false,
            error: "Channel does not exist."
        };
    }

    return new Promise(
        (resolve) => {
            channel.subscribe(
                (status, error) => {
                    if (
                        typeof callback ===
                        "function"
                    ) {
                        callback(
                            status,
                            error
                        );
                    }

                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {
                        resolve({
                            success: true,
                            error: null
                        });

                        return;
                    }

                    if (
                        status ===
                        "CHANNEL_ERROR" ||
                        status ===
                        "TIMED_OUT"
                    ) {
                        resolve({
                            success: false,
                            error:
                                error ??
                                status
                        });
                    }
                }
            );
        }
    );
}

/**
 * Leave a multiplayer channel.
 */
export async function leaveChannel(
    channel
) {
    if (!supabase || !channel) {
        return;
    }

    try {
        await supabase.removeChannel(
            channel
        );
    } catch (error) {
        console.error(
            "Failed to leave channel:",
            error
        );
    }
}

/**
 * Send a realtime event.
 *
 * Useful for:
 * - Player movement
 * - Shooting state
 * - Animations
 * - Emotes
 * - Game events
 */
export async function broadcast(
    channel,
    event,
    payload
) {
    if (!channel) {
        return false;
    }

    try {
        await channel.send({
            type: "broadcast",

            event,

            payload
        });

        return true;
    } catch (error) {
        console.error(
            `Broadcast failed: ${event}`,
            error
        );

        return false;
    }
}

/**
 * Listen for a broadcast event.
 */
export function onBroadcast(
    channel,
    event,
    callback
) {
    if (!channel) {
        return null;
    }

    channel.on(
        "broadcast",
        {
            event
        },
        ({ payload }) => {
            if (
                typeof callback ===
                "function"
            ) {
                callback(
                    payload
                );
            }
        }
    );

    return channel;
}

/**
 * Track a player's online presence.
 */
export async function trackPresence(
    channel,
    playerData
) {
    if (!channel) {
        return false;
    }

    try {
        await channel.track(
            playerData
        );

        return true;
    } catch (error) {
        console.error(
            "Presence tracking failed:",
            error
        );

        return false;
    }
}

/**
 * Listen for players joining/leaving
 * the current multiplayer room.
 */
export function onPresence(
    channel,
    callbacks = {}
) {
    if (!channel) return null;

    if (
        typeof callbacks.sync ===
        "function"
    ) {
        channel.on(
            "presence",
            {
                event: "sync"
            },
            () => {
                callbacks.sync(
                    channel.presenceState()
                );
            }
        );
    }

    if (
        typeof callbacks.join ===
        "function"
    ) {
        channel.on(
            "presence",
            {
                event: "join"
            },
            ({ key, newPresences }) => {
                callbacks.join(
                    key,
                    newPresences
                );
            }
        );
    }

    if (
        typeof callbacks.leave ===
        "function"
    ) {
        channel.on(
            "presence",
            {
                event: "leave"
            },
            ({ key, leftPresences }) => {
                callbacks.leave(
                    key,
                    leftPresences
                );
            }
        );
    }

    return channel;
}

/**
 * Insert data into a Supabase table.
 */
export async function insert(
    table,
    values
) {
    if (!supabase) {
        return {
            data: null,
            error:
                new Error(
                    "Supabase is not configured."
                )
        };
    }

    return await supabase
        .from(table)
        .insert(values)
        .select();
}

/**
 * Select data from a table.
 */
export async function select(
    table,
    columns = "*"
) {
    if (!supabase) {
        return {
            data: null,
            error:
                new Error(
                    "Supabase is not configured."
                )
        };
    }

    return await supabase
        .from(table)
        .select(columns);
}

/**
 * Update data in a table.
 */
export async function update(
    table,
    values,
    filterColumn,
    filterValue
) {
    if (!supabase) {
        return {
            data: null,
            error:
                new Error(
                    "Supabase is not configured."
                )
        };
    }

    return await supabase
        .from(table)
        .update(values)
        .eq(
            filterColumn,
            filterValue
        )
        .select();
}

/**
 * Delete data from a table.
 */
export async function remove(
    table,
    filterColumn,
    filterValue
) {
    if (!supabase) {
        return {
            data: null,
            error:
                new Error(
                    "Supabase is not configured."
                )
        };
    }

    return await supabase
        .from(table)
        .delete()
        .eq(
            filterColumn,
            filterValue
        )
        .select();
}

/**
 * Call a Supabase Edge Function.
 */
export async function invokeFunction(
    functionName,
    body = {}
) {
    if (!supabase) {
        return {
            data: null,
            error:
                new Error(
                    "Supabase is not configured."
                )
        };
    }

    return await supabase.functions.invoke(
        functionName,
        {
            body
        }
    );
}

/**
 * Get a public Storage URL.
 */
export function getPublicStorageUrl(
    bucket,
    path
) {
    if (!supabase) {
        return null;
    }

    const {
        data
    } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

    return data?.publicUrl ?? null;
}

/**
 * Backend status information.
 */
export function getBackendStatus() {
    return {
        configured:
            isConfigured,

        connected:
            Boolean(supabase),

        realtime:
            Boolean(
                supabase?.realtime
            ),

        authentication:
            Boolean(
                supabase?.auth
            ),

        database:
            Boolean(supabase),

        storage:
            Boolean(
                supabase?.storage
            )
    };
}

export default supabase;
