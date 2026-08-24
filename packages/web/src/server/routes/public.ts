import { Router, type NextFunction, type Request, type Response } from 'express';
import { getCurrentMonthJST, getNowISO, isValidYearMonth } from '@warikan/shared';
import { getDb } from '../db.js';
import { ensureMonthOpen, getOrCreateMonth } from '../month-service.js';

const router: ReturnType<typeof Router> = Router();

/**
 * 外部クライアントから割り勘の支出を1件登録する。
 *
 * POST /api/public/expenses
 * {
 *   "user_id": 1,
 *   "description": "食費",
 *   "amount": 3000,
 *   "year_month": "2026-08", // 任意（省略時はJSTの当月）
 *   "note": "週末の買い物" // 任意
 * }
 */
router.post('/expenses', (req: Request, res: Response, next: NextFunction) => {
  const { user_id, description, amount, note, year_month } = req.body ?? {};
  const yearMonth = year_month ?? getCurrentMonthJST();

  if (!isValidYearMonth(yearMonth)) {
    res.status(400).json({ error: 'invalid year_month (expected YYYY-MM)' });
    return;
  }
  if (!Number.isInteger(user_id)) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }
  if (typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ error: 'description is required' });
    return;
  }
  if (!Number.isSafeInteger(amount) || amount < 0) {
    res.status(400).json({ error: 'amount must be a non-negative integer' });
    return;
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    res.status(400).json({ error: 'note must be a string or null' });
    return;
  }

  try {
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id) as
      | { id: number }
      | undefined;
    if (!user) {
      res.status(404).json({ error: 'user not found' });
      return;
    }

    // 外部利用者は月の初期化を意識しなくてよい。固定費の自動投入もここで行う。
    const month = getOrCreateMonth(db, yearMonth);
    ensureMonthOpen(month);
    const maxOrder = (
      db
        .prepare(
          'SELECT COALESCE(MAX(sort_order), -1) AS m FROM expenses WHERE month_id = ? AND user_id = ?',
        )
        .get(month.id, user_id) as { m: number }
    ).m;
    const info = db
      .prepare(
        `INSERT INTO expenses (month_id, user_id, description, amount, note, is_fixed, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        month.id,
        user_id,
        description.trim(),
        amount,
        note ?? null,
        maxOrder + 1,
        getNowISO(),
      );
    const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(expense);
  } catch (e) {
    next(e);
  }
});

export default router;
