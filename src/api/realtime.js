import {
  getSupabase,
  getCurrentUser,
  createRealtimeChannel,
  joinRealtimeChannel,
  leaveRealtimeChannel,
  broadcastRealtime,
  listenToBroadcast,
  trackPresence,
  listenToPresence
} from "./supabase.js";

/**
 * AZAD WORLD
 * Realtime Multiplayer System
 *
 * امکانات:
 * - Multiplayer rooms
 * - Player presence
 * - Player state synchronization
 * - Player actions
 * - Game events
 * - World events
 * - Chat messages
 * - Online/offline players
 */

export class RealtimeManager {
  constructor() {
    this.supabase = getSupabase();

    this.channels = new Map();
    this.players = new Map();
    this.listeners = new Map();

    this.currentRoom = null;
    this.playerId = null;

    this.isConnected = false;

    this.lastStateBroadcast = 0;
    this.stateBroadcastInterval = 100;
  }

  async initialize() {
    const user = await getCurrentUser();

    if (!user) {
      return {
        ok: false,
        error: "User is not logged in."
      };
    }

    this.playerId = user.id;

    return {
      ok: true,
      playerId: this.playerId
    };
  }

  createRoomName(roomId) {
    return `azad-world-room-${roomId}`;
  }

  async joinRoom(roomId) {
    if (!this.supabase) {
      return {
        ok: false,
        error: "Supabase is not configured."
      };
    }

    if (!roomId) {
      return {
        ok: false,
        error: "Room ID is required."
      };
    }

    if (this.currentRoom) {
      await this.leaveRoom();
    }

    const initialized = await this.initialize();

    if (!initialized.ok) {
      return initialized;
    }

    try {
      const channelName = this.createRoomName(roomId);

      const channel = createRealtimeChannel(
        channelName,
        {
          config: {
            broadcast: {
              self: false
            },
            presence: {
              key: this.playerId
            }
          }
        }
      );

      if (!channel) {
        return {
          ok: false,
          error: "Failed to create realtime channel."
        };
      }

      this.channels.set(roomId, channel);
      this.currentRoom = roomId;

      this.setupBroadcastListeners(channel);
      this.setupPresenceListeners(channel);

      const result = await joinRealtimeChannel(channel);

      if (!result.ok) {
        this.channels.delete(roomId);
        this.currentRoom = null;

        return result;
      }

      this.isConnected = true;

      await this.trackPlayer({
        playerId: this.playerId,
        online: true,
        joinedAt: Date.now()
      });

      this.emit("room_joined", {
        roomId,
        playerId: this.playerId
      });

      return {
        ok: true,
        roomId,
        playerId: this.playerId
      };

    } catch (error) {
      console.error(
        "[RealtimeManager] joinRoom:",
        error
      );

      return {
        ok: false,
        error: error?.message || "Failed to join room."
      };
    }
  }

  async leaveRoom() {
    if (!this.currentRoom) {
      return {
        ok: true
      };
    }

    const roomId = this.currentRoom;
    const channel = this.channels.get(roomId);

    try {
      if (channel) {
        await this.trackPlayer({
          playerId: this.playerId,
          online: false,
          leftAt: Date.now()
        });

        await leaveRealtimeChannel(channel);
      }

      this.channels.delete(roomId);

      this.players.clear();

      this.currentRoom = null;
      this.isConnected = false;

      this.emit("room_left", {
        roomId,
        playerId: this.playerId
      });

      return {
        ok: true
      };

    } catch (error) {
      console.error(
        "[RealtimeManager] leaveRoom:",
        error
      );

      return {
        ok: false,
        error: error?.message || "Failed to leave room."
      };
    }
  }

  getCurrentChannel() {
    if (!this.currentRoom) {
      return null;
    }

    return this.channels.get(this.currentRoom) || null;
  }

