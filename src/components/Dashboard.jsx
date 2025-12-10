import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth, appId } from '../config/firebase';
import { Search, MapPin, Calendar, Briefcase, Bookmark, MessageCircle, ChevronDown, Filter, Play, ArrowRight, Sparkles, Menu, X } from 'lucide-react';
import vlogDataDefault from '../data/vlogData';

const Dashboard = ({ onStartChat, onViewReels, onToggleSidebar }) => {
  const [bookmarkedJobs, setBookmarkedJobs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('date');
  const [loading, setLoading] = useState(true);

  // 모든 직업 데이터 (vlogData 기반)
  const allJobs = vlogDataDefault.map((vlog, index) => ({
    id: vlog.id,
    title: vlog.role,
    company: vlog.username,
    salary: `${7.5 + index * 0.5} - ${12.5 + index * 0.5}k PLN`,
    location: 'Remote',
    type: vlog.tags[0] || 'Full time',
    tags: vlog.tags,
    postedDate: `${index + 2} days ago`,
    description: vlog.description,
    videoId: vlog.videoId,
    avatar: vlog.username[0],
    isBookmarked: false
  }));

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      if (!auth.currentUser) return;
      
      const bookmarksRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookmarks');
      const q = query(bookmarksRef, where('userId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      
      const bookmarkedIds = snapshot.docs.map(doc => doc.data().vlogId);
      setBookmarkedJobs(bookmarkedIds);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      setLoading(false);
    }
  };

  const toggleBookmark = async (jobId) => {
    // 북마크 토글 로직은 기존과 동일
    if (bookmarkedJobs.includes(jobId)) {
      setBookmarkedJobs(bookmarkedJobs.filter(id => id !== jobId));
    } else {
      setBookmarkedJobs([...bookmarkedJobs, jobId]);
    }
  };

  // 필터링된 직업 목록 - 저장된 것만 표시
  const filteredJobs = allJobs
    .filter(job => {
      // 저장된 항목만 필터링
      if (!bookmarkedJobs.includes(job.id)) return false;
      
      const matchSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.company.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTags = selectedTags.length === 0 || selectedTags.some(tag => job.tags.includes(tag));
      return matchSearch && matchTags;
    })
    .map(job => ({
      ...job,
      isBookmarked: true // 모두 저장된 항목이므로 true
    }));

  const allTags = ['Design', 'Remote', 'Full time', 'JavaScript', 'Adobe'];

  const handleJobClick = (job) => {
    const vlog = vlogDataDefault.find(v => v.id === job.id);
    if (vlog) {
      onStartChat(vlog);
    }
  };

  return (
    <div className="flex-1 bg-gray-50 h-screen overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* 모바일 햄버거 메뉴 */}
              <button 
                onClick={onToggleSidebar}
                className="sm:hidden p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <Menu size={24} className="text-gray-700" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">저장된 직업</h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 hidden sm:block">북마크한 직업 목록을 확인하세요</p>
              </div>
            </div>
            <button className="text-gray-600 hover:text-gray-900">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-purple-600">
                  {auth.currentUser?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="직업 또는 회사 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 text-sm">
                <MapPin size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline">Anywhere</span>
                <ChevronDown size={14} className="sm:w-4 sm:h-4" />
              </button>
              <button className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 border border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 text-sm">
                <Filter size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </div>
          </div>

          {/* Tag Filters */}
          <div className="flex gap-2 flex-wrap overflow-x-auto pb-2 scrollbar-hide">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => {
                  if (selectedTags.includes(tag)) {
                    setSelectedTags(selectedTags.filter(t => t !== tag));
                  } else {
                    setSelectedTags([...selectedTags, tag]);
                  }
                }}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                  selectedTags.includes(tag)
                    ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                    : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                }`}
              >
                {selectedTags.includes(tag) && '✕ '}{tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-purple-600 hover:text-purple-700 font-medium whitespace-nowrap"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Job List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {/* 릴스 탐색 유도 배너 (저장된 직업이 있을 때) */}
          {!loading && filteredJobs.length > 0 && (
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-3 sm:p-4 mb-4 text-white shadow-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Play size={20} className="fill-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm">더 많은 직업을 탐색해보세요!</h3>
                    <p className="text-xs text-white/80 line-clamp-1 sm:line-clamp-none">릴스에서 짧은 영상으로 다양한 직업을 만나보세요</p>
                  </div>
                </div>
                <button
                  onClick={onViewReels}
                  className="bg-white text-purple-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-all flex items-center gap-2 whitespace-nowrap w-full sm:w-auto justify-center"
                >
                  릴스 보기
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600">
              저장된 직업 <span className="font-semibold text-gray-900">{filteredJobs.length}</span>개
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">정렬:</span>
              <button className="text-sm font-medium text-gray-900 hover:text-purple-600">
                날짜순 <ChevronDown size={14} className="inline" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="max-w-2xl mx-auto px-2 sm:px-0">
                {/* 릴스 안내 배너 */}
                <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl p-6 sm:p-8 text-white mb-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={20} className="sm:w-6 sm:h-6 animate-pulse" />
                      <span className="text-xs sm:text-sm font-semibold bg-white/20 px-2 sm:px-3 py-1 rounded-full">새로운 기능</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3">릴스로 직업 탐색하기</h2>
                    <p className="text-white/90 text-sm sm:text-lg mb-4 sm:mb-6 leading-relaxed">
                      짧은 영상으로 다양한 직업인들의 실제 이야기를 들어보세요.
                      <span className="hidden sm:inline"><br/></span>
                      <span className="inline sm:hidden"> </span>
                      스와이프하며 흥미로운 직업을 발견하고 북마크하세요! 🎯
                    </p>
                    
                    <button
                      onClick={onViewReels}
                      className="bg-white text-purple-600 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2 sm:gap-3 group w-full sm:w-auto justify-center"
                    >
                      <Play size={20} className="sm:w-6 sm:h-6 fill-purple-600" />
                      <span>릴스 보러가기</span>
                      <ArrowRight size={16} className="sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>

                {/* 빈 상태 메시지 */}
                <div className="text-center py-8 bg-white rounded-xl border-2 border-dashed border-gray-300">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bookmark size={32} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">저장된 직업이 없습니다</h3>
                  <p className="text-gray-500 text-sm">
                    릴스에서 마음에 드는 직업을 찾아 북마크 버튼을 눌러보세요!
                  </p>
                </div>
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className={`bg-white border-2 rounded-xl p-4 hover:border-purple-300 transition cursor-pointer group ${
                    job.isBookmarked ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200'
                  }`}
                  onClick={() => handleJobClick(job)}
                >
                  <div className="flex items-start gap-4">
                    {/* Company Logo */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">{job.avatar}</span>
                    </div>

                    {/* Job Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition">
                            {job.title}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {job.company} <span className="text-gray-400">—</span> {job.location}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(job.id);
                            }}
                            className="p-2 hover:bg-purple-50 rounded-lg transition"
                          >
                            <Bookmark
                              size={20}
                              className={job.isBookmarked ? 'fill-purple-500 text-purple-500' : 'text-gray-400'}
                            />
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-3 line-clamp-1">{job.description}</p>

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2 flex-wrap">
                          <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            {job.type}
                          </span>
                          {job.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="font-semibold text-gray-900">{job.salary}</span>
                          <span>{job.postedDate}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
