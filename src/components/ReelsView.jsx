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
  CreditCard,
  Shield,
  Loader2
} from 'lucide-react';
import { VLOG_DATA } from '../data/vlogData';
import { db, auth } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const ReelsView = ({ onClose, onStartChat }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [interested, setInterested] = useState({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMode, setChatMode] = useState(null); // 'oneOnOne' | 'template' | 'payment'
  const [paymentStep, setPaymentStep] = useState(1); // 1: 결제정보, 2: 처리중, 3: 완료
  const [templateStep, setTemplateStep] = useState(1); // 1: 질문 작성, 2: 이메일 입력, 3: 완료
  const [questionSummary, setQuestionSummary] = useState('');
  const [questionDetail, setQuestionDetail] = useState('');
  const [email, setEmail] = useState('');
  const [selectedMentor, setSelectedMentor] = useState(null); // 선택한 멘토 정보 저장
  // 가이드라인은 처음 한 번만 표시 (localStorage 확인)
  const [showGuide, setShowGuide] = useState(() => {
    const hasSeenGuide = localStorage.getItem('hasSeenReelsGuide');
    return !hasSeenGuide;
  });
  const [guideStep, setGuideStep] = useState(0); // 가이드 단계
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  // 가이드 닫을 때 localStorage에 저장
  const closeGuide = () => {
    setShowGuide(false);
    localStorage.setItem('hasSeenReelsGuide', 'true');
  };

  // 1:1 대화 클릭 정보 저장
  const saveOneOnOneClick = async () => {
    if (!selectedMentor) return;
    try {
      await addDoc(collection(db, 'oneOnOneClicks'), {
        mentorId: selectedMentor.id,
        mentorName: selectedMentor.username,
        mentorRole: selectedMentor.role,
        userId: auth.currentUser?.uid || 'anonymous',
        amount: 20000,
        status: 'clicked',
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error saving click:', error);
    }
  };

  // 템플릿 질문 저장
  const saveTemplateQuestion = async () => {
    if (!selectedMentor) return;
    try {
      await addDoc(collection(db, 'templateQuestions'), {
        mentorId: selectedMentor.id,
        mentorName: selectedMentor.username,
        mentorRole: selectedMentor.role,
        userId: auth.currentUser?.uid || 'anonymous',
        questionSummary: questionSummary,
        questionDetail: questionDetail,
        email: email,
        status: 'pending',
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error saving question:', error);
    }
  };

  const toggleInterest = async (id) => {
    const newState = !interested[id];
    
    // 인증 확인
    if (!auth.currentUser) {
      console.error('User not authenticated');
      alert('로그인이 필요합니다. 페이지를 새로고침해주세요.');
      return;
    }
    
    // UI 먼저 업데이트
    setInterested(prev => ({ ...prev, [id]: newState }));
    
    // Firestore에 북마크 저장/삭제
    if (newState) {
      try {
        console.log('Attempting to save bookmark...', {
          userId: auth.currentUser.uid,
          vlogId: id,
          vlogName: currentVlog.username
        });
        
        const docRef = await addDoc(collection(db, 'bookmarks'), {
          userId: auth.currentUser.uid,
          vlogId: id,
          vlogData: currentVlog,
          createdAt: serverTimestamp()
        });
        
        console.log('✅ Bookmark saved successfully! Doc ID:', docRef.id);
      } catch (error) {
        console.error('❌ Error saving bookmark:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message
        });
        // 에러 발생 시 상태 되돌리기
        setInterested(prev => ({ ...prev, [id]: false }));
        alert(`저장 실패: ${error.message}`);
      }
    } else {
      console.log('Bookmark unsaved (UI only)');
    }
  };

  const goToNext = () => {
    if (currentIndex < VLOG_DATA.length - 1 && !isTransitioning) {
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

  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 모달이 열려있으면 스크롤 이벤트 무시
      if (showChatModal || chatMode) {
        if (e.key === 'Escape') {
          setShowChatModal(false);
          setChatMode(null);
        }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'j') goToNext();
      if (e.key === 'ArrowUp' || e.key === 'k') goToPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isTransitioning, showChatModal, chatMode]);

  // 마우스 휠 이벤트 처리
  useEffect(() => {
    const handleWheel = (e) => {
      // 모달이 열려있으면 스크롤 이벤트 무시
      if (showChatModal || chatMode) {
        return;
      }
      e.preventDefault();
      if (e.deltaY > 0) goToNext();
      else if (e.deltaY < 0) goToPrev();
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isTransitioning, showChatModal, chatMode]);

  // 터치 이벤트 처리
  const handleTouchStart = (e) => {
    // 모달이 열려있으면 터치 이벤트 무시
    if (showChatModal || chatMode) return;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    // 모달이 열려있으면 터치 이벤트 무시
    if (showChatModal || chatMode) return;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    // 모달이 열려있으면 터치 이벤트 무시
    if (showChatModal || chatMode) return;
    const diff = touchStartY.current - touchEndY.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNext();
      else goToPrev();
    }
  };

  const currentVlog = VLOG_DATA[currentIndex];

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-50 bg-black flex flex-col overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 헤더 */}
      <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-6 z-30 bg-gradient-to-b from-black/80 to-transparent">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <Play size={20} className="text-pink-500 fill-pink-500" />
          Job Reels
          <span className="text-sm font-normal text-gray-400 ml-2">
            {currentIndex + 1} / {VLOG_DATA.length}
          </span>
        </h2>
        <button 
          onClick={onClose} 
          className="p-2 hover:bg-white/10 rounded-full text-white transition"
        >
          <X size={24} />
        </button>
      </div>

      {/* 메인 릴스 컨테이너 */}
      <div className="flex-1 flex items-center justify-center relative w-full">
        {/* 비디오 영역 - 9:16 비율 */}
        <div 
          className="relative mx-auto transition-transform duration-300 ease-out"
          style={{
            width: 'min(100vw, calc((100vh - 64px) * 9 / 16))',
            height: 'calc(100vh - 64px)',
            maxWidth: '400px',
            transform: isTransitioning ? 'scale(0.95)' : 'scale(1)',
            opacity: isTransitioning ? 0.8 : 1
          }}
        >
          {/* YouTube iframe - 컨트롤 숨김 */}
          <div className="absolute inset-0 w-full h-full overflow-hidden rounded-xl">
            <iframe 
              key={currentVlog.videoId + currentIndex}
              className="absolute inset-0 w-full h-full pointer-events-none"
              src={`https://www.youtube.com/embed/${currentVlog.videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&loop=1&playlist=${currentVlog.videoId}&showinfo=0&disablekb=1&fs=0`}
              title={currentVlog.username}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>

          {/* 오버레이 정보 - 하단 */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">
            <div className="pointer-events-auto">
              {/* 프로필 정보 */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg ring-2 ring-white">
                  {currentVlog.username[0]}
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg drop-shadow-lg">{currentVlog.username}</h3>
                  <p className="text-gray-300 text-sm drop-shadow-lg">{currentVlog.role}</p>
                </div>
              </div>

              {/* 설명 */}
              <p className="text-white text-sm mb-3 drop-shadow-lg leading-relaxed">
                {currentVlog.description}
              </p>

              {/* 태그 */}
              <div className="flex gap-2 flex-wrap mb-4">
                {currentVlog.tags.map(tag => (
                  <span 
                    key={tag} 
                    className="text-xs bg-white/20 px-3 py-1 rounded-full text-white backdrop-blur-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* 대화하기 버튼 */}
              <button 
                onClick={() => {
                  setSelectedMentor(currentVlog); // 선택한 멘토 정보 저장
                  setShowChatModal(true);
                }}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
              >
                <MessageCircle size={20} />
                이 직무에 대해 질문하기
              </button>
            </div>
          </div>

          {/* 오른쪽 상단 저장 버튼 */}
          <div className="absolute right-4 top-4">
            <button 
              onClick={() => toggleInterest(currentVlog.id)}
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

        {/* 네비게이션 버튼 - 왼쪽 (제거) */}

        {/* 진행률 표시 - 제거 */}
      </div>

      {/* 대화 선택 모달 */}
      {showChatModal && !chatMode && (
        <div className="absolute inset-0 z-60 bg-black/80 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-[#1e2024] rounded-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-base sm:text-lg">멘토에게 질문하기</h3>
              </div>
              <button 
                onClick={() => {
                  setShowChatModal(false);
                  setChatMode(null);
                  setTemplateStep(1);
                  setQuestionSummary('');
                  setQuestionDetail('');
                  setEmail('');
                }}
                className="p-2 hover:bg-gray-700 rounded-full"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-3 sm:p-4">
              {/* 선택 화면 */}
              <div className="space-y-3 sm:space-y-4">
                <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4">
                  {selectedMentor?.username}님에게 질문하는 방법을 선택하세요.
                </p>
                
                {/* 1:1 대화 카드 */}
                <button 
                  onClick={() => {
                    setChatMode('oneOnOneInfo');
                  }}
                  className="w-full p-3 sm:p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl text-left hover:border-purple-500/60 transition-all group"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <MessageSquare size={20} className="text-purple-400 sm:w-6 sm:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-white font-bold text-base sm:text-lg">1:1 대화</h4>
                        <span className="text-pink-400 font-bold text-sm sm:text-base whitespace-nowrap">₩13,000</span>
                      </div>
                      <p className="text-gray-400 text-xs sm:text-sm mt-1">
                        30분 정도의 자유로운 대화
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 sm:mt-2 text-gray-500 text-xs">
                        <Clock size={12} className="sm:w-3.5 sm:h-3.5" />
                        <span>약 30분 소요</span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* 템플릿 질문 카드 */}
                <button 
                  onClick={() => setChatMode('template')}
                  className="w-full p-3 sm:p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl text-left hover:border-green-500/60 transition-all group"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <FileText size={20} className="text-green-400 sm:w-6 sm:h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-white font-bold text-base sm:text-lg">템플릿으로 질문하기</h4>
                        <span className="text-green-400 font-bold text-sm sm:text-base whitespace-nowrap">1회 무료</span>
                      </div>
                      <p className="text-gray-400 text-xs sm:text-sm mt-1">
                        질문을 작성하면 답변이 도착할 때 알림을 받아요
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1:1 대화 상세 설명 화면 */}
      {chatMode === 'oneOnOneInfo' && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowChatModal(false); setChatMode(null); }}}>
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl shadow-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="relative p-4 sm:p-6 pb-4 border-b border-gray-700">
              <button 
                onClick={() => setChatMode(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center">
                  <MessageSquare size={28} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg sm:text-xl">1:1 대화</h2>
                  <p className="text-purple-400 font-semibold">₩13,000</p>
                </div>
              </div>
            </div>

            {/* 내용 */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
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
              <div className="text-gray-500 text-[10px] sm:text-xs space-y-1">
                <p>• 결제 후 멘토가 일정을 제안하면 카카오톡으로 알림을 보내드려요.</p>
                <p>• 멘토 사정으로 대화가 불가한 경우 전액 환불됩니다.</p>
                <p>• 결제 후 7일 이내 대화가 성사되지 않으면 자동 환불됩니다.</p>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="p-4 sm:p-6 pt-0">
              <button 
                onClick={() => {
                  saveOneOnOneClick();
                  setChatMode('payment');
                  setPaymentStep(1);
                }}
                className="w-full py-3 sm:py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all text-base sm:text-lg"
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
                <p className="text-gray-500 mb-6">
                  {selectedMentor?.username}님과의 1:1 대화가 예약되었습니다.<br/>
                  멘토가 확인 후 연락드릴 예정입니다.
                </p>
                <button 
                  onClick={() => {
                    setShowChatModal(false);
                    setChatMode(null);
                    setPaymentStep(1);
                    onStartChat(selectedMentor);
                  }}
                  className="px-8 py-4 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-bold rounded-lg transition-all"
                >
                  대화 시작하기
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* 템플릿 질문 전체 화면 */}
      {chatMode === 'template' && (
        <div className="absolute inset-0 z-60 bg-white flex flex-col md:flex-row overflow-y-auto">
          {/* 왼쪽: 멘토 정보 */}
          <div className="w-full md:w-80 md:min-w-[320px] bg-gray-50 p-8 border-r border-gray-200 flex-shrink-0">
            {/* 프로필 이미지 */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl mb-4">
              {selectedMentor?.username?.[0]}
            </div>

            {/* 카테고리 */}
            <p className="text-gray-500 text-sm mb-1">{selectedMentor?.tags?.[0]?.replace('#', '')}</p>
            
            {/* 이름 + 신규 멘토 뱃지 */}
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-gray-900 font-bold text-xl">{selectedMentor?.username?.replace('_', ' ')}</h2>
              <span className="bg-pink-500 text-white text-xs px-2 py-0.5 rounded">신규 멘토</span>
            </div>

            {/* 회사/직무 */}
            <p className="text-blue-600 text-sm mb-4">{selectedMentor?.role}</p>

            {/* 자기소개 */}
            <div className="text-gray-700 text-sm leading-relaxed space-y-3">
              <p>안녕하세요!</p>
              <p>{selectedMentor?.description}</p>
              <p>커리어, 직무 고민에 대한 해답을 진짜 현직자에게 받아보세요.</p>
              <p>짧지만 여러 회사를 밀도있게 다녀본 경험이 궁금하시다면!</p>
              <p className="text-blue-600 underline cursor-pointer">질문을 남겨주세요~</p>
              <p className="text-gray-400 text-xs cursor-pointer">더보기</p>
            </div>

            {/* 태그들 */}
            <div className="flex flex-wrap gap-2 mt-6">
              {currentVlog.tags.map(tag => (
                <span key={tag} className="text-gray-500 text-sm">{tag}</span>
              ))}
              <span className="text-gray-500 text-sm">#면접</span>
              <span className="text-gray-500 text-sm">#이직</span>
              <span className="text-gray-500 text-sm">#해외취업</span>
              <span className="text-gray-500 text-sm">#자소서</span>
            </div>
          </div>

          {/* 오른쪽: 질문 폼 */}
          <div className="w-full flex-1 p-8">
            {/* 닫기 버튼 */}
            <button 
              onClick={() => {
                setChatMode(null);
                setShowChatModal(false);
                setTemplateStep(1);
                setQuestionSummary('');
                setQuestionDetail('');
                setEmail('');
              }}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
            >
              <X size={24} className="text-gray-500" />
            </button>

            {templateStep === 1 && (
              <>
                <h1 className="text-gray-900 font-bold text-2xl mb-2">멘토에게 질문하기</h1>
                <p className="text-gray-500 text-sm mb-6">
                  이용건님 고민이 있나요?<br/>
                  커리어, 직무 고민에 대한 해답을 진짜 현직자에게 받아보세요.
                </p>

                {/* 질문 작성 안내 */}
                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                  <p className="text-pink-500 font-medium mb-2">질문을 구체적으로 작성해 주세요.</p>
                  <p className="text-gray-500 text-sm">예시. <span className="text-pink-400">영업</span> 직무 취업을 목표로 3개월 계획을 <span className="text-pink-400">세웠습니다.</span></p>
                  <p className="text-gray-500 text-sm">예시. <span className="text-pink-400">외국계 기업</span>에서 좋은 조건으로 인터뷰를 <span className="text-pink-400">제안하셨습니다.</span></p>
                </div>

                {/* 고민 한줄 요약 */}
                <div className="mb-4">
                  <label className="text-gray-700 text-sm block mb-2">고민 한줄 요약</label>
                  <input 
                    type="text"
                    value={questionSummary}
                    onChange={(e) => setQuestionSummary(e.target.value)}
                    placeholder="고민을 한 줄로 요약해주세요"
                    className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-500"
                  />
                </div>

                {/* 질문 내용 안내 */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4 text-sm">
                  <p className="text-gray-700 font-medium mb-2">질문 내용은 콘텐츠 소재로 사용될 수 있습니다.</p>
                  <p className="text-gray-500">- 오다 콘텐츠는 실제 질문/답변 중 우수 사례를 편집하여 발행합니다.</p>
                  <p className="text-gray-500">- 개인 정보는 콘텐츠 검수 과정에서 안전하게 삭제됩니다.</p>
                </div>

                {/* 서비스 취지 안내 */}
                <div className="mb-4 text-sm">
                  <p className="text-gray-700 font-medium mb-2">서비스 취지에 맞지 않는 질문을 남길 경우 이용이 제한될 수 있습니다.</p>
                  <p className="text-gray-500">- 과제를 목적으로 하는 인터뷰 요청</p>
                  <p className="text-gray-500">- 외부 프로그램 섭외 요청</p>
                </div>

                <p className="text-gray-500 text-sm mb-4">
                  자세한 <span className="text-blue-600 underline cursor-pointer">내용은</span> 질문하기 <span className="text-blue-600 underline cursor-pointer">이용방법</span>을 확인해 주세요.
                </p>

                {/* 질문 작성 */}
                <div className="mb-6">
                  <textarea 
                    value={questionDetail}
                    onChange={(e) => setQuestionDetail(e.target.value)}
                    placeholder="질문을 작성해주세요.."
                    rows={5}
                    className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-500 resize-none"
                  />
                </div>

                {/* 미리보기 버튼 */}
                <button 
                  onClick={() => {
                    if (questionSummary.trim() && questionDetail.trim()) {
                      setTemplateStep(2);
                    }
                  }}
                  disabled={!questionSummary.trim() || !questionDetail.trim()}
                  className="w-full py-4 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
                >
                  미리보기
                </button>
              </>
            )}

            {templateStep === 2 && (
              <>
                <button 
                  onClick={() => setTemplateStep(1)}
                  className="flex items-center gap-2 text-gray-500 mb-6 hover:text-gray-700"
                >
                  <ArrowLeft size={20} />
                  <span>뒤로</span>
                </button>

                <div className="text-center py-8">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                    <Send size={36} className="text-green-500" />
                  </div>
                  <h2 className="text-gray-900 font-bold text-xl mb-2">질문이 전송될 준비가 되었어요!</h2>
                  <p className="text-gray-500 text-sm mb-8">답변이 도착하면 알림을 받을 이메일 주소를 입력해주세요.</p>

                  <div className="max-w-xs mx-auto mb-6">
                    <label className="text-gray-700 text-sm block mb-2 text-left">이메일 주소</label>
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-pink-500 text-center"
                    />
                  </div>

                  <p className="text-gray-400 text-sm mb-8">
                    입력하신 이메일로 멘토의 답변 알림이 발송됩니다.
                  </p>

                  <button 
                    onClick={async () => {
                      if (email.includes('@') && email.includes('.')) {
                        await saveTemplateQuestion();
                        setTemplateStep(3);
                      }
                    }}
                    disabled={!email.includes('@') || !email.includes('.')}
                    className="w-full max-w-xs py-4 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all mx-auto"
                  >
                    질문 전송하기
                  </button>
                </div>
              </>
            )}

            {templateStep === 3 && (
              <div className="text-center py-16">
                <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6">
                  <Check size={48} className="text-white" />
                </div>
                <h2 className="text-gray-900 font-bold text-2xl mb-4">질문이 전송되었습니다!</h2>
                <p className="text-gray-500 mb-2">
                  {selectedMentor?.username?.replace('_', ' ')}님이 답변을 작성하면
                </p>
                <p className="text-gray-700 font-medium mb-6">
                  {email}로 알림을 보내드려요.
                </p>
                <p className="text-gray-400 text-sm mb-8">
                  보통 1~3일 내에 답변이 도착합니다.
                </p>
                <button 
                  onClick={() => {
                    setShowChatModal(false);
                    setChatMode(null);
                    setTemplateStep(1);
                    setQuestionSummary('');
                    setQuestionDetail('');
                    setEmail('');
                  }}
                  className="px-12 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-all"
                >
                  확인
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
                          <CreditCard size={18} className="text-orange-600" />
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
