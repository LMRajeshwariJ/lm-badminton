import type { Team } from "@/types";

const doubles = [
  ["T01", "Arctic Hunter"], ["T02", "Drop Shot Duo"], ["T03", "Smashers"],
  ["T04", "LM Drops"], ["T05", "Infra Boys"], ["T06", "JustDoIt"],
  ["T07", "Smash Bros"], ["T08", "Fault in Our Serves"], ["T09", "Drop Shot Devils"],
  ["T10", "Micromanagers"], ["T11", "Crunch & Munch"], ["T12", "Pimpri Boys"],
  ["T13", "Pacific Hunter"], ["T14", "Integrated Collection"], ["T15", "Blitz"],
  ["T16", "Drop Shot Specialists"],
] as const;

const singles = [
  ["WS01", "Shubhashri"], ["WS02", "Apurva"], ["WS03", "Ashwini Tanpure"],
  ["WS04", "Bandana Kaur Cheema"], ["WS05", "Moulika Kulkarni"], ["WS06", "Gauri Dhengekar"],
  ["WS07", "Nikita Borgaonkar"], ["WS08", "Shruti Mishra"], ["WS09", "Videhi Bavishi"],
] as const;

export const teams: Team[] = [
  ...doubles.map(([id, name], index) => ({ id, name, category: "mixed-doubles" as const, playerIds: [`${id}-P1`, `${id}-P2`], seed: index + 1 })),
  ...singles.map(([id, name], index) => ({ id, name, category: "womens-singles" as const, playerIds: [`${id}-P1`], seed: index + 1 })),
];
