import type { ExperienceSettings } from "@/types";

export const DEFAULT_EXPERIENCE_SETTINGS: ExperienceSettings = {
  masterSound: false,
  pointSound: true,
  gameSound: true,
  matchSound: true,
  championSound: true,
  volume: 35,
  animations: true,
  confetti: true,
  victoryCelebrations: true,
};

export type SoundEvent = "point" | "game" | "match" | "champion" | "undo";

export function normalizeExperienceSettings(value?: Partial<ExperienceSettings> | null): ExperienceSettings {
  return {
    ...DEFAULT_EXPERIENCE_SETTINGS,
    ...value,
    volume: Math.min(100, Math.max(0, Number(value?.volume ?? DEFAULT_EXPERIENCE_SETTINGS.volume))),
  };
}

export function playTournamentSound(kind: SoundEvent, settings: ExperienceSettings, locallyMuted = false, force = false) {
  if (typeof window === "undefined" || locallyMuted) return;
  const enabled = kind === "point" || kind === "undo"
    ? settings.pointSound
    : kind === "game"
      ? settings.gameSound
      : kind === "match"
        ? settings.matchSound
        : settings.championSound;
  if (!force && (!settings.masterSound || !enabled)) return;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const volume = Math.max(0.015, settings.volume / 100 * 0.13);
  const notes = soundNotes(kind);
  notes.forEach(([frequency, offset, duration], index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind === "point" || kind === "undo" ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + duration + 0.02);
    if (index === notes.length - 1) oscillator.addEventListener("ended", () => void context.close(), { once: true });
  });
}

function soundNotes(kind: SoundEvent): Array<[number, number, number]> {
  if (kind === "point") return [[620, 0, 0.09]];
  if (kind === "undo") return [[380, 0, 0.08]];
  if (kind === "game") return [[523, 0, 0.13], [659, 0.1, 0.18]];
  if (kind === "match") return [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.28]];
  return [[523, 0, 0.16], [659, 0.13, 0.16], [784, 0.26, 0.16], [1047, 0.39, 0.35]];
}
