// 백그라운드 서비스 워커
chrome.runtime.onInstalled.addListener(() => {
    console.log('Critical Thinking Bot이 설치되었습니다!');
    
    // 기본 설정 초기화
    chrome.storage.sync.set({
        enabled: true,
        popupDelay: 3,
        categories: {
            factual: true,
            logical: true,
            practical: true
        },
        totalPrompts: 0,
        userResponses: 0
    });
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStats') {
        // 팝업 UI에 통계 업데이트 알림
        chrome.runtime.sendMessage({ action: 'updateStats' });
    }
});

// 탭 업데이트 시 content script 재초기화
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // LLM 사이트인지 확인
        const llmSites = [
            'chat.openai.com',
            'claude.ai',
            'bard.google.com',
            'gemini.google.com'
        ];
        
        const isLLMSite = llmSites.some(site => tab.url.includes(site));
        
        if (isLLMSite) {
            // content script가 이미 로드되었는지 확인
            chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
                if (chrome.runtime.lastError) {
                    // content script가 로드되지 않았으면 다시 주입
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['content.js']
                    });
                }
            });
        }
    }
});

// Extension 아이콘 클릭 시 팝업 열기
chrome.action.onClicked.addListener((tab) => {
    // 팝업이 이미 설정되어 있으므로 별도 처리 불필요
});

// 설치 후 환영 메시지
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({
            url: 'https://github.com/your-repo/critical-thinking-bot'
        });
    }
}); 