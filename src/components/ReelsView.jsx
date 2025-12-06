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

// [중요] "사용자가 소리를 켰는가?"를 기억하는 전역 변수
// false(음소거)로 시작하지만, 한 번 켜면 계속 true 유지
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
  const [templateStep, setTemplateStep] = useState(1);
  const [questionSummary, setQuestionSummary] = useState('');
  const [questionDetail, setQuestionDetail] = useState('');
  const [email, setEmail] = useState('');
  const [selectedMentor, setSelectedMentor] = useState(null);
  
  // 현재 UI상 소리 상태 (화면에 아이콘 띄울지 말지 결정)
  const [isMuted, setIsMuted] = useState(!globalSoundOn);
  
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

  // 영상 변경 시 UI 상태 업데이트
  useEffect(() => {
    // 전역 소리 상태에 맞춰 UI 아이콘 상태 동기화
    setIsMuted(!globalSoundOn);
  }, [currentIndex]);

  const closeGuide = () => {
    setShowGuide(false);
    localStorage.setItem('hasSeenReelsGuide', 'true');
  };

  // [소리 토글] 사용자가 화면을 탭했을 때 실행
  const toggleSound = () => {
    if (!iframeRef.current) return;
    
    // 상태 뒤집기
    const wantSound = !globalSoundOn;
    globalSoundOn = wantSound; // 전역 변수 업데이트
    setIsMuted(!wantSound);    // UI 업데이트
    
    // 명령어 전송
    const command = wantSound ? 'unMute' : 'mute';
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: command, args: [] }), 
      '*'
    );
    // 소리 켜면서 재생도 확실하게 (멈춤 방지)
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 
      '*'
    );
  };

  // ---------------------------------------------------------
  // [핵심] 영상 로딩 완료 핸들러 (숏츠 방식 구현)
  // ---------------------------------------------------------
  const handleVideoLoad = () => {
    if (iframeRef.current) {
      // 1. [재생] 일단 무조건 재생 명령부터 보냄 (영상 멈춤 방지 최우선)
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 
        '*'
      );

      // 2. [소리] 전역 상태 확인
      if (globalSoundOn) {
        // 사용자가 이전에 소리를 켰다면 -> 즉시 소리 켬 (연속 재생)
        // iframe을 재활용했기 때문에 아이폰도 이걸 막지 않음!
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*'
        );
      } else {
        // 아직 소리를 안 켰거나 껐다면 -> 소리 끔
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*'
        );
      }
    }
  };

  // ---------------------------------------------------------
  // [통합 터치/클릭 시스템] (PC & 모바일 완벽 호환)
  // ---------------------------------------------------------
  
  const goToNext = () => {
    if (currentIndex < shuffledVlogs.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex(prev => prev - 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  const handleTouchStart = (e) => {
    if (showChatModal || chatMode) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e) => {
    if (showChatModal || chatMode) return;
    if(e.cancelable) e.preventDefault(); // 갤럭시 스크롤 간섭 해결
    
    // 이동 거리 계산 -> 스와이프 판단
    const currentY = e.touches[0].clientY;
    if (Math.abs(touchStartRef.current.y - currentY) > 10) {
      isSwipingRef.current = true;
    }
  };

  const handleTouchEnd = (e) => {
    if (showChatModal || chatMode) return;
    
    const endY = e.changedTouches[0].clientY;
    const diffY = touchStartRef.current.y - endY;
    
    // 스와이프 (50px 이상)
    if (Math.abs(diffY) > 50) {
      if (diffY > 0) goToNext();
      else goToPrev();
    }
    // 탭 동작은 onClick(handleOverlayClick)에서 처리
  };

  // [클릭 핸들러] PC/모바일 공용
  const handleOverlayClick = (e) => {
    e.stopPropagation();
    
    // 스와이프 중이었다면 클릭 무시 (화면 넘김만 수행)
    if (isSwipingRef.current) {
      isSwipingRef.current = false;
      return;
    }

    // 진짜 탭(클릭) -> 소리 토글
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
  }, [showChatModal, chatMode, currentIndex, isTransitioning]); 

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
  }, [currentIndex, isTransitioning, showChatModal, chatMode]);

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
  }, [currentIndex, isTransitioning, showChatModal, chatMode]);

  // DB 저장 함수들 (기존 유지)
  const saveOneOnOneClick = async () => { if (!selectedMentor) return; try { await addDoc(collection(db, 'oneOnOneClicks'), { mentorId: selectedMentor.id, mentorName: selectedMentor.username, mentorRole: selectedMentor.role, userId: auth.currentUser?.uid || 'anonymous', amount: 20000, status: 'clicked', createdAt: serverTimestamp() }); } catch (error) { console.error('Error', error); } };
  const saveTemplateQuestion = async () => { if (!selectedMentor) return; try { await addDoc(collection(db, 'templateQuestions'), { mentorId: selectedMentor.id, mentorName: selectedMentor.username, mentorRole: selectedMentor.role, userId: auth.currentUser?.uid || 'anonymous', questionSummary: questionSummary, questionDetail: questionDetail, email: email, status: 'pending', createdAt: serverTimestamp() }); } catch (error) { console.error('Error', error); } };
  const toggleInterest = async (id) => { const newState = !interested[id]; if (!auth.currentUser) { alert('로그인이 필요합니다.'); return; } setInterested(prev => ({ ...prev, [id]: newState })); if (newState) { try { await addDoc(collection(db, 'bookmarks'), { userId: auth.currentUser.uid, vlogId: id, vlogData: currentVlog, createdAt: serverTimestamp() }); } catch (error) { setInterested(prev => ({ ...prev, [id]: false })); } } };

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
          <div className="absolute inset-0 w-full h-full overflow-hidden rounded-xl">
            {/* ★★★ [가장 중요] key를 제거하여 iframe을 재활용합니다. ★★★ 
               이렇게 해야 아이폰에서 영상이 바뀌어도 "같은 플레이어"로 인식해서 
               소리 권한을 유지해줍니다.
            */}
            <iframe 
              ref={iframeRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              // mute=1 (초기 로딩은 무조건 무음) - onLoad에서 JS로 풉니다.
              src={`https://www.youtube.com/embed/${currentVlog.videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&loop=1&playlist=${currentVlog.videoId}&showinfo=0&disablekb=1&fs=0&enablejsapi=1&origin=${window.location.origin}`}
              title={currentVlog.username}
              allow="autoplay; encrypted-media"
              allowFullScreen
              onLoad={handleVideoLoad}
            />
          </div>

          {/* 소리 켜기/끄기 오버레이 버튼 
              - onClick으로 작동 (PC 호환)
              - 모바일은 handleOverlayClick 내부에서 스와이프 체크
          */}
          <div 
            className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer" 
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

              <button 
                onTouchEnd={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedMentor(currentVlog);
                  setChatMode('select');
                }}
                className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-lg active:scale-95 text-xs touch-manipulation"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <MessageCircle size={16} />
                이 직무에 대해 질문하기
              </button>
            </div>
          </div>

          <div className="absolute right-4 top-4 z-40 pointer-events-auto">
            <button 
              onTouchEnd={(e) => e.stopPropagation()}
              onClick={(e) => {
                  e.stopPropagation();
                  toggleInterest(currentVlog.id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all active:scale-95 backdrop-blur-sm ${
                interested[currentVlog.id] 
                  ? 'bg-yellow-400 text-gray-900' 
                  : 'bg-black/40 text-white hover:bg-black/60'
              }`}
            >
              {interested[currentVlog.id] ? (
                <CheckCircle2 size={18} />
              ) : (
                <Bookmark size={18} />
              )}
              <span className="text-sm font-medium">
                {interested[currentVlog.id] ? '저장됨' : '저장'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 모달들 (기존 코드 그대로 사용) */}
      {chatMode === 'select' && (
        <div className="absolute inset-0 z-60 bg-black flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <button onClick={() => { setChatMode(null); setTemplateStep(1); setQuestionSummary(''); setQuestionDetail(''); setEmail(''); }} className="p-2 hover:bg-gray-800 rounded-full">
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
                        <button onClick={() => setChatMode('template')} className="p-5 bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/30 rounded-xl text-center hover:border-green-500/60 transition-all active:scale-95 flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-green-500/30 flex items-center justify-center mb-3"><FileText size={32} className="text-green-400" /></div>
                            <h4 className="text-white font-bold text-xl mb-2">템플릿으로 질문하기</h4>
                            <span className="text-green-400 font-bold text-lg mb-2">1회 무료</span>
                            <p className="text-gray-400 text-xs">질문을 작성하면 답변이 도착할 때 알림을 받아요</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
      
      {/* 1:1 대화 상세, 결제, 템플릿, 가이드 모달 등 (나머지 기존 코드 유지) */}
      {chatMode === 'oneOnOneInfo' && (
          <div className="absolute inset-0 z-[70] bg-black flex flex-col">
             <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <button onClick={() => setChatMode('select')} className="p-2 hover:bg-gray-800 rounded-full"><ArrowLeft size={24} className="text-white" /></button>
                <h3 className="text-white font-bold text-lg">1:1 대화</h3>
                <div className="w-10"></div>
             </div>
             <div className="flex-1 overflow-y-auto pb-20">
                 <div className="p-4 space-y-4 max-w-md mx-auto text-center">
                     <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center"><MessageSquare size={32} className="text-white" /></div>
                     <h2 className="text-white font-bold text-xl">1:1 대화</h2>
                     <p className="text-purple-400 font-semibold text-lg">₩13,000</p>
                 </div>
             </div>
             <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 bg-black">
                 <div className="max-w-md mx-auto">
                     <button onClick={() => { saveOneOnOneClick(); setChatMode('payment'); setPaymentStep(1); }} className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg">결제하기</button>
                 </div>
             </div>
          </div>
      )}
      {chatMode === 'payment' && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowChatModal(false); setChatMode(null); setPaymentStep(1); }}}>
              <div className="bg-[#e8e8e8] shadow-2xl w-full max-w-[800px] flex flex-col sm:flex-row overflow-hidden max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setShowChatModal(false); setChatMode(null); setPaymentStep(1); }} className="absolute top-2 right-2 z-50 w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-md hover:bg-gray-100 text-gray-600"><X size={20} /></button>
                  {paymentStep === 1 && (
                      <div className="w-full h-full flex flex-col sm:flex-row">
                          <div className="flex-1 bg-white p-4 flex items-center justify-center">
                            <div className="text-center">
                              <p className="mb-4 font-bold">결제 화면 (KG이니시스)</p>
                              <button onClick={() => setPaymentStep(2)} className="px-6 py-2 bg-blue-500 text-white rounded">다음</button>
                            </div>
                          </div>
                      </div>
                  )}
                  {paymentStep === 2 && <div className="flex-1 flex items-center justify-center bg-white h-[400px]"><Loader2 className="animate-spin mr-2" /> 처리중... {setTimeout(() => setPaymentStep(3), 1500) && ""}</div>}
                  {paymentStep === 3 && (
                      <div className="flex-1 flex flex-col items-center justify-center bg-white h-[400px]">
                          <Check size={48} className="text-green-500 mb-4" />
                          <h3 className="font-bold">완료되었습니다</h3>
                          <button onClick={() => {onStartChat(selectedMentor); setShowChatModal(false); setChatMode(null);}} className="mt-4 px-4 py-2 bg-yellow-400 rounded">확인</button>
                      </div>
                  )}
              </div>
          </div>
      )}
      {chatMode === 'template' && (
          <div className="absolute inset-0 z-60 bg-white overflow-y-auto">
             <div className="flex flex-col md:flex-row min-h-full">
                <button onClick={() => setChatMode(null)} className="fixed top-4 right-4 z-10 p-2 bg-white rounded-full shadow"><X/></button>
                <div className="w-full md:w-80 bg-gray-50 p-6"><h2 className="font-bold">{selectedMentor?.username}</h2></div>
                <div className="flex-1 p-6">
                    {templateStep === 1 && (<div><h2 className="font-bold text-2xl mb-4">질문하기</h2><textarea className="w-full border p-2 mb-4" value={questionDetail} onChange={e=>setQuestionDetail(e.target.value)} placeholder="질문 내용"></textarea><button onClick={() => setTemplateStep(2)} className="w-full bg-pink-500 text-white py-3 rounded">전송하기</button></div>)}
                    {templateStep === 2 && (<div><h2 className="font-bold text-xl mb-4">이메일 입력</h2><input className="w-full border p-2 mb-4" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@example.com" /><button onClick={() => setTemplateStep(3)} className="w-full bg-pink-500 text-white py-3 rounded">완료</button></div>)}
                    {templateStep === 3 && (<div className="text-center pt-20"><Check size={48} className="mx-auto text-green-500 mb-4"/><h2 className="font-bold text-xl">전송 완료!</h2><button onClick={() => setChatMode(null)} className="mt-8 px-6 py-2 bg-gray-800 text-white rounded">닫기</button></div>)}
                </div>
             </div>
          </div>
      )}
      {showGuide && (
          <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                 <h2 className="text-2xl font-bold mb-4">가이드 {guideStep + 1}/4</h2>
                 <div className="h-40 bg-gray-100 rounded mb-4 flex items-center justify-center text-gray-500">
                    {guideStep === 0 && "스와이프로 영상 넘기기"}
                    {guideStep === 1 && "대화하기 버튼 누르기"}
                    {guideStep === 2 && "질문 방식 선택하기"}
                    {guideStep === 3 && "관심 직업 저장하기"}
                 </div>
                 <button onClick={() => { if (guideStep < 3) setGuideStep(p => p+1); else closeGuide(); }} className="w-full py-3 bg-purple-500 text-white rounded-xl">{guideStep < 3 ? "다음" : "시작하기"}</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default ReelsView;
