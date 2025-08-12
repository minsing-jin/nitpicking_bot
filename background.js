// 백그라운드 서비스 워커
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Critical Thinking Bot 설치/업데이트:', details.reason);
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      enabled: true,
      popupDelay: 3,
      categories: { factual: true, logical: true, practical: true },
      totalPrompts: 0,
      userResponses: 0,
      autoGenerate: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: ''
    });
  }
});

// 통계 브로드캐스트
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStats') {
    chrome.runtime.sendMessage({ action: 'updateStats' });
    return;
  }
});

// 자동 비판 응답 생성 (간단한 라우팅)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'generateCritique') return;
  const { provider, model, apiKey, prompt } = request;

  (async () => {
    try {
      if (!apiKey || !prompt) throw new Error('API 키 또는 프롬프트가 없습니다');

      if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a terse, highly critical reviewer. Keep answers compact but incisive.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'OpenAI API 오류');
        sendResponse({ text: data.choices?.[0]?.message?.content?.trim() || '' });
        return;
      }

      if (provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: model || 'claude-3-haiku-20240307',
            max_tokens: 1000,
            system: 'You are a terse, highly critical reviewer. Keep answers compact but incisive.',
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Anthropic API 오류');
        const text = Array.isArray(data.content) ? data.content.map(p => p.text || '').join('\n') : (data.content?.[0]?.text || '');
        sendResponse({ text: (text || '').trim() });
        return;
      }

      if (provider === 'gemini') {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-1.5-flash')}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Gemini API 오류');
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
        sendResponse({ text: text.trim() });
        return;
      }

      throw new Error('알 수 없는 provider');
    } catch (err) {
      sendResponse({ error: String(err.message || err) });
    }
  })();

  // 비동기 응답 유지
  return true;
});

// 탭 업데이트 시 content script 재주입 로직은 MV3에서 자동 실행되므로 생략
// 필요 시 scripting으로 주입할 때만 사용하세요.

// Extension 아이콘 클릭 시 팝업 열기
chrome.action.onClicked.addListener((tab) => {
    // 팝업이 이미 설정되어 있으므로 별도 처리 불필요
});
