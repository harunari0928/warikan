import { Router, type Request, type Response, type NextFunction } from 'express';

const router: ReturnType<typeof Router> = Router();

const MODEL = 'gpt-5.4-mini';

// AI は品目名と「レシートに印字された金額」だけを読み取る。
// 税率の判定はしない（軽減/標準の判断は精度が出ないため、ユーザが画面で選ぶ）。
export type ReceiptItem = { name: string; amount: number };

type OcrParsed = {
  store: string | null;
  items: { name: string; amount: number }[];
};

const SYSTEM_PROMPT = `あなたは日本のスーパーやコンビニのレシート画像を解析するアシスタントです。
画像から購入品目を1行ずつ抽出し、次のルールで JSON を返してください。

- items: 購入した商品ごとに { name: 商品名, amount: レシートに印字された金額(整数, 円) } を列挙する。
- amount はレシートの品目行に印字されている金額をそのまま読み取ること。税率を掛けたり税込・税抜を換算したりせず、印字された数値をそのまま返す。
- 小計・合計・お預り・お釣り・ポイント・値引き行など、購入品目でないものは含めない。
- store: 店舗名がわかれば入れる。不明なら null。`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    store: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          amount: { type: 'integer' },
        },
        required: ['name', 'amount'],
      },
    },
  },
  required: ['store', 'items'],
};

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { httpStatus: status });
}

// テスト用スタブ: OPENAI_API_KEY 未設定の非本番環境でOpenAIを呼ばずに決定論的な結果を返す。
function stubResult(): OcrParsed {
  return {
    store: 'テストスーパー',
    items: [
      { name: '牛乳', amount: 200 },
      { name: '食パン', amount: 150 },
      { name: '台所用洗剤', amount: 300 },
    ],
  };
}

async function callOpenAI(apiKey: string, imageDataUrl: string): Promise<OcrParsed> {
  const payload = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'このレシートの明細を解析してください。' },
          { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'receipt', strict: true, schema: SCHEMA },
    },
  };

  let resp: globalThis.Response;
  try {
    resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // 接続失敗（DNS/タイムアウト/TLS等）。生エラーを残さないと原因が追えないため記録する。
    console.error('[ocr] OpenAI への接続に失敗しました', e);
    throw httpError('OCRに失敗しました', 502);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    console.error('[ocr] OpenAI API がエラーを返しました', resp.status, body);
    throw httpError('OCRに失敗しました', 502);
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    console.error('[ocr] OpenAI レスポンスに content がありません', JSON.stringify(data));
    throw httpError('OCRに失敗しました', 502);
  }
  try {
    return JSON.parse(content) as OcrParsed;
  } catch (e) {
    console.error('[ocr] OpenAI レスポンスの JSON パースに失敗しました', e, content);
    throw httpError('OCRに失敗しました', 502);
  }
}

router.post('/receipt', async (req: Request, res: Response, next: NextFunction) => {
  const { image } = req.body ?? {};
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    res.status(400).json({ error: 'image (data URL) is required' });
    return;
  }
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    let parsed: OcrParsed;
    if (process.env.NODE_ENV !== 'production' && !apiKey) {
      parsed = stubResult();
    } else if (!apiKey) {
      throw httpError('OCRが利用できません (APIキー未設定)', 503);
    } else {
      parsed = await callOpenAI(apiKey, image);
    }

    if (parsed.items.length === 0) {
      throw httpError('レシートから明細を読み取れませんでした', 422);
    }

    const items: ReceiptItem[] = parsed.items.map((it) => ({
      name: it.name,
      amount: Math.round(it.amount),
    }));
    res.json({ store: parsed.store ?? null, items });
  } catch (e) {
    next(e);
  }
});

export default router;
