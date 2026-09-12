/**
 * AZAD WORLD
 * Authentication UI
 * Login / Register / Logout
 *
 * Connects the UI to:
 * src/api/auth.js
 */

import { authManager } from "../api/auth.js";
import { gameState } from "../core/game-state.js";


// ============================================================
// CONSTANTS
// ============================================================

export const AUTH_UI_STATES = {
    LOGIN: "login",
    REGISTER: "register",
    LOGGED_IN: "logged-in"
};


// ============================================================
// HELPERS
// ============================================================

function $(id) {
    return document.getElementById(id);
}


function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
        if (key === "className") {
            element.className = value;
        } else if (key === "textContent") {
            element.textContent = value;
        } else {
            element.setAttribute(key, value);
        }
    });

    children.forEach((child) => {
        if (child) {
            element.appendChild(child);
        }
    });

    return element;
}


// ============================================================
// AUTH UI MANAGER
// ============================================================

export class AuthUIManager {

    constructor() {

        this.state = AUTH_UI_STATES.LOGIN;

        this.root = null;

        this.form = null;

        this.emailInput = null;

        this.passwordInput = null;

        this.usernameInput = null;

        this.submitButton = null;

        this.switchButton = null;

        this.logoutButton = null;

        this.messageElement = null;

        this.userElement = null;

        this.initialized = false;

        this.loading = false;

        this.listeners = new Map();

        this.authUnsubscribe = null;
    }


    // ========================================================
    // INITIALIZE
    // ========================================================

    initialize() {

        if (this.initialized) {
            return this;
        }

        this.createUI();

        this.bindEvents();

        this.listenToAuth();

        this.refresh();

        this.initialized = true;

        this.emit("initialized");

        return this;
    }


    // ========================================================
    // CREATE UI
    // ========================================================

    createUI() {

        this.root = $("auth-screen");

        /*
         * If auth-screen doesn't exist in index.html,
         * create it automatically.
         */

        if (!this.root) {

            this.root = createElement(
                "section",
                {
                    id: "auth-screen",
                    className: "screen hidden",
                    "aria-label": "Authentication"
                }
            );

            const game = $("game");

            if (game) {
                game.appendChild(this.root);
            } else {
                document.body.appendChild(this.root);
            }
        }


        this.root.innerHTML = "";


        // ----------------------------------------------------
        // Panel
        // ----------------------------------------------------

        const panel = createElement(
            "div",
            {
                className: "auth-panel"
            }
        );


        // ----------------------------------------------------
        // Title
        // ----------------------------------------------------

        const title = createElement(
            "h2",
            {
                className: "auth-title",
                textContent: "AZAD WORLD"
            }
        );


        const subtitle = createElement(
            "p",
            {
                className: "auth-subtitle",
                textContent: "ACCOUNT"
            }
        );


        // ----------------------------------------------------
        // Form
        // ----------------------------------------------------

        this.form = createElement(
            "form",
            {
                className: "auth-form",
                novalidate: "true"
            }
        );


        // Username

        const usernameGroup = createElement(
            "div",
            {
                className: "auth-field"
            }
        );

        this.usernameInput = createElement(
            "input",
            {
                id: "auth-username",
                type: "text",
                placeholder: "Username",
                autocomplete: "username",
                maxlength: "32"
            }
        );

        usernameGroup.appendChild(this.usernameInput);


        // Email

        const emailGroup = createElement(
            "div",
            {
                className: "auth-field"
            }
        );

        this.emailInput = createElement(
            "input",
            {
                id: "auth-email",
                type: "email",
                placeholder: "Email",
                autocomplete: "email",
                required: "true"
            }
        );

        emailGroup.appendChild(this.emailInput);


        // Password

        const passwordGroup = createElement(
            "div",
            {
                className: "auth-field"
            }
        );

        this.passwordInput = createElement(
            "input",
            {
                id: "auth-password",
                type: "password",
                placeholder: "Password",
                autocomplete: "current-password",
                minlength: "6",
                required: "true"
            }
        );

        passwordGroup.appendChild(this.passwordInput);


        // Message

        this.messageElement = createElement(
            "div",
            {
                id: "auth-message",
                className: "auth-message",
                role: "status"
            }
        );


        // Submit

        this.submitButton = createElement(
            "button",
            {
                id: "auth-submit",
                className: "menu-button primary",
                type: "submit",
                textContent: "LOGIN"
            }
        );


        // Switch

        this.switchButton = createElement(
            "button",
            {
                id: "auth-switch",
                className: "menu-button",
                type: "button",
                textContent: "CREATE ACCOUNT"
            }
        );


        // Logged-in user

        this.userElement = createElement(
            "div",
            {
                id: "auth-user",
                className: "auth-user"
            }
        );


        // Logout

        this.logoutButton = createElement(
            "button",
            {
                id: "auth-logout",
                className: "menu-button",
                type: "button",
                textContent: "LOGOUT"
            }
        );


        // ----------------------------------------------------
        // Append
        // ----------------------------------------------------

        this.form.appendChild(usernameGroup);

        this.form.appendChild(emailGroup);

        this.form.appendChild(passwordGroup);

        this.form.appendChild(this.messageElement);

        this.form.appendChild(this.submitButton);

        this.form.appendChild(this.switchButton);

        panel.appendChild(title);

        panel.appendChild(subtitle);

        panel.appendChild(this.form);

        panel.appendChild(this.userElement);

        panel.appendChild(this.logoutButton);

        this.root.appendChild(panel);


        this.updateUI();
    }


