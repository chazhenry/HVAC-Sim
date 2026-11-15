import type { TrainingTrack } from "./catalog";

/** The three training modes on the menu, in order. */
export const tracks: Array<{
  id: TrainingTrack;
  title: string;
  detail: string;
}> = [
  {
    id: "residential",
    title: "Residential troubleshooting",
    detail: "Equipment and service calls",
  },
  {
    id: "epa",
    title: "EPA 608 preparation",
    detail: "Refrigerant practice and exams",
  },
  {
    id: "nate",
    title: "NATE preparation",
    detail: "Selected CHP-5 objectives",
  },
];
