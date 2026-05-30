import { formatYearMonthJa } from '../utils.js';

type Props = {
  yearMonth: string;
  closed: boolean;
  onClose: () => Promise<void>;
  onOpen: () => Promise<void>;
};

export default function CloseMonthButton({ yearMonth, closed, onClose, onOpen }: Props) {
  const handleClose = async () => {
    const ok = window.confirm(
      `${formatYearMonthJa(yearMonth)}を締めますか？\n締めた後は支出の追加・編集ができなくなります（解除は可能）。`,
    );
    if (ok) await onClose();
  };
  const handleOpen = async () => {
    const ok = window.confirm('締めを解除しますか？再び編集可能になります。');
    if (ok) await onOpen();
  };

  if (closed) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="min-h-11 px-4 rounded-xl text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-sm font-medium"
      >
        締めを解除
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClose}
      className="min-h-11 px-5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800"
    >
      月を締める
    </button>
  );
}
