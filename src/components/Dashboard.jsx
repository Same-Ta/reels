import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth, appId } from '../config/firebase';
import { TrendingUp, Bookmark, MessageCircle, Menu, Play, BarChart3, Activity } from 'lucide-react';
import vlogDataDefault from '../data/vlogData';

const Dashboard = ({ onViewReels, onToggleSidebar, onOpenChat, onViewBookmarks, activeChat }) => {
  const [dailyActivity, setDailyActivity] = useState([]);
  const [totalBookmarks, setTotalBookmarks] = useState(0);
  const [thisWeekBookmarks, setThisWeekBookmarks] = useState(0);
  const [bookmarks, setBookmarks] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateDailyActivity = (bookmarksWithTimestamps) => {
      // 최근 7일 데이터 준비
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const today = new Date();
      const last7Days = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        last7Days.push({
          date: date.toISOString().split('T')[0],
          day: days[date.getDay()],
          count: 0
        });
      }
      
      // 북마크 카운트
      bookmarksWithTimestamps.forEach(bookmark => {
        if (bookmark.timestamp && bookmark.timestamp.seconds) {
          const bookmarkDate = new Date(bookmark.timestamp.seconds * 1000);
          const dateStr = bookmarkDate.toISOString().split('T')[0];
          
          const dayData = last7Days.find(d => d.date === dateStr);
          if (dayData) {
            dayData.count += 1;
          }
        }
      });
      
      // 이번주 북마크 계산
      const weekCount = last7Days.reduce((sum, day) => sum + day.count, 0);
      setThisWeekBookmarks(weekCount);
      
      setDailyActivity(last7Days);
    };

    if (!auth.currentUser) return;

    const bookmarksRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookmarks');
    const bookmarksQuery = query(bookmarksRef, where('userId', '==', auth.currentUser.uid));
    
    const unsubscribeBookmarks = onSnapshot(bookmarksQuery, (snapshot) => {
      console.log('Bookmarks snapshot:', snapshot.docs.length, 'documents');
      const bookmarkList = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Bookmark data:', data);
        
        // vlogData가 있으면 그걸 사용, 없으면 vlogId로 찾기
        const vlogInfo = data.vlogData || vlogDataDefault.find(v => v.videoId === data.vlogId);
        
        return {
          id: doc.id,
          vlogId: data.vlogId,
          timestamp: data.timestamp,
          vlogInfo: vlogInfo
        };
      });
      
      console.log('Processed bookmarkList:', bookmarkList);
      setBookmarks(bookmarkList);
      setTotalBookmarks(bookmarkList.length);
      calculateDailyActivity(bookmarkList);
      setLoading(false);
    }, (error) => {
      console.error('Error loading bookmarks:', error);
      setLoading(false);
    });

    const chatsRef = collection(db, 'artifacts', appId, 'public', 'data', 'chats');
    const chatsQuery = query(chatsRef, where('guestId', '==', auth.currentUser.uid));
    
    const unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
      let chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      chatList.sort((a, b) => (b.lastTimestamp?.seconds || 0) - (a.lastTimestamp?.seconds || 0));
      setChats(chatList);
    }, (error) => {
      console.error('Error loading chats:', error);
    });

    return () => {
      unsubscribeBookmarks();
      unsubscribeChats();
    };
  }, []);

  const handleSelectChat = (chat) => {
    if (onOpenChat) {
      onOpenChat(chat);
    }
  };

  // 최대값 계산 (그래프 정규화용)
  const maxActivity = Math.max(...dailyActivity.map(d => d.count), 1);

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 h-screen overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 sm:py-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 모바일 햄버거 메뉴 */}
              <button 
                onClick={onToggleSidebar}
                className="sm:hidden p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <Menu size={24} className="text-gray-700" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="text-purple-600" size={28} />
                  취준로그
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">나의 활동과 채팅을 한눈에 확인하세요</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={onViewReels}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-300 to-purple-400 text-white rounded-lg hover:shadow-lg transition hover:from-purple-400 hover:to-purple-500"
              >
                <Play size={16} />
                <span className="text-sm font-semibold">릴스 보기</span>
              </button>
              <div className="w-9 h-9 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center shadow-md">
                <span className="text-sm font-bold text-white">
                  {auth.currentUser?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Main Content - 통계 + 채팅 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">
            {/* 상단: 최근 채팅 (좌측) + 나의 활동 (우측) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* 좌측: 최근 채팅 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col" style={{ height: '480px' }}>
                <div className="p-6 border-b">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <MessageCircle size={20} className="text-purple-600" />
                    최근 채팅
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">진행 중인 대화를 확인하세요</p>
                </div>

                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : chats.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center p-6">
                    <div>
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageCircle size={32} className="text-gray-400" />
                      </div>
                      <h4 className="text-base font-semibold text-gray-900 mb-2">대화가 없습니다</h4>
                      <p className="text-sm text-gray-500 mb-4">릴스에서 관심있는 직업을 찾고<br/>대화를 시작해보세요!</p>
                      <button
                        onClick={onViewReels}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold"
                      >
                        릴스 보기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    {chats.slice(0, 5).map(chat => (
                      <div
                        key={chat.id}
                        onClick={() => handleSelectChat(chat)}
                        className={`p-4 border-b hover:bg-purple-50 cursor-pointer transition ${
                          activeChat?.id === chat.id ? 'bg-purple-50 border-l-4 border-l-purple-500' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                              {chat.vloggerName?.[0] || 'V'}
                            </div>
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-gray-900 text-sm">{chat.vloggerName}</h4>
                              <span className="text-xs text-gray-400">
                                {chat.lastTimestamp?.seconds 
                                  ? new Date(chat.lastTimestamp.seconds * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                                  : ''}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mb-1">{chat.vloggerRole}</p>
                            <p className="text-sm text-gray-600 truncate">{chat.lastMessage || '대화를 시작해보세요'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 우측: 나의 활동 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <BarChart3 size={20} className="text-purple-600" />
                      나의 활동
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">최근 7일간 저장한 릴스</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold">주간</button>
                    <button className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200">월간</button>
                  </div>
                </div>

                {/* Activity Chart */}
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Bar Chart */}
                    <div className="flex items-end justify-between gap-3 h-48 bg-gradient-to-t from-purple-50/30 to-transparent rounded-xl p-4">
                      {dailyActivity.map((day, index) => {
                        const heightPercent = maxActivity > 0 ? (day.count / maxActivity) * 100 : 0;
                        return (
                          <div key={index} className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-full flex flex-col items-center justify-end h-full">
                              <div className="relative group">
                                {day.count > 0 && (
                                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                                    {day.count}개
                                  </div>
                                )}
                                <div 
                                  className={`w-full rounded-t-lg transition-all duration-500 ${
                                    day.count > 0 
                                      ? 'bg-gradient-to-t from-purple-500 to-purple-400 hover:from-purple-600 hover:to-purple-500' 
                                      : 'bg-gray-200'
                                  }`}
                                  style={{ 
                                    height: `${Math.max(heightPercent, day.count > 0 ? 10 : 5)}%`,
                                    minHeight: day.count > 0 ? '20px' : '8px'
                                  }}
                                />
                              </div>
                            </div>
                            <span className="text-xs font-medium text-gray-600 mt-2">{day.day}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-3 gap-3 pt-4 border-t">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{thisWeekBookmarks}</div>
                        <div className="text-xs text-gray-500 mt-1">이번 주</div>
                      </div>
                      <div className="text-center border-l border-r">
                        <div className="text-2xl font-bold text-blue-600">
                          {dailyActivity.length > 0 ? Math.max(...dailyActivity.map(d => d.count)) : 0}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">최고 기록</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {thisWeekBookmarks > 0 ? Math.round(thisWeekBookmarks / 7 * 10) / 10 : 0}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">일 평균</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 하단 통계 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Total Bookmarks */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center">
                    <Bookmark size={24} className="text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 bg-blue-50 px-2.5 py-1 rounded-full">전체</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{totalBookmarks}</div>
                <div className="text-sm text-gray-500">저장한 직업</div>
              </div>

              {/* This Week */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                    <TrendingUp size={24} className="text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 bg-green-50 px-2.5 py-1 rounded-full">이번주</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{thisWeekBookmarks}</div>
                <div className="text-sm text-gray-500">이번 주 저장</div>
              </div>

              {/* Chat Count */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center">
                    <MessageCircle size={24} className="text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 bg-purple-50 px-2.5 py-1 rounded-full">활성</span>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{chats.length}</div>
                <div className="text-sm text-gray-500">진행 중인 대화</div>
              </div>
            </div>

            {/* 저장된 릴스 목록 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Bookmark size={20} className="text-blue-600" />
                    저장된 릴스
                    {bookmarks.length > 0 && (
                      <span className="text-sm font-normal text-gray-500">({bookmarks.length})</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">관심있는 직업을 다시 확인해보세요</p>
                </div>
                {bookmarks.length > 8 && (
                  <button
                    onClick={onViewBookmarks}
                    className="px-4 py-2 bg-gradient-to-r from-purple-300 to-purple-400 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold hover:from-purple-400 hover:to-purple-500"
                  >
                    전체보기
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : bookmarks.length === 0 ? (
                <div className="flex items-center justify-center text-center p-12">
                  <div>
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Bookmark size={32} className="text-gray-400" />
                    </div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">저장된 릴스가 없습니다</h4>
                    <p className="text-sm text-gray-500 mb-4">릴스를 보고 관심있는 직업을<br/>저장해보세요!</p>
                    <button
                      onClick={onViewReels}
                      className="px-4 py-2 bg-gradient-to-r from-purple-300 to-purple-400 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold hover:from-purple-400 hover:to-purple-500"
                    >
                      릴스 보기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
                  {bookmarks.slice(0, 8).map((bookmark, index) => {
                    const vlog = bookmark.vlogInfo;
                    if (!vlog) return null;
                    
                    return (
                      <div
                        key={bookmark.vlogId || index}
                        className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                        onClick={onViewReels}
                      >
                        {/* 썸네일 */}
                        <div className="relative aspect-video bg-gray-200 overflow-hidden">
                          <img
                            src={`https://img.youtube.com/vi/${vlog.videoId}/maxresdefault.jpg`}
                            alt={vlog.username}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.target.src = `https://img.youtube.com/vi/${vlog.videoId}/hqdefault.jpg`;
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play size={24} className="text-purple-600 ml-1" />
                            </div>
                          </div>
                          {/* 저장된 뱃지 */}
                          <div className="absolute top-2 right-2 bg-yellow-400 text-gray-900 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <Bookmark size={12} className="fill-current" />
                            저장됨
                          </div>
                        </div>
                        
                        {/* 정보 */}
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                              {vlog.username[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 text-sm truncate">{vlog.username}</h4>
                              <p className="text-xs text-gray-500 truncate">{vlog.role}</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                            {vlog.description}
                          </p>
                          <div className="flex gap-1 flex-wrap">
                            {vlog.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
