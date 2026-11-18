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
import { PowerUpType } from '../items/PowerUpSystem';

export interface RemoteTelemetryPacket {
  playerId: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  speed: number;
  driftLevel: number;
  pitch: number;
  roll: number;
  timestamp: number;
}

export class SocketManager {
  private static instance: SocketManager;
  private socket: Socket | null = null;
  private supabaseChannel: RealtimeChannel | null = null;
  private localPlayerId: string = 'player_' + Math.random().toString(36).substring(2, 9);
  private lastTelemetryTime = 0;
  private currentRoomCode: string | null = null;
  private heartbeatInterval: any = null;
  private healthCheckInterval: any = null;
  private lastHeartbeatMap: Map<string, number> = new Map();
  private isReconnecting = false;

  public onRemoteTelemetry?: (packet: RemoteTelemetryPacket) => void;
  public onRemoteItemUse?: (data: { playerId: string; itemType: PowerUpType; position: any; direction: any }) => void;
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
    return this.localPlayerId;
  }

  public getSocketId(): string {
    return this.socket?.id || this.localPlayerId;
  }

  // ==========================================================================
  // ROOM CREATION — Instant Code Generation & Presence Initialization
  // ==========================================================================
  public async createRoom(username: string, kartId: string, kartColor: string): Promise<string> {
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
      isHost: true
    };

    // 2. Immediately update Zustand Store (Zero hanging, 0ms feedback)
    useGameStore.getState().setRoomCode(roomCode);
    useGameStore.getState().setIsHost(true);
    useGameStore.getState().setRoomPlayers([initialPlayer]);

    // 3. Connect to Supabase Realtime Channel
    this.initSupabaseChannel(roomCode, initialPlayer);

    // 4. Also optionally announce to local Socket.IO server if running (non-blocking)
    this.tryConnectSocketIO(roomCode, initialPlayer);

    return roomCode;
  }

  // ==========================================================================
  // ROOM JOINING — Connect via 6-Character Room Code
  // ==========================================================================
  public async joinRoom(roomCode: string, username: string, kartId: string, kartColor: string): Promise<void> {
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
      isHost: false
    };

    // Update store state
    useGameStore.getState().setRoomCode(cleanCode);
    useGameStore.getState().setIsHost(false);
    useGameStore.getState().setRoomPlayers([joiningPlayer]);

    // Connect to Supabase Realtime Channel
    this.initSupabaseChannel(cleanCode, joiningPlayer);

    // Optional Socket.IO connection
    this.tryConnectSocketIO(cleanCode, joiningPlayer);
  }

  // ==========================================================================
  // SUPABASE REALTIME CHANNEL SETUP (Cloud-Native, High Availability)
  // ==========================================================================
  private initSupabaseChannel(roomCode: string, localPlayer: MultiplayerPlayer): void {
    const channelName = `kv_room_${roomCode}`;

    this.supabaseChannel = supabase.channel(channelName, {
      config: {
        presence: { key: this.localPlayerId },
        broadcast: { ack: false, self: false }
      }
    });

    // 1. Presence Sync: Synchronize roster whenever someone joins/leaves or changes state
    this.supabaseChannel.on('presence', { event: 'sync' }, () => {
      if (!this.supabaseChannel) return;
      const state = this.supabaseChannel.presenceState();
      const playerList: MultiplayerPlayer[] = [];
      const seen = new Set<string>();

      for (const key of Object.keys(state)) {
        const items = state[key] as any[];
        if (items && items.length > 0) {
          const p = items[items.length - 1]; // Latest presence packet
          if (!seen.has(p.id)) {
            seen.add(p.id);
            playerList.push({
              id: p.id,
              userId: p.userId || p.id,
              username: p.username || 'Racer',
              avatar: p.avatar || 'kart_racer_1',
              kartId: p.kartId || 'velocity_gt',
              kartColor: p.kartColor || '#00f0ff',
              isReady: !!p.isReady,
              isHost: !!p.isHost
            });
          }
        }
      }

      // Ensure local player is in the list
      if (!seen.has(localPlayer.id)) {
        playerList.push(localPlayer);
      }

      // Preserve active players during live race if presence temporarily drops
      const currentScreen = useGameStore.getState().currentScreen;
      if (['QUICK_RACE', 'GRAND_PRIX'].includes(currentScreen)) {
        const existing = useGameStore.getState().roomPlayers;
        for (const exp of existing) {
          if (!playerList.some(p => p.id === exp.id)) {
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

    // 2. Real-Time Track Selection Broadcast (Host -> All Players)
    this.supabaseChannel.on('broadcast', { event: 'track_selected' }, ({ payload }) => {
      if (payload && payload.trackId) {
        useGameStore.getState().setSelectedTrack(payload.trackId);
      }
    });

    // 3. Ready Toggle Broadcast
    this.supabaseChannel.on('broadcast', { event: 'player_ready' }, ({ payload }) => {
      if (payload && payload.id) {
        const current = useGameStore.getState().roomPlayers;
        const updated = current.map(p => (p.id === payload.id ? { ...p, isReady: payload.isReady } : p));
        useGameStore.getState().setRoomPlayers(updated);
      }
    });

    // 4. Synchronized Race Launch (Host -> All Players)
    this.supabaseChannel.on('broadcast', { event: 'start_race' }, ({ payload }) => {
      if (payload?.trackId) {
        useGameStore.getState().setSelectedTrack(payload.trackId);
      }
      useGameStore.getState().setRaceMode('MULTIPLAYER');
      useGameStore.getState().setScreen('QUICK_RACE');
      if (this.onRaceStart) this.onRaceStart();
    });

    // 5. Zero-Delay High-Frequency Telemetry Broadcast (25-30Hz)
    this.supabaseChannel.on('broadcast', { event: 'telemetry' }, ({ payload }) => {
      if (payload && payload.id !== this.localPlayerId) {
        // Record heartbeat timestamp from active telemetry
        this.lastHeartbeatMap.set(payload.id, Date.now());

        if (this.onRemoteTelemetry) {
          this.onRemoteTelemetry({
            playerId: payload.id,
            position: { x: payload.x, y: payload.y, z: payload.z },
            rotationY: payload.rotY,
            speed: payload.speed,
            driftLevel: payload.driftLevel || 0,
            pitch: 0,
            roll: 0,
            timestamp: Date.now()
          });
        }
      }
    });

    // 6. Reliable Heartbeat Broadcast Listener
    this.supabaseChannel.on('broadcast', { event: 'player_heartbeat' }, ({ payload }) => {
      if (payload && payload.id && payload.id !== this.localPlayerId) {
        this.lastHeartbeatMap.set(payload.id, Date.now());
      }
    });

    // 7. Explicit Player Departure Listener (Tab Close / Exit Race)
    this.supabaseChannel.on('broadcast', { event: 'player_left' }, ({ payload }) => {
      if (payload && payload.id && payload.id !== this.localPlayerId) {
        console.log(`[MULTIPLAYER] Inbound player_left notification: ${payload.id}, reason: ${payload.reason}`);
        this.lastHeartbeatMap.delete(payload.id);
        if (this.onPlayerLeft) {
          this.onPlayerLeft(payload.id, payload.reason || 'LEFT');
        }
      }
    });

    // 8. Power-Up Item Events
    this.supabaseChannel.on('broadcast', { event: 'use_item' }, ({ payload }) => {
      if (payload.senderId !== this.localPlayerId && this.onRemoteItemUse) {
        this.onRemoteItemUse({
          playerId: payload.senderId,
          itemType: payload.itemType,
          position: payload.originPos,
          direction: payload.direction || { x: 0, y: 0, z: 1 }
        });
      }
    });

    // Subscribe and track local presence with auto-reconnect
    this.supabaseChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && this.supabaseChannel) {
        await this.supabaseChannel.track(localPlayer);
        // Start continuous heartbeat & health monitoring
        this.startHeartbeat(localPlayer);
      } else if (['CLOSED', 'TIMED_OUT', 'CHANNEL_ERROR'].includes(status)) {
        console.warn(`[MULTIPLAYER] Channel disconnected (${status}). Auto-reconnecting in 2s...`);
        if (this.currentRoomCode && !this.isReconnecting) {
          this.isReconnecting = true;
          setTimeout(() => {
            this.isReconnecting = false;
            if (this.currentRoomCode && this.supabaseChannel) {
              this.supabaseChannel.subscribe();
            }
          }, 2000);
        }
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
    // Refresh channel presence so Supabase Realtime never times out the client
    this.supabaseChannel.track(localPlayer).catch(() => {});
    // Broadcast ping to all connected peers
    this.supabaseChannel.send({
      type: 'broadcast',
      event: 'player_heartbeat',
      payload: { id: this.localPlayerId, timestamp: Date.now() }
    }).catch(() => {});
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
      if (lastSeen && (now - lastSeen > 15000)) {
        console.warn(`[MULTIPLAYER] Player ${p.id} (${p.username}) timed out after 15s`);
        this.lastHeartbeatMap.delete(p.id);
        if (this.onPlayerLeft) {
          this.onPlayerLeft(p.id, 'TIMEOUT');
        }
      }
    }
  }

  public async leaveRace(reason: string = 'USER_EXIT'): Promise<void> {
    console.log(`[MULTIPLAYER] Leaving room/race: ${this.currentRoomCode}, reason: ${reason}`);
    this.stopHeartbeat();
    if (this.supabaseChannel) {
      try {
        await this.supabaseChannel.send({
          type: 'broadcast',
          event: 'player_left',
          payload: { id: this.localPlayerId, reason }
        });
        await this.supabaseChannel.untrack();
        // Brief 150ms delay to ensure WebSocket frame is dispatched before unsubscription
        await new Promise(r => setTimeout(r, 150));
      } catch (e) {
        // quiet catch
      }
    }
    this.disconnect();
  }

  // ==========================================================================
  // HOST & PLAYER CONTROLS
  // ==========================================================================
  public toggleReady(isReady: boolean): void {
    const currentList = useGameStore.getState().roomPlayers;
    const local = currentList.find(p => p.id === this.localPlayerId);
    if (local) {
      local.isReady = isReady;
      if (this.supabaseChannel) {
        this.supabaseChannel.track(local);
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'player_ready',
          payload: { id: this.localPlayerId, isReady }
        });
      }
    }
  }

  public setTrack(trackId: string): void {
    useGameStore.getState().setSelectedTrack(trackId);
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'track_selected',
        payload: { trackId }
      });
    }
  }

  public startRace(): void {
    const trackId = useGameStore.getState().selectedTrack;
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'start_race',
        payload: { trackId }
      });
    }
  }

  // ==========================================================================
  // REAL-TIME ZERO-DELAY TELEMETRY & ITEMS
  // ==========================================================================
  public sendTelemetry(telemetry: Omit<RemoteTelemetryPacket, 'playerId' | 'timestamp'>): void {
    const now = performance.now();
    // Throttle to ~30Hz (every 33ms) for smooth zero-lag synchronization
    if (now - this.lastTelemetryTime < 32) return;
    this.lastTelemetryTime = now;

    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'telemetry',
        payload: {
          id: this.localPlayerId,
          x: telemetry.position.x,
          y: telemetry.position.y,
          z: telemetry.position.z,
          rotY: telemetry.rotationY,
          speed: telemetry.speed,
          driftLevel: telemetry.driftLevel
        }
      }).then(res => {
        if (Math.random() < 0.05) {
          console.log(`[TELEMETRY_SEND] ${this.localPlayerId} result: ${res}`);
        }
      }).catch(err => {
        console.error(`[TELEMETRY_SEND_ERR] ${this.localPlayerId}`, err);
      });
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
          driftTier: telemetry.driftLevel
        }
      });
    }
  }

  public sendItemUse(itemType: PowerUpType, position: THREE.Vector3, direction: THREE.Vector3): void {
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'use_item',
        payload: {
          senderId: this.localPlayerId,
          itemType,
          originPos: { x: position.x, y: position.y, z: position.z },
          direction: { x: direction.x, y: direction.y, z: direction.z }
        }
      });
    }
  }

  // ==========================================================================
  // OPTIONAL SOCKET.IO SERVER HOOK (Non-blocking fallback)
  // ==========================================================================
  private tryConnectSocketIO(roomCode: string, player: MultiplayerPlayer): void {
    try {
      const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : (import.meta.env.VITE_SERVER_URL || '');
      if (!serverUrl || serverUrl.includes('localhost') && window.location.hostname !== 'localhost') return;

      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 2500,
        reconnectionAttempts: 2
      });

      this.socket.on('connect', () => {
        if (player.isHost) {
          this.socket?.emit('create_room', { ...player, trackId: useGameStore.getState().selectedTrack });
        } else {
          this.socket?.emit('join_room', { code: roomCode, ...player });
        }
      });
    } catch {
      // Quiet fallback - Supabase Realtime handles all communication
    }
  }

  public disconnect(): void {
    this.stopHeartbeat();
    this.lastHeartbeatMap.clear();
    const ch = this.supabaseChannel;
    this.supabaseChannel = null;
    this.currentRoomCode = null;
    if (ch) {
      ch.unsubscribe();
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketManager = SocketManager.getInstance();
if (typeof window !== 'undefined') {
  (window as any).__socketManager = socketManager;
}
