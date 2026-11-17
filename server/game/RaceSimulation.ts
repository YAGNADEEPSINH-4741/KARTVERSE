// ============================================================================
// KARTVERSE MULTIPLAYER SERVER — Authoritative Race Simulation & Validation
// ============================================================================

import { GameRoom, NetworkPlayer } from '../rooms/RoomManager';

export class RaceSimulation {
  // Sort players by race position based on lap progress and checkpoint index
  public static updatePositions(room: GameRoom): NetworkPlayer[] {
    const list = Array.from(room.players.values());

    list.sort((a, b) => {
      // 1. Finished players come first ordered by finish time
      if (a.finished && b.finished) {
        return a.finishTime - b.finishTime;
      }
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;

      // 2. Ordered by lap count
      if (b.currentLap !== a.currentLap) {
        return b.currentLap - a.currentLap;
      }

      // 3. Ordered by checkpoint progression
      if (b.checkpointIndex !== a.checkpointIndex) {
        return b.checkpointIndex - a.checkpointIndex;
      }

      // 4. Ordered by race distance
      return b.raceDistance - a.raceDistance;
    });

    // Assign positions 1st, 2nd, etc.
    list.forEach((p, idx) => {
      p.position = idx + 1;
    });

    return list;
  }

  // Validate player lap completion
  public static handleCheckpoint(
    player: NetworkPlayer,
    checkpointIndex: number,
    totalCheckpoints: number,
    totalLaps: number
  ): { lapCompleted: boolean; raceFinished: boolean } {
    let lapCompleted = false;
    let raceFinished = false;

    // Checkpoint sequential validation (prevent skip / backward abuse)
    const expected = (player.checkpointIndex + 1) % totalCheckpoints;
    if (checkpointIndex === expected || (player.checkpointIndex === 0 && checkpointIndex === 1)) {
      player.checkpointIndex = checkpointIndex;

      // Finish line passed
      if (checkpointIndex === 0 && player.checkpointIndex !== 0) {
        player.currentLap++;
        lapCompleted = true;

        if (player.currentLap > totalLaps) {
          player.finished = true;
          player.finishTime = Date.now();
          raceFinished = true;
        }
      }
    }

    return { lapCompleted, raceFinished };
  }
}

