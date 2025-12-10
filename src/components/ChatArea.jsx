import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  Send, 
  User,
  MoreHorizontal,
  Briefcase,
  Play,
  Sparkles,
  Menu
} from 'lucide-react';
import { db, appId } from '../config/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  orderBy, 
  serverTimestamp,
  doc,
  setDoc
} from 'firebase/firestore';
import { generateSuggestedQuestions } from '../config/gemini';
import { VLOG_DATA } from '../data/vlogData';

const ChatArea = ({ activeChat, currentUser, onToggleSidebar }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const messagesEndRef = useRef(null);

  // Find vlog data to show profile info
  const vlogInfo = VLOG_DATA.find(v => v.id === activeChat?.vloggerId) || {};

  useEffect(() => {
    if (!activeChat) return;
    // Use explicit path segments for nested collections: 'artifacts' / appId / 'public' / 'data' / 'chats' / activeChat.id / 'messages'
    const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChat.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(newMessages);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [activeChat]);

  // 메시지가 변경될 때마다 질문 추천 업데이트
  useEffect(() => {
    if (!activeChat || messages.length === 0) {
      // 대화가 없을 때 기본 질문 표시
      if (activeChat && vlogInfo.role) {
        loadSuggestedQuestions([]);
      }
      return;
    }
    
    // 마지막 5개 메시지만 사용하여 질문 추천
    const recentMessages = messages.slice(-5);
    loadSuggestedQuestions(recentMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeChat]);

  const loadSuggestedQuestions = async (chatHistory) => {
    if (!activeChat) return;
    
    setIsLoadingQuestions(true);
    try {
      const vloggerInfo = {
        username: activeChat.vloggerName,
        role: activeChat.vloggerRole || vlogInfo.role,
      };
      const questions = await generateSuggestedQuestions(chatHistory, vloggerInfo);
      setSuggestedQuestions(questions);
    } catch (error) {
      console.error('질문 추천 로드 실패:', error);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleSendMessage = async (e, questionText = null) => {
    if (e) e.preventDefault();
    const text = questionText || newMessage;
    if (!text.trim()) return;
    
    setNewMessage('');
    
    try {
      const messagesRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats', activeChat.id, 'messages');
      
      // 사용자 메시지 저장
      await addDoc(messagesRef, {
        text,
        senderId: currentUser.uid,
        senderType: 'guest',
        timestamp: serverTimestamp()
      });
      
      const chatDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'chats', activeChat.id);
      await setDoc(chatDocRef, {
        lastMessage: text,
        lastTimestamp: serverTimestamp(),
        guestUnread: 0,
      }, { merge: true });
      
    } catch (error) { 
      console.error(error); 
    }
  };

  const handleQuestionClick = (question) => {
    handleSendMessage(null, question);
  };

  if (!activeChat) {
    return (
      <div className="flex-1 bg-[#f0f2f5] flex flex-col items-center justify-center text-gray-400 px-4">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4">
          <MessageCircle size={32} className="text-gray-400 sm:w-10 sm:h-10" />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-gray-600 mb-2">대화를 시작해보세요</h3>
        <p className="text-xs sm:text-sm text-center">왼쪽 목록에서 채팅방을 선택하거나<br/>릴스 메뉴에서 새로운 직무 담당자를 찾아보세요.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#f3f4f6]">
      {/* Chat Messages Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 sm:h-20 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-8 shadow-sm z-10">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* 모바일 햄버거 메뉴 버튼 - 항상 표시 */}
            <button 
              onClick={onToggleSidebar}
              className="sm:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors relative z-20 active:bg-gray-200"
              aria-label="메뉴 열기"
            >
              <Menu size={24} className="text-gray-700" />
            </button>
            <div className="relative">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                {activeChat.vloggerName?.[0] || 'V'}
              </div>
              <div className="absolute bottom-0 right-0 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-sm sm:text-lg">{activeChat.vloggerName}</h2>
              <p className="text-[10px] sm:text-xs text-gray-500">{activeChat.vloggerRole || vlogInfo.role}</p>
            </div>
          </div>
          <div className="hidden sm:flex gap-4 text-gray-400">
            <button className="hover:text-gray-600 transition"><MoreHorizontal size={20} /></button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-8 space-y-4 sm:space-y-6">
          {/* Date Separator (Mock) */}
          <div className="flex justify-center">
            <span className="text-[10px] text-gray-400 bg-gray-200/50 px-3 py-1 rounded-full">Today</span>
          </div>

          {messages.map((msg) => {
            const isMe = msg.senderId === currentUser.uid;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                 {!isMe && (
                   <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-300 flex-shrink-0 mr-2 sm:mr-3 self-end flex items-center justify-center text-[10px] sm:text-xs font-bold text-gray-600">
                      {activeChat.vloggerName?.[0]}
                   </div>
                 )}
                 <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[70%]`}>
                    <div className={`px-3 py-2 sm:px-5 sm:py-3 rounded-2xl text-xs sm:text-sm shadow-sm leading-relaxed ${
                      isMe 
                        ? 'bg-gradient-to-r from-green-400 to-green-500 text-white rounded-br-none' 
                        : 'bg-white text-gray-700 border border-gray-100 rounded-bl-none'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Just now'}
                    </span>
                 </div>
              </div>
            );
          })}
          
          <div ref={messagesEndRef} />
        </div>

        {/* 추천 질문 영역 */}
        {suggestedQuestions.length > 0 && (
          <div className="px-3 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={12} className="text-purple-500 sm:w-3.5 sm:h-3.5" />
              <span className="text-[10px] sm:text-xs font-medium text-purple-600">추천 질문</span>
              {isLoadingQuestions && <span className="text-[10px] sm:text-xs text-gray-400">(업데이트 중...)</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {suggestedQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuestionClick(question)}
                  className="px-2 py-1.5 sm:px-3 sm:py-2 bg-white text-[11px] sm:text-sm text-gray-700 rounded-xl border border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all shadow-sm hover:shadow"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-3 sm:p-6 bg-white border-t border-gray-100">
          <form onSubmit={handleSendMessage} className="flex gap-2 sm:gap-3 bg-gray-50 p-1.5 sm:p-2 rounded-2xl border border-gray-200 focus-within:ring-2 focus-within:ring-green-100 focus-within:border-green-400 transition-all">
            <button type="button" className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/50 transition">
               <span className="text-base sm:text-xl">☺</span>
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="flex-1 bg-transparent focus:outline-none text-xs sm:text-sm text-gray-700"
            />
            <button 
              type="submit" 
              disabled={!newMessage.trim()}
              className={`p-1.5 sm:p-2 rounded-xl transition-all shadow-md ${newMessage.trim() ? 'bg-green-500 text-white hover:bg-green-600 transform hover:scale-105' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
            >
              <Send size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </form>
        </div>
      </div>

      {/* Right User Profile Panel */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto hidden xl:flex">
        <div className="p-8 flex flex-col items-center border-b border-gray-100">
          <div className="w-24 h-24 rounded-full bg-gray-200 mb-4 p-1 border-2 border-green-500 relative">
             <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
               {activeChat.vloggerName?.[0]}
             </div>
          </div>
          <h3 className="text-xl font-bold text-gray-800">{activeChat.vloggerName}</h3>
          <p className="text-sm text-gray-500 mb-2">{activeChat.vloggerRole || vlogInfo.role}</p>
          <p className="text-sm text-gray-600 text-center px-4">{vlogInfo.description || '현직자와의 대화를 통해 직무에 대해 알아보세요'}</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Information</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                 <Briefcase size={16} className="text-gray-400 mt-0.5" />
                 <div>
                   <p className="text-gray-800 font-medium">{vlogInfo.role || '직무 정보 없음'}</p>
                   <p className="text-xs text-gray-400">Role</p>
                 </div>
              </li>
              <li className="flex items-start gap-3">
                 <div className="text-gray-400 mt-0.5"><span className="text-base">📍</span></div>
                 <div>
                   <p className="text-gray-800 font-medium">{vlogInfo.location || 'Korea'}</p>
                   <p className="text-xs text-gray-400">Location</p>
                 </div>
              </li>
              <li className="flex items-start gap-3">
                 <div className="text-gray-400 mt-0.5"><span className="text-base">✉️</span></div>
                 <div>
                   <p className="text-gray-800 font-medium">{vlogInfo.email || 'private@mail.com'}</p>
                   <p className="text-xs text-gray-400">Email</p>
                 </div>
              </li>
            </ul>
          </div>

          <div>
             <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Related Vlogs</h4>
             <div className="relative rounded-xl overflow-hidden aspect-video group cursor-pointer shadow-md">
                <div className="absolute inset-0 bg-gray-900"></div>
                {/* Thumbnail Simulation */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-3">
                   <p className="text-white text-xs font-bold line-clamp-2">{vlogInfo.description || '브이로그 영상'}</p>
                   <div className="flex items-center gap-1 mt-1">
                      <Play size={10} className="fill-white text-white" />
                      <span className="text-[10px] text-gray-300">Play Reel</span>
                   </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/30">
                   <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      <Play size={20} className="fill-white text-white ml-1" />
                   </div>
                </div>
             </div>
          </div>
          
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {vlogInfo.tags?.map(tag => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
