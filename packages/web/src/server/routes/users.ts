import { Router, type Request, type Response } from 'express';
import { getDb } from '../db.js';

const router: ReturnType<typeof Router> = Router();

type UserRow = { id: number; name: string; display_order: number };

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, name, display_order FROM users ORDER BY display_order ASC, id ASC')
    .all() as UserRow[];
  res.json(rows);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { name, display_order } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const order =
    typeof display_order === 'number'
      ? display_order
      : ((db.prepare('SELECT COALESCE(MAX(display_order), -1) AS m FROM users').get() as { m: number }).m + 1);
  try {
    const info = db
      .prepare('INSERT INTO users (name, display_order) VALUES (?, ?)')
      .run(name.trim(), order);
    const row = db
      .prepare('SELECT id, name, display_order FROM users WHERE id = ?')
      .get(info.lastInsertRowid) as UserRow;
    res.status(201).json(row);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'user already exists' });
      return;
    }
    throw e;
  }
});

router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const id = Number(req.params.id);
  const { name, display_order } = req.body ?? {};
  const fields: string[] = [];
  const params: unknown[] = [];
  if (typeof name === 'string' && name.trim()) {
    fields.push('name = ?');
    params.push(name.trim());
  }
  if (typeof display_order === 'number') {
    fields.push('display_order = ?');
    params.push(display_order);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: 'no updatable fields' });
    return;
  }
  params.push(id);
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  const row = db
    .prepare('SELECT id, name, display_order FROM users WHERE id = ?')
    .get(id) as UserRow | undefined;
  if (!row) {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  res.json(row);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

export default router;
