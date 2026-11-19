// ============================================================================
// KARTVERSE — Real-Time Multiplayer Networking Engine
// Powered by Supabase Realtime Channels (Presence & Low-Latency Broadcast)
// with Optional Node.js Socket.IO Fallback Support
// Zero-Delay Telemetry, Instant Room Creation & Live Track/Player Sync
// ============================================================================

import { RealtimeChannel } from '@supabase/supabase-js';
import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { supabase } from '../supabase/client';
import { useGameStore, MultiplayerPlayer } from '../store/gameStore';
import type { PowerUpType } from '../items/PowerUpSystem';

const loopback = (host: string) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(host);
const configuredServer = import.meta.env.VITE_SERVER_URL?.trim();
const serverUrl =
  configuredServer &&
  (!loopback(new URL(configuredServer, window.location.href).hostname) ||
    loopback(window.location.hostname))
    ? configuredServer
    : '';

export interface RemoteTelemetryPacket {
  playerId: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  speed: number;
  driftLevel: number;
  pitch: number;
  roll: number;
  timestamp: number;
  progress?: {
    lap: number;
    checkpoint: number;
    time: number;
    best: number;
    finished: boolean;
  };
}

export class SocketManager {
  private static instance: SocketManager;
  private socket: Socket | null = null;
  private supabaseChannel: RealtimeChannel | null = null;
  private localPlayerId: string =
    'player_' + Math.random().toString(36).substring(2, 9);
  private lastTelemetryTime = 0;
  private currentRoomCode: string | null = null;
  private heartbeatInterval: any = null;
  private healthCheckInterval: any = null;
  private lastHeartbeatMap: Map<string, number> = new Map();
  private readonly departed = new Set<string>();
  private opened?: (ready: boolean) => void;

  public onRemoteTelemetry?: (packet: RemoteTelemetryPacket) => void;
  public onRemoteItemUse?: (data: {
    playerId: string;
    itemType: PowerUpType;
    position: any;
    direction: any;
  }) => void;
  public onCountdownStart?: (countdown: number) => void;
  public onRaceStart?: () => void;
  public onPlayerLeft?: (playerId: string, reason: string) => void;

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public getLocalPlayerId(): string {
    return this.socket?.id || this.localPlayerId;
  }

  // ==========================================================================
  // ROOM CREATION — Instant Code Generation & Presence Initialization
  // ==========================================================================
  public async createRoom(
    username: string,
    kartId: string,
    kartColor: string,
  ): Promise<string> {
    this.disconnect();

    // 1. Generate clean, legible 6-character room code (e.g. KV-842)
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const roomCode = `KV${randomHex}`;
    this.currentRoomCode = roomCode;

    const profile = useGameStore.getState().profile;
    const initialPlayer: MultiplayerPlayer = {
      id: this.localPlayerId,
      userId: profile.id || `user_${this.localPlayerId}`,
      username: username || profile.username || 'Host Racer',
      avatar: profile.avatar || 'kart_racer_1',
      kartId: kartId || 'speed_demon',
      kartColor: kartColor || '#ff0055',
      isReady: true,
      isHost: true,
    };

    // 2. Immediately update Zustand Store (Zero hanging, 0ms feedback)
    useGameStore.getState().setRoomCode(roomCode);
    useGameStore.getState().setIsHost(true);
    useGameStore.getState().setRoomPlayers([initialPlayer]);

    if (serverUrl) return this.connectSocketIO(initialPlayer);
    this.initSupabaseChannel(roomCode, initialPlayer);

    // 4. Also optionally announce to local Socket.IO server if running (non-blocking)
    if (!(await this.waitForChannel())) {
      this.disconnect();
      throw new Error('Could not connect to the race service.');
    }

    return roomCode;
  }

