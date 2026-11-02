import React from 'react';
import { UnoCard, UnoColor } from '../../types/game';

interface UnoCardViewProps {
  card?: UnoCard;
  isBack?: boolean;
  chosenColor?: UnoColor;
  className?: string;
  isFlex?: boolean;
}

export const UnoCardView: React.FC<UnoCardViewProps> = ({
  card,
  isBack = false,
  chosenColor,
  className = '',
  isFlex = false
}) => {
  // If rendering official card back (scalable SVG viewBox so it scales to ANY size without clipping)
  if (isBack || !card) {
    return (
      <div
        className={`relative w-16 sm:w-20 md:w-22 h-22 sm:h-28 md:h-32 rounded-xl sm:rounded-2xl select-none shadow-2xl overflow-hidden ${className}`}
        style={{ aspectRatio: '5 / 7.2' }}
      >
        <svg viewBox="0 0 100 145" className="w-full h-full block">
          <defs>
            <linearGradient id="unoRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d90429" />
              <stop offset="50%" stopColor="#ef233c" />
              <stop offset="100%" stopColor="#b70928" />
            </linearGradient>
            <filter id="unoShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="1" dy="1.5" stdDeviation="1" floodColor="#000" floodOpacity="0.7" />
            </filter>
          </defs>

          {/* Outer Black Border */}
          <rect x="0" y="0" width="100" height="145" rx="14" fill="#0a0a0a" />
          <rect x="2.5" y="2.5" width="95" height="140" rx="12" fill="none" stroke="#262626" strokeWidth="1" />

          {/* Red Inner Card Face */}
          <rect x="5.5" y="5.5" width="89" height="134" rx="10" fill="url(#unoRedGrad)" stroke="#ff4d4d" strokeWidth="0.8" />

          {/* Tilted Center Black Oval */}
          <ellipse
            cx="50"
            cy="72.5"
            rx="36"
            ry="22"
            transform="rotate(-28 50 72.5)"
            fill="#0a0a0a"
            stroke="#000"
            strokeWidth="1.5"
            filter="url(#unoShadow)"
          />

          {/* Iconic Yellow & Red UNO Text */}
          <g transform="rotate(-28 50 72.5)">
            <text
              x="50"
              y="79.5"
              textAnchor="middle"
              transform="skewX(-10)"
              fontFamily="'Impact', 'Arial Black', sans-serif"
              fontWeight="900"
              fontStyle="italic"
              fontSize="24"
              letterSpacing="-0.5"
              fill="#FEE440"
              stroke="#D90429"
              strokeWidth="2.4"
              paintOrder="stroke fill"
            >
              UNO
            </text>
          </g>
        </svg>
      </div>
    );
  }

  // Face-Up Card Rendering
  const effectiveColor = isFlex && card.flexColor ? card.flexColor : (chosenColor || card.color);
  const effectiveValue = isFlex && card.flexValue ? card.flexValue : card.value;

  const colorStyles: Record<UnoColor, { bg: string; text: string; border: string }> = {
    red: { bg: 'bg-[#E71D36]', text: 'text-[#E71D36]', border: 'border-red-500' },
    blue: { bg: 'bg-[#0099FF]', text: 'text-[#0099FF]', border: 'border-blue-400' },
    green: { bg: 'bg-[#00C853]', text: 'text-[#00C853]', border: 'border-emerald-400' },
    yellow: { bg: 'bg-[#FFD166]', text: 'text-[#FFD166]', border: 'border-yellow-300' },
    wild: { bg: 'bg-[#111827]', text: 'text-white', border: 'border-slate-600' }
  };

  const style = colorStyles[effectiveColor] || colorStyles.red;
  const isWild = card.color === 'wild';

const UnoReverseIcon: React.FC<{ isCenter?: boolean; className?: string }> = ({ isCenter = false, className = '' }) => (
  <svg
    viewBox="0 0 100 100"
    className={isCenter ? `w-12 sm:w-14 h-12 sm:h-14 ${className}` : `w-3.5 h-3.5 sm:w-4 sm:h-4 ${className}`}
    fill="currentColor"
  >
    {/* Classic Uno Two Curved Opposite Arrows */}
    <path d="M 22 42 C 22 22, 38 13, 62 13 L 62 3 L 88 22 L 62 41 L 62 31 C 46 31, 36 37, 36 45 Z" />
    <path d="M 78 58 C 78 78, 62 87, 38 87 L 38 97 L 12 78 L 38 59 L 38 69 C 54 69, 64 63, 64 55 Z" />
  </svg>
);

const UnoWildOvalIcon: React.FC<{ size?: 'sm' | 'md'; className?: string }> = ({ size = 'md', className = '' }) => (
  <svg
    viewBox="0 0 100 130"
    className={size === 'md' ? `w-11 sm:w-13 h-15 sm:h-18 -rotate-[28deg] drop-shadow-md ${className}` : `w-3.5 h-4.5 -rotate-[28deg] drop-shadow ${className}`}
  >
    <ellipse cx="50" cy="65" rx="48" ry="62" fill="#ffffff" stroke="#000000" strokeWidth="1" />
    <g>
      {/* Top-Right: Blue */}
      <path d="M 50 65 L 50 3 A 46 60 0 0 1 96 65 Z" fill="#0099FF" />
      {/* Bottom-Right: Green */}
      <path d="M 50 65 L 96 65 A 46 60 0 0 1 50 125 Z" fill="#00C853" />
      {/* Bottom-Left: Yellow */}
      <path d="M 50 65 L 50 125 A 46 60 0 0 1 4 65 Z" fill="#FFD166" />
      {/* Top-Left: Red */}
      <path d="M 50 65 L 4 65 A 46 60 0 0 1 50 3 Z" fill="#E71D36" />
    </g>
    <ellipse cx="50" cy="65" rx="46" ry="60" fill="none" stroke="#ffffff" strokeWidth="3" />
  </svg>
);

  const renderCardSymbol = (val: string, isCenter = false) => {
    switch (val) {
      case 'skip':
        return <span className={isCenter ? 'text-3xl font-black' : 'text-xs font-black'}>⊘</span>;
      case 'reverse':
        return <UnoReverseIcon isCenter={isCenter} />;
      case 'draw_two':
        return <span className={isCenter ? 'text-2xl font-black' : 'text-[11px] font-black'}>+2</span>;
      case 'wild':
        return isCenter ? (
          <UnoWildOvalIcon size="md" />
        ) : (
          <UnoWildOvalIcon size="sm" />
        );
      case 'wild_draw_two':
        return isCenter ? (
          <div className="relative flex items-center justify-center">
            <UnoWildOvalIcon size="md" />
            <span
              className="absolute text-white font-black text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
              style={{ textShadow: '0 0 6px #000, 1px 1px 3px #000' }}
            >
              +2
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <UnoWildOvalIcon size="sm" />
            <span className="text-[10px] font-black">+2</span>
          </div>
        );
      case 'wild_draw_four':
        return isCenter ? (
          <div className="relative flex items-center justify-center">
            <UnoWildOvalIcon size="md" />
            <span
              className="absolute text-white font-black text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
              style={{ textShadow: '0 0 6px #000, 1px 1px 3px #000' }}
            >
              +4
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <UnoWildOvalIcon size="sm" />
            <span className="text-[10px] font-black">+4</span>
          </div>
        );
      case 'draw_four':
        return <span className={isCenter ? 'text-2xl font-black' : 'text-[10px] font-black'}>+4</span>;
      case 'wild_reverse_draw_four':
        return isCenter ? (
          <div className="relative flex items-center justify-center">
            <UnoWildOvalIcon size="md" />
            <div className="absolute flex flex-col items-center leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              <UnoReverseIcon isCenter={false} />
              <span className="text-base font-black" style={{ textShadow: '0 0 6px #000, 1px 1px 3px #000' }}>
                +4
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <UnoReverseIcon isCenter={false} />
            <span className="text-[8px] font-black">+4</span>
          </div>
        );
      case 'wild_draw_six':
        return isCenter ? (
          <div className="relative flex items-center justify-center">
            <UnoWildOvalIcon size="md" />
            <span
              className="absolute text-white font-black text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
              style={{ textShadow: '0 0 6px #000, 1px 1px 3px #000' }}
            >
              +6
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <UnoWildOvalIcon size="sm" />
            <span className="text-[10px] font-black">+6</span>
          </div>
        );
      case 'wild_draw_eight':
        return isCenter ? (
          <div className="relative flex items-center justify-center">
            <UnoWildOvalIcon size="md" />
            <span
              className="absolute text-white font-black text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
              style={{ textShadow: '0 0 6px #000, 1px 1px 3px #000' }}
            >
              +8
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <UnoWildOvalIcon size="sm" />
            <span className="text-[10px] font-black">+8</span>
          </div>
        );
      case 'wild_draw_ten':
        return isCenter ? (
          <div className="relative flex items-center justify-center">
            <UnoWildOvalIcon size="md" />
            <span
              className="absolute text-white font-black text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
              style={{ textShadow: '0 0 6px #000, 1px 1px 3px #000' }}
            >
              +10
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <UnoWildOvalIcon size="sm" />
            <span className="text-[9px] font-black">+10</span>
          </div>
        );
      case 'skip_everyone':
        return <span className={isCenter ? 'text-lg font-black text-center leading-none' : 'text-[8px] font-black'}>CẤM HẾT</span>;
      case 'discard_all':
        return <span className={isCenter ? 'text-lg font-black text-center leading-none' : 'text-[8px] font-black'}>BỎ HẾT</span>;
      case 'wild_color_roulette':
        return isCenter ? (
          <div className="text-center font-black text-xs text-amber-300">VÒNG QUAY</div>
        ) : (
          <span className="text-[7px] font-black">QUAY</span>
        );
      case 'flex_all_flip':
        return <span className={isCenter ? 'text-2xl font-black' : 'text-xs font-black'}>🔄</span>;
      default:
        return <span className={isCenter ? 'text-4xl font-black' : 'text-sm font-black'}>{val}</span>;
    }
  };

  return (
    <div
      className={`relative w-16 sm:w-20 md:w-22 h-22 sm:h-28 md:h-32 rounded-xl sm:rounded-2xl bg-black p-1 shadow-2xl border border-neutral-700 select-none transition-transform ${className}`}
      style={{ aspectRatio: '5 / 7.5' }}
    >
      {/* Inner Color Card Face */}
      <div className={`w-full h-full rounded-xl ${style.bg} relative flex flex-col justify-between p-1.5 overflow-hidden border border-white/30`}>
        {/* White center tilted ellipse */}
        {!isWild ? (
          <div
            className="w-14 sm:w-16 h-20 sm:h-24 rounded-[50%] bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] shadow-inner flex items-center justify-center border border-black/10"
          >
            <div className={`rotate-[28deg] font-black ${style.text} drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]`}>
              {renderCardSymbol(effectiveValue, true)}
            </div>
          </div>
        ) : (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            {renderCardSymbol(effectiveValue, true)}
          </div>
        )}

        {/* Top-Left Pip */}
        <div className="self-start text-white font-black leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] z-10">
          {renderCardSymbol(effectiveValue, false)}
        </div>

        {/* Bottom-Right Pip (Upside down) */}
        <div className="self-end text-white font-black leading-none rotate-180 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] z-10">
          {renderCardSymbol(effectiveValue, false)}
        </div>

        {/* Flex Indicator ribbon if flex card */}
        {card.flexColor && (
          <div className="absolute top-0 right-0 w-6 h-6 overflow-hidden pointer-events-none">
            <div className="bg-amber-400 text-slate-950 font-black text-[7px] rotate-45 py-0.5 w-12 text-center absolute -top-1 -right-3 shadow">
              FLEX
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
