import React from 'react';
import { EKCard, EKCardType } from '../../types/game';

interface EKCardViewProps {
  card?: EKCard;
  isBack?: boolean;
  className?: string;
}

export const EKCardView: React.FC<EKCardViewProps> = ({
  card,
  isBack = false,
  className = ''
}) => {
  // Official Exploding Kittens Card Back
  if (isBack || !card) {
    return (
      <div
        className={`relative w-20 sm:w-24 h-28 sm:h-36 rounded-2xl bg-black p-1.5 shadow-2xl border border-neutral-700 select-none ${className}`}
        style={{ aspectRatio: '5 / 7.5' }}
      >
        <div className="w-full h-full rounded-xl bg-gradient-to-br from-red-700 via-rose-800 to-black flex flex-col items-center justify-between p-2 relative overflow-hidden border border-red-500/50">
          <div className="text-[10px] font-black tracking-widest text-red-400/80 uppercase">TUYỆT MẬT</div>
          <div className="w-12 h-12 rounded-full bg-black/60 border border-red-500/50 flex items-center justify-center text-2xl shadow-lg">
            💣
          </div>
          <div className="text-center">
            <span className="block text-[11px] sm:text-xs font-black uppercase tracking-tight text-amber-300 leading-none">
              MÈO NỔ
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Face-Up Imploding Kitten on Deck or In Hand
  if (card.type === 'imploding_kitten' && card.isFaceUp) {
    return (
      <div
        className={`relative w-20 sm:w-24 h-28 sm:h-36 rounded-2xl bg-black p-1.5 shadow-2xl border-2 border-purple-500 select-none animate-pulse ${className}`}
        style={{ aspectRatio: '5 / 7.5' }}
      >
        <div className="w-full h-full rounded-xl bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex flex-col items-center justify-between p-2 relative overflow-hidden border border-purple-400">
          <div className="text-[9px] font-black tracking-widest text-purple-300 uppercase animate-bounce">
            NGUY HIỂM ☣️
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-950/80 border-2 border-purple-400 flex items-center justify-center text-2xl shadow-xl shadow-purple-500/50">
            ☢️
          </div>
          <div className="text-center">
            <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-tight text-purple-200 leading-none">
              MÈO PHÁT NỔ
            </span>
            <span className="block text-[7px] font-bold text-red-400 uppercase mt-0.5">
              RÚT LÀ CHẾT NGAY!
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Face-Up Exploding Kittens Card
  const getTheme = (type: EKCardType) => {
    switch (type) {
      case 'defuse':
        return {
          border: 'border-emerald-500',
          badge: 'bg-emerald-500 text-slate-950',
          icon: '🛠️',
          title: 'GỠ BOM',
          desc: 'Tự cứu mình khỏi bị nổ tung. Bí mật nhét lại thẻ Mèo Nổ vào bộ bài.'
        };
      case 'attack':
        return {
          border: 'border-orange-500',
          badge: 'bg-orange-500 text-slate-950',
          icon: '⚡',
          title: 'TẤN CÔNG (2X)',
          desc: 'Kết thúc lượt không cần rút bài và ép người chơi kế tiếp đánh 2 lượt.'
        };
      case 'skip':
        return {
          border: 'border-sky-500',
          badge: 'bg-sky-500 text-slate-950',
          icon: '⏭️',
          title: 'BỎ QUA',
          desc: 'Kết thúc lượt đi ngay lập tức mà không cần phải rút bài.'
        };
      case 'favor':
        return {
          border: 'border-purple-500',
          badge: 'bg-purple-500 text-white',
          icon: '🎁',
          title: 'XIN XỎ',
          desc: 'Ép một người chơi bất kỳ phải nộp cho bạn 1 lá bài họ chọn.'
        };
      case 'shuffle':
        return {
          border: 'border-indigo-500',
          badge: 'bg-indigo-500 text-white',
          icon: '🔀',
          title: 'XÁO BÀI',
          desc: 'Xáo trộn lại toàn bộ chồng bài rút một cách ngẫu nhiên.'
        };
      case 'see_the_future':
        return {
          border: 'border-fuchsia-500',
          badge: 'bg-fuchsia-500 text-white',
          icon: '🔮',
          title: 'SOI TƯƠNG LAI (3X)',
          desc: 'Bí mật xem trước 3 lá bài trên cùng của chồng bài rút.'
        };
      case 'nope':
        return {
          border: 'border-rose-600',
          badge: 'bg-rose-600 text-white',
          icon: '🚫',
          title: 'CHẶN NOPE!',
          desc: 'Chặn đứng tác dụng của thẻ bài bất kỳ. Có thể bị chặn tiếp bởi Nope khác.'
        };
      case 'exploding_kitten':
        return {
          border: 'border-red-600',
          badge: 'bg-red-600 text-white animate-pulse',
          icon: '💣',
          title: 'MÈO NỔ (ÔM BOM)',
          desc: 'Đang ôm bom an toàn nhờ Mèo Đi Dạo! Kẻ nào trộm lá này từ bạn sẽ bị nổ tung!'
        };
      case 'imploding_kitten':
        return {
          border: 'border-purple-600',
          badge: 'bg-purple-600 text-white',
          icon: '☢️',
          title: 'MÈO PHÁT NỔ',
          desc: 'Rút lần 1: Nhét ngửa mặt lại vào bộ bài. Rút lần 2: Nổ tung ngay lập tức!'
        };
      case 'targeted_attack':
        return {
          border: 'border-rose-500',
          badge: 'bg-rose-600 text-white',
          icon: '🎯',
          title: 'TẤN CÔNG MỤC TIÊU',
          desc: 'Chọn 1 đối thủ phải đánh 2 lượt liên tiếp. Kết thúc lượt của bạn.'
        };
      case 'reverse':
        return {
          border: 'border-cyan-500',
          badge: 'bg-cyan-500 text-slate-950',
          icon: '🔄',
          title: 'ĐẢO CHIỀU',
          desc: 'Đổi ngược chiều vòng chơi và kết thúc lượt của bạn.'
        };
      case 'draw_from_bottom':
        return {
          border: 'border-teal-600',
          badge: 'bg-teal-600 text-white',
          icon: '⏬',
          title: 'RÚT ĐÁY',
          desc: 'Rút 1 lá dưới đáy bộ bài rút và kết thúc lượt ngay lập tức.'
        };
      case 'feral_cat':
        return {
          border: 'border-yellow-500',
          badge: 'bg-yellow-400 text-slate-950',
          icon: '🐾',
          title: 'MÈO HOANG (WILD)',
          desc: 'Thẻ mèo vạn năng, có thể ghép với bất kỳ lá mèo nào để cướp bài.'
        };
      case 'alter_the_future_3x':
        return {
          border: 'border-violet-500',
          badge: 'bg-violet-600 text-white',
          icon: '🌀',
          title: 'SỬA TƯƠNG LAI (3X)',
          desc: 'Bí mật xem và tự do sắp xếp lại 3 lá trên cùng của bộ bài rút.'
        };
      case 'streaking_kitten':
        return {
          border: 'border-pink-500',
          badge: 'bg-pink-500 text-white',
          icon: '🩲',
          title: 'MÈO ĐI DẠO',
          desc: 'Giúp bạn bí mật giữ 1 Mèo Nổ trên tay. Kẻ nào cướp phải lá đó sẽ nổ!'
        };
      case 'super_skip':
        return {
          border: 'border-blue-500',
          badge: 'bg-blue-600 text-white',
          icon: '⏩',
          title: 'SIÊU BỎ QUA',
          desc: 'Kết thúc toàn bộ lượt chơi còn lại của bạn mà không cần rút bài.'
        };
      case 'see_the_future_5x':
        return {
          border: 'border-fuchsia-600',
          badge: 'bg-fuchsia-600 text-white',
          icon: '🔮',
          title: 'SOI TƯƠNG LAI (5X)',
          desc: 'Bí mật xem trước 5 lá bài trên cùng của chồng bài rút.'
        };
      case 'alter_the_future_5x':
        return {
          border: 'border-indigo-600',
          badge: 'bg-indigo-600 text-white',
          icon: '🌀',
          title: 'SỬA TƯƠNG LAI (5X)',
          desc: 'Bí mật xem và tự do sắp xếp lại 5 lá bài trên cùng của bộ bài rút.'
        };
      case 'swap_top_and_bottom':
        return {
          border: 'border-emerald-600',
          badge: 'bg-emerald-600 text-white',
          icon: '🔃',
          title: 'ĐỔI ĐỈNH ĐÁY',
          desc: 'Hoán đổi vị trí lá bài trên đỉnh và dưới đáy của bộ bài rút.'
        };
      case 'catomic_bomb':
        return {
          border: 'border-amber-600',
          badge: 'bg-amber-600 text-white',
          icon: '☣️',
          title: 'BOM NGUYÊN TỬ',
          desc: 'Gom toàn bộ Mèo Nổ, xáo phần còn lại rồi đặt các Mèo Nổ lên đỉnh bộ bài!'
        };
      case 'curse_of_cat_butt':
        return {
          border: 'border-stone-600',
          badge: 'bg-stone-700 text-white',
          icon: '💩',
          title: 'LỜI NGUYỀN ĐÍT MÈO',
          desc: 'Mục tiêu bị mù (toàn bộ bài úp xuống) cho đến khi rút bài an toàn.'
        };
      case 'barking_kitten':
        return {
          border: 'border-orange-600',
          badge: 'bg-orange-600 text-white',
          icon: '🐶',
          title: 'MÈO SỦA',
          desc: 'Nếu đối thủ có lá Mèo Sủa còn lại, họ phải nộp cho bạn 1 thẻ Gỡ Bom!'
        };
      case 'personal_attack':
        return {
          border: 'border-red-700',
          badge: 'bg-red-700 text-white',
          icon: '💥',
          title: 'TỰ TẤN CÔNG (3X)',
          desc: 'Ép chính bạn phải tự đánh 3 lượt liên tiếp!'
        };
      case 'bury':
        return {
          border: 'border-stone-500',
          badge: 'bg-stone-600 text-white',
          icon: '🕳️',
          title: 'CHÔN BÀI',
          desc: 'Chọn 1 lá bài trên tay nhét lại vào bộ bài rút và kết thúc lượt.'
        };
      case 'ill_take_that':
        return {
          border: 'border-amber-500',
          badge: 'bg-amber-500 text-slate-950',
          icon: '🫳',
          title: 'CÁI ĐÓ CỦA TÔI',
          desc: 'Ép đối thủ phải nộp ngay lá bài đầu tiên họ rút được cho bạn.'
        };
      case 'share_the_future':
        return {
          border: 'border-indigo-400',
          badge: 'bg-indigo-500 text-white',
          icon: '🤝',
          title: 'CHIA SẺ TƯƠNG LAI',
          desc: 'Xem và sắp xếp 3 lá trên cùng, sau đó cho người kế tiếp xem.'
        };
      case 'taco_cat':
        return {
          border: 'border-amber-500',
          badge: 'bg-amber-500 text-slate-950',
          icon: '🌮',
          title: 'MÈO TACO',
          desc: 'Đánh một cặp mèo giống nhau để cướp ngẫu nhiên 1 lá bài từ đối thủ.'
        };
      case 'hairy_potato_cat':
        return {
          border: 'border-amber-600',
          badge: 'bg-amber-600 text-white',
          icon: '🥔',
          title: 'MÈO KHOAI TÂY',
          desc: 'Đánh một cặp mèo giống nhau để cướp ngẫu nhiên 1 lá bài từ đối thủ.'
        };
      case 'rainbow_ralphing_cat':
        return {
          border: 'border-teal-500',
          badge: 'bg-teal-500 text-slate-950',
          icon: '🌈',
          title: 'MÈO CẦU VỒNG',
          desc: 'Đánh một cặp mèo giống nhau để cướp ngẫu nhiên 1 lá bài từ đối thủ.'
        };
      case 'beard_cat':
        return {
          border: 'border-blue-600',
          badge: 'bg-blue-600 text-white',
          icon: '🧔',
          title: 'MÈO RÂU XÙ',
          desc: 'Đánh một cặp mèo giống nhau để cướp ngẫu nhiên 1 lá bài từ đối thủ.'
        };
      case 'cattermelon':
        return {
          border: 'border-lime-500',
          badge: 'bg-lime-500 text-slate-950',
          icon: '🍉',
          title: 'MÈO DƯA HẤU',
          desc: 'Đánh một cặp mèo giống nhau để cướp ngẫu nhiên 1 lá bài từ đối thủ.'
        };
      default:
        return {
          border: 'border-slate-600',
          badge: 'bg-slate-700 text-white',
          icon: '🐱',
          title: 'THẺ MÈO',
          desc: 'Đánh theo cặp 2 lá để cướp bài.'
        };
    }
  };

  const theme = getTheme(card.type);

  return (
    <div
      className={`relative w-20 sm:w-24 h-28 sm:h-36 rounded-2xl bg-white border-2 ${theme.border} p-1 shadow-2xl flex flex-col justify-between select-none text-slate-950 ${className}`}
      style={{ aspectRatio: '5 / 7.5' }}
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-1 border-b pb-0.5 border-slate-200">
        <span className="text-xs">{theme.icon}</span>
        <span className={`text-[8px] font-black px-1 rounded uppercase tracking-tighter ${theme.badge}`}>
          {theme.title}
        </span>
        <span className="text-xs">{theme.icon}</span>
      </div>

      {/* Center Character Art */}
      <div className="flex-1 flex flex-col items-center justify-center my-0.5">
        <span className="text-3xl sm:text-4xl drop-shadow-md">{theme.icon}</span>
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-tight text-center leading-tight mt-0.5">
          {theme.title}
        </span>
      </div>

      {/* Bottom Description */}
      <div className="border-t pt-0.5 border-slate-200">
        <p className="text-[7.5px] leading-[9px] text-slate-600 font-medium line-clamp-2 text-center">
          {theme.desc}
        </p>
      </div>
    </div>
  );
};
