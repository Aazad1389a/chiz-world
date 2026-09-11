import {
    getSupabase,
    getCurrentUser,
    getSession,
    onAuthStateChange
} from "./supabase.js";

/**
 * AZAD WORLD
 * Authentication System
 *
 * Handles:
 * - Sign up
 * - Sign in
 * - Sign out
 * - Session
 * - Current player
 * - Authentication state
 */

export class AuthManager {
    constructor() {
        this.supabase = getSupabase();

        this.user = null;
        this.session = null;

        this.listeners = new Set();

        this.initialized = false;

        this.initialize();
    }

    async initialize() {
        if (!this.supabase) {
            console.warn(
                "AZAD WORLD: Authentication is not configured yet."
            );

            this.initialized = true;
            return null;
        }

        try {
            this.session =
                await getSession();

            this.user =
                this.session?.user ?? null;

            onAuthStateChange(
                (event, session) => {
                    this.session =
                        session;

                    this.user =
                        session?.user ?? null;

                    this.notify(
                        event,
                        this.user,
                        this.session
                    );
                }
            );

            this.initialized = true;

            return this.user;
        } catch (error) {
            console.error(
                "Authentication initialization failed:",
                error
            );

            this.initialized = true;

            return null;
        }
    }

    /**
     * Register a new player.
     */
    async signUp(
        email,
        password,
        metadata = {}
    ) {
        if (!this.supabase) {
            return this.errorResult(
                "Supabase is not configured."
            );
        }

        if (!email || !password) {
            return this.errorResult(
                "Email and password are required."
            );
        }

        if (password.length < 6) {
            return this.errorResult(
                "Password must contain at least 6 characters."
            );
        }

        try {
            const {
                data,
                error
            } =
                await this.supabase.auth.signUp(
                    {
                        email:
                            email.trim(),

                        password,

                        options: {
                            data: {
                                username:
                                    metadata.username ??
                                    "",

                                display_name:
                                    metadata.display_name ??
                                    "",

                                avatar:
                                    metadata.avatar ??
                                    "",

                                ...metadata
                            }
                        }
                    }
                );

            if (error) {
                return this.errorResult(
                    error.message,
                    error
                );
            }

            this.session =
                data?.session ?? null;

            this.user =
                data?.user ?? null;

            return {
                success: true,
                user: this.user,
                session: this.session,
                needsEmailConfirmation:
                    Boolean(
                        data?.user &&
                        !data?.session
                    ),
                error: null
            };
        } catch (error) {
            return this.errorResult(
                error.message,
                error
            );
        }
    }

    /**
     * Login existing player.
     */
    async signIn(
        email,
        password
    ) {
        if (!this.supabase) {
            return this.errorResult(
                "Supabase is not configured."
            );
        }

        if (!email || !password) {
            return this.errorResult(
                "Email and password are required."
            );
        }

        try {
            const {
                data,
                error
            } =
                await this.supabase.auth
                    .signInWithPassword({
                        email:
                            email.trim(),

                        password
                    });

            if (error) {
                return this.errorResult(
                    error.message,
                    error
                );
            }

            this.session =
                data?.session ?? null;

            this.user =
                data?.user ?? null;

            return {
                success: true,
                user: this.user,
                session: this.session,
                error: null
            };
        } catch (error) {
            return this.errorResult(
                error.message,
                error
            );
        }
    }

    /**
     * Logout current player.
     */
    async signOut() {
        if (!this.supabase) {
            return this.errorResult(
                "Supabase is not configured."
            );
        }

        try {
            const {
                error
            } =
                await this.supabase.auth.signOut();

            if (error) {
                return this.errorResult(
                    error.message,
                    error
                );
            }

            this.user = null;
            this.session = null;

            return {
                success: true,
                error: null
            };
        } catch (error) {
            return this.errorResult(
                error.message,
                error
            );
        }
    }

    /**
     * Send password reset email.
     */
    async resetPassword(
        email,
        redirectTo = null
    ) {
        if (!this.supabase) {
            return this.errorResult(
                "Supabase is not configured."
            );
        }

        if (!email) {
            return this.errorResult(
                "Email is required."
            );
        }

        try {
            const options = {};

            if (redirectTo) {
                options.redirectTo =
                    redirectTo;
            }

            const {
                error
            } =
                await this.supabase.auth
                    .resetPasswordForEmail(
                        email.trim(),
                        {
                            ...options
                        }
                    );

            if (error) {
                return this.errorResult(
                    error.message,
                    error
                );
            }

            return {
                success: true,
                error: null
            };
        } catch (error) {
            return this.errorResult(
                error.message,
                error
            );
        }
    }

