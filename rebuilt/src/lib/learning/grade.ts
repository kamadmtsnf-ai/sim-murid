export function grade(value: number, kkm: number) {
  if (value < kkm) return "D";
  if (value >= kkm + (2 * (100 - kkm)) / 3) return "A";
  if (value >= kkm + (100 - kkm) / 3) return "B";
  return "C";
}
