// ============================================================================
// KARTVERSE MULTIPLAYER SERVER — Room & Lobby Manager
// ============================================================================

export interface NetworkPlayer {
  id: string; // Socket ID
  userId: string;
  username: string;
  avatar: string;
  kartId: string;
  kartColor: string;
  isReady: boolean;
  isHost: boolean;
  ping: number;

  // Race State
  x: number;
  y: number;
  z: number;
  rotY: number;
  speed: number;
  isDrifting: boolean;
  driftTier: number;
  isBoosting: boolean;
  currentLap: number;
  checkpointIndex: number;
  raceDistance: number;
  position: number;
  finished: boolean;
  finishTime: number;
}

export interface GameRoom {
  code: string;
  hostId: string;
  trackId: string;
  maxPlayers: number;
  status: 'LOBBY' | 'COUNTDOWN' | 'RACING' | 'FINISHED';
  players: Map<string, NetworkPlayer>;
  startTime: number;
  laps: number;
  createdAt: number;
}

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();

  // Generate 6-character room code (e.g. KV89RT)
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  public createRoom(hostPlayer: Omit<NetworkPlayer, 'isHost' | 'isReady' | 'finished' | 'finishTime' | 'currentLap' | 'checkpointIndex' | 'raceDistance' | 'position' | 'x' | 'y' | 'z' | 'rotY' | 'speed' | 'isDrifting' | 'driftTier' | 'isBoosting'>, trackId = 'sunset_coast'): GameRoom {
    const code = this.generateRoomCode();
    const player: NetworkPlayer = {
      ...hostPlayer,
      isHost: true,
      isReady: true,
      finished: false,
      finishTime: 0,
      currentLap: 1,
      checkpointIndex: 0,
      raceDistance: 0,
      position: 1,
      x: 0,
      y: 0,
      z: 0,
      rotY: 0,
      speed: 0,
      isDrifting: false,
      driftTier: 0,
      isBoosting: false
    };

    const room: GameRoom = {
      code,
      hostId: player.id,
      trackId,
      maxPlayers: 8,
      status: 'LOBBY',
      players: new Map([[player.id, player]]),
      startTime: 0,
      laps: 3,
      createdAt: Date.now()
    };

    this.rooms.set(code, room);
    return room;
  }

  public getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  public joinRoom(code: string, newPlayer: Omit<NetworkPlayer, 'isHost' | 'isReady' | 'finished' | 'finishTime' | 'currentLap' | 'checkpointIndex' | 'raceDistance' | 'position' | 'x' | 'y' | 'z' | 'rotY' | 'speed' | 'isDrifting' | 'driftTier' | 'isBoosting'>): { success: boolean; error?: string; room?: GameRoom } {
    const room = this.getRoom(code);
    if (!room) {
      return { success: false, error: 'Room not found. Check code.' };
    }
    if (room.status !== 'LOBBY') {
      return { success: false, error: 'Race is already in progress.' };
    }
    if (room.players.size >= room.maxPlayers) {
      return { success: false, error: 'Room is full (max 8 players).' };
    }

    const player: NetworkPlayer = {
      ...newPlayer,
      isHost: false,
      isReady: false,
      finished: false,
      finishTime: 0,
      currentLap: 1,
      checkpointIndex: 0,
      raceDistance: 0,
      position: room.players.size + 1,
      x: 0,
      y: 0,
      z: 0,
      rotY: 0,
      speed: 0,
      isDrifting: false,
      driftTier: 0,
      isBoosting: false
    };

    room.players.set(player.id, player);
    return { success: true, room };
  }

  public removePlayer(socketId: string): { room?: GameRoom; wasHost: boolean; roomDeleted: boolean } {
    for (const [code, room] of this.rooms.entries()) {
      if (room.players.has(socketId)) {
        const wasHost = room.hostId === socketId;
        room.players.delete(socketId);

        if (room.players.size === 0) {
          this.rooms.delete(code);
          return { wasHost, roomDeleted: true };
        }

        // If host left, assign host to next player
        if (wasHost) {
          const nextHost = room.players.values().next().value;
          if (nextHost) {
            nextHost.isHost = true;
            nextHost.isReady = true;
            room.hostId = nextHost.id;
          }
        }

        return { room, wasHost, roomDeleted: false };
      }
    }
    return { wasHost: false, roomDeleted: false };
  }

  public serializeRoom(room: GameRoom) {
    return {
      code: room.code,
      hostId: room.hostId,
      trackId: room.trackId,
      maxPlayers: room.maxPlayers,
      status: room.status,
      laps: room.laps,
      players: Array.from(room.players.values())
    };
  }
}

