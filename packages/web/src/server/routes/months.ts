import { Router, type Request, type Response, type NextFunction } from 'express';
import { getDb } from '../db.js';
import {
  loadMonthSnapshot,
  getMonthRowOr404,
  ensureMonthOpen,
} from '../month-service.js';
import { getNowISO, isValidYearMonth } from '@warikan/shared';

const router: ReturnType<typeof Router> = Router();

function ymOr400(req: Request, res: Response): string | null {
  const ym = String(req.params.yyyymm ?? '');
  if (!isValidYearMonth(ym)) {
    res.status(400).json({ error: 'invalid year_month (expected YYYY-MM)' });
    return null;
  }
  return ym;
}

router.get('/:yyyymm', (req: Request, res: Response, next: NextFunction) => {
  const ym = ymOr400(req, res);
  if (!ym) return;
  try {
    const snapshot = loadMonthSnapshot(getDb(), ym);
    res.json(snapshot);
  } catch (e) {
    next(e);
  }
});

router.post('/:yyyymm/close', (req: Request, res: Response, next: NextFunction) => {
  const ym = ymOr400(req, res);
  if (!ym) return;
  try {
    const db = getDb();
    const month = getMonthRowOr404(db, ym);
    db.prepare('UPDATE months SET is_closed = 1, closed_at = ? WHERE id = ?').run(
      getNowISO(),
      month.id,
    );
    // 精算不要（送金なし）の月は締めた時点で送金完了とみなし、自動で精算済みにする
    const snapshot = loadMonthSnapshot(db, ym);
    if (snapshot.settlement.amount === 0 && !snapshot.month.settlement_paid) {
      db.prepare('UPDATE months SET settlement_paid = 1, settlement_paid_at = ? WHERE id = ?').run(
        getNowISO(),
        month.id,
      );
      res.json(loadMonthSnapshot(db, ym));
      return;
    }
    res.json(snapshot);
  } catch (e) {
    next(e);
  }
});

router.post('/:yyyymm/open', (req: Request, res: Response, next: NextFunction) => {
  const ym = ymOr400(req, res);
  if (!ym) return;
  try {
    const db = getDb();
    const month = getMonthRowOr404(db, ym);
    db.prepare('UPDATE months SET is_closed = 0, closed_at = NULL WHERE id = ?').run(month.id);
    res.json(loadMonthSnapshot(db, ym));
  } catch (e) {
    next(e);
  }
});

router.put('/:yyyymm/settlement-paid', (req: Request, res: Response, next: NextFunction) => {
  const ym = ymOr400(req, res);
  if (!ym) return;
  const { paid } = req.body ?? {};
  if (typeof paid !== 'boolean') {
    res.status(400).json({ error: 'paid must be boolean' });
    return;
  }
  try {
    const db = getDb();
    const month = getMonthRowOr404(db, ym);
    // 月を締めるまで精算済みフラグは変更できない
    if (month.is_closed !== 1) {
      res.status(409).json({ error: 'month must be closed before settlement can be marked paid' });
      return;
    }
    db.prepare(
      'UPDATE months SET settlement_paid = ?, settlement_paid_at = ? WHERE id = ?',
    ).run(paid ? 1 : 0, paid ? getNowISO() : null, month.id);
    res.json(loadMonthSnapshot(db, ym));
  } catch (e) {
    next(e);
  }
});

router.put('/:yyyymm/incomes/:userId', (req: Request, res: Response, next: NextFunction) => {
  const ym = ymOr400(req, res);
  if (!ym) return;
  const userId = Number(req.params.userId);
  const { amount } = req.body ?? {};
  if (!Number.isFinite(amount) || amount < 0) {
    res.status(400).json({ error: 'amount must be a non-negative number' });
    return;
  }
  try {
    const db = getDb();
    const month = getMonthRowOr404(db, ym);
    ensureMonthOpen(month);
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as
      | { id: number }
      | undefined;
    if (!user) {
      res.status(404).json({ error: 'user not found' });
      return;
    }
    db.prepare(
      `INSERT INTO monthly_incomes (month_id, user_id, amount) VALUES (?, ?, ?)
       ON CONFLICT(month_id, user_id) DO UPDATE SET amount = excluded.amount`,
    ).run(month.id, userId, Math.round(amount));
    res.json(loadMonthSnapshot(db, ym));
  } catch (e) {
    next(e);
  }
});

router.get('/:yyyymm/expenses', (req: Request, res: Response, next: NextFunction) => {
  const ym = ymOr400(req, res);
  if (!ym) return;
  try {
    const db = getDb();
    const month = getMonthRowOr404(db, ym);
    const rows = db
      .prepare(
        `SELECT * FROM expenses WHERE month_id = ? ORDER BY user_id ASC, sort_order ASC, id ASC`,
      )
      .all(month.id);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/:yyyymm/expenses', (req: Request, res: Response, next: NextFunction) => {
  const ym = ymOr400(req, res);
  if (!ym) return;
  const { user_id, description, amount, note } = req.body ?? {};
  if (!Number.isInteger(user_id)) {
    res.status(400).json({ error: 'user_id is required' });
    return;
  }
  if (typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ error: 'description is required' });
    return;
  }
  if (!Number.isFinite(amount) || amount < 0) {
    res.status(400).json({ error: 'amount must be a non-negative number' });
    return;
  }
  try {
    const db = getDb();
    const month = getMonthRowOr404(db, ym);
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
      .run(month.id, user_id, description.trim(), Math.round(amount), note ?? null, maxOrder + 1, getNowISO());
    const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

router.patch('/:yyyymm/expenses/:id', (req: Request, res: Response, next: NextFunction) => {
  const ym = ymOr400(req, res);
  if (!ym) return;
  const id = Number(req.params.id);
  const { description, amount, note } = req.body ?? {};
  try {
    const db = getDb();
    const month = getMonthRowOr404(db, ym);
    ensureMonthOpen(month);
    const existing = db
      .prepare('SELECT * FROM expenses WHERE id = ? AND month_id = ?')
      .get(id, month.id);
    if (!existing) {
      res.status(404).json({ error: 'expense not found' });
      return;
    }
    const fields: string[] = [];
    const params: unknown[] = [];
    if (typeof description === 'string' && description.trim()) {
      fields.push('description = ?');
      params.push(description.trim());
    }
    if (Number.isFinite(amount) && amount >= 0) {
      fields.push('amount = ?');
      params.push(Math.round(amount));
    }
    if (note !== undefined) {
      fields.push('note = ?');
      params.push(note);
    }
    if (fields.length === 0) {
      res.status(400).json({ error: 'no updatable fields' });
      return;
    }
    params.push(id);
    db.prepare(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(id));
  } catch (e) {
    next(e);
  }
});

router.delete('/:yyyymm/expenses/:id', (req: Request, res: Response, next: NextFunction) => {
  const ym = ymOr400(req, res);
  if (!ym) return;
  try {
    const db = getDb();
    const month = getMonthRowOr404(db, ym);
    ensureMonthOpen(month);
    db.prepare('DELETE FROM expenses WHERE id = ? AND month_id = ?').run(
      Number(req.params.id),
      month.id,
    );
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
