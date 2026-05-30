import MonthSelector from './MonthSelector.js';
import UserSwitcher from './UserSwitcher.js';
import type { User } from '../types.js';

type Props = {
  yearMonth: string;
  onMonthChange: (yyyymm: string) => void;
  users: User[];
  currentUserId: number | null;
  onUserChange: (userId: number) => void;
  onOpenSettings: () => void;
};

export default function Header({
  yearMonth,
  onMonthChange,
  users,
  currentUserId,
  onUserChange,
  onOpenSettings,
}: Props) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="flex items-center justify-between gap-2 px-3 h-14">
        <MonthSelector value={yearMonth} onChange={onMonthChange} />
        <div className="flex items-center gap-2">
          <UserSwitcher users={users} currentUserId={currentUserId} onChange={onUserChange} />
          <button
            type="button"
            onClick={onOpenSettings}
            className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200"
            aria-label="設定"
          >
            ⚙
          </button>
        </div>
      </div>
    </header>
  );
}
