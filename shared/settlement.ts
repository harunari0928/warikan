export type SettlementParty = {
  userId: number;
  income: number;
  expense: number;
};

export type SettlementResult = {
  amount: number;
  fromUserId: number | null;
  toUserId: number | null;
};

/**
 * Two-party settlement: split so that each ends with the same leftover (income - expense - transfer).
 *
 * For parties A (first) and B (second):
 *   incomeA - expenseA - x === incomeB - expenseB + x
 *   → x = (incomeA + expenseB - incomeB - expenseA) / 2
 *
 * - x > 0: A pays B amount x
 * - x < 0: B pays A amount |x|
 * - x = 0: settled
 */
export function calculateSettlement(a: SettlementParty, b: SettlementParty): SettlementResult {
  const x = Math.round((a.income + b.expense - b.income - a.expense) / 2);
  if (x > 0) return { amount: x, fromUserId: a.userId, toUserId: b.userId };
  if (x < 0) return { amount: -x, fromUserId: b.userId, toUserId: a.userId };
  return { amount: 0, fromUserId: null, toUserId: null };
}
