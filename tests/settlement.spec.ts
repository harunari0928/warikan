import { test, expect } from '@playwright/test';
import { calculateSettlement } from '@warikan/shared';

test.describe('割勘ロジック', () => {
  test('夫が多く稼ぎ、妻が多く支出した場合、夫が妻に払う', () => {
    const r = calculateSettlement(
      { userId: 1, income: 300000, expense: 120000 },
      { userId: 2, income: 400000, expense: 35000 },
    );
    expect(r.amount).toBe(92500);
    expect(r.fromUserId).toBe(2);
    expect(r.toUserId).toBe(1);
  });

  test('同額の手取り・支出なら精算不要', () => {
    const r = calculateSettlement(
      { userId: 1, income: 300000, expense: 50000 },
      { userId: 2, income: 300000, expense: 50000 },
    );
    expect(r.amount).toBe(0);
    expect(r.fromUserId).toBeNull();
    expect(r.toUserId).toBeNull();
  });

  test('妻が多く稼ぎ夫が多く支出すると、夫が妻に払う', () => {
    const r = calculateSettlement(
      { userId: 1, income: 500000, expense: 50000 },
      { userId: 2, income: 300000, expense: 200000 },
    );
    // (500000 + 200000 - 300000 - 50000) / 2 = 175000 → wife pays husband
    expect(r.amount).toBe(175000);
    expect(r.fromUserId).toBe(1);
    expect(r.toUserId).toBe(2);
  });
});
