import React from 'react';
import { LeaderboardView } from '../components/leaderboard/LeaderboardView';
import { useLang } from '../i18n/LanguageContext';

/** Slug /leaderboard — Bảng xếp hạng cao thủ. */
export const LeaderboardPage: React.FC = () => {
  const { t } = useLang();
  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-black">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-yellow-500">{t('lb.pageTitle')}</span>
        </h2>
        <p className="text-sm text-gray-400 mt-1">{t('lb.pageSub')}</p>
      </div>
      <LeaderboardView />
    </div>
  );
};

export default LeaderboardPage;