    /**
     * Update password.
     */
    async updatePassword(
        newPassword
    ) {
        if (!this.supabase) {
            return this.errorResult(
                "Supabase is not configured."
            );
        }

        if (
            !newPassword ||
            newPassword.length < 6
        ) {
            return this.errorResult(
                "Password must contain at least 6 characters."
            );
        }

        try {
            const {
                data,
                error
            } =
                await this.supabase.auth
                    .updateUser({
                        password:
                            newPassword
                    });

            if (error) {
                return this.errorResult(
                    error.message,
                    error
                );
            }

            this.user =
                data?.user ??
                this.user;

            return {
                success: true,
                user: this.user,
                error: null
            };
        } catch (error) {
            return this.errorResult(
                error.message,
                error
            );
        }
    }

    /**
     * Update user metadata.
     */
    async updateMetadata(
        metadata
    ) {
        if (!this.supabase) {
            return this.errorResult(
                "Supabase is not configured."
            );
        }

        if (
            !metadata ||
            typeof metadata !==
                "object"
        ) {
            return this.errorResult(
                "Metadata must be an object."
            );
        }

        try {
            const {
                data,
                error
            } =
                await this.supabase.auth
                    .updateUser({
                        data: metadata
                    });

            if (error) {
                return this.errorResult(
                    error.message,
                    error
                );
            }

            this.user =
                data?.user ??
                this.user;

            return {
                success: true,
                user: this.user,
                error: null
            };
        } catch (error) {
            return this.errorResult(
                error.message,
                error
            );
        }
    }

    /**
     * Refresh current session.
     */
    async refreshSession() {
        if (!this.supabase) {
            return null;
        }

        try {
            const {
                data,
                error
            } =
                await this.supabase.auth
                    .refreshSession();

            if (error) {
                console.error(
                    "Session refresh failed:",
                    error
                );

                return null;
            }

            this.session =
                data?.session ?? null;

            this.user =
                data?.user ??
                this.session?.user ??
                null;

            return this.session;
        } catch (error) {
            console.error(
                "Session refresh failed:",
                error
            );

            return null;
        }
    }

    /**
     * Get current player.
     */
    async getUser() {
        if (this.user) {
            return this.user;
        }

        this.user =
            await getCurrentUser();

        return this.user;
    }

    /**
     * Get current session.
     */
    async getCurrentSession() {
        if (this.session) {
            return this.session;
        }

        this.session =
            await getSession();

        this.user =
            this.session?.user ??
            null;

        return this.session;
    }

    /**
     * Check login state.
     */
    isLoggedIn() {
        return Boolean(
            this.user &&
            this.session
        );
    }

    /**
     * Get player ID.
     */
    getPlayerId() {
        return (
            this.user?.id ??
            null
        );
    }

    /**
     * Get player email.
     */
    getEmail() {
        return (
            this.user?.email ??
            null
        );
    }

    /**
     * Get player metadata.
     */
    getMetadata() {
        return (
            this.user?.user_metadata ??
            {}
        );
    }

    /**
     * Listen for auth changes.
     */
    onChange(callback) {
        if (
            typeof callback !==
            "function"
        ) {
            return () => {};
        }

        this.listeners.add(
            callback
        );

        return () => {
            this.listeners.delete(
                callback
            );
        };
    }

    /**
     * Notify application.
     */
    notify(
        event,
        user,
        session
    ) {
        for (
            const callback of
                this.listeners
        ) {
            try {
                callback({
                    event,
                    user,
                    session,
                    loggedIn:
                        Boolean(
                            user &&
                            session
                        )
                });
            } catch (error) {
                console.error(
                    "Auth listener error:",
                    error
                );
            }
        }
    }

    /**
     * Standard error result.
     */
    errorResult(
        message,
        error = null
    ) {
        console.error(
            "AZAD WORLD Auth:",
            message
        );

        return {
            success: false,
            user: null,
            session: null,
            error:
                error ?? message
        };
    }

    /**
     * Destroy authentication manager.
     */
    dispose() {
        this.listeners.clear();
    }
}

export default AuthManager;
