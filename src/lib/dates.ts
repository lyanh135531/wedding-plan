/** Business dates are Vietnamese calendar days, independently of the server's TZ. */
export function weddingDateKey(value: Date | string): string {
  return new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function endOfWeddingDay(date: string): Date {
  return new Date(`${date}T23:59:59.999+07:00`);
}