  setupBroadcastListeners(channel) {
    listenToBroadcast(
      channel,
      "player_state",
      (payload) => {
        this.handlePlayerState(payload);
      }
    );

    listenToBroadcast(
      channel,
      "game_event",
      (payload) => {
        this.handleGameEvent(payload);
      }
    );

    listenToBroadcast(
      channel,
      "chat_message",
      (payload) => {
        this.handleChatMessage(payload);
      }
    );

    listenToBroadcast(
      channel,
      "player_action",
      (payload) => {
        this.handlePlayerAction(payload);
      }
    );

    listenToBroadcast(
      channel,
      "world_event",
      (payload) => {
        this.handleWorldEvent(payload);
      }
    );
  }

  setupPresenceListeners(channel) {
    listenToPresence(
      channel,
      "sync",
      () => {
        this.syncPresencePlayers(channel);
      }
    );

    listenToPresence(
      channel,
      "join",
      (payload) => {
        this.handlePresenceJoin(payload);
      }
    );

    listenToPresence(
      channel,
      "leave",
      (payload) => {
        this.handlePresenceLeave(payload);
      }
    );
  }

  async trackPlayer(state = {}) {
    const channel = this.getCurrentChannel();

    if (!channel) {
      return {
        ok: false,
        error: "Not connected to a room."
      };
    }

    try {
      const presenceData = {
        playerId: state.playerId || this.playerId,

        online: state.online !== false,

        joinedAt: state.joinedAt || Date.now(),

        ...state
      };

      return await trackPresence(
        channel,
        presenceData
      );

    } catch (error) {
      console.error(
        "[RealtimeManager] trackPlayer:",
        error
      );

      return {
        ok: false,
        error: error?.message || "Failed to track player."
      };
    }
  }

  async sendPlayerState(state = {}) {
    const now = performance.now();

    if (
      now - this.lastStateBroadcast <
      this.stateBroadcastInterval
    ) {
      return {
        ok: false,
        skipped: true
      };
    }

    this.lastStateBroadcast = now;

    return await this.broadcast(
      "player_state",
      {
        playerId: this.playerId,
        timestamp: Date.now(),
        state
      }
    );
  }

  async sendAction(action, data = {}) {
    return await this.broadcast(
      "player_action",
      {
        playerId: this.playerId,
        action,
        data,
        timestamp: Date.now()
      }
    );
  }

  async sendGameEvent(event, data = {}) {
    return await this.broadcast(
      "game_event",
      {
        playerId: this.playerId,
        event,
        data,
        timestamp: Date.now()
      }
    );
  }

  async sendWorldEvent(event, data = {}) {
    return await this.broadcast(
      "world_event",
      {
        playerId: this.playerId,
        event,
        data,
        timestamp: Date.now()
      }
    );
  }

  async sendChatMessage(message) {
    const cleanMessage = String(message || "")
      .trim()
      .slice(0, 500);

    if (!cleanMessage) {
      return {
        ok: false,
        error: "Message is empty."
      };
    }

    return await this.broadcast(
      "chat_message",
      {
        playerId: this.playerId,
        message: cleanMessage,
        timestamp: Date.now()
      }
    );
  }

  async broadcast(event, payload = {}) {
    const channel = this.getCurrentChannel();

    if (!channel) {
      return {
        ok: false,
        error: "Not connected to a room."
      };
    }

    try {
      return await broadcastRealtime(
        channel,
        event,
        payload
      );

    } catch (error) {
      console.error(
        "[RealtimeManager] broadcast:",
        error
      );

      return {
        ok: false,
        error: error?.message || "Broadcast failed."
      };
    }
  }

  handlePlayerState(payload) {
    if (!payload) {
      return;
    }

    const playerId = payload.playerId;

    if (!playerId) {
      return;
    }

    if (playerId === this.playerId) {
      return;
    }

    const previous =
      this.players.get(playerId) || {};

    const player = {
      ...previous,

      playerId,

      state: payload.state || {},

      timestamp:
        payload.timestamp || Date.now(),

      lastUpdate: Date.now()
    };

    this.players.set(
      playerId,
      player
    );

    this.emit(
      "player_state",
      player
    );
  }

