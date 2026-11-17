// ============================================================================
// KARTVERSE — Dual-Client Real-Time Multiplayer Integration Test
// ============================================================================

import { io } from 'socket.io-client';

async function runMultiplayerTest() {
  console.log('🏁 Starting KARTVERSE Dual-Client Multiplayer Test...\n');

  const serverUrl = 'http://localhost:3001';

  // 1. Connect Client A (Host)
  const clientA = io(serverUrl, { transports: ['websocket'] });
  // 2. Connect Client B (Challenger)
  const clientB = io(serverUrl, { transports: ['websocket'] });

  await new Promise<void>((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    clientA.on('connect', () => {
      console.log('✅ Client A connected (Socket ID:', clientA.id, ')');
      check();
    });
    clientB.on('connect', () => {
      console.log('✅ Client B connected (Socket ID:', clientB.id, ')');
      check();
    });
  });

  // 3. Client A creates a room
  console.log('\n--- Step 1: Client A creates room ---');
  let roomCode = '';
  await new Promise<void>((resolve, reject) => {
    clientA.emit(
      'create_room',
      { username: 'SpeedKing', kartId: 'speed_demon', kartColor: '#ff3b30' },
      (res: any) => {
        if (res.success && res.room) {
          roomCode = res.room.code;
          console.log(`✅ Room successfully created! Code: ${roomCode}`);
          console.log(`   Host ID: ${res.room.hostId}, Track: ${res.room.trackId}`);
          resolve();
        } else {
          reject(new Error(res.error || 'Failed to create room'));
        }
      }
    );
  });

  // 4. Client B joins the room
  console.log('\n--- Step 2: Client B joins room ---');
  await new Promise<void>((resolve, reject) => {
    clientB.emit(
      'join_room',
      { code: roomCode, username: 'DriftQueen', kartId: 'cyber_glider', kartColor: '#00f0ff' },
      (res: any) => {
        if (res.success && res.room) {
          console.log(`✅ Client B joined room ${roomCode}!`);
          console.log(`   Roster size: ${res.room.players.length} players`);
          resolve();
        } else {
          reject(new Error(res.error || 'Failed to join room'));
        }
      }
    );
  });

  // 5. Client B toggles ready
  console.log('\n--- Step 3: Client B toggles ready ---');
  await new Promise<void>((resolve) => {
    const onRoomUpdated = (room: any) => {
      const pB = room.players.find((p: any) => p.id === clientB.id);
      if (pB && pB.isReady) {
        console.log('✅ Client A received room_updated: Client B is READY!');
        clientA.off('room_updated', onRoomUpdated);
        resolve();
      }
    };
    clientA.on('room_updated', onRoomUpdated);
    clientB.emit('toggle_ready', { code: roomCode, isReady: true });
  });

  // 6. Client A selects track "neon_city"
  console.log('\n--- Step 4: Host selects circuit ---');
  await new Promise<void>((resolve) => {
    const onTrackUpdated = (room: any) => {
      if (room.trackId === 'neon_city') {
        console.log('✅ Client B received track change: neon_city');
        clientB.off('room_updated', onTrackUpdated);
        resolve();
      }
    };
    clientB.on('room_updated', onTrackUpdated);
    clientA.emit('select_track', { code: roomCode, trackId: 'neon_city' });
  });

  // 7. Client A launches race (Countdown & Start)
  console.log('\n--- Step 5: Host starts race ---');
  await new Promise<void>((resolve) => {
    clientB.on('countdown_tick', (count: number) => {
      console.log(`   ⏱️ Countdown tick: ${count}`);
    });

    clientB.once('race_started', () => {
      console.log('✅ Client B received race_started event!');
      resolve();
    });

    clientA.emit('start_race', { code: roomCode });
  });

  // 8. High-frequency telemetry sync test
  console.log('\n--- Step 6: 20Hz Telemetry Synchronization ---');
  await new Promise<void>((resolve) => {
    clientB.once('player_telemetry', (data: any) => {
      console.log('✅ Client B received telemetry from Client A:');
      console.log(`   Position: (${data.x}, ${data.y}, ${data.z}), Speed: ${data.speed} km/h, RotY: ${data.rotY}`);
      resolve();
    });

    clientA.emit('telemetry', {
      code: roomCode,
      data: {
        x: 124.5,
        y: 2.1,
        z: -48.2,
        rotY: 1.57,
        speed: 118,
        isDrifting: true,
        driftTier: 2,
        isBoosting: false,
        currentLap: 1,
        checkpointIndex: 3,
        raceDistance: 320
      }
    });
  });

  // 9. Power-Up Item Use & Hit synchronization
  console.log('\n--- Step 7: Power-Up Item Usage & Hit Synchronization ---');
  await new Promise<void>((resolve) => {
    clientB.once('item_spawned', (data: any) => {
      console.log('✅ Client B received item_spawned:');
      console.log(`   Item: ${data.itemType}, Sender: ${data.senderId}`);
      resolve();
    });

    clientA.emit('use_item', {
      code: roomCode,
      itemType: 'HOMING_ORB',
      originPos: { x: 124.5, y: 2.1, z: -48.2 }
    });
  });

  // Cleanup
  clientA.disconnect();
  clientB.disconnect();

  console.log('\n🎉 ALL MULTIPLAYER TESTS PASSED SUCCESSFULLY! 🏆\n');
  process.exit(0);
}

runMultiplayerTest().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
