import type { Team } from "@/types";

const doubles = [
  ["T01", "Arctic Hunter"], ["T02", "Drop Shot Duo"], ["T03", "Smashers"],
  ["T04", "LM Drops"], ["T05", "Infra boys"], ["T06", "Crunch & Munch"],
  ["T07", "JustDoIt"], ["T08", "integrated collection"], ["T09", "Smash Bros"],
  ["T10", "Fault in our serves"], ["T11", "Drop Shot Devils"], ["T12", "Micromanagers"],
  ["T13", "Pimpri Boys"], ["T14", "Error 404: Skills Not Found"], ["T15", "Pacific Hunter"],
  ["T16", "Blitz"], ["T17", "Warriors"], ["T18", "Drop Shot Specialists"],
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
