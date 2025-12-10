// Gemini API Configuration
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
export const GEMINI_API_URL = import.meta.env.VITE_GEMINI_API_URL;

// 대화 문맥을 파악하여 다음 질문 3개를 추천하는 함수
export const generateSuggestedQuestions = async (chatHistory, vloggerInfo) => {
  try {
    const systemPrompt = `당신은 취업 상담 도우미입니다.
사용자가 "${vloggerInfo.role}" 직무의 "${vloggerInfo.username}"님과 대화하고 있습니다.

아래 대화 내역을 보고, 사용자가 다음에 물어볼 만한 관련 질문 3개를 추천해주세요.
질문은 해당 직무에 관심있는 취준생이나 학생 입장에서 궁금해할 만한 것으로 해주세요.

반드시 아래 JSON 형식으로만 응답하세요:
["질문1", "질문2", "질문3"]

다른 설명 없이 JSON 배열만 출력하세요.`;

    const conversationText = chatHistory.length > 0 
      ? chatHistory.map(msg => `${msg.senderType === 'guest' ? '사용자' : vloggerInfo.username}: ${msg.text}`).join('\n')
      : '(아직 대화가 시작되지 않았습니다)';

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: `대화 내역:\n${conversationText}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 256,
        }
      })
    });

    if (!response.ok) {
      throw new Error('Gemini API 요청 실패');
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text.trim();
      // JSON 파싱 시도
      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const questions = JSON.parse(jsonMatch[0]);
          if (Array.isArray(questions) && questions.length > 0) {
            return questions.slice(0, 3);
          }
        }
      } catch (e) {
        console.error('JSON 파싱 실패:', e);
      }
    }
    
    // 기본 질문 반환
    return getDefaultQuestions(vloggerInfo.role);
  } catch (error) {
    console.error('Gemini API Error:', error);
    return getDefaultQuestions(vloggerInfo.role);
  }
};

// 직무별 기본 추천 질문
const getDefaultQuestions = (role) => {
  const defaultQuestions = {
    '소프트웨어 개발자': ['개발자가 되려면 어떻게 준비해야 하나요?', '하루 일과가 어떻게 되나요?', '야근이 많은 편인가요?'],
    '핀테크 개발자': ['토스에서 일하려면 어떤 역량이 필요한가요?', '핀테크 개발자의 매력은 무엇인가요?', '개발 문화는 어떤가요?'],
    '임베디드 시스템 개발자': ['임베디드 개발자가 되려면 어떤 공부가 필요한가요?', '하드웨어 지식이 많이 필요한가요?', '펌웨어 개발은 어떤 느낌인가요?'],
    '패션 브랜드 마케터': ['패션 마케터가 되려면 어떤 준비가 필요한가요?', '트렌드는 어떻게 파악하나요?', '하루 일과가 궁금해요!'],
    '뷰티 에디터 서포터즈': ['서포터즈 활동은 어떻게 시작하셨나요?', '어떤 활동을 하나요?', '취업에 도움이 되나요?'],
    '뷰티 콘텐츠 마케터': ['콘텐츠는 어떻게 기획하나요?', '뷰티 마케터의 매력은 무엇인가요?', '트렌드 파악은 어떻게 하나요?'],
    '브랜드 마케터': ['브랜드 마케팅과 콘텐츠 마케팅의 차이가 뭔가요?', '마케터 취업 준비 팁이 있나요?', '실무에서 가장 중요한 역량은?'],
    '마케터 (전직 간호사)': ['커리어 전환을 결심한 계기가 뭔가요?', '전환 과정이 힘들지 않았나요?', '이전 경험이 도움이 되나요?'],
    '패션 콘텐츠 마케터': ['영상 제작은 어떻게 배우셨나요?', '콘텐츠 기획 팁이 있나요?', '패션 트렌드는 어떻게 따라가나요?'],
    '주니어 뷰티 마케터': ['신입으로 입사하려면 어떤 준비가 필요한가요?', '회사 생활은 어떤가요?', '선배들과의 관계는 어떤가요?'],
    '뷰티 마케터': ['뷰티 업계에서 일하는 매력이 뭔가요?', '화장품 지식이 많이 필요한가요?', '하루 일과가 어떻게 되나요?'],
    'PD (프로듀서)': ['PD가 되려면 어떤 준비가 필요한가요?', '방송 현장 분위기는 어떤가요?', '가장 보람찬 순간은 언제인가요?'],
    '제약 연구원': ['연구원이 되려면 어떤 전공이 필요한가요?', '신약 개발 과정이 궁금해요!', '연구원의 하루 일과는 어떤가요?'],
    '식품 생산직': ['생산직은 어떤 일을 하나요?', '교대 근무가 힘들지 않나요?', '복지는 어떤가요?'],
    '건강기능식품 포장 직원': ['포장 업무는 구체적으로 어떤 일인가요?', '체력적으로 힘들지 않나요?', '근무 환경은 어떤가요?'],
    '식품공장 사무직': ['공장 사무직은 어떤 업무를 하나요?', '생산 현장과의 소통은 어떻게 하나요?', '워라밸은 어떤가요?'],
    '회사원': ['직장 생활 적응 팁이 있나요?', '워라밸은 어떤가요?', '회사에서 성장하려면 어떻게 해야 하나요?'],
  };
  
  return defaultQuestions[role] || ['이 직무에 대해 더 알려주세요!', '하루 일과가 궁금해요!', '이 일의 매력은 무엇인가요?'];
};

export default { GEMINI_API_KEY, GEMINI_API_URL, generateSuggestedQuestions };
