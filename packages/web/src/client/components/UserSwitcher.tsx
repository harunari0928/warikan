import type { User } from '../types.js';

type Props = {
  users: User[];
  currentUserId: number | null;
  onChange: (userId: number) => void;
};

const USER_THEMES = [
  { dot: 'bg-rose-500', active: 'bg-rose-100 text-rose-700' },
  { dot: 'bg-sky-500', active: 'bg-sky-100 text-sky-700' },
];

export default function UserSwitcher({ users, currentUserId, onChange }: Props) {
  if (users.length === 0) return null;
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="ユーザー切替">
      {users.map((u, idx) => {
        const isActive = u.id === currentUserId;
        const theme = USER_THEMES[idx % USER_THEMES.length];
        return (
          <button
            key={u.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(u.id)}
            className={`min-h-10 px-3 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
              isActive ? `${theme.active} shadow-sm` : 'text-slate-500'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${theme.dot}`} aria-hidden />
            {u.name}
          </button>
        );
      })}
    </div>
  );
}
