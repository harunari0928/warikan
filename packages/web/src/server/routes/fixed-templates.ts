import { Router, type Request, type Response } from 'express';
import { getDb } from '../db.js';

const router: ReturnType<typeof Router> = Router();

type TemplateRow = {
  id: number;
  user_id: number;
  description: string;
  amount: number;
  note: string | null;
  is_active: number;
  display_order: number;
};

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, description, amount, note, is_active, display_order
       FROM fixed_expense_templates
       ORDER BY user_id ASC, display_order ASC, id ASC`,
    )
    .all() as TemplateRow[];
  res.json(rows);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { user_id, description, amount, note, is_active } = req.body ?? {};
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
  const maxOrder = (
    db
      .prepare(
        'SELECT COALESCE(MAX(display_order), -1) AS m FROM fixed_expense_templates WHERE user_id = ?',
      )
      .get(user_id) as { m: number }
  ).m;
  const info = db
    .prepare(
      `INSERT INTO fixed_expense_templates (user_id, description, amount, note, is_active, display_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user_id,
      description.trim(),
      Math.round(amount),
      note ?? null,
      is_active === false ? 0 : 1,
      maxOrder + 1,
    );
  const row = db
    .prepare('SELECT * FROM fixed_expense_templates WHERE id = ?')
    .get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { description, amount, note, is_active, display_order, user_id } = req.body ?? {};
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
  if (typeof is_active === 'boolean') {
    fields.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }
  if (Number.isInteger(display_order)) {
    fields.push('display_order = ?');
    params.push(display_order);
  }
  if (Number.isInteger(user_id)) {
    fields.push('user_id = ?');
    params.push(user_id);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'no updatable fields' });
    return;
  }
  params.push(id);
  db.prepare(`UPDATE fixed_expense_templates SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM fixed_expense_templates WHERE id = ?').get(id) as
    | TemplateRow
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'template not found' });
    return;
  }
  res.json(row);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM fixed_expense_templates WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

export default router;
