import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Bookmark, 
  Settings,
  LogOut,
  Play,
  Shield
} from 'lucide-react';

const Sidebar = ({ currentView, onViewChange, onLogout, onAdminClick, isAdmin }) => {
  const [showBubble, setShowBubble] = useState(true);

  // 5초 후 말풍선 사라지게 하기
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBubble(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  // 말풍선 표시 여부 (릴스 뷰일 때는 표시 안함)
  const shouldShowBubble = showBubble && currentView !== 'reels';

  return (
    <div className="w-20 bg-[#2c2f33] flex flex-col items-center py-6 gap-8 h-full shadow-xl z-20 flex-shrink-0">
      {/* Logo */}
      <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center shadow-lg mb-4 p-1">
        <img src="/logo.png" alt="취준로그" className="w-full h-full object-contain" />
      </div>

      {/* Nav Items */}
      <div className="flex flex-col gap-6 w-full items-center flex-1">
        <button 
          onClick={() => onViewChange('chat')}
          className={`relative p-3 rounded-xl transition-all duration-300 group ${currentView === 'chat' ? 'bg-white/10 text-green-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <MessageCircle size={24} />
          {currentView === 'chat' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-green-400 rounded-r-full" />}
          <span className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">채팅</span>
        </button>

        <button 
          onClick={() => onViewChange('reels')}
          className={`relative p-3 rounded-xl transition-all duration-300 group ${currentView === 'reels' ? 'bg-white/10 text-pink-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <Play size={24} />
          {currentView === 'reels' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-pink-400 rounded-r-full" />}
          <span className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">릴스 보기</span>
          
          {/* 초기 말풍선 */}
          {shouldShowBubble && (
            <div className="absolute left-16 top-1/2 -translate-y-1/2 z-50 animate-bounce">
              <div className="relative bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-pink-500 border-b-[6px] border-b-transparent"></div>
                릴스를 보며 직무를 탐색해 보세요!
              </div>
            </div>
          )}
        </button>

        <button className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
          <Bookmark size={24} />
        </button>

        <button className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
          <Settings size={24} />
        </button>
      </div>

      {/* Admin & Logout */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={onAdminClick}
          className={`p-3 rounded-xl transition-all duration-300 group ${isAdmin ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-purple-400 hover:bg-white/5'}`}
        >
          <Shield size={24} />
          <span className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {isAdmin ? '관리자 모드' : '관리자 로그인'}
          </span>
        </button>
        <button onClick={onLogout} className="p-3 text-gray-500 hover:text-red-400 transition-colors">
          <LogOut size={24} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
