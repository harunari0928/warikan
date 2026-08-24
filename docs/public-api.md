# Public REST API

## Register an expense

`POST /api/public/expenses`

Registers one expense item. The target month is created automatically, including
any active fixed-expense templates, so a client does not need to call another
endpoint first.

```json
{
  "user_id": 1,
  "description": "食費",
  "amount": 3000,
  "year_month": "2026-08",
  "note": "週末の買い物"
}
```

| Field | Required | Description |
| --- | --- | --- |
| `user_id` | Yes | Existing user ID. Obtain it with `GET /api/users`. |
| `description` | Yes | Non-empty expense description. |
| `amount` | Yes | Non-negative integer amount in yen. |
| `year_month` | No | Target month in `YYYY-MM`; defaults to the current month in JST. Future months are rejected. |
| `note` | No | String memo, or `null`. |

On success, the API returns `201 Created` and the inserted `expenses` row. A
closed month returns `409`; an unknown user returns `404`; invalid request data
or a future month returns `400`.

```bash
curl -X POST http://localhost:3120/api/public/expenses \
  -H 'Content-Type: application/json' \
  -d '{"user_id":1,"description":"食費","amount":3000}'
```
