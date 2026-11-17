// ============================================================================
// KARTVERSE — Client Real-Time Multiplayer Socket.IO Manager
// ============================================================================

import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
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
  private serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;

  public onRemoteTelemetry?: (packet: RemoteTelemetryPacket) => void;
  public onRemoteItemUse?: (data: { playerId: string; itemType: PowerUpType; position: any; direction: any }) => void;
  public onCountdownStart?: (countdown: number) => void;
  public onRaceStart?: () => void;

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  public connect(): void {
    if (this.socket && this.socket.connected) return;

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('Connected to Kartverse Multiplayer Server:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Multiplayer Server');
    });

+
        }
      }
    });

    this.socket.on('countdown_tick', (countdown: number) => {
      if (this.onCountdownStart) this.onCountdownStart(countdown);
      useGameStore.getState().setTelemetry({ countdownNumber: countdown });
    });

    this.socket.on('race_started', () => {
      useGameStore.getState().setRaceStatus('RACING');
      if (this.onRaceStart) this.onRaceStart();
    });

    // Telemetry updates from other racers
    this.socket.on('player_telemetry', (data: any) => {
      if (data.id !== this.socket?.id && this.onRemoteTelemetry) {
        this.onRemoteTelemetry({
          playerId: data.id,
          position: { x: data.x, y: data.y, z: data.z },
          rotationY: data.rotY,
          speed: data.speed,
          driftLevel: data.driftTier || 0,
          pitch: 0,
          roll: 0,
          timestamp: Date.now()
        });
      }
    });

    // Remote item events
    this.socket.on('item_spawned', (data: any) => {
      if (data.senderId !== this.socket?.id && this.onRemoteItemUse) {
        this.onRemoteItemUse({
          playerId: data.senderId,
          itemType: data.itemType,
          position: data.originPos || { x: 0, y: 0, z: 0 },
          direction: { x: 0, y: 0, z: 1 }
        });
      }
    });
  }

  public createRoom(username: string, kartId: string, kartColor: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.connect();
      this.socket?.emit('create_room', { username, kartId, kartColor }, (res: any) => {
        if (res && res.success && res.room) {
          useGameStore.getState().setRoomCode(res.room.code);
          useGameStore.getState().setIsHost(true);

          const players: MultiplayerPlayer[] = (res.room.players || []).map((p: any) => ({
            id: p.id,
            userId: p.userId,
            username: p.username,
            avatar: p.avatar,
            kartId: p.kartId,
            kartColor: p.kartColor,
            isReady: !!p.isReady,
            isHost: !!p.isHost
          }));
          useGameStore.getState().setRoomPlayers(players);
          resolve(res.room.code);
        } else {
          reject(new Error(res?.error || 'Failed to create room'));
        }
      });
    });
  }

  public joinRoom(roomCode: string, username: string, kartId: string, kartColor: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connect();
      this.socket?.emit('join_room', { code: roomCode, username, kartId, kartColor }, (res: any) => {
        if (res && res.success && res.room) {
          useGameStore.getState().setRoomCode(res.room.code);
          useGameStore.getState().setIsHost(false);

          const players: MultiplayerPlayer[] = (res.room.players || []).map((p: any) => ({
            id: p.id,
            userId: p.userId,
            username: p.username,
            avatar: p.avatar,
            kartId: p.kartId,
            kartColor: p.kartColor,
            isReady: !!p.isReady,
            isHost: !!p.isHost
          }));
          useGameStore.getState().setRoomPlayers(players);
          resolve();
        } else {
          reject(new Error(res?.error || 'Failed to join room'));
        }
      });
    });
  }

  public toggleReady(isReady: boolean): void {
    const roomCode = useGameStore.getState().roomCode;
    if (roomCode) {
      this.socket?.emit('toggle_ready', { code: roomCode, isReady });
    }
  }

  public setTrack(trackId: string): void {
    const roomCode = useGameStore.getState().roomCode;
    if (roomCode) {
      this.socket?.emit('select_track', { code: roomCode, trackId });
    }
  }

  public startRace(): void {
    const roomCode = useGameStore.getState().roomCode;
    if (roomCode) {
      this.socket?.emit('start_race', { code: roomCode });
    }
  }

  public sendTelemetry(telemetry: Omit<RemoteTelemetryPacket, 'playerId' | 'timestamp'>): void {
    if (!this.socket || !this.socket.connected) return;
    const roomCode = useGameStore.getState().roomCode;
    if (roomCode) {
      this.socket.emit('telemetry', {
        code: roomCode,
        data: {
          x: telemetry.position.x,
          y: telemetry.position.y,
          z: telemetry.position.z,
          rotY: telemetry.rotationY,
          speed: telemetry.speed,
          isDrifting: telemetry.driftLevel > 0,
          driftTier: telemetry.driftLevel,
          isBoosting: false
        }
      });
    }
  }

  public sendItemUse(itemType: PowerUpType, position: THREE.Vector3, direction: THREE.Vector3): void {
    const roomCode = useGameStore.getState().roomCode;
    if (roomCode) {
      this.socket?.emit('use_item', {
        code: roomCode,
        itemType,
        originPos: { x: position.x, y: position.y, z: position.z }
      });
    }
  }

  public getSocketId(): string | undefined {
    return this.socket?.id;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketManager = SocketManager.getInstance();
