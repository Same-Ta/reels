import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { db, appId } from '../config/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  where 
} from 'firebase/firestore';

const ChatListPanel = ({ currentUser, activeChatId, onSelectChat, isCollapsed, onToggleCollapse }) => {
  const [chats, setChats] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    const chatsRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats');
    const q = query(chatsRef, where('guestId', '==', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      chatList.sort((a, b) => (b.lastTimestamp?.seconds || 0) - (a.lastTimestamp?.seconds || 0));
      setChats(chatList);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const filteredChats = chats.filter(chat => 
    chat.vloggerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 접힘 상태일 때 축소된 뷰
  if (isCollapsed) {
    return (
      <div className="w-16 bg-[#25282c] border-r border-gray-700/50 flex flex-col h-full items-center py-4">
        <button 
          onClick={onToggleCollapse}
          className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 hover:bg-gray-600"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full sm:w-80 bg-[#25282c] border-r border-gray-700/50 flex flex-col h-full flex-shrink-0">
      {/* Search Header */}
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-xl">Messages</h2>
          <div className="flex items-center gap-2">
            {onToggleCollapse && (
              <button 
                onClick={onToggleCollapse}
                className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 hover:bg-gray-600"
                title="접기"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <button className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 hover:bg-gray-600">
              <span className="text-xl">+</span>
            </button>
          </div>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e2024] text-gray-300 pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-green-500/50 placeholder-gray-600 text-sm transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 scrollbar-hide">
        {filteredChats.length === 0 ? (
          <div className="text-center text-gray-500 mt-10 text-sm px-4">
            <p className="mb-2">대화 내역이 없습니다.</p>
            <p className="text-xs">왼쪽 '릴스' 메뉴에서<br/>새로운 직무 담당자를 찾아보세요!</p>
          </div>
        ) : (
          filteredChats.map(chat => (
            <div 
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 group ${activeChatId === chat.id ? 'bg-gradient-to-r from-green-500/10 to-transparent border-l-2 border-green-500' : 'hover:bg-[#2f3238] border-l-2 border-transparent'}`}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                  {chat.vloggerName?.[0] || 'V'}
                </div>
                {/* Online Indicator Mock */}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#25282c] rounded-full"></div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className={`font-semibold text-sm truncate ${activeChatId === chat.id ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                    {chat.vloggerName}
                  </h3>
                  <span className="text-[10px] text-gray-500">
                    {chat.lastTimestamp?.seconds 
                      ? new Date(chat.lastTimestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                      : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate group-hover:text-gray-400">
                  {chat.lastMessage || '대화를 시작했습니다.'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatListPanel;