    // ========================================================
    // EVENTS
    // ========================================================

    bindEvents() {

        if (!this.form) {
            return;
        }


        this.form.addEventListener(
            "submit",
            (event) => {

                event.preventDefault();

                this.submit();
            }
        );


        this.switchButton?.addEventListener(
            "click",
            () => {

                this.toggleMode();
            }
        );


        this.logoutButton?.addEventListener(
            "click",
            () => {

                this.logout();
            }
        );
    }


    // ========================================================
    // AUTH LISTENER
    // ========================================================

    listenToAuth() {

        if (
            !authManager ||
            typeof authManager.onChange !== "function"
        ) {
            return;
        }


        this.authUnsubscribe = authManager.onChange(
            (event) => {

                this.refresh();

                this.emit(
                    "auth-change",
                    event
                );
            }
        );
    }


    // ========================================================
    // REFRESH
    // ========================================================

    async refresh() {

        try {

            let user = null;


            if (
                authManager &&
                typeof authManager.getUser === "function"
            ) {
                user = await authManager.getUser();
            }


            if (user) {

                this.state = AUTH_UI_STATES.LOGGED_IN;

                this.updateState(user);

            } else {

                this.state =
                    this.state === AUTH_UI_STATES.REGISTER
                        ? AUTH_UI_STATES.REGISTER
                        : AUTH_UI_STATES.LOGIN;

                this.updateState(null);
            }

        } catch (error) {

            console.error(
                "AZAD WORLD AUTH REFRESH ERROR:",
                error
            );
        }
    }


    // ========================================================
    // LOGIN / REGISTER
    // ========================================================

