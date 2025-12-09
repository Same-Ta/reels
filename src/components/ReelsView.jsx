import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  Bookmark, 
  Play,
  CheckCircle2,
  X,
  MessageSquare,
  FileText,
  Clock,
  Send,
  ArrowLeft,
  Check,
  Loader2
} from 'lucide-react';
import vlogDataDefault from '../data/vlogData';
import { db, auth } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// 전역 변수 (기본값: 무음)
let globalSoundOn = false; 

const ReelsView = ({ onClose, onStartChat }) => {
  const [shuffledVlogs] = useState(() => {
    const array = [...vlogDataDefault];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [interested, setInterested] = useState({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // 모달 상태
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMode, setChatMode] = useState(null); 
  const [paymentStep, setPaymentStep] = useState(1);
  const [selectedMentor, setSelectedMentor] = useState(null);
  
  // 현재 UI상 소리 상태 (화면에 아이콘 띄울지 말지 결정)
  // 초기값: true (무음)
  const [isMuted, setIsMuted] = useState(true);
  
  const [showGuide, setShowGuide] = useState(() => {
    const hasSeenGuide = localStorage.getItem('hasSeenReelsGuide');
    return !hasSeenGuide;
  });
  const [guideStep, setGuideStep] = useState(0);
  
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  
  // 터치 좌표
  const touchStartRef = useRef({ x: 0, y: 0 });
  const isSwipingRef = useRef(false);

  // [수정 1] 영상 변경 시: 전역 설정(사용자가 소리 켰는지)을 따라감
  React.useLayoutEffect(() => {
    setIsMuted(!globalSoundOn);
  }, [currentIndex]);

  const closeGuide = () => {
    setShowGuide(false);
    localStorage.setItem('hasSeenReelsGuide', 'true');
  };

  // [핵심 수정 2] 갤럭시 멈춤 해결: "강력한 재생 샌드위치"
  const toggleSound = () => {
    if (!iframeRef.current) return;

    // 1. 상태 업데이트
    const wantSound = !globalSoundOn;
    globalSoundOn = wantSound;
    setIsMuted(!wantSound);

    const command = wantSound ? 'unMute' : 'mute';

    // 2. 명령어 전송 (갤럭시 필승 전략)
    // (1) 선제 재생: 멈춰있을지 모르니 일단 재생
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'
    );

    // (2) 소리 변경
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: command, args: [] }), '*'
    );

    // (3) 후속 재생: 소리 변경 시 갤럭시가 영상을 멈추는 버그를 막기 위해
    // 0.05초 뒤에 다시 한번 "재생해!"라고 명령을 보냄 (setTimeout 필수)
    setTimeout(() => {
      if (iframeRef.current) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'
        );
      }
    }, 50);
  };

  // [핵심 수정 3] 영상 로딩 완료 시 처리
  const handleVideoLoad = () => {
    if (!iframeRef.current) return;

    // 1. 일단 무조건 재생 (가장 중요)
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'
    );

    // 2. 사용자가 이전에 소리를 켰다면? (globalSoundOn === true)
    if (globalSoundOn) {
      // 바로 켜지 말고 0.5초 뒤에 켬 (아이폰/갤럭시 로딩 충돌 방지)
      setTimeout(() => {
        if(iframeRef.current) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*'
          );
          // 소리 켜면서 멈출까봐 재생 명령 한 번 더
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*'
          );
        }
      }, 500); 
    } else {
      // 소리를 안 켰다면 확실히 끔
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*'
      );
    }
  };

  // ---------------------------------------------------------
  // [통합 터치/클릭 시스템] (PC & 모바일 완벽 호환)
  // ---------------------------------------------------------
  
  const goToNext = React.useCallback(() => {
    if (currentIndex < shuffledVlogs.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentIndex, shuffledVlogs.length, isTransitioning]);

  const goToPrev = React.useCallback(() => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex(prev => prev - 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentIndex, isTransitioning]);

  const handleTouchStart = React.useCallback((e) => {
    if (showChatModal || chatMode) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    isSwipingRef.current = false;
  }, [showChatModal, chatMode]);

  const handleTouchMove = React.useCallback((e) => {
    if (showChatModal || chatMode) return;
    if(e.cancelable) e.preventDefault(); // 갤럭시 스크롤 간섭 해결
    
    // 이동 거리 계산 -> 스와이프 판단
    const currentY = e.touches[0].clientY;
    if (Math.abs(touchStartRef.current.y - currentY) > 10) {
      isSwipingRef.current = true;
    }
  }, [showChatModal, chatMode]);

  const handleTouchEnd = React.useCallback((e) => {
    if (showChatModal || chatMode) return;
    
    const endY = e.changedTouches[0].clientY;
    const diffY = touchStartRef.current.y - endY;
    
    if (Math.abs(diffY) > 50) {
      if (diffY > 0) goToNext();
      else goToPrev();
    }
    // 탭 동작은 onClick에서 처리 (중복 실행 방지)
  }, [showChatModal, chatMode, goToNext, goToPrev]);

  // [핵심 수정 4] 클릭 핸들러: 이벤트 전파 완벽 차단
  const handleOverlayClick = (e) => {
    e.stopPropagation(); // 부모로 이벤트 전파 중단
    e.preventDefault();  // 브라우저 기본 동작(더블탭 확대 등) 중단
    
    // 스와이프 중이었다면 클릭 무시
    if (isSwipingRef.current) {
      isSwipingRef.current = false;
      return;
    }

    // 진짜 탭(클릭) -> 소리 토글 실행
    toggleSound();
  };

  // 이벤트 리스너 등록
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e) => handleTouchStart(e);
    const onTouchMove = (e) => handleTouchMove(e);
    const onTouchEnd = (e) => handleTouchEnd(e);

    // passive: false 필수 (스크롤 제어권 확보)
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [showChatModal, chatMode, currentIndex, isTransitioning, handleTouchStart, handleTouchMove, handleTouchEnd]); 

  // 키보드/휠 이벤트 (PC용)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showChatModal || chatMode) {
        if (e.key === 'Escape') { setShowChatModal(false); setChatMode(null); }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'j') goToNext();
      if (e.key === 'ArrowUp' || e.key === 'k') goToPrev();
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') toggleSound();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isTransitioning, showChatModal, chatMode, goToNext, goToPrev, onClose]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (showChatModal || chatMode) return;
      e.preventDefault();
      if (e.deltaY > 0) goToNext();
      else if (e.deltaY < 0) goToPrev();
    };
    const container = containerRef.current;
    if (container) container.addEventListener('wheel', handleWheel, { passive: false });
    return () => { if (container) container.removeEventListener('wheel', handleWheel); };
  }, [currentIndex, isTransitioning, showChatModal, chatMode, goToNext, goToPrev]);

  // DB 저장 함수들 (기존 유지)
  const saveOneOnOneClick = async () => { if (!selectedMentor) return; try { await addDoc(collection(db, 'oneOnOneClicks'), { mentorId: selectedMentor.id, mentorName: selectedMentor.username, mentorRole: selectedMentor.role, userId: auth.currentUser?.uid || 'anonymous', amount: 20000, status: 'clicked', createdAt: serverTimestamp() }); } catch (error) { console.error('Error', error); } };
  const toggleInterest = async (id) => { const newState = !interested[id]; if (!auth.currentUser) { alert('로그인이 필요합니다.'); return; } setInterested(prev => ({ ...prev, [id]: newState })); if (newState) { try { await addDoc(collection(db, 'bookmarks'), { userId: auth.currentUser.uid, vlogId: id, vlogData: currentVlog, createdAt: serverTimestamp() }); } catch { setInterested(prev => ({ ...prev, [id]: false })); } } };

  const currentVlog = shuffledVlogs[currentIndex];

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-50 bg-black flex flex-col overflow-hidden touch-none h-[100dvh]"
    >
      {/* 헤더 */}
      <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-30 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <h2 className="text-white font-bold text-lg flex items-center gap-2 pointer-events-auto">
          <Play size={20} className="text-pink-500 fill-pink-500" />
          Job Reels
          <span className="text-sm font-normal text-gray-400 ml-2">
            {currentIndex + 1} / {shuffledVlogs.length}
          </span>
        </h2>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-white/10 rounded-full text-white transition pointer-events-auto"
        >
          <X size={24} />
        </button>
      </div>

      {/* 메인 릴스 컨테이너 */}
      <div className="flex-1 flex items-center justify-center relative w-full">
        <div 
          className="relative w-full h-full mx-auto transition-transform duration-300 ease-out md:max-w-md"
          style={{
            transform: isTransitioning ? 'scale(0.95)' : 'scale(1)',
            opacity: isTransitioning ? 0.8 : 1
          }}
        >
          {/* YouTube iframe */}
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            {/* ★ Key 제거됨 (iframe 재활용) */}
            <iframe 
              ref={iframeRef}
              className="absolute inset-0 w-full h-full pointer-events-none object-cover"
              style={{ transform: 'scale(1.35)', pointerEvents: 'none' }} // pointerEvents: none 추가 (확실한 클릭 방지)
              // mute=1, autoplay=1 (필수)
              src={`https://www.youtube.com/embed/${currentVlog.videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&loop=1&playlist=${currentVlog.videoId}&showinfo=0&disablekb=1&fs=0&enablejsapi=1&origin=${window.location.origin}`}
              title={currentVlog.username}
              allow="autoplay; encrypted-media"
              allowFullScreen
              onLoad={handleVideoLoad}
            />
          </div>

          {/* ★ 소리 켜기/끄기 오버레이 버튼 
              - bg-transparent: 클릭 관통 방지
              - onClick: toggleSound 실행
          */}
          <div 
            className="absolute inset-0 z-10 w-full h-full bg-transparent flex items-center justify-center cursor-pointer" 
            onClick={handleOverlayClick}
          >
            {/* 소리 꺼진 상태(isMuted=true)일 때만 아이콘 표시 */}
            {isMuted && (
              <div className="bg-black/40 p-5 rounded-full backdrop-blur-sm animate-pulse pointer-events-none flex flex-col items-center">
                <span className="text-white text-4xl mb-2">🔇</span>
                <span className="text-white text-xs font-bold drop-shadow-lg whitespace-nowrap">
                  터치하여 소리 켜기
                </span>
              </div>
            )}
          </div>

          {/* 하단 정보 영역 (기존 유지) */}
          <div className="absolute bottom-0 left-0 right-0 p-3 pb-safe bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none z-20">
            <div className="pointer-events-auto pb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm ring-1 ring-white">
                  {currentVlog.username[0]}
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm drop-shadow-lg">{currentVlog.username}</h3>
                  <p className="text-gray-300 text-[10px] drop-shadow-lg">{currentVlog.role}</p>
                </div>
              </div>

              <p className="text-white text-[11px] mb-1.5 drop-shadow-lg leading-tight line-clamp-1">
                {currentVlog.description}
              </p>

              <div className="flex gap-1 overflow-x-auto mb-2 scrollbar-hide">
                {currentVlog.tags.map(tag => (
                  <span 
                    key={tag} 
                    className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full text-white backdrop-blur-sm whitespace-nowrap"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <button 
                  onTouchEnd={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMentor(currentVlog);
                    setChatMode('select');
                  }}
                  className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-95 text-xs touch-manipulation"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <MessageCircle size={16} />
                  이 직무에 대해 질문하기
                </button>
                <button 
                  onTouchEnd={(e) => e.stopPropagation()}
                  onClick={(e) => {
                      e.stopPropagation();
                      toggleInterest(currentVlog.id);
                  }}
                  className={`px-4 py-2 rounded-lg transition-all active:scale-95 backdrop-blur-sm flex items-center gap-1.5 text-xs font-bold shadow-lg ${
                    interested[currentVlog.id] 
                      ? 'bg-yellow-400 text-gray-900' 
                      : 'bg-black/40 text-white hover:bg-black/60'
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {interested[currentVlog.id] ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Bookmark size={16} />
                  )}
                  {interested[currentVlog.id] ? '저장됨' : '저장'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 모달들 (기존 코드 그대로 사용) */}
      {chatMode === 'select' && (
        <div className="absolute inset-0 z-60 bg-black flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <button onClick={() => { setChatMode(null); }} className="p-2 hover:bg-gray-800 rounded-full">
                    <ArrowLeft size={24} className="text-white" />
                </button>
                <h3 className="text-white font-bold text-lg">멘토에게 질문하기</h3>
                <div className="w-10"></div>
            </div>
            <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                <div className="w-full max-w-2xl mx-auto">
                    <p className="text-gray-300 text-sm text-center mb-6 mt-4">{selectedMentor?.username}님에게 질문하는 방법을 선택하세요.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button onClick={() => setChatMode('oneOnOneInfo')} className="p-5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/30 rounded-xl text-center hover:border-purple-500/60 transition-all active:scale-95 flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-purple-500/30 flex items-center justify-center mb-3"><MessageSquare size={32} className="text-purple-400" /></div>
                            <h4 className="text-white font-bold text-xl mb-2">1:1 대화</h4>
                            <span className="text-pink-400 font-bold text-lg mb-2">₩13,000</span>
                            <p className="text-gray-400 text-sm mb-2">30분 정도의 자유로운 대화</p>
                        </button>
                        <button onClick={() => {
                            onStartChat(selectedMentor);
                            setChatMode(null);
                        }} className="p-5 bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/30 rounded-xl text-center hover:border-green-500/60 transition-all active:scale-95 flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-green-500/30 flex items-center justify-center mb-3"><MessageSquare size={32} className="text-green-400" /></div>
                            <h4 className="text-white font-bold text-xl mb-2">1회 무료 질문하기</h4>
                            <span className="text-green-400 font-bold text-lg mb-2">무료 체험</span>
                            <p className="text-gray-400 text-xs">실시간 채팅으로 1회 무료 질문이 가능합니다</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {/* 1:1 대화 상세, 결제, 템플릿, 가이드 모달 등 (나머지 기존 코드 유지) */}
      {/* 1:1 대화 상세 설명 화면 - 페이지 전환 방식 */}
      {chatMode === 'oneOnOneInfo' && (
        <div className="absolute inset-0 z-[70] bg-black flex flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <button 
              onClick={() => setChatMode('select')}
              className="p-2 hover:bg-gray-800 rounded-full"
            >
              <ArrowLeft size={24} className="text-white" />
            </button>
            <h3 className="text-white font-bold text-lg">1:1 대화</h3>
            <div className="w-10"></div>
          </div>

          {/* 내용 - 스크롤 가능 */}
          <div className="flex-1 overflow-y-auto pb-20">
            <div className="p-4 space-y-4 max-w-md mx-auto">
              {/* 아이콘 */}
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center">
                  <MessageSquare size={32} className="text-white" />
                </div>
              </div>

              {/* 제목 */}
              <div className="text-center">
                <h2 className="text-white font-bold text-xl">1:1 대화</h2>
                <p className="text-purple-400 font-semibold text-lg mt-1">₩13,000</p>
              </div>
              {/* 멘토 정보 */}
              <div className="bg-gray-800/50 rounded-xl p-3 sm:p-4">
                <p className="text-gray-400 text-xs sm:text-sm mb-2">대화 상대</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm sm:text-base">
                    {selectedMentor?.username?.[0]}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm sm:text-base">{selectedMentor?.username?.replace('_', ' ')}</p>
                    <p className="text-gray-400 text-xs sm:text-sm">{selectedMentor?.role}</p>
                  </div>
                </div>
              </div>

              {/* 서비스 설명 */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-white font-bold text-base sm:text-lg">서비스 안내</h3>
                
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock size={14} className="text-purple-400 sm:w-4 sm:h-4" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm sm:text-base">30분 자유로운 대화</p>
                    <p className="text-gray-400 text-xs sm:text-sm">현직자와 30분 동안 자유롭게 대화하며 직무에 대해 깊이 있는 탐색을 할 수 있어요.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageSquare size={14} className="text-pink-400 sm:w-4 sm:h-4" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm sm:text-base">실시간 채팅 상담</p>
                    <p className="text-gray-400 text-xs sm:text-sm">일정 조율 후 Zoom 또는 Google Meet를 통해 실시간으로 대화할 수 있어요.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText size={14} className="text-green-400 sm:w-4 sm:h-4" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm sm:text-base">맞춤형 커리어 조언</p>
                    <p className="text-gray-400 text-xs sm:text-sm">이력서 피드백, 면접 팁, 업계 동향 등 궁금한 모든 것을 물어볼 수 있어요.</p>
                  </div>
                </div>
              </div>

              {/* 진행 과정 */}
              <div className="bg-gray-800/50 rounded-xl p-3 sm:p-4">
                <h4 className="text-white font-semibold mb-2 sm:mb-3 text-sm sm:text-base">진행 과정</h4>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center flex-shrink-0">1</span>
                    <span className="text-gray-300">결제 완료</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500/60 text-white text-xs flex items-center justify-center flex-shrink-0">2</span>
                    <span className="text-gray-300">멘토가 확인 후 일정 제안 (1~3일 소요)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500/40 text-white text-xs flex items-center justify-center flex-shrink-0">3</span>
                    <span className="text-gray-300">일정 확정 후 30분 대화 진행</span>
                  </div>
                </div>
              </div>

              {/* 유의사항 */}
              <div className="text-gray-500 text-xs space-y-1">
                <p>• 결제 후 멘토가 일정을 제안하면 카카오톡으로 알림을 보내드려요.</p>
                <p>• 멘토 사정으로 대화가 불가한 경우 전액 환불됩니다.</p>
                <p>• 결제 후 7일 이내 대화가 성사되지 않으면 자동 환불됩니다.</p>
              </div>
            </div>
          </div>

          {/* 하단 고정 버튼 */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 bg-black">
            <div className="max-w-md mx-auto">
              <button 
                onClick={() => {
                  saveOneOnOneClick();
                  setChatMode('payment');
                  setPaymentStep(1);
                }}
                className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all text-sm active:scale-95"
              >
                결제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 결제 화면 - KG이니시스 스타일 모달 팝업 */}
      {chatMode === 'payment' && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowChatModal(false); setChatMode(null); setPaymentStep(1); }}}>
          <div className="bg-[#e8e8e8] shadow-2xl w-full max-w-[800px] flex flex-col sm:flex-row overflow-hidden max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            {/* 닫기 버튼 - 최상단 우측 */}
            <button 
              onClick={() => {
                setShowChatModal(false);
                setChatMode(null);
                setPaymentStep(1);
              }}
              className="absolute top-2 right-2 z-50 w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md hover:bg-gray-100 text-gray-600 hover:text-gray-800"
            >
              <X size={20} />
            </button>
          {paymentStep === 1 && (
            <>
              {/* 왼쪽: 결제 수단 선택 - 모바일에서 숨김 */}
              <div className="hidden sm:flex w-[120px] bg-[#d9d9d9] flex-col text-[11px]">
                <div className="p-2.5 bg-white border-b border-[#ccc] flex items-center gap-1.5">
                  <input type="checkbox" className="w-3 h-3" readOnly />
                  <span className="text-gray-600">직접입력</span>
                </div>
                <div className="p-2.5 bg-[#ffcc00] text-gray-800 font-bold border-b border-[#e6b800]">
                  신용카드
                </div>
                <div className="flex-1 bg-white">
                  <div className="p-2.5 border-b border-[#eee] flex items-center gap-1.5">
                    <input type="checkbox" checked className="w-3 h-3 accent-blue-500" readOnly />
                    <span className="text-gray-700">신용카드</span>
                  </div>
                  <div className="p-2.5 text-[10px] text-gray-400 leading-tight">
                    신용카드 결제<br/>
                    결제 진행 시 ~
                  </div>
                  <div className="p-2.5 border-t border-[#eee] flex items-center gap-1.5">
                    <input type="checkbox" className="w-3 h-3" readOnly />
                    <span className="text-gray-600">실시간</span>
                  </div>
                  <div className="p-2.5 border-t border-[#eee] flex items-center gap-1.5">
                    <input type="checkbox" className="w-3 h-3" readOnly />
                    <span className="text-gray-600">가상계좌</span>
                  </div>
                  <div className="p-2.5 border-t border-[#eee] flex items-center gap-1.5">
                    <input type="checkbox" className="w-3 h-3" readOnly />
                    <span className="text-gray-600">카카오</span>
                  </div>
                </div>
              </div>

              {/* 가운데: 결제 수단 상세 */}
              <div className="flex-1 bg-white p-3 sm:p-4 overflow-y-auto sm:border-l sm:border-r border-[#ddd] min-w-0">
                {/* 헤더 */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 pb-2 border-b border-[#eee]">
                  <div className="flex items-center">
                    <span className="text-[#0066cc] font-bold text-sm">Code</span>
                    <span className="text-[#ff3366] font-bold text-sm">M</span>
                    <span className="text-gray-700 font-bold text-sm">Shop</span>
                  </div>
                  <p className="text-gray-400 text-[10px] sm:text-[11px]">안전하고 편리한 이니시스결제입니다.</p>
                </div>

                {/* 이용약관 */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-800 font-bold text-[13px]">이용약관</span>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" className="w-3 h-3" readOnly />
                      <span className="text-gray-500 text-[11px]">전체동의</span>
                    </label>
                  </div>
                  <div className="bg-[#f9f9f9] p-3 border border-[#ddd] text-[11px]">
                    <div className="mb-1.5">
                      <span className="text-gray-700">전자금융거래 이용약관</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[10px]">
                      <span className="text-gray-600">개인정보의 수집 및 이용안내</span>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" className="w-2.5 h-2.5" readOnly />
                        <span className="text-gray-500">동의</span>
                      </label>
                      <span className="text-gray-600">개인정보 제공 및 위탁안내</span>
                      <label className="flex items-center gap-1">
                        <input type="checkbox" className="w-2.5 h-2.5" readOnly />
                        <span className="text-gray-500">동의</span>
                      </label>
                    </div>
                    <button className="mt-2 px-2.5 py-1 bg-[#ffcc00] text-gray-700 text-[10px] rounded-sm font-medium">
                      약관보기 ▼
                    </button>
                  </div>
                </div>

                {/* 간편결제 */}
                <div className="space-y-2">
                  {/* 카카오페이 */}
                  <div className="flex items-center p-2.5 border border-[#ddd] bg-white cursor-pointer hover:bg-gray-50">
                    <div className="w-[50px] h-[22px] bg-[#ffeb00] rounded-sm flex items-center justify-center mr-3">
                      <span className="text-[#3c1e1e] font-bold text-[10px]">●pay</span>
                    </div>
                    <span className="text-gray-600 text-[12px]">온 국민이 다 쓰는 카카오페이</span>
                  </div>

                  {/* SSG페이 */}
                  <div className="flex items-center justify-between p-2.5 border border-[#ddd] bg-white cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center">
                      <span className="text-[#ff3366] font-bold text-[13px] mr-0.5">SSG</span>
                      <span className="text-[#ffcc00] font-bold text-[13px]">PAY.</span>
                      <span className="text-[#ff6699] text-[11px] ml-2">처음 쓰는 당신에게 3천원이 쏙~</span>
                    </div>
                    <span className="w-5 h-5 border border-[#ccc] rounded-full flex items-center justify-center text-gray-400 text-[12px]">+</span>
                  </div>

                  {/* 기타 페이 */}
                  <div className="grid grid-cols-4 gap-1.5">
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">PAYCO</button>
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">L.pay</button>
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">KPAY</button>
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">samsungPay</button>
                  </div>

                  {/* 카드사 선택 - 현대/삼성 */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50 flex items-center justify-center gap-1">
                      현대카드 <span className="w-4 h-4 bg-[#eee] rounded-full text-[10px] flex items-center justify-center">+</span>
                    </button>
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50 flex items-center justify-center gap-1">
                      삼성카드 <span className="w-4 h-4 bg-[#eee] rounded-full text-[10px] flex items-center justify-center">+</span>
                    </button>
                  </div>

                  {/* 카드사 4열 */}
                  <div className="grid grid-cols-4 gap-1.5">
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">비씨카드</button>
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">KB국민</button>
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">신한카드</button>
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">롯데카드</button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">NH농협</button>
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">하나카드</button>
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">씨티카드</button>
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">UnionPay</button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    <button className="p-2 border border-[#ddd] bg-white text-gray-600 text-[11px] hover:bg-gray-50">그외카드</button>
                  </div>
                </div>

                {/* 국기 아이콘 */}
                <div className="flex items-center gap-2 mt-4">
                  {/* 미국 국기 */}
                  <div className="w-7 h-5 border border-[#ddd] overflow-hidden flex flex-col">
                    <div className="flex-1 bg-[#bf0a30]"></div>
                    <div className="flex-1 bg-white"></div>
                    <div className="flex-1 bg-[#bf0a30]"></div>
                  </div>
                  {/* 한국 국기 */}
                  <div className="w-7 h-5 bg-white border border-[#ddd] flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-b from-[#c60c30] via-[#c60c30] to-[#003478]" style={{background: 'linear-gradient(to bottom, #c60c30 50%, #003478 50%)'}}></div>
                  </div>
                </div>
              </div>

              {/* 오른쪽: 결제 정보 - 노란색 배경 */}
              <div className="w-full sm:w-[180px] bg-[#fff8dc] p-4 flex flex-col relative">
                {/* KG이니시스 로고 */}
                <div className="mb-4 mt-2">
                  <span className="text-[#ff6600] font-bold text-[15px]">KG</span>
                  <span className="text-gray-600 text-[15px]"> 이니시스</span>
                </div>

                {/* 결제 정보 */}
                <div className="space-y-2.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">상품명</span>
                    <span className="text-[#0066cc]">1:1 멘토링</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">상품가격</span>
                    <span className="text-[#ff6600]">13,000 원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">제공기간</span>
                    <span className="text-[#ff6600]">별도제공기간없음</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#eed]">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-[11px]">결제금액</span>
                    <span className="text-[#0066cc] font-bold text-[16px]">13,000 원</span>
                  </div>
                </div>

                {/* 다음 버튼 */}
                <div className="mt-auto">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      setPaymentStep(2);
                      setTimeout(() => setPaymentStep(3), 1500);
                    }}
                    className="w-full py-2 bg-gradient-to-b from-[#ffdd55] to-[#ffcc00] hover:from-[#ffcc00] hover:to-[#eebb00] text-gray-700 text-[12px] font-medium rounded-sm border border-[#dda] transition-all flex items-center justify-center gap-1"
                  >
                    다 음
                  </button>
                </div>
              </div>
            </>
          )}

          {paymentStep === 2 && (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center">
                <Loader2 size={48} className="text-yellow-500 animate-spin mx-auto mb-6" />
                <h3 className="text-gray-900 font-bold text-xl mb-2">결제 처리 중...</h3>
                <p className="text-gray-500">잠시만 기다려주세요</p>
              </div>
            </div>
          )}

          {paymentStep === 3 && (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center p-8">
                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6">
                  <Check size={40} className="text-white" />
                </div>
                <h3 className="text-gray-900 font-bold text-xl mb-2">결제가 완료되었습니다!</h3>
                <p className="text-gray-500">
                  재생에너지 엔지니어님과의 1:1 대화가 예약되었습니다.<br/>
                  멘토가 확인 후 연락드릴 예정입니다.
                </p>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* 템플릿 질문 화면은 제거됨 - 1회 무료 채팅으로 대체 */}

      {/* 가이드라인 모달 */}
      {showGuide && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* 가이드 콘텐츠 */}
            <div className="p-6">
              {guideStep === 0 && (
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Play size={36} className="text-white ml-1" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">직무 탐색 시작하기</h2>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    다양한 직업인들의 <span className="font-semibold text-purple-600">브이로그</span>를 통해<br/>
                    생생한 직무 이야기를 들어보세요!
                  </p>
                  <div className="bg-gray-100 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-purple-600 font-bold">1</span>
                      </div>
                      <p className="text-gray-700 text-sm">
                        <span className="font-semibold">위/아래로 스와이프</span>하여 다양한 직업 영상을 탐색해요
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {guideStep === 1 && (
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle size={36} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">대화하기 버튼</h2>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    궁금한 직업을 발견하면<br/>
                    <span className="font-semibold text-green-600">대화하기</span> 버튼을 눌러보세요!
                  </p>
                  <div className="bg-gray-100 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-green-600 font-bold">2</span>
                      </div>
                      <p className="text-gray-700 text-sm">
                        영상 하단의 <span className="font-semibold">"이 직무에 대해 질문하기"</span> 버튼을 클릭해요
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {guideStep === 2 && (
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText size={36} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">질문 방법 선택</h2>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    <span className="font-semibold text-orange-500">1:1 대화</span> 또는{' '}
                    <span className="font-semibold text-green-500">템플릿 질문</span>을<br/>
                    선택할 수 있어요!
                  </p>
                  <div className="space-y-3">
                    <div className="bg-orange-50 rounded-xl p-4">
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <MessageCircle size={18} className="text-orange-600" />
                        </div>
                        <div>
                          <p className="text-gray-800 font-semibold text-sm">1:1 대화</p>
                          <p className="text-gray-500 text-xs">30분 자유 대화 (유료)</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4">
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <FileText size={18} className="text-green-600" />
                        </div>
                        <div>
                          <p className="text-gray-800 font-semibold text-sm">템플릿으로 질문</p>
                          <p className="text-gray-500 text-xs">1회 무료 질문</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {guideStep === 3 && (
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bookmark size={36} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">관심 직업 저장</h2>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    마음에 드는 직업은<br/>
                    <span className="font-semibold text-yellow-600">저장 버튼</span>으로 보관해두세요!
                  </p>
                  <div className="bg-gray-100 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bookmark size={18} className="text-yellow-600" />
                      </div>
                      <p className="text-gray-700 text-sm">
                        우측 상단의 <span className="font-semibold">저장 버튼</span>을 눌러 관심 직업을 저장해요
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 진행 표시기 & 버튼 */}
            <div className="px-6 pb-6">
              {/* 도트 인디케이터 */}
              <div className="flex justify-center gap-2 mb-4">
                {[0, 1, 2, 3].map((step) => (
                  <div 
                    key={step}
                    className={`w-2 h-2 rounded-full transition-all ${
                      guideStep === step ? 'bg-purple-500 w-6' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              {/* 버튼 */}
              <div className="flex gap-3">
                {guideStep > 0 && (
                  <button
                    onClick={() => setGuideStep(prev => prev - 1)}
                    className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition-all"
                  >
                    이전
                  </button>
                )}
                {guideStep < 3 ? (
                  <button
                    onClick={() => setGuideStep(prev => prev + 1)}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all"
                  >
                    다음
                  </button>
                ) : (
                  <button
                    onClick={closeGuide}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all"
                  >
                    시작하기
                  </button>
                )}
              </div>

              {/* 건너뛰기 */}
              {guideStep < 3 && (
                <button
                  onClick={closeGuide}
                  className="w-full mt-3 py-2 text-gray-400 hover:text-gray-600 text-sm transition-all"
                >
                  건너뛰기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReelsView;
