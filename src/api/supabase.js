import {
    createClient
} from "https://cdn.jsdelivr.net/npm/@Supabase/supabase-js@2/+esm";

/*
 * AZAD WORLD
 * Multiplayer Backend Connection
 *
 * امکانات:
 * - Supabase connection
 * - Authentication
 * - Realtime
 * - Multiplayer channels
 * - Database access
 * - Storage
 * - Edge Functions
 * - Database compatibility helpers
 */

const SUPABASE_URL =
    "https://zfyxvvquukhqapujyygv.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_4Pn17itO540ZN5PCp05qaw_MkaZ-Dmo";

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


/* =========================================================
   CLIENT
   ========================================================= */

/**
 * Return Supabase client.
 */
export function getSupabase() {
    return supabase;
}


/**
 * Check whether Supabase is configured.
 */
export function isSupabaseConfigured() {
    return isConfigured;
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

/**
 * Get current authenticated user.
 *
 * IMPORTANT:
 * We use getSession() instead of getUser() here.
 *
 * getUser() can throw AuthSessionMissingError when nobody
 * is logged in. A logged-out user is a normal state for
 * AZAD WORLD, not an application error.
 */
export async function getCurrentUser() {
    if (!supabase) {
        return null;
    }

    try {
        const {
            data,
            error
        } = await supabase.auth.getSession();

        if (error) {
            console.error(
                "Failed to get auth session:",
                error
            );

            return null;
        }

        return data?.session?.user ?? null;
    } catch (error) {
        /*
         * A missing session is expected when the player
         * has not logged in yet.
         *
         * Do not spam the console with AuthSessionMissingError.
         */
        if (
            error?.name ===
                "AuthSessionMissingError" ||
            error?.code ===
                "AUTH_SESSION_MISSING" ||
            String(error?.message ?? "")
                .toLowerCase()
                .includes("auth session missing")
        ) {
            return null;
        }

        console.error(
            "Failed to get current user:",
            error
        );

        return null;
    }
}


/**
 * Get current session.
 */
export async function getSession() {
    if (!supabase) {
        return null;
    }

    try {
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
    } catch (error) {
        console.error(
            "Failed to get session:",
            error
        );

        return null;
    }
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


/* =========================================================
   REALTIME CHANNELS
   ========================================================= */

/**
 * Create a Realtime game channel.
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
 * Join a Realtime channel.
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
            let settled = false;

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
                        if (!settled) {
                            settled = true;

                            resolve({
                                success: true,
                                error: null
                            });
                        }

                        return;
                    }

                    if (
                        status ===
                            "CHANNEL_ERROR" ||
                        status ===
                            "TIMED_OUT"
                    ) {
                        if (!settled) {
                            settled = true;

                            resolve({
                                success: false,
                                error:
                                    error ??
                                    status
                            });
                        }
                    }
                }
            );
        }
    );
}


/**
 * Leave a Realtime channel.
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
 * Send Realtime broadcast.
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
 * Listen for Realtime broadcast.
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
 * Track player presence.
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
 * Listen for presence events.
 */
export function onPresence(
    channel,
    callbacks = {}
) {
    if (!channel) {
        return null;
    }

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
            ({
                key,
                newPresences
            }) => {
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
            ({
                key,
                leftPresences
            }) => {
                callbacks.leave(
                    key,
                    leftPresences
                );
            }
        );
    }

    return channel;
}


/* =========================================================
   DATABASE
   ========================================================= */

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
            error: new Error(
                "Supabase is not configured."
            )
        };
    }

    try {
        return await supabase
            .from(table)
            .insert(values)
            .select();
    } catch (error) {
        return {
            data: null,
            error
        };
    }
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
            error: new Error(
                "Supabase is not configured."
            )
        };
    }

    try {
        return await supabase
            .from(table)
            .select(columns);
    } catch (error) {
        return {
            data: null,
            error
        };
    }
}


