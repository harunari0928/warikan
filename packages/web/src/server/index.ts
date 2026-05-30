import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import usersRouter from './routes/users.js';
import monthsRouter from './routes/months.js';
import fixedTemplatesRouter from './routes/fixed-templates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3100', 10);

app.use(cors());
app.use(express.json());

getDb();

app.use('/api/users', usersRouter);
app.use('/api/months', monthsRouter);
app.use('/api/fixed-expense-templates', fixedTemplatesRouter);

if (process.env.NODE_ENV !== 'production') {
  app.post('/api/test/reset', (_req: Request, res: Response) => {
    const db = getDb();
    db.exec('DELETE FROM expenses');
    db.exec('DELETE FROM monthly_incomes');
    db.exec('DELETE FROM months');
    db.exec('DELETE FROM fixed_expense_templates');
    db.exec('DELETE FROM users');
    res.json({ success: true });
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err === 'object' && 'httpStatus' in err) {
    const status = (err as { httpStatus: number }).httpStatus;
    const message = err instanceof Error ? err.message : 'error';
    res.status(status).json({ error: message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

const clientDist = path.join(__dirname, '../client');
const indexHtml = path.join(clientDist, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(indexHtml);
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
