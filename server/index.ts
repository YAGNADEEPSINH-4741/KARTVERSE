// ============================================================================
// KARTVERSE REAL-TIME MULTIPLAYER SERVER (Node.js + Socket.IO)
// ============================================================================

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomManager } from './rooms/RoomManager';
import { RaceSimulation } from './game/RaceSimulation';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'KARTVERSE Multiplayer Engine' });
});

io.on('connection', (socket) => {
  console.log(`[CONNECT] Socket connected: ${socket.id}`);

  // 1. Create Room
  socket.on('create_room', (data, callback) => {
    try {
      const room = roomManager.createRoom({
        id: socket.id,
        userId: data.userId || `guest_${socket.id.slice(0, 5)}`,
        username: data.username || 'Racer',
        avatar: data.avatar || 'kart_racer_1',
        kartId: data.kartId || 'velocity_gt',
        kartColor: data.kartColor || '#ff0055',
        ping: 0
      }, data.trackId || 'sunset_coast');

      socket.join(room.code);
      console.log(`[ROOM CREATED] Code: ${room.code} by ${data.username}`);
      callback({ success: true, room: roomManager.serializeRoom(room) });
    } catch (e: any) {
      callback({ success: false, error: e.message });
    }
  });

  // 2. Join Room
  socket.on('join_room', (data, callback) => {
    try {
      const res = roomManager.joinRoom(data.code, {
        id: socket.id,
        userId: data.userId || `guest_${socket.id.slice(0, 5)}`,
        username: data.username || 'Racer',
        avatar: data.avatar || 'kart_racer_1',
        kartId: data.kartId || 'velocity_gt',
        kartColor: data.kartColor || '#00f0ff',
        ping: 0
      });

      if (!res.success || !res.room) {
        callback({ success: false, error: res.error });
        return;
      }

      socket.join(res.room.code);
      console.log(`[PLAYER JOINED] ${data.username} joined room ${res.room.code}`);

      const serialized = roomManager.serializeRoom(res.room);
      callback({ success: true, room: serialized });

      // Notify other players in room
      socket.to(res.room.code).emit('room_updated', serialized);
    } catch (e: any) {
      callback({ success: false, error: e.message });
    }
  });

  // 3. Ready Toggle
  socket.on('toggle_ready', ({ code, isReady }) => {
    const room = roomManager.getRoom(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) {
      player.isReady = isReady;
      io.to(code).emit('room_updated', roomManager.serializeRoom(room));
    }
  });

  // 4. Kart Selection
  socket.on('select_kart', ({ code, kartId, color }) => {
    const room = roomManager.getRoom(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) {
      if (kartId) player.kartId = kartId;
      if (color) player.kartColor = color;
      io.to(code).emit('room_updated', roomManager.serializeRoom(room));
    }
  });

  // 5. Track Selection (Host only)
  socket.on('select_track', ({ code, trackId }) => {
    const room = roomManager.getRoom(code);
    if (!room || room.hostId !== socket.id) return;
    room.trackId = trackId;
    io.to(code).emit('room_updated', roomManager.serializeRoom(room));
  });

  // 6. Start Race (Host only)
  socket.on('start_race', ({ code }) => {
    const room = roomManager.getRoom(code);
    if (!room || room.hostId !== socket.id) return;

    room.status = 'COUNTDOWN';
    io.to(code).emit('race_starting', {
      trackId: room.trackId,
      players: Array.from(room.players.values())
    });

    // Synchronized Countdown (3.. 2.. 1.. GO!)
    let count = 3;
    const interval = setInterval(() => {
      io.to(code).emit('countdown_tick', count);
      count--;
      if (count < 0) {
        clearInterval(interval);
        room.status = 'RACING';
        room.startTime = Date.now();
        io.to(code).emit('race_started');
      }
    }, 1000);
  });

  // 7. High-frequency telemetry sync
  socket.on('telemetry', ({ code, data }) => {
    const room = roomManager.getRoom(code);
    if (!room || room.status !== 'RACING') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // Update player state
    player.x = data.x;
    player.y = data.y;
    player.z = data.z;
    player.rotY = data.rotY;
    player.speed = data.speed;
    player.isDrifting = data.isDrifting;
    player.driftTier = data.driftTier;
    player.isBoosting = data.isBoosting;
    player.currentLap = data.currentLap;
    player.checkpointIndex = data.checkpointIndex;
    player.raceDistance = data.raceDistance;

    // Relay telemetry to others
    socket.to(code).emit('player_telemetry', {
      id: socket.id,
      ...data
    });
  });

  // 8. Power-Up Item Use
  socket.on('use_item', ({ code, itemType, targetId, originPos }) => {
    io.to(code).emit('item_spawned', {
      senderId: socket.id,
      itemType,
      targetId,
      originPos,
      timestamp: Date.now()
    });
  });

  // 9. Item Hit Event
  socket.on('item_hit', ({ code, targetId, itemType }) => {
    io.to(code).emit('player_hit', {
      targetId,
      itemType
    });
  });

  // 10. Checkpoint & Lap event
  socket.on('checkpoint_passed', ({ code, checkpointIndex, totalCheckpoints, totalLaps }) => {
    const room = roomManager.getRoom(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;

    const result = RaceSimulation.handleCheckpoint(player, checkpointIndex, totalCheckpoints, totalLaps);

    if (result.lapCompleted) {
      io.to(code).emit('player_lap', {
        id: socket.id,
        lap: player.currentLap
      });
    }

    if (result.raceFinished) {
      io.to(code).emit('player_finished', {
        id: socket.id,
        username: player.username,
        position: player.position,
        finishTime: (player.finishTime - room.startTime) / 1000
      });

      // Check if all finished
      const allFinished = Array.from(room.players.values()).every(p => p.finished);
      if (allFinished) {
        room.status = 'FINISHED';
        io.to(code).emit('race_completed', {
          results: Array.from(room.players.values()).map(p => ({
            id: p.id,
            username: p.username,
            position: p.position,
            kartId: p.kartId,
            time: (p.finishTime - room.startTime) / 1000
          }))
        });
      }
    }

    // Broadcast updated positions
    const sorted = RaceSimulation.updatePositions(room);
    io.to(code).emit('standings_updated', sorted.map(p => ({ id: p.id, position: p.position })));
  });

  // 11. Disconnect
  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] Socket disconnected: ${socket.id}`);
    const res = roomManager.removePlayer(socket.id);
    if (res.room) {
      io.to(res.room.code).emit('player_left', {
        id: socket.id,
        room: roomManager.serializeRoom(res.room)
      });
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🏁 KARTVERSE Multiplayer Server active on http://localhost:${PORT}`);
});

