import React, { useState, useEffect } from 'react';
import { 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  serverTimestamp,
  doc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';

// Config & Data
import { auth, db, appId } from './config/firebase';

// Components
import { Sidebar, ChatListPanel, ChatArea, ReelsView, AdminLogin, AdminChatPanel, BookmarksView, Dashboard } from './components';

// Main App Component
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'chat', 'reels', or 'admin'
  const [activeChat, setActiveChat] = useState(null);
  const [allChats, setAllChats] = useState([]); // 모든 채팅 목록
  // 관리자 상태는 초기화 시 localStorage에서 읽어옴
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('isAdmin') === 'true';
  });
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isChatListCollapsed, setIsChatListCollapsed] = useState(false);

  // Instagram 인앱 브라우저 감지 및 리디렉션
  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isInstagram = /Instagram/i.test(userAgent);
    
    if (isInstagram) {
      const currentUrl = window.location.href;
      const isAndroid = /Android/i.test(userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
      
      if (isAndroid) {
        // Android: Chrome으로 강제 리디렉션
        const intentUrl = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
        window.location.href = intentUrl;
      } else if (isIOS) {
        // iOS: Safari로 리디렉션 안내
        alert('Instagram 내부 브라우저에서는 일부 기능이 제한됩니다.\n\n우측 상단 \'...\' 메뉴를 눌러 \'Safari에서 열기\' 또는 \'Chrome에서 열기\'를 선택해주세요.');
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthLoading(false);
      }
    });

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error('Auth error:', error);
        setAuthError(error.message);
        setAuthLoading(false);
      }
    };
    
    initAuth();
    return () => unsubscribe();
  }, []);

  // 채팅 목록 구독
  useEffect(() => {
    if (!user) return;
    
    const chatsRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats');
    const q = query(chatsRef, where('guestId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      chatList.sort((a, b) => (b.lastTimestamp?.seconds || 0) - (a.lastTimestamp?.seconds || 0));
      setAllChats(chatList);
    });
    
    return () => unsubscribe();
  }, [user]);

  const handleStartChat = async (vlog) => {
    if (!user) return;
    const chatId = `${user.uid}_${vlog.id}`;
    const chatRef = doc(db, 'artifacts', appId, 'public', 'data', 'chats', chatId);
    
    await setDoc(chatRef, {
      guestId: user.uid,
      guestName: 'Guest User', 
      vloggerId: vlog.id,
      vloggerName: vlog.username,
      vloggerRole: vlog.role,
      lastTimestamp: serverTimestamp(),
    }, { merge: true });

    setActiveChat({ 
      id: chatId, 
      name: vlog.username, 
      role: vlog.role, 
      vloggerName: vlog.username, 
      vloggerRole: vlog.role, 
      vloggerId: vlog.id 
    });
    setView('chat'); // Go back to chat view
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('isAdmin');
    auth.signOut();
    window.location.reload();
  };

  const handleAdminClick = () => {
    if (isAdmin) {
      // 이미 관리자면 관리자 뷰로 이동
      setView('admin');
    } else {
      // 관리자 로그인 모달 표시
      setShowAdminLogin(true);
    }
  };

  const handleAdminLogin = () => {
    setIsAdmin(true);
    localStorage.setItem('isAdmin', 'true');
    setShowAdminLogin(false);
    setView('admin');
  };

  if (authLoading) {
    return (
      <div className="h-screen w-full bg-[#1e2024] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (authError || !user) {
    return (
      <div className="h-screen w-full bg-[#1e2024] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4 text-center px-4 max-w-2xl">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold">인증 오류</h2>
          <p className="text-gray-400 text-sm">
            Firebase 익명 인증이 활성화되지 않았습니다.<br/>
            Firebase Console에서 Authentication → Sign-in method → Anonymous를 활성화해주세요.
          </p>
          {authError && (
            <div className="text-red-400 text-xs mt-2 bg-red-500/10 px-4 py-3 rounded-lg">
              <p className="font-mono">{authError}</p>
              <p className="mt-2 text-gray-300">Firebase: Error (auth/configuration-not-found)</p>
            </div>
          )}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-left text-sm text-gray-300 mt-4">
            <p className="font-bold text-blue-400 mb-2">🔧 해결 방법:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Firebase Console 접속: <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">console.firebase.google.com</a></li>
              <li>프로젝트 선택: <span className="font-mono bg-gray-700 px-2 py-0.5 rounded">reels-c097d</span></li>
              <li>왼쪽 메뉴에서 <strong>Authentication</strong> 클릭</li>
              <li><strong>Sign-in method</strong> 탭 클릭</li>
              <li><strong>Anonymous</strong> 항목 찾아서 <strong>사용 설정</strong> 클릭</li>
              <li>이 페이지에서 <strong>다시 시도</strong> 버튼 클릭</li>
            </ol>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-6 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-[#1e2024] font-sans overflow-hidden">
      
      {/* 관리자 로그인 모달 */}
      {showAdminLogin && (
        <AdminLogin 
          onLogin={handleAdminLogin}
          onCancel={() => setShowAdminLogin(false)}
        />
      )}

      {/* 1. Sidebar - 데스크톱에서만 보임 */}
      <div className="hidden sm:flex">
        <Sidebar 
          currentView={view} 
          onViewChange={(newView) => {
            setView(newView);
            // 채팅 뷰로 전환할 때 채팅이 없으면 최근 채팅 자동 선택
            if (newView === 'chat' && !activeChat && allChats.length > 0) {
              setActiveChat(allChats[0]);
            }
          }} 
          onLogout={handleLogout}
          onAdminClick={handleAdminClick}
          isAdmin={isAdmin}
        />
      </div>

      {/* 모바일 사이드바 오버레이 */}
      {showMobileSidebar && (
        <div 
          className="sm:hidden fixed inset-0 z-[100] bg-black/50"
          onClick={() => setShowMobileSidebar(false)}
        >
          <div 
            className="absolute left-0 top-0 h-full w-64 bg-[#2c2f33] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar 
              currentView={view} 
              onViewChange={(newView) => {
                setView(newView);
                setShowMobileSidebar(false);
                // 채팅 뷰로 전환할 때 채팅이 없으면 최근 채팅 자동 선택
                if (newView === 'chat' && !activeChat && allChats.length > 0) {
                  setActiveChat(allChats[0]);
                }
              }} 
              onLogout={handleLogout}
              onAdminClick={handleAdminClick}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      {/* 2. Content Area */}
      <div className="flex-1 flex relative overflow-hidden">
        
        {/* 대시보드 뷰 (첫 화면) */}
        {view === 'dashboard' ? (
          <Dashboard 
            onStartChat={handleStartChat}
            onViewReels={() => setView('reels')}
            onToggleSidebar={() => setShowMobileSidebar(true)}
            onOpenChat={(chat) => {
              setActiveChat(chat);
              setView('chat');
            }}
            onViewBookmarks={() => setView('bookmarks')}
            activeChat={activeChat}
            currentUser={user}
          />
        ) : view === 'bookmarks' ? (
          <BookmarksView onClose={() => setView('dashboard')} />
        ) : view === 'admin' && isAdmin ? (
          /* 관리자 뷰 */
          <AdminChatPanel onBack={() => setView('dashboard')} />
        ) : (
          <>
            {/* 모바일 오버레이 사이드바 - 전체 카테고리 메뉴 */}
            {showMobileSidebar && (
              <div 
                className="md:hidden fixed inset-0 z-[100] bg-black/50"
                onClick={() => setShowMobileSidebar(false)}
              >
                <div 
                  className="absolute left-0 top-0 h-full w-64 bg-[#2c2f33] shadow-xl animate-slide-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Sidebar 
                    currentView={view} 
                    onViewChange={(newView) => {
                      setView(newView);
                      setShowMobileSidebar(false);
                    }} 
                    onLogout={handleLogout}
                    onAdminClick={handleAdminClick}
                    isAdmin={isAdmin}
                  />
                </div>
              </div>
            )}

            {/* Chat List - 데스크톱에서만 표시 */}
            <div className={`hidden sm:flex flex-col border-r border-gray-700 h-full ${isChatListCollapsed ? 'w-16' : 'w-80'}`}>
              <ChatListPanel 
                currentUser={user} 
                activeChatId={activeChat?.id} 
                onSelectChat={setActiveChat}
                isCollapsed={isChatListCollapsed}
                onToggleCollapse={() => setIsChatListCollapsed(!isChatListCollapsed)}
                onToggleSidebar={() => setShowMobileSidebar(true)}
                showMobileMenu={false}
              />
            </div>
            
            {/* Chat Window - 데스크톱에서는 항상, 모바일에서는 전체 화면 */}
            <div className="flex-1 flex h-full overflow-hidden">
              <ChatArea 
                activeChat={activeChat} 
                currentUser={user}
                onToggleSidebar={() => setShowMobileSidebar(true)}
              />
            </div>

            {/* 3. Reels Overlay (When view is 'reels') */}
            {view === 'reels' && (
              <ReelsView 
                onClose={() => setView('dashboard')} 
                onStartChat={handleStartChat}
              />
            )}
          </>
        )}
      </div>

    </div>
  );
}