  // ==========================================================================
  // ROOM JOINING — Connect via 6-Character Room Code
  // ==========================================================================
  public async joinRoom(
    roomCode: string,
    username: string,
    kartId: string,
    kartColor: string,
  ): Promise<void> {
    this.disconnect();

    const cleanCode = roomCode.trim().toUpperCase();
    this.currentRoomCode = cleanCode;

    const profile = useGameStore.getState().profile;
    const joiningPlayer: MultiplayerPlayer = {
      id: this.localPlayerId,
      userId: profile.id || `user_${this.localPlayerId}`,
      username: username || profile.username || 'Challenger',
      avatar: profile.avatar || 'kart_racer_2',
      kartId: kartId || 'velocity_gt',
      kartColor: kartColor || '#00f0ff',
      isReady: false,
      isHost: false,
    };

    // Update store state
    useGameStore.getState().setRoomCode(cleanCode);
    useGameStore.getState().setIsHost(false);
    useGameStore.getState().setRoomPlayers([joiningPlayer]);

    if (serverUrl) {
      await this.connectSocketIO(joiningPlayer, cleanCode);
      return;
    }
    this.initSupabaseChannel(cleanCode, joiningPlayer);

    // Optional Socket.IO connection
    if (!(await this.waitForChannel(true))) {
      this.disconnect();
      throw new Error(
        'Room not found. Check the code and ask the host to keep the lobby open.',
      );
    }
  }

