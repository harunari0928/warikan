export function getTodayJST(): string {
  if (process.env.TEST_TODAY) return process.env.TEST_TODAY;
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

export function getCurrentMonthJST(): string {
  return getTodayJST().slice(0, 7);
}

export function isValidYearMonth(yyyymm: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(yyyymm);
}

export function getNowISO(): string {
  if (process.env.TEST_NOW) return process.env.TEST_NOW;
  return new Date().toISOString();
}
