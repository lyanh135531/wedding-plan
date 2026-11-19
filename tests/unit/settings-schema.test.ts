import { describe, expect, it } from 'vitest';
import { setupSchema } from '@/schemas/settings';

const input = { groomName: ' Chú rể ', brideName: 'Cô dâu', weddingDate: null, isUnconfirmedDate: true, estimatedDateNote: 'Cuối năm sau', categories: [] };
describe('Wedding setup validation', () => {
  it('keeps an unconfirmed date empty and trims names', () => {
    expect(setupSchema.parse(input)).toMatchObject({ groomName: 'Chú rể', weddingDate: null });
  });
  it('requires an actual calendar date when confirming', () => {
    expect(setupSchema.safeParse({ ...input, isUnconfirmedDate: false }).success).toBe(false);
    expect(setupSchema.safeParse({ ...input, isUnconfirmedDate: false, weddingDate: '2027-02-30' }).success).toBe(false);
    expect(setupSchema.safeParse({ ...input, isUnconfirmedDate: false, weddingDate: '2027-02-28' }).success).toBe(true);
  });
  it('rejects empty names and unconfirmed dates without a note', () => {
    expect(setupSchema.safeParse({ ...input, groomName: ' ' }).success).toBe(false);
    expect(setupSchema.safeParse({ ...input, estimatedDateNote: ' ' }).success).toBe(false);
  });
});
