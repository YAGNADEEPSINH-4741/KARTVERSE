// ============================================================================
// KARTVERSE — Mobile & Tablet On-Screen Touch Controls State Bridge
// Handles Multi-Touch Steering, Speed (Gas), Brake, Reverse, Nitro & Items
// ============================================================================

export interface TouchInputState {
  steerLeft: boolean;
  steerRight: boolean;
  accelerate: boolean;
  brake: boolean;
  reverse: boolean;
  nitro: boolean;
  drift: boolean;
  useItem: boolean;
}

export const touchControls: TouchInputState = {
  steerLeft: false,
  steerRight: false,
  accelerate: false,
  brake: false,
  reverse: false,
  nitro: false,
  drift: false,
  useItem: false
};

if (typeof window !== 'undefined') {
  (window as any).touchControls = touchControls;
}

// Reset all touch inputs on screen switch / pause
export function resetTouchControls(): void {
  touchControls.steerLeft = false;
  touchControls.steerRight = false;
  touchControls.accelerate = false;
  touchControls.brake = false;
  touchControls.reverse = false;
  touchControls.nitro = false;
  touchControls.drift = false;
  touchControls.useItem = false;
}