    async submit() {

        if (this.loading) {
            return;
        }


        const email =
            this.emailInput?.value.trim() || "";


        const password =
            this.passwordInput?.value || "";


        const username =
            this.usernameInput?.value.trim() || "";


        if (!email) {

            this.showMessage(
                "Please enter your email.",
                true
            );

            return;
        }


        if (!password) {

            this.showMessage(
                "Please enter your password.",
                true
            );

            return;
        }


        if (password.length < 6) {

            this.showMessage(
                "Password must be at least 6 characters.",
                true
            );

            return;
        }


        this.setLoading(true);


        try {

            let result;


            if (
                this.state === AUTH_UI_STATES.REGISTER
            ) {

                if (!username) {

                    this.showMessage(
                        "Please enter a username.",
                        true
                    );

                    this.setLoading(false);

                    return;
                }


                if (
                    typeof authManager.signUp !== "function"
                ) {
                    throw new Error(
                        "Sign up system is unavailable."
                    );
                }


                result = await authManager.signUp(
                    email,
                    password,
                    {
                        username,
                        display_name: username
                    }
                );


                if (result?.error) {
                    throw result.error;
                }


                this.showMessage(
                    "Account created successfully."
                );


                /*
                 * Supabase may require email confirmation.
                 * In that case there may be no active session yet.
                 */

                if (!result?.user && !result?.data?.user) {

                    this.showMessage(
                        "Account created. Check your email if confirmation is required."
                    );
                }

            } else {

                if (
                    typeof authManager.signIn !== "function"
                ) {
                    throw new Error(
                        "Login system is unavailable."
                    );
                }


                result = await authManager.signIn(
                    email,
                    password
                );


                if (result?.error) {
                    throw result.error;
                }


                this.showMessage(
                    "Login successful."
                );
            }


            await this.refresh();

            this.emit(
                "authenticated",
                result
            );


        } catch (error) {

            console.error(
                "AZAD WORLD AUTH ERROR:",
                error
            );


            this.showMessage(
                error?.message ||
                "Authentication failed.",
                true
            );

        } finally {

            this.setLoading(false);
        }
    }


    // ========================================================
    // LOGOUT
    // ========================================================

    async logout() {

        if (this.loading) {
            return;
        }


        this.setLoading(true);


        try {

            if (
                authManager &&
                typeof authManager.signOut === "function"
            ) {

                const result =
                    await authManager.signOut();


                if (result?.error) {
                    throw result.error;
                }
            }


            if (gameState) {

                gameState.set(
                    "connection.authenticated",
                    false
                );

                gameState.set(
                    "player.loggedIn",
                    false
                );
            }


            this.state =
                AUTH_UI_STATES.LOGIN;


            this.clearFields();

            this.showMessage(
                "You have been logged out."
            );


            await this.refresh();


            this.emit("logout");


        } catch (error) {

            console.error(
                "AZAD WORLD LOGOUT ERROR:",
                error
            );


            this.showMessage(
                error?.message ||
                "Logout failed.",
                true
            );

        } finally {

            this.setLoading(false);
        }
    }


    // ========================================================
    // TOGGLE LOGIN / REGISTER
    // ========================================================

    toggleMode() {

        if (
            this.state === AUTH_UI_STATES.LOGIN
        ) {

            this.state =
                AUTH_UI_STATES.REGISTER;

        } else {

            this.state =
                AUTH_UI_STATES.LOGIN;
        }


        this.showMessage("");

        this.updateUI();

        this.emit(
            "mode-change",
            this.state
        );
    }


    // ========================================================
    // UPDATE UI
    // ========================================================

    updateState(user) {

        if (user) {

            this.updateLoggedInUI(user);

        } else {

            this.updateAuthFormUI();
        }
    }


    updateUI() {

        if (
            this.state === AUTH_UI_STATES.LOGGED_IN
        ) {

            this.updateLoggedInUI();

        } else {

            this.updateAuthFormUI();
        }
    }


    updateAuthFormUI() {

        if (!this.form) {
            return;
        }


        this.form.style.display = "";


        if (this.userElement) {
            this.userElement.style.display = "none";
        }


        if (this.logoutButton) {
            this.logoutButton.style.display = "none";
        }


        if (this.state === AUTH_UI_STATES.REGISTER) {

            if (this.usernameInput) {
                this.usernameInput.parentElement.style.display =
                    "";
            }


            if (this.submitButton) {
                this.submitButton.textContent =
                    this.loading
                        ? "CREATING..."
                        : "CREATE ACCOUNT";
            }


            if (this.switchButton) {
                this.switchButton.textContent =
                    "BACK TO LOGIN";
            }


            if (this.passwordInput) {
                this.passwordInput.autocomplete =
                    "new-password";
            }

        } else {

            if (this.usernameInput) {
                this.usernameInput.parentElement.style.display =
                    "none";
            }


            if (this.submitButton) {
                this.submitButton.textContent =
                    this.loading
                        ? "LOGGING IN..."
                        : "LOGIN";
            }


            if (this.switchButton) {
                this.switchButton.textContent =
                    "CREATE ACCOUNT";
            }


            if (this.passwordInput) {
                this.passwordInput.autocomplete =
                    "current-password";
            }
        }
    }


