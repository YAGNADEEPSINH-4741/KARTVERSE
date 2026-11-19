import React, { useEffect, useRef } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronsUp,
  CornerUpLeft,
  Diamond,
  Octagon,
  Zap,
} from 'lucide-react';
import {
  resetTouchControls,
  touchControls,
  TouchInputState,
} from '../input/TouchControls';

type Action = keyof TouchInputState;
const controls = {
  steerLeft: [ArrowLeft, 'Left'],
  steerRight: [ArrowRight, 'Right'],
  accelerate: [ChevronsUp, 'Gas'],
  brake: [Octagon, 'Brake'],
  reverse: [ArrowDown, 'Reverse'],
  nitro: [Zap, 'Nitro'],
  drift: [CornerUpLeft, 'Drift'],
  useItem: [Diamond, 'Item'],
} as const;
function TouchButton({ action }: { action: Action }) {
  const owners = useRef(new Set<number>());
  const [Icon, label] = controls[action];
  function release(e: React.PointerEvent<HTMLButtonElement>) {
    owners.current.delete(e.pointerId);
    if (owners.current.size === 0) {
      touchControls[action] = false;
      e.currentTarget.removeAttribute('data-held');
    }
  }
  return (
    <button
      aria-label={label}
      className={'touch-key key-' + action}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        owners.current.add(e.pointerId);
        touchControls[action] = true;
        e.currentTarget.dataset.held = 'true';
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <Icon size={19} />
      <span>{label}</span>
    </button>
  );
}
export function MobileRaceHUD() {
  useEffect(() => {
    window.addEventListener('blur', resetTouchControls);
    document.addEventListener('visibilitychange', resetTouchControls);
    return () => {
      window.removeEventListener('blur', resetTouchControls);
      document.removeEventListener('visibilitychange', resetTouchControls);
      resetTouchControls();
    };
  }, []);
  return (
    <div className="touch-controls">
      <div className="touch-left">
        <div className="touch-row minor">
          <TouchButton action="drift" />
          <TouchButton action="reverse" />
        </div>
        <div className="touch-row">
          <TouchButton action="steerLeft" />
          <TouchButton action="steerRight" />
        </div>
      </div>
      <div className="touch-right">
        <div className="touch-row minor">
          <TouchButton action="useItem" />
          <TouchButton action="nitro" />
        </div>
        <div className="touch-row">
          <TouchButton action="brake" />
          <TouchButton action="accelerate" />
        </div>
      </div>
    </div>
  );
}
