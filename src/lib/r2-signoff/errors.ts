export class R2VerificationFailedError extends Error {
  readonly statusCode = 422;
  readonly code = 'R2_VERIFICATION_FAILED';
  readonly failedChecks: string[];

  constructor(failedChecks: string[]) {
    super(`Nghiệm thu cột mốc R2 không đạt. Các cổng chưa thỏa mãn: ${failedChecks.join(', ')}`);
    this.name = 'R2VerificationFailedError';
    this.failedChecks = failedChecks;
  }
}