    updateLoggedInUI(user = null) {

        if (this.form) {
            this.form.style.display = "none";
        }


        if (this.userElement) {

            this.userElement.style.display =
                "block";


            const email =
                user?.email ||
                authManager?.getEmail?.() ||
                "PLAYER";


            this.userElement.textContent =
                `SIGNED IN AS: ${email}`;
        }


        if (this.logoutButton) {

            this.logoutButton.style.display =
                "block";

            this.logoutButton.textContent =
                this.loading
                    ? "LOGGING OUT..."
                    : "LOGOUT";
        }
    }


    // ========================================================
    // SCREEN
    // ========================================================

    show() {

        if (!this.root) {
            this.initialize();
        }


        this.root.classList.remove("hidden");

        this.root.classList.add("active");


        this.emit("show");
    }


    hide() {

        if (!this.root) {
            return;
        }


        this.root.classList.add("hidden");

        this.root.classList.remove("active");


        this.emit("hide");
    }


    toggle() {

        if (
            this.root?.classList.contains("hidden")
        ) {

            this.show();

        } else {

            this.hide();
        }
    }


    // ========================================================
    // LOADING
    // ========================================================

    setLoading(value) {

        this.loading = Boolean(value);


        if (this.submitButton) {
            this.submitButton.disabled =
                this.loading;
        }


        if (this.switchButton) {
            this.switchButton.disabled =
                this.loading;
        }


        if (this.logoutButton) {
            this.logoutButton.disabled =
                this.loading;
        }


        this.updateUI();
    }


    // ========================================================
    // MESSAGE
    // ========================================================

    showMessage(message, error = false) {

        if (!this.messageElement) {
            return;
        }


        this.messageElement.textContent =
            message || "";


        this.messageElement.dataset.type =
            error
                ? "error"
                : "success";
    }


    // ========================================================
    // CLEAR
    // ========================================================

    clearFields() {

        if (this.emailInput) {
            this.emailInput.value = "";
        }


        if (this.passwordInput) {
            this.passwordInput.value = "";
        }


        if (this.usernameInput) {
            this.usernameInput.value = "";
        }
    }


    // ========================================================
    // EVENT SYSTEM
    // ========================================================

    on(event, callback) {

        if (
            typeof callback !== "function"
        ) {
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


        return () => {

            this.off(
                event,
                callback
            );
        };
    }


    off(event, callback) {

        this.listeners
            .get(event)
            ?.delete(callback);
    }


    emit(event, payload) {

        const listeners =
            this.listeners.get(event);


        if (!listeners) {
            return;
        }


        listeners.forEach(
            (callback) => {

                try {

                    callback(payload);

                } catch (error) {

                    console.error(
                        `Auth UI event "${event}" error:`,
                        error
                    );
                }
            }
        );
    }


    // ========================================================
    // SNAPSHOT
    // ========================================================

    getSnapshot() {

        return {

            state: this.state,

            initialized:
                this.initialized,

            loading:
                this.loading,

            visible:
                !this.root?.classList.contains(
                    "hidden"
                )
        };
    }


    // ========================================================
    // DISPOSE
    // ========================================================

    dispose() {

        if (
            typeof this.authUnsubscribe ===
            "function"
        ) {

            this.authUnsubscribe();

            this.authUnsubscribe = null;
        }


        this.listeners.clear();

        this.initialized = false;
    }
}


// ============================================================
// SINGLETON
// ============================================================

export const authUIManager =
    new AuthUIManager();


// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

export function initializeAuthUI() {

    return authUIManager.initialize();
}


export function showAuth() {

    return authUIManager.show();
}


export function hideAuth() {

    return authUIManager.hide();
}


export function toggleAuth() {

    return authUIManager.toggle();
}


export default authUIManager;
