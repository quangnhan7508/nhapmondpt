import React from 'react';
import { Package } from 'lucide-react';
import { CaseOpeningView } from '../components/cases/CaseOpeningView';

export const CasesPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-6xl mx-auto w-full flex items-center gap-2 bg-gray-900/60 border border-gray-800 p-1.5 rounded-2xl backdrop-blur-md">
        <div className="px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md shadow-amber-500/20">
          <Package className="w-4 h-4" /> Mở Hòm Solo
        </div>
      </div>
      <CaseOpeningView />
    </div>
  );
};

export default CasesPage;