  // ==========================================================================
  // SUPABASE REALTIME CHANNEL SETUP (Cloud-Native, High Availability)
  // ==========================================================================
  private initSupabaseChannel(
    roomCode: string,
    localPlayer: MultiplayerPlayer,
  ): void {
    const channelName = `kv_room_${roomCode}`;

    this.supabaseChannel = supabase.channel(channelName, {
      config: {
        presence: { key: this.localPlayerId },
        broadcast: { ack: false, self: false },
      },
    });

    // 1. Presence Sync: Synchronize roster whenever someone joins/leaves or changes state
    const channel = this.supabaseChannel;
    this.supabaseChannel.on('presence', { event: 'sync' }, () => {
      if (this.supabaseChannel !== channel) return;
      const state = channel.presenceState();
      const playerList: MultiplayerPlayer[] = [];
      const seen = new Set<string>();

      for (const key of Object.keys(state)) {
        const items = state[key] as any[];
        if (items && items.length > 0) {
          const p = items[items.length - 1]; // Latest presence packet
          const pId = p.id || key;
          if (!seen.has(pId) && !this.departed.has(pId)) {
            if (!this.lastHeartbeatMap.has(pId))
              this.lastHeartbeatMap.set(pId, Date.now());
            seen.add(pId);
            playerList.push({
              id: pId,
              userId: p.userId || pId,
              username: p.username || 'Racer',
              avatar: p.avatar || 'kart_racer_1',
              kartId: p.kartId || 'velocity_gt',
              kartColor: p.kartColor || '#00f0ff',
              isReady: !!p.isReady,
              isHost: !!p.isHost,
            });
          }
        }
      }

      // Ensure local player is in the list
      if (!seen.has(localPlayer.id)) {
        playerList.push(
          useGameStore
            .getState()
            .roomPlayers.find((p) => p.id === localPlayer.id) || localPlayer,
        );
      }

      // Preserve active players during live race if presence temporarily drops
      const currentScreen = useGameStore.getState().currentScreen;
      if (['QUICK_RACE', 'GRAND_PRIX'].includes(currentScreen)) {
        const existing = useGameStore.getState().roomPlayers;
        for (const exp of existing) {
          if (!playerList.some((p) => p.id === exp.id)) {
            const lastSeen = this.lastHeartbeatMap.get(exp.id) || 0;
            // Retain player if they sent telemetry/heartbeat recently (within 15s)
            if (Date.now() - lastSeen < 15000) {
              playerList.push(exp);
            }
          }
        }
      }

      // Sort Host first, then others
      playerList.sort((a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0));
      useGameStore.getState().setRoomPlayers(playerList);
    });

    // 1b. Direct Peer Join Handshake: Instant, zero-lag roster registration
    this.supabaseChannel.on(
      'broadcast',
      { event: 'player_join' },
      ({ payload }) => {
        if (
          payload?.player &&
          payload.player.id !== this.localPlayerId &&
          !this.departed.has(payload.player.id)
        ) {
          console.log(
            '[MULTIPLAYER] Instant peer joined:',
            payload.player.username,
            payload.player.id,
          );
          const store = useGameStore.getState();
          const current = store.roomPlayers;
          if (!current.some((p) => p.id === payload.player.id)) {
            const updated = [...current, payload.player].sort(
              (a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0),
            );
            store.setRoomPlayers(updated);
          }

          // If I am Host, immediately respond with authoritative room state
          if (store.isHost && this.supabaseChannel) {
            this.supabaseChannel
              .send({
                type: 'broadcast',
                event: 'room_state',
                payload: {
                  players: useGameStore.getState().roomPlayers,
                  selectedTrack: store.selectedTrack,
                },
              })
              .catch(() => {});
          }
        }
      },
    );

    // 1c. Authoritative Room State Sync from Host
    this.supabaseChannel.on(
      'broadcast',
      { event: 'room_state' },
      ({ payload }) => {
        if (payload?.players && Array.isArray(payload.players)) {
          console.log(
            '[MULTIPLAYER] Received room_state sync:',
            payload.players.length,
            'players',
          );
          const store = useGameStore.getState();
          const map = new Map<string, MultiplayerPlayer>();
          for (const p of payload.players) {
            if (!this.departed.has(p.id)) map.set(p.id, p);
          }
          // Ensure local player stays intact
          const local =
            store.roomPlayers.find((p) => p.id === this.localPlayerId) ||
            localPlayer;
          map.set(local.id, local);

          const list = Array.from(map.values()).sort(
            (a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0),
          );
          store.setRoomPlayers(list);

          if (
            payload.selectedTrack &&
            !store.isHost &&
            store.currentScreen === 'MULTIPLAYER_LOBBY'
          ) {
            store.setSelectedTrack(payload.selectedTrack);
          }
        }
      },
    );

    // 2. Real-Time Track Selection Broadcast (Host -> All Players)
    this.supabaseChannel.on(
      'broadcast',
      { event: 'track_selected' },
      ({ payload }) => {
        if (
          payload?.trackId &&
          useGameStore.getState().currentScreen === 'MULTIPLAYER_LOBBY'
        ) {
          useGameStore.getState().setSelectedTrack(payload.trackId);
        }
      },
    );

    // 3. Ready Toggle Broadcast
    this.supabaseChannel.on(
      'broadcast',
      { event: 'player_ready' },
      ({ payload }) => {
        if (payload && payload.id) {
          const current = useGameStore.getState().roomPlayers;
          const updated = current.map((p) =>
            p.id === payload.id ? { ...p, isReady: payload.isReady } : p,
          );
          useGameStore.getState().setRoomPlayers(updated);
        }
      },
    );

    // 4. Synchronized Race Launch (Host -> All Players)
    this.supabaseChannel.on(
      'broadcast',
      { event: 'start_race' },
      ({ payload }) => {
        if (useGameStore.getState().currentScreen !== 'MULTIPLAYER_LOBBY')
          return;
        const store = useGameStore.getState();
        if (
          Array.isArray(payload?.players) &&
          payload.players.some(
            (p: MultiplayerPlayer) => p.id === this.localPlayerId,
          )
        ) {
          store.setRoomPlayers(
            payload.players.filter(
              (p: MultiplayerPlayer) => !this.departed.has(p.id),
            ),
          );
        }
        if (payload?.trackId) store.setSelectedTrack(payload.trackId);
        useGameStore.getState().setRaceMode('MULTIPLAYER');
        useGameStore.getState().setScreen('QUICK_RACE');
        if (this.onRaceStart) this.onRaceStart();
      },
    );

    // 5. Zero-Delay High-Frequency Telemetry Broadcast (25-30Hz)
    this.supabaseChannel.on(
      'broadcast',
      { event: 'telemetry' },
      ({ payload }) => {
        if (
          payload?.id &&
          payload.id !== this.localPlayerId &&
          !this.departed.has(payload.id) &&
          useGameStore.getState().roomPlayers.some((p) => p.id === payload.id)
        ) {
          // Record heartbeat timestamp from active telemetry
          this.lastHeartbeatMap.set(payload.id, Date.now());

          // Failsafe: If guest is still sitting in the lobby and telemetry starts flowing, launch race!
          if (useGameStore.getState().currentScreen === 'MULTIPLAYER_LOBBY') {
            console.log(
              '[MULTIPLAYER] Telemetry detected while in lobby! Auto-starting race...',
            );
            useGameStore.getState().setRaceMode('MULTIPLAYER');
            useGameStore.getState().setScreen('QUICK_RACE');
            if (this.onRaceStart) this.onRaceStart();
          }

          if (this.onRemoteTelemetry) {
            this.onRemoteTelemetry({
              playerId: payload.id,
              position: { x: payload.x, y: payload.y, z: payload.z },
              rotationY: payload.rotY,
              speed: payload.speed,
              driftLevel: payload.driftLevel || 0,
              pitch: payload.pitch || 0,
              roll: payload.roll || 0,
              progress: payload.progress,
              timestamp: Date.now(),
            });
          }
        }
      },
    );

    // 6. Reliable Heartbeat Broadcast Listener
    this.supabaseChannel.on(
      'broadcast',
      { event: 'player_heartbeat' },
      ({ payload }) => {
        if (payload && payload.id && payload.id !== this.localPlayerId) {
          this.lastHeartbeatMap.set(payload.id, Date.now());
        }
      },
    );

    // 7. Explicit Player Departure Listener (Tab Close / Exit Race)
    this.supabaseChannel.on(
      'broadcast',
      { event: 'player_left' },
      ({ payload }) => {
        if (payload && payload.id && payload.id !== this.localPlayerId) {
          console.log(
            `[MULTIPLAYER] Inbound player_left notification: ${payload.id}, reason: ${payload.reason}`,
          );
          this.removePeer(payload.id, payload.reason || 'LEFT');
        }
      },
    );

    // 8. Power-Up Item Events
    this.supabaseChannel.on(
      'broadcast',
      { event: 'use_item' },
      ({ payload }) => {
        if (
          payload &&
          payload.senderId !== this.localPlayerId &&
          !this.departed.has(payload.senderId) &&
          this.onRemoteItemUse
        ) {
          this.onRemoteItemUse({
            playerId: payload.senderId,
            itemType: payload.itemType,
            position: payload.originPos,
            direction: payload.direction || { x: 0, y: 0, z: 1 },
          });
        }
      },
    );

    // Subscribe and track local presence with auto-reconnect
    this.supabaseChannel.subscribe(async (status) => {
      if (this.supabaseChannel !== channel) return;
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track(
            useGameStore
              .getState()
              .roomPlayers.find((p) => p.id === localPlayer.id) || localPlayer,
          );
          if (this.supabaseChannel !== channel) return;
          this.opened?.(true);
        } catch (e) {
          console.warn('[MULTIPLAYER] Track error:', e);
        }
        // Start continuous heartbeat & health monitoring
        this.startHeartbeat(localPlayer);

        // Announce join via broadcast (3 bursts for 100% arrival)
        if (!localPlayer.isHost) {
          const sendJoin = () => {
            if (this.supabaseChannel !== channel) return;
            channel
              .send({
                type: 'broadcast',
                event: 'player_join',
                payload: { player: localPlayer },
              })
              .catch(() => {});
          };
          sendJoin();
          setTimeout(sendJoin, 400);
          setTimeout(sendJoin, 1000);
        }
      } else if (status === 'CLOSED') {
        this.opened?.(false);
      }
    });
  }

  // ==========================================================================
  // HEARTBEAT & HEALTH MONITORING SYSTEM
  // ==========================================================================
  private startHeartbeat(localPlayer: MultiplayerPlayer): void {
    this.stopHeartbeat();

    // 1. Send immediate heartbeat
    this.sendHeartbeat(localPlayer);

    // 2. High-reliability 3.5s presence & heartbeat ping
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat(localPlayer);
    }, 3500);

    // 3. Stale player health-check loop every 3.0s
    this.healthCheckInterval = setInterval(() => {
      this.checkRemoteRacersHealth();
    }, 3000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private sendHeartbeat(localPlayer: MultiplayerPlayer): void {
    if (!this.supabaseChannel) return;
    // Broadcast ping to all connected peers
    this.supabaseChannel
      .send({
        type: 'broadcast',
        event: 'player_heartbeat',
        payload: { id: this.localPlayerId, timestamp: Date.now() },
      })
      .catch(() => {});
  }

  private checkRemoteRacersHealth(): void {
    const now = Date.now();
    const currentScreen = useGameStore.getState().currentScreen;
    // Health check active in lobby and racing screens
    const roomPlayers = useGameStore.getState().roomPlayers;

    for (const p of roomPlayers) {
      if (p.id === this.localPlayerId) continue;
      const lastSeen = this.lastHeartbeatMap.get(p.id);
      // If we have seen them before and they have sent no packet for > 15 seconds
      if (lastSeen && now - lastSeen > 15000) {
        console.warn(
          `[MULTIPLAYER] Player ${p.id} (${p.username}) timed out after 15s`,
        );
        this.removePeer(p.id, 'TIMEOUT');
      }
    }
  }

  private removePeer(id: string, reason: string) {
    this.departed.add(id);
    this.lastHeartbeatMap.delete(id);
    const store = useGameStore.getState();
    store.setRoomPlayers(
      store.roomPlayers.filter((player) => player.id !== id),
    );
    this.onPlayerLeft?.(id, reason);
  }

  private async waitForChannel(requireHost = false): Promise<boolean> {
    const ready = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.opened = undefined;
        resolve(false);
      }, 5000);
      this.opened = (success) => {
        clearTimeout(timer);
        this.opened = undefined;
        resolve(success);
      };
    });
    if (!ready || !requireHost) return ready;
    const channel = this.supabaseChannel;
    for (let i = 0; i < 25 && this.supabaseChannel === channel; i++) {
      if (useGameStore.getState().roomPlayers.some((p) => p.isHost))
        return true;
      await new Promise((resolve) => setTimeout(resolve, 125));
    }
    return false;
  }

  public async leaveRace(reason = 'USER_EXIT'): Promise<void> {
    const channel = this.supabaseChannel;
    if (channel?.state === 'joined') {
      void channel.send({
        type: 'broadcast',
        event: 'player_left',
        payload: { id: this.localPlayerId, reason },
      });
    }
    this.disconnect();
  }

  // ==========================================================================
  // HOST & PLAYER CONTROLS
  // ==========================================================================
  public toggleReady(isReady: boolean): void {
    const currentList = useGameStore.getState().roomPlayers;
    if (this.socket) {
      this.socket.emit('toggle_ready', { code: this.currentRoomCode, isReady });
      return;
    }
    const current = currentList.find((p) => p.id === this.localPlayerId);
    const local = current && { ...current, isReady };
    if (local) {
      useGameStore
        .getState()
        .setRoomPlayers(
          currentList.map((p) => (p.id === local.id ? local : p)),
        );
      if (this.supabaseChannel) {
        this.supabaseChannel.track(local);
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'player_ready',
          payload: { id: this.localPlayerId, isReady },
        });
      }
    }
  }

  public setTrack(trackId: string): void {
    this.socket?.emit('select_track', { code: this.currentRoomCode, trackId });
    useGameStore.getState().setSelectedTrack(trackId);
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'track_selected',
        payload: { trackId },
      });
    }
  }

  public startRace(): void {
    this.socket?.emit('start_race', { code: this.currentRoomCode });
    const { selectedTrack: trackId, roomPlayers: players } =
      useGameStore.getState();
    if (this.supabaseChannel) {
      const channel = this.supabaseChannel;
      const sendPacket = () => {
        if (this.supabaseChannel !== channel) return;
        channel
          .send({
            type: 'broadcast',
            event: 'start_race',
            payload: { trackId, players, timestamp: Date.now() },
          })
          .catch(() => {});
      };
      // Send 3 bursts to ensure 100% arrival over mobile / WiFi
      sendPacket();
      setTimeout(sendPacket, 120);
      setTimeout(sendPacket, 250);
    }
  }

  // ==========================================================================
  // REAL-TIME ZERO-DELAY TELEMETRY & ITEMS
  // ==========================================================================
  public sendTelemetry(
    telemetry: Omit<RemoteTelemetryPacket, 'playerId' | 'timestamp'>,
  ): void {
    const now = performance.now();
    // Throttle to ~30Hz (every 33ms) for smooth zero-lag synchronization
    if (now - this.lastTelemetryTime < 32) return;
    this.lastTelemetryTime = now;

    if (this.supabaseChannel) {
      this.supabaseChannel
        .send({
          type: 'broadcast',
          event: 'telemetry',
          payload: {
            id: this.localPlayerId,
            x: telemetry.position.x,
            y: telemetry.position.y,
            z: telemetry.position.z,
            rotY: telemetry.rotationY,
            speed: telemetry.speed,
            driftLevel: telemetry.driftLevel,
            pitch: telemetry.pitch,
            roll: telemetry.roll,
            progress: telemetry.progress,
          },
        })
        .catch(() => {});
    }

    if (this.socket && this.socket.connected && this.currentRoomCode) {
      this.socket.emit('telemetry', {
        code: this.currentRoomCode,
        data: {
          x: telemetry.position.x,
          y: telemetry.position.y,
          z: telemetry.position.z,
          rotY: telemetry.rotationY,
          speed: telemetry.speed,
          isDrifting: telemetry.driftLevel > 0,
          driftTier: telemetry.driftLevel,
          pitch: telemetry.pitch,
          roll: telemetry.roll,
          progress: telemetry.progress,
        },
      });
    }
  }

  public sendItemUse(
    itemType: PowerUpType,
    position: THREE.Vector3,
    direction: THREE.Vector3,
  ): void {
    this.socket?.emit('use_item', {
      code: this.currentRoomCode,
      itemType,
      originPos: position,
      direction,
    });
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'use_item',
        payload: {
          senderId: this.localPlayerId,
          itemType,
          originPos: { x: position.x, y: position.y, z: position.z },
          direction: { x: direction.x, y: direction.y, z: direction.z },
        },
      });
    }
  }

  // ==========================================================================
  // OPTIONAL SOCKET.IO SERVER HOOK (Non-blocking fallback)
  // ==========================================================================
  private async connectSocketIO(
    player: MultiplayerPlayer,
    code?: string,
  ): Promise<string> {
    const socket = io(serverUrl, { timeout: 2500 });
    this.socket = socket;
    const applyRoom = (room: {
      code: string;
      trackId: string;
      hostId: string;
      players: MultiplayerPlayer[];
    }) => {
      if (this.socket !== socket) return;
      useGameStore
        .getState()
        .setMultiplayerRoom(room.code, room.hostId === socket.id, room.players);
      useGameStore.getState().setSelectedTrack(room.trackId);
    };
    socket.on('room_updated', applyRoom);
    socket.on('race_starting', ({ trackId, players }) => {
      useGameStore.getState().setRoomPlayers(players);
      useGameStore.getState().setSelectedTrack(trackId);
      useGameStore.getState().setRaceMode('MULTIPLAYER');
      useGameStore.getState().setScreen('QUICK_RACE');
    });
    socket.on('player_left', ({ playerId, id, room }) => {
      if (room) applyRoom(room);
      this.removePeer(playerId || id, 'LEFT');
    });
    socket.on('player_telemetry', (payload) => {
      if (this.departed.has(payload.id)) return;
      this.onRemoteTelemetry?.({
        playerId: payload.id,
        position: { x: payload.x, y: payload.y, z: payload.z },
        rotationY: payload.rotY,
        speed: payload.speed,
        driftLevel: payload.driftTier,
        pitch: payload.pitch || 0,
        roll: payload.roll || 0,
        timestamp: Date.now(),
        progress: payload.progress,
      });
    });
    socket.on('item_spawned', (data) => {
      if (data.senderId !== socket.id)
        this.onRemoteItemUse?.({
          playerId: data.senderId,
          itemType: data.itemType,
          position: data.originPos,
          direction: data.direction,
        });
    });
    try {
      const result = await socket
        .timeout(3500)
        .emitWithAck(code ? 'join_room' : 'create_room', {
          ...player,
          code,
          trackId: useGameStore.getState().selectedTrack,
        });
      if (this.socket !== socket) throw new Error('Room connection cancelled.');
      if (!result.success) throw new Error(result.error);
      this.currentRoomCode = result.room.code;
      applyRoom(result.room);
      return result.room.code;
    } catch (error) {
      if (this.socket === socket) this.disconnect();
      throw error;
    }
  }

  public disconnect(): void {
    this.stopHeartbeat();
    this.lastHeartbeatMap.clear();
    this.departed.clear();
    this.opened?.(false);
    useGameStore.getState().setMultiplayerRoom(null, false);
    const ch = this.supabaseChannel;
    this.supabaseChannel = null;
    this.currentRoomCode = null;
    if (ch) {
      try {
        supabase.removeChannel(ch);
      } catch {
        ch.unsubscribe();
      }
    }
    if (this.socket) {
      this.socket.emit('leave_room');
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketManager = SocketManager.getInstance();
if (typeof window !== 'undefined') {
  (window as any).__socketManager = socketManager;
}
