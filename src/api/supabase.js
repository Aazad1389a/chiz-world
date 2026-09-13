/**
 * AZAD WORLD
 * Supabase Client & API Layer
 *
 * Responsibilities:
 * - Supabase client initialization
 * - Authentication session helpers
 * - Realtime channels
 * - Presence
 * - Database helpers
 * - Edge Function helpers
 * - Storage helpers
 */

import {
    createClient
} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* =========================================================
   CONFIG
   ========================================================= */

const SUPABASE_URL =
    "https://zfyxvvquukhqapujyygv.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_4Pn17itO540ZN5PCp05qaw_MkaZ-Dmo";

/* =========================================================
   CLIENT
   ========================================================= */

let supabase = null;

try {
    if (
        SUPABASE_URL &&
        SUPABASE_ANON_KEY
    ) {
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
    }
} catch (error) {
    console.error(
        "[AZAD WORLD] Failed to initialize Supabase:",
        error
    );

    supabase = null;
}

/* =========================================================
   BASIC HELPERS
   ========================================================= */

export function getSupabase() {
    return supabase;
}

export function isSupabaseConfigured() {
    return Boolean(
        supabase &&
        SUPABASE_URL &&
        SUPABASE_ANON_KEY
    );
}

/* =========================================================
   AUTH
   ========================================================= */

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
            /*
             * No active session is a normal state
             * when the player has not logged in yet.
             */
            if (
                error?.name ===
                    "AuthSessionMissingError" ||
                error?.code ===
                    "AUTH_SESSION_MISSING" ||
                String(error?.message ?? "")
                    .toLowerCase()
                    .includes(
                        "auth session missing"
                    )
            ) {
                return null;
            }

            console.error(
                "[AZAD WORLD] Failed to get auth session:",
                error
            );

            return null;
        }

        return (
            data?.session?.user ??
            null
        );
    } catch (error) {
        if (
            error?.name ===
                "AuthSessionMissingError" ||
            error?.code ===
                "AUTH_SESSION_MISSING" ||
            String(error?.message ?? "")
                .toLowerCase()
                .includes(
                    "auth session missing"
                )
        ) {
            return null;
        }

        console.error(
            "[AZAD WORLD] Failed to get current user:",
            error
        );

        return null;
    }
}

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
            if (
                error?.name ===
                    "AuthSessionMissingError" ||
                error?.code ===
                    "AUTH_SESSION_MISSING" ||
                String(error?.message ?? "")
                    .toLowerCase()
                    .includes(
                        "auth session missing"
                    )
            ) {
                return null;
            }

            console.error(
                "[AZAD WORLD] Failed to get session:",
                error
            );

            return null;
        }

        return data?.session ?? null;
    } catch (error) {
        if (
            error?.name ===
                "AuthSessionMissingError" ||
            error?.code ===
                "AUTH_SESSION_MISSING" ||
            String(error?.message ?? "")
                .toLowerCase()
                .includes(
                    "auth session missing"
                )
        ) {
            return null;
        }

        console.error(
            "[AZAD WORLD] Failed to get session:",
            error
        );

        return null;
    }
}

export function onAuthStateChange(callback) {
    if (
        !supabase ||
        typeof callback !== "function"
    ) {
        return {
            data: {
                subscription: {
                    unsubscribe() {}
                }
            }
        };
    }

    return supabase.auth.onAuthStateChange(
        callback
    );
}

/* =========================================================
   REALTIME CHANNELS
   ========================================================= */

export function createGameChannel(
    channelName,
    options = {}
) {
    if (!supabase) {
        return null;
    }

    return supabase.channel(
        channelName,
        options
    );
}

export async function joinChannel(
    channel
) {
    if (!channel) {
        return null;
    }

    try {
        return await channel.subscribe();
    } catch (error) {
        console.error(
            "[AZAD WORLD] Failed to join channel:",
            error
        );

        return null;
    }
}

export async function leaveChannel(
    channel
) {
    if (!channel) {
        return null;
    }

    try {
        return await channel.unsubscribe();
    } catch (error) {
        console.error(
            "[AZAD WORLD] Failed to leave channel:",
            error
        );

        return null;
    }
}

export function broadcast(
    channel,
    event,
    payload
) {
    if (!channel) {
        return Promise.resolve(null);
    }

    try {
        return channel.send({
            type: "broadcast",
            event,
            payload
        });
    } catch (error) {
        console.error(
            "[AZAD WORLD] Broadcast failed:",
            error
        );

        return Promise.resolve(null);
    }
}

export function onBroadcast(
    channel,
    event,
    callback
) {
    if (
        !channel ||
        typeof callback !== "function"
    ) {
        return channel;
    }

    channel.on(
        "broadcast",
        {
            event
        },
        payload => {
            callback(
                payload?.payload ??
                payload
            );
        }
    );

    return channel;
}

/* =========================================================
   PRESENCE
   ========================================================= */

