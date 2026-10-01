/** A number as two digits: "07", "14". Longer numbers stay as they are. */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