  handleGameEvent(payload) {
    if (!payload) {
      return;
    }

    this.emit(
      "game_event",
      payload
    );
  }

  handleChatMessage(payload) {
    if (!payload) {
      return;
    }

    this.emit(
      "chat_message",
      payload
    );
  }

  handlePlayerAction(payload) {
    if (!payload) {
      return;
    }

    if (payload.playerId === this.playerId) {
      return;
    }

    this.emit(
      "player_action",
      payload
    );
  }

  handleWorldEvent(payload) {
    if (!payload) {
      return;
    }

    this.emit(
      "world_event",
      payload
    );
  }

  syncPresencePlayers(channel) {
    if (!channel) {
      return;
    }

    try {
      const state =
        channel.presenceState();

      const players = new Map();

      for (const key of Object.keys(state)) {
        const entries = state[key] || [];

        for (const entry of entries) {
          const playerId =
            entry.playerId || key;

          players.set(
            playerId,
            {
              ...entry,
              playerId,
              online: true
            }
          );
        }
      }

      for (const [id, player] of players) {
        this.players.set(id, player);
      }

      this.emit(
        "players_sync",
        this.getPlayers()
      );

    } catch (error) {
      console.error(
        "[RealtimeManager] syncPresencePlayers:",
        error
      );
    }
  }

  handlePresenceJoin(payload) {
    this.emit(
      "player_joined",
      payload
    );

    const joined =
      payload?.newPresences || [];

    for (const presence of joined) {
      const playerId =
        presence.playerId;

      if (!playerId) {
        continue;
      }

      this.players.set(
        playerId,
        {
          ...presence,
          playerId,
          online: true
        }
      );
    }
  }

  handlePresenceLeave(payload) {
    this.emit(
      "player_left",
      payload
    );

    const left =
      payload?.leftPresences || [];

    for (const presence of left) {
      const playerId =
        presence.playerId;

      if (!playerId) {
        continue;
      }

      this.players.delete(playerId);
    }
  }

  getPlayer(playerId) {
    return this.players.get(playerId) || null;
  }

  getPlayers() {
    return Array.from(
      this.players.values()
    );
  }

  getOtherPlayers() {
    return this.getPlayers().filter(
      (player) =>
        player.playerId !== this.playerId
    );
  }

  getPlayerCount() {
    return this.players.size;
  }

  isPlayerOnline(playerId) {
    const player =
      this.players.get(playerId);

    return Boolean(player?.online);
  }

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

    return () => {
      this.off(event, callback);
    };
  }

  off(event, callback) {
    const listeners =
      this.listeners.get(event);

    if (!listeners) {
      return;
    }

    listeners.delete(callback);

    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event, data) {
    const listeners =
      this.listeners.get(event);

    if (!listeners) {
      return;
    }

    for (const callback of listeners) {
      try {
        callback(data);
      } catch (error) {
        console.error(
          `[RealtimeManager] Event "${event}" error:`,
          error
        );
      }
    }
  }

  setStateBroadcastInterval(milliseconds) {
    this.stateBroadcastInterval =
      Math.max(
        50,
        Number(milliseconds) || 100
      );
  }

  getConnectionState() {
    return {
      connected: this.isConnected,

      room: this.currentRoom,

      playerId: this.playerId,

      players: this.getPlayerCount()
    };
  }

  async reconnect() {
    if (!this.currentRoom) {
      return {
        ok: false,
        error: "No room to reconnect."
      };
    }

    const room = this.currentRoom;

    await this.leaveRoom();

    return await this.joinRoom(room);
  }

  async destroy() {
    await this.leaveRoom();

    this.channels.clear();
    this.players.clear();
    this.listeners.clear();

    this.currentRoom = null;
    this.playerId = null;
    this.isConnected = false;
  }

  dispose() {
    return this.destroy();
  }
}

export const realtimeManager =
  new RealtimeManager();

export default realtimeManager;
