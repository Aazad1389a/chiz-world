import { rendererSystem } from "../engine/renderer.js";

/**
 * AZAD WORLD
 *
 * The application loop in main.js owns gameplay updates.
 * rendererSystem.start() used to run a second RAF that updated
 * player/input/animation/camera again. Keep its render loop, but
 * make it render-only so the scene remains visible without double updates.
 */

if (rendererSystem && typeof rendererSystem.start === "function") {
  rendererSystem.start = function startRenderOnly() {
    if (this.animationFrame) return;

    this.running = true;
    this.paused = false;

    let lastRenderTime =
      typeof performance !== "undefined"
        ? performance.now()
        : Date.now();

    const loop = (time) => {
      if (!this.running) {
        this.animationFrame = null;
        return;
      }

      const now = Number.isFinite(time) ? time : Date.now();
      lastRenderTime = now;

      if (!this.paused) {
        try {
          if (typeof this.render === "function") {
            this.render();
          }
        } catch (error) {
          console.error("[RendererLoopFix] Render error:", error);
        }
      }

      this.animationFrame = requestAnimationFrame(loop);
    };

    this.animationFrame = requestAnimationFrame(loop);
    void lastRenderTime;
  };
}

export default rendererSystem;
