export function formatYen(value: number): string {
  return new Intl.NumberFormat('ja-JP').format(Math.round(value));
}

export function getCurrentMonthLocal(): string {
  const now = new Date();
  const tokyo = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y = tokyo.getFullYear();
  const m = String(tokyo.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const ny = d.getUTCFullYear();
  const nm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

export function formatYearMonthJa(yyyymm: string): string {
  const [y, m] = yyyymm.split('-');
  return `${y}年${parseInt(m, 10)}月`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像を読み込めませんでした'));
    img.src = src;
  });
}

// レシート画像を長辺 maxDim 以内に縮小し、JPEG の data URL を返す。
// 送信ペイロードと OCR トークンを抑えるため。canvas が使えない場合は元の data URL を返す。
export async function resizeImageToDataUrl(
  file: File,
  maxDim = 1500,
  quality = 0.8,
): Promise<string> {
  const original = await readFileAsDataUrl(file);
  try {
    const img = await loadImage(original);
    const longest = Math.max(img.width, img.height) || 1;
    const scale = Math.min(1, maxDim / longest);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return original;
  }
}
