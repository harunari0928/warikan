import { Router, type Request, type Response, type NextFunction } from 'express';

const router: ReturnType<typeof Router> = Router();

const MODEL = 'gpt-4o-mini';

// taxRate が null のときは税率を判定できなかった明細。クライアント側でユーザが選び直す（要確認）。
export type ReceiptItem = { name: string; taxRate: number | null; amount: number };

type OcrParsed = {
  store: string | null;
  taxRatesReadable: boolean;
  items: { name: string; taxRate: number; taxIncludedPrice: number }[];
};

const SYSTEM_PROMPT = `あなたは日本のスーパーやコンビニのレシート画像を解析するアシスタントです。
画像から購入品目を1行ずつ抽出し、次のルールで JSON を返してください。

- items: 購入した商品ごとに { name: 商品名, taxRate: 税率(0.08 または 0.10), taxIncludedPrice: 税込価格(整数, 円) } を列挙する。
- 価格は必ず消費税込みの整数円にすること。レシートが税抜表示なら税率を掛けて税込に換算する。
- 軽減税率(食料品など。※や*印が付くことが多い)は 0.08、それ以外は 0.10 とする。レシート下部の税区分別集計も手がかりにする。
- 小計・合計・お預り・お釣り・ポイント・値引き行など、購入品目でないものは含めない。
- 各品目の税率を判定できない、または税率がレシートから読み取れない場合は taxRatesReadable を false にする。すべて判定できたら true。
- store: 店舗名がわかれば入れる。不明なら null。`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    store: { type: ['string', 'null'] },
    taxRatesReadable: { type: 'boolean' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          taxRate: { type: 'number' },
          taxIncludedPrice: { type: 'integer' },
        },
        required: ['name', 'taxRate', 'taxIncludedPrice'],
      },
    },
  },
  required: ['store', 'taxRatesReadable', 'items'],
};

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { httpStatus: status });
}

// テスト用スタブ: OPENAI_API_KEY 未設定の非本番環境でOpenAIを呼ばずに決定論的な結果を返す。
// filename に "no-tax" を含む場合は税率が判定できなかったケース（要確認）を再現する。
function stubResult(filename: string): OcrParsed {
  if (filename.includes('no-tax')) {
    return {
      store: 'テストスーパー',
      taxRatesReadable: false,
      items: [
        { name: '牛乳', taxRate: 0.08, taxIncludedPrice: 216 },
        { name: 'お茶', taxRate: 0.1, taxIncludedPrice: 150 },
      ],
    };
  }
  return {
    store: 'テストスーパー',
    taxRatesReadable: true,
    items: [
      { name: '牛乳', taxRate: 0.08, taxIncludedPrice: 216 },
      { name: '食パン', taxRate: 0.08, taxIncludedPrice: 162 },
      { name: '台所用洗剤', taxRate: 0.1, taxIncludedPrice: 330 },
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
  const { image, filename } = req.body ?? {};
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    res.status(400).json({ error: 'image (data URL) is required' });
    return;
  }
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    let parsed: OcrParsed;
    if (process.env.NODE_ENV !== 'production' && !apiKey) {
      parsed = stubResult(typeof filename === 'string' ? filename : '');
    } else if (!apiKey) {
      throw httpError('OCRが利用できません (APIキー未設定)', 503);
    } else {
      parsed = await callOpenAI(apiKey, image);
    }

    if (parsed.items.length === 0) {
      throw httpError('レシートから明細を読み取れませんでした', 422);
    }

    // 税率を判定できなかった場合は taxRate を null にして返し、ユーザが確認ダイアログで選べるようにする。
    const items: ReceiptItem[] = parsed.items.map((it) => ({
      name: it.name,
      taxRate: parsed.taxRatesReadable ? it.taxRate : null,
      amount: Math.round(it.taxIncludedPrice),
    }));
    res.json({ store: parsed.store ?? null, items });
  } catch (e) {
    next(e);
  }
});

export default router;