/**
 * Update data in a Supabase table.
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
            error: new Error(
                "Supabase is not configured."
            )
        };
    }

    try {
        return await supabase
            .from(table)
            .update(values)
            .eq(
                filterColumn,
                filterValue
            )
            .select();
    } catch (error) {
        return {
            data: null,
            error
        };
    }
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
            error: new Error(
                "Supabase is not configured."
            )
        };
    }

    try {
        return await supabase
            .from(table)
            .delete()
            .eq(
                filterColumn,
                filterValue
            )
            .select();
    } catch (error) {
        return {
            data: null,
            error
        };
    }
}


/* =========================================================
   DATABASE COMPATIBILITY API
   ========================================================= */

/**
 * Compatibility alias for database insert.
 */
export async function databaseInsert(
    table,
    values
) {
    return insert(
        table,
        values
    );
}


/**
 * Compatibility alias for database select.
 */
export async function databaseSelect(
    table,
    columns = "*",
    filters = null
) {
    if (!supabase) {
        return {
            data: null,
            error: new Error(
                "Supabase is not configured."
            )
        };
    }

    try {
        let query =
            supabase
                .from(table)
                .select(columns);

        if (
            filters &&
            typeof filters === "object"
        ) {
            for (
                const [
                    column,
                    value
                ] of Object.entries(filters)
            ) {
                if (
                    Array.isArray(value)
                ) {
                    query = query.in(
                        column,
                        value
                    );
                } else {
                    query = query.eq(
                        column,
                        value
                    );
                }
            }
        }

        return await query;
    } catch (error) {
        return {
            data: null,
            error
        };
    }
}


/**
 * Compatibility alias for database update.
 */
export async function databaseUpdate(
    table,
    values,
    filters = null
) {
    if (!supabase) {
        return {
            data: null,
            error: new Error(
                "Supabase is not configured."
            )
        };
    }

    try {
        let query =
            supabase
                .from(table)
                .update(values);

        if (
            filters &&
            typeof filters === "object"
        ) {
            for (
                const [
                    column,
                    value
                ] of Object.entries(filters)
            ) {
                if (
                    Array.isArray(value)
                ) {
                    query = query.in(
                        column,
                        value
                    );
                } else {
                    query = query.eq(
                        column,
                        value
                    );
                }
            }
        }

        return await query.select();
    } catch (error) {
        return {
            data: null,
            error
        };
    }
}


/**
 * Compatibility alias for database delete.
 */
export async function databaseDelete(
    table,
    filters = null
) {
    if (!supabase) {
        return {
            data: null,
            error: new Error(
                "Supabase is not configured."
            )
        };
    }

    try {
        let query =
            supabase
                .from(table)
                .delete();

        if (
            filters &&
            typeof filters === "object"
        ) {
            for (
                const [
                    column,
                    value
                ] of Object.entries(filters)
            ) {
                if (
                    Array.isArray(value)
                ) {
                    query = query.in(
                        column,
                        value
                    );
                } else {
                    query = query.eq(
                        column,
                        value
                    );
                }
            }
        }

        return await query.select();
    } catch (error) {
        return {
            data: null,
            error
        };
    }
}


/* =========================================================
   EDGE FUNCTIONS
   ========================================================= */

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
            error: new Error(
                "Supabase is not configured."
            )
        };
    }

    try {
        return await supabase.functions.invoke(
            functionName,
            {
                body
            }
        );
    } catch (error) {
        return {
            data: null,
            error
        };
    }
}


/* =========================================================
   STORAGE
   ========================================================= */

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

    try {
        const {
            data
        } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);

        return (
            data?.publicUrl ??
            null
        );
    } catch (error) {
        console.error(
            "Failed to get Storage URL:",
            error
        );

        return null;
    }
}


/* =========================================================
   BACKEND STATUS
   ========================================================= */

/**
 * Get backend status.
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


/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

export default supabase;