export function trackPresence(
    channel,
    state
) {
    if (!channel) {
        return Promise.resolve(null);
    }

    try {
        return channel.track(state);
    } catch (error) {
        console.error(
            "[AZAD WORLD] Presence tracking failed:",
            error
        );

        return Promise.resolve(null);
    }
}

export function onPresence(
    channel,
    event,
    callback
) {
    if (
        !channel ||
        typeof callback !== "function"
    ) {
        return channel;
    }

    channel.on(
        "presence",
        {
            event
        },
        payload => {
            callback(payload);
        }
    );

    return channel;
}

/* =========================================================
   DATABASE
   ========================================================= */

export async function insert(
    table,
    values,
    options = {}
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
        let query = supabase
            .from(table)
            .insert(values);

        if (options.select) {
            query = query.select(
                options.select
            );
        }

        if (options.single) {
            query = query.single();
        }

        return await query;
    } catch (error) {
        console.error(
            "[AZAD WORLD] Database insert failed:",
            error
        );

        return {
            data: null,
            error
        };
    }
}

export async function select(
    table,
    columns = "*",
    filters = {},
    options = {}
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
        let query = supabase
            .from(table)
            .select(columns);

        for (
            const [key, value]
            of Object.entries(filters)
        ) {
            if (
                value === null ||
                value === undefined
            ) {
                continue;
            }

            query = query.eq(
                key,
                value
            );
        }

        if (options.order) {
            query = query.order(
                options.order.column,
                {
                    ascending:
                        options.order.ascending ??
                        true
                }
            );
        }

        if (
            Number.isInteger(
                options.limit
            )
        ) {
            query = query.limit(
                options.limit
            );
        }

        if (options.single) {
            query = query.single();
        }

        return await query;
    } catch (error) {
        console.error(
            "[AZAD WORLD] Database select failed:",
            error
        );

        return {
            data: null,
            error
        };
    }
}

export async function update(
    table,
    values,
    filters = {},
    options = {}
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
        let query = supabase
            .from(table)
            .update(values);

        for (
            const [key, value]
            of Object.entries(filters)
        ) {
            if (
                value === null ||
                value === undefined
            ) {
                continue;
            }

            query = query.eq(
                key,
                value
            );
        }

        if (options.select) {
            query = query.select(
                options.select
            );
        }

        if (options.single) {
            query = query.single();
        }

        return await query;
    } catch (error) {
        console.error(
            "[AZAD WORLD] Database update failed:",
            error
        );

        return {
            data: null,
            error
        };
    }
}

export async function remove(
    table,
    filters = {},
    options = {}
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
        let query = supabase
            .from(table)
            .delete();

        for (
            const [key, value]
            of Object.entries(filters)
        ) {
            if (
                value === null ||
                value === undefined
            ) {
                continue;
            }

            query = query.eq(
                key,
                value
            );
        }

        if (options.select) {
            query = query.select(
                options.select
            );
        }

        if (options.single) {
            query = query.single();
        }

        return await query;
    } catch (error) {
        console.error(
            "[AZAD WORLD] Database delete failed:",
            error
        );

        return {
            data: null,
            error
        };
    }
}

/* =========================================================
   DATABASE COMPATIBILITY HELPERS
   ========================================================= */

export async function databaseInsert(
    table,
    values,
    options = {}
) {
    return insert(
        table,
        values,
        options
    );
}

export async function databaseSelect(
    table,
    columns = "*",
    filters = {},
    options = {}
) {
    return select(
        table,
        columns,
        filters,
        options
    );
}

export async function databaseUpdate(
    table,
    values,
    filters = {},
    options = {}
) {
    return update(
        table,
        values,
        filters,
        options
    );
}

export async function databaseDelete(
    table,
    filters = {},
    options = {}
) {
    return remove(
        table,
        filters,
        options
    );
}

/* =========================================================
   EDGE FUNCTIONS
   ========================================================= */

export async function invokeFunction(
    functionName,
    body = {},
    options = {}
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
                body,
                ...options
            }
        );
    } catch (error) {
        console.error(
            "[AZAD WORLD] Edge Function failed:",
            error
        );

        return {
            data: null,
            error
        };
    }
}

/* =========================================================
   STORAGE
   ========================================================= */

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
            "[AZAD WORLD] Storage URL failed:",
            error
        );

        return null;
    }
}

/* =========================================================
   BACKEND STATUS
   ========================================================= */

export async function getBackendStatus() {
    if (!supabase) {
        return {
            configured: false,
            connected: false,
            authenticated: false
        };
    }

    try {
        const session =
            await getSession();

        return {
            configured: true,
            connected: true,
            authenticated:
                Boolean(session)
        };
    } catch (error) {
        return {
            configured: true,
            connected: false,
            authenticated: false,
            error
        };
    }
}

/* =========================================================
   DEFAULT EXPORT
   ========================================================= */

export {
    supabase
};

export default supabase;
