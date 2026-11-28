// Setup.js - System Tab (Tab 0) & Core State Management
let gameData = {
    xuatPhat: {}, // Turn 1..8 -> [ { q: "", a: "" }, ... 10 items ]
    raKhoi: [
        { q: "", a: "", m: "", am: "" },
        { q: "", a: "", m: "", am: "" },
        { q: "", a: "", m: "", am: "" },
        { q: "", a: "", m: "", am: "" }
    ],
    vuotSong: {
        h1: { q: "", a: "" },
        h2: { q: "", a: "" },
        h3: { q: "", a: "" },
        h4: { q: "", a: "" },
        center: { q: "", a: "" },
        keyword: "",
        hintImage: ""
    },
    vinhQuang: {
        1: [],
        2: [],
        3: [],
        4: [],
        5: []
    },
    cauHoiPhu: [
        { q: "", a: "" },
        { q: "", a: "" },
        { q: "", a: "" }
    ],
    intros: {
        opening: './Opening.mp4',
        v1: './V1.mp4',
        v2: './V2.mp4',
        v3: './V3.mp4',
        v4: './V4.mp4'
    },
    contestants: [
        { name: "Thí sinh 1", info: "", score: 0 },
        { name: "Thí sinh 2", info: "", score: 0 },
        { name: "Thí sinh 3", info: "", score: 0 },
        { name: "Thí sinh 4", info: "", score: 0 }
    ]
};

let currentXuatPhatTurn = 0;
let editingXuatPhatDe = 1;
let currentVinhQuangPack = 1;

// Safely initialize scoreboardThumbnailStates & scoreboardInfoStates early
window.scoreboardThumbnailStates = window.scoreboardThumbnailStates || { 1: false, 2: false, 3: false, 4: false };
window.scoreboardInfoStates = window.scoreboardInfoStates || { 1: false, 2: false, 3: false, 4: false };

// Initialize state on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    initXuatPhatTurnData();
    renderXuatPhatTurnUI(1);
    initVinhQuangData();
    renderVinhQuangPackUI(1);
    loadSavedData();
    updateVuotSongState();
    let hasRuntimeSnapshot = false;
    try {
        hasRuntimeSnapshot = !!(localStorage.getItem('ddvq_controller_runtime_v1') || sessionStorage.getItem('ddvq_controller_runtime_v1'));
    } catch(e) {}
    if (!hasRuntimeSnapshot && typeof setRKQuestionUI === 'function') {
        setRKQuestionUI(1);
    }
    // Restore room credentials immediately on load
    try {
        const savedRoom = localStorage.getItem('ddvq_room_code');
        const savedAuth = localStorage.getItem('ddvq_room_auth');
        const rInput = document.getElementById('room_code_input');
        const aInput = document.getElementById('room_auth_input');
        const rBadge = document.getElementById('room_code_badge');
        if (savedRoom && rInput && !rInput.value) rInput.value = savedRoom;
        if (savedAuth && aInput && !aInput.value) aInput.value = savedAuth;
        if (savedRoom && rBadge) rBadge.innerText = `Đang hoạt động: ${savedRoom} | Pass: ${savedAuth || '123456'}`;
    } catch(e) {}
    // Restore Scoreboard Thumbnail & Info States
    try {
        for (let c = 1; c <= 4; c++) {
            const savedSelf = localStorage.getItem('ddvq_scoreboard_thumbnail_shown_' + c);
            const savedAll = localStorage.getItem('ddvq_scoreboard_thumbnail_shown');
            if (savedSelf === 'true' || (savedSelf === null && savedAll === 'true')) {
                window.scoreboardThumbnailStates[c] = true;
            } else {
                window.scoreboardThumbnailStates[c] = false;
            }
            const savedInfoSelf = localStorage.getItem('ddvq_scoreboard_info_shown_' + c);
            const savedInfoAll = localStorage.getItem('ddvq_scoreboard_info_shown');
            if (savedInfoSelf === 'true' || (savedInfoSelf === null && savedInfoAll === 'true')) {
                window.scoreboardInfoStates[c] = true;
            } else {
                window.scoreboardInfoStates[c] = false;
            }
        }
    } catch(e) {}
    if (typeof updateScoreboardThumbnailBadges === 'function') {
        updateScoreboardThumbnailBadges();
    }
    if (typeof updateScoreboardInfoBadges === 'function') {
        updateScoreboardInfoBadges();
    }
});

// Track current active round and running timer
window.currentActiveRound = localStorage.getItem('ddvq_active_round') || 'XUAT_PHAT';
window.currentActiveTimer = null;
try {
    const tStr = localStorage.getItem('ddvq_current_timer');
    if (tStr) window.currentActiveTimer = JSON.parse(tStr);
} catch(e) {}

// Local-only tab refresh: switching Controller tabs NEVER resets state or switches Player/Projector
function onSwitchTabRound(index, opts = {}) {
    if (typeof syncContestantsUI === 'function' && !opts.silentSync) {
        // Only refresh local controller DOM values without re-broadcasting on tab view
        if (gameData && Array.isArray(gameData.contestants)) {
            gameData.contestants.forEach((c, i) => {
                const idx = i + 1;
                const scoreVal = c.score !== undefined ? c.score : 0;
                ['ts' + idx + '_score_disp', 'ts' + idx + '_score_disp_rk', 'ts' + idx + '_score_disp_vs', 'ts' + idx + '_score_disp_vq', 'ts' + idx + '_score_disp_chp'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = scoreVal;
                });
            });
        }
    }

    if (index === 1) {
        if (typeof updateTab1Preview === 'function') updateTab1Preview();
    } else if (index === 2) {
        if (typeof updateVSBuzzerLabels === 'function') updateVSBuzzerLabels();
    } else if (index === 3) {
        if (typeof updateTab2Preview === 'function') updateTab2Preview();
    } else if (index === 4) {
        if (typeof syncVQTurnDropdownNames === 'function') syncVQTurnDropdownNames();
    } else if (index === 5) {
        if (typeof updateTab5Preview === 'function') updateTab5Preview();
    }
}
window.onSwitchTabRound = onSwitchTabRound;

// Bắt đầu vòng thi: Bấm nút tên vòng thi để chuyển cảnh Thí sinh/MC đồng thời ẩn sạch toàn bộ Graphic trên Projector & Graphic
window.startRoundAndCleanGraphics = function(roundIndex) {
    let roundName = 'XUAT_PHAT';
    let viewNum = 1;
    let label = 'Xuất Phát';
    if (roundIndex === 1) {
        roundName = 'XUAT_PHAT';
        viewNum = 1;
        label = 'Xuất Phát';
    } else if (roundIndex === 2) {
        roundName = 'RA_KHOI';
        viewNum = 2;
        label = 'Tăng Tốc';
    } else if (roundIndex === 3) {
        roundName = 'VUOT_SONG';
        viewNum = 3;
        label = 'Vượt Chướng Ngại Vật';
        window.vsRoundStartTime = Date.now();
        window.vsOpenedPieces = { 1: false, 2: false, 3: false, 4: false, 5: false };
        if (typeof syncVSPieceButtonsUI === 'function') syncVSPieceButtonsUI();
        if (typeof resetVSShowAnswersButton === 'function') resetVSShowAnswersButton();
        try { localStorage.setItem('s3_round_start_time', window.vsRoundStartTime); } catch(e) {}
    } else if (roundIndex === 4) {
        roundName = 'VINH_QUANG';
        viewNum = 6;
        label = 'Vinh Quang';
    } else if (roundIndex === 5) {
        roundName = 'CAU_HOI_PHU';
        viewNum = 0;
        label = 'Câu Hỏi Phụ';
    }

    window.currentActiveRound = roundName;
    window.currentActiveTimer = null;
    window.xpQuestionIsShown = false;
    window.vsQuestionIsShown = false;
    window.vqQuestionIsShown = false;
    try {
        localStorage.setItem('ddvq_active_round', roundName);
        localStorage.setItem('ddvq_xp_question_shown', 'false');
        localStorage.setItem('ddvq_vs_question_shown', 'false');
        localStorage.setItem('ddvq_vq_question_shown', 'false');
        localStorage.removeItem('ddvq_current_timer');
        localStorage.removeItem('ddvq_xp_question_text');
        localStorage.removeItem('ddvq_vs_question_text');
        localStorage.removeItem('ddvq_vq_question_text');
    } catch(e) {}

    // Gửi tín hiệu chuyển vòng và dọn sạch graphic trên Projector
    const payload = {
        type: 'START_ROUND_CLEAN',
        round: roundName,
        activeRound: roundName,
        roundIndex: roundIndex,
        sceneNum: roundIndex,
        viewNum: viewNum,
        xpQuestionShown: false,
        vsQuestionShown: false,
        vqQuestionShown: false,
        roundStartTime: roundIndex === 3 ? window.vsRoundStartTime : undefined,
        vuotSong: roundIndex === 3 ? gameData.vuotSong : undefined,
        timestamp: Date.now()
    };
    sendToProjector('START_ROUND_CLEAN', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }

    if (typeof resetTongKetButton === 'function') {
        resetTongKetButton();
    }

    if (roundIndex === 1) {
        currentXuatPhatTurn = 0;
        if (typeof isXuatPhatStarted !== 'undefined') isXuatPhatStarted = false;
        for (let i = 1; i <= 5; i++) {
            const btn = document.getElementById(`btn_luot_${i}`);
            if (btn) btn.classList.remove('active');
        }
        if (typeof clearXPBuzzerUI === 'function') clearXPBuzzerUI();
        if (typeof updateTab1Preview === 'function') updateTab1Preview();
        sendToProjector('XUAT_PHAT_RESET', { turnIndex: 0, round: 'XUAT_PHAT', activeRound: 'XUAT_PHAT', xpQuestionShown: false, vqQuestionShown: false, keepRoundStartSound: true });
    } else if (roundIndex === 2) {
        if (typeof setRKQuestionUI === 'function') setRKQuestionUI(1);
        if (typeof resetRKDapAnButton === 'function') resetRKDapAnButton();
        sendToProjector('RA_KHOI_RESET', { round: 'RA_KHOI', activeRound: 'RA_KHOI', keepRoundStartSound: true });
    } else if (roundIndex === 3) {
        if (typeof updateVuotSongState === 'function') updateVuotSongState();
        sendToProjector('VUOT_SONG_RESET', { round: 'VUOT_SONG', activeRound: 'VUOT_SONG', vsQuestionShown: false, roundStartTime: window.vsRoundStartTime, vuotSong: gameData.vuotSong, keepRoundStartSound: true });
        sendToProjector('PLAY_SOUND', { sound: 'SFX/2_StartRound.mp3' });
    } else if (roundIndex === 4) {
        sendToProjector('VINH_QUANG_RESET', { round: 'VINH_QUANG', activeRound: 'VINH_QUANG', vqQuestionShown: false, keepRoundStartSound: true });
        sendToProjector('VINH_QUANG_HIDE_PACK', { round: 'VINH_QUANG', vqQuestionShown: false, silent: true });
        sendToProjector('VINH_QUANG_INTRO', { round: 'VINH_QUANG', activeRound: 'VINH_QUANG' });
    } else if (roundIndex === 5) {
        if (typeof onClickCHPReset === 'function') onClickCHPReset();
        sendToProjector('CAU_HOI_PHU_RESET', { round: 'CHP', activeRound: 'CHP' });
    }

    if (typeof window.saveControllerRuntimeState === 'function') {
        window.saveControllerRuntimeState();
    }
    showToast(`🚀 Đã Bắt đầu Vòng ${roundIndex}: ${label}! Đã chuyển tab Player & ẩn toàn bộ Graphic.`);
};

// Show Toast Notification
function showToast(msg) {
    console.log("[Controller Toast]:", msg);
    // Disabled UI toast on controller to prevent lag and button obstruction as requested.
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function safeGetStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn("Storage access restricted:", e);
        return null;
    }
}

function safeSetStorage(key, val) {
    try {
        localStorage.setItem(key, val);
    } catch (e) {
        console.warn("Storage access restricted:", e);
    }
}

function safeRemoveStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.warn("Storage access restricted:", e);
    }
}

// Seed default questions if empty
function ensureDefaultGameDataSeed() {
    const defaultXPSet1 = [
        { q: "Thành phố Hồ Chí Minh trước năm 1976 có tên gọi là gì?", a: "Sài Gòn" },
        { q: "Ngôn ngữ chính thức của Việt Nam là gì?", a: "Tiếng Việt" },
        { q: "Hành tinh nào trong Hệ Mặt Trời gần Mặt Trời nhất?", a: "Thủy Tinh" },
        { q: "Sông nào dài nhất chảy hoàn toàn trên lãnh thổ Việt Nam?", a: "Sông Đồng Nai" },
        { q: "Ai là tác giả của tác phẩm Truyện Kiều?", a: "Nguyễn Du" },
        { q: "Kim loại nào có khả năng dẫn điện tốt nhất?", a: "Bạc" },
        { q: "Thủ đô của Nhật Bản là thành phố nào?", a: "Tokyo" },
        { q: "Bác Hồ đọc Tuyên ngôn Độc lập khai sinh nước VNDCCH vào năm nào?", a: "1945" },
        { q: "Đỉnh núi nào được mệnh danh là nóc nhà của Đông Dương?", a: "Fansipan" },
        { q: "Vitamin nào có hàm lượng rất cao trong quả cam, chanh?", a: "Vitamin C" },
        { q: "Đơn vị đo cường độ dòng điện trong hệ SI là gì?", a: "Ampe" },
        { q: "Quốc gia nào có diện tích lớn nhất thế giới?", a: "Nga" }
    ];

    for (let t = 1; t <= 8; t++) {
        const defaultCount = (t >= 1 && t <= 4) ? 6 : 12;
        const maxCap = (t >= 1 && t <= 4) ? 6 : 15;
        if (!gameData.xuatPhat[t] || !Array.isArray(gameData.xuatPhat[t])) {
            gameData.xuatPhat[t] = [];
        }
        while (gameData.xuatPhat[t].length < defaultCount) {
            const idx = gameData.xuatPhat[t].length;
            const src = defaultXPSet1[idx];
            gameData.xuatPhat[t].push({
                q: src ? src.q : `Câu hỏi số ${idx + 1} bộ đề ${t}`,
                a: src ? src.a : `Đáp án câu ${idx + 1}`
            });
        }
        if (gameData.xuatPhat[t].length > maxCap) {
            gameData.xuatPhat[t] = gameData.xuatPhat[t].slice(0, maxCap);
        }
    }

    if (!gameData.raKhoi || !gameData.raKhoi[0] || !gameData.raKhoi[0].q) {
        gameData.raKhoi = [
            { q: "Sự kiện lịch sử nào diễn ra vào ngày 30/4/1975?", a: "Giải phóng miền Nam" },
            { q: "Nguyên tố hóa học nào có ký hiệu là Au?", a: "Vàng" },
            { q: "Biển nào có độ mặn cao nhất thế giới?", a: "Biển Chết" },
            { q: "Tập hợp các số tự nhiên được ký hiệu bằng chữ cái nào?", a: "N" }
        ];
    }

    if (!gameData.vuotSong || !gameData.vuotSong.h1 || !gameData.vuotSong.h1.q) {
        gameData.vuotSong = {
            h1: { q: "Loài chim biểu tượng cho hòa bình là chim gì?", a: "BO CHAU" },
            h2: { q: "Thành phố trung tâm kinh tế lớn nhất phía Nam là gì?", a: "TP HO CHI MINH" },
            h3: { q: "Đại dương lớn nhất trên Trái Đất là đại dương nào?", a: "THAI BINH DUONG" },
            h4: { q: "Chất khí chiếm tỷ lệ lớn nhất trong không khí là khí gì?", a: "NITO" },
            center: { q: "Từ khóa chính của chướng ngại vật là gì?", a: "VIET NAM" },
            keyword: "VIET NAM"
        };
    }

    if (!gameData.vinhQuang || typeof gameData.vinhQuang !== 'object' || !Array.isArray(gameData.vinhQuang[1])) {
        gameData.vinhQuang = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        for (let pt of [1, 2, 3, 4, 5]) {
            for (let i = 0; i < 6; i++) {
                gameData.vinhQuang[pt].push({ m: '', q: '', a: '' });
            }
        }
    }
}

// Initialize empty Xuat Phat turns
function initXuatPhatTurnData() {
    ensureDefaultGameDataSeed();
}

// Render Xuat Phat rows for editing a set (1..4: max 6 rows, 5..8: up to 15 rows)
function renderXuatPhatTurnUI(deNum) {
    editingXuatPhatDe = deNum || 1;
    const container = document.getElementById('xuatPhatRows');
    if (!container) return;

    // Highlight tab header
    const tabs = document.querySelectorAll('#xuatPhatTabHeader .kd-tab');
    tabs.forEach((tab, idx) => {
        if (idx + 1 === editingXuatPhatDe) tab.classList.add('active');
        else tab.classList.remove('active');
    });

    container.innerHTML = '';
    const questions = gameData.xuatPhat[editingXuatPhatDe] || [];
    const maxRows = (editingXuatPhatDe >= 1 && editingXuatPhatDe <= 4) ? 6 : Math.max(15, questions.length);

    for (let i = 0; i < maxRows; i++) {
        const item = questions[i] || { q: '', a: '' };
        const row = document.createElement('div');
        row.className = 'kd-row';
        row.innerHTML = `
            <span style="font-weight: bold; color: #555;">Câu ${i + 1}</span>
            <input type="text" value="${escapeHtml(item.q)}" placeholder="Nội dung câu hỏi ${i + 1}" oninput="updateXuatPhatItem(${editingXuatPhatDe}, ${i}, 'q', this.value)">
            <input type="text" value="${escapeHtml(item.a)}" placeholder="Đáp án câu ${i + 1}" oninput="updateXuatPhatItem(${editingXuatPhatDe}, ${i}, 'a', this.value)">
        `;
        container.appendChild(row);
    }
}

function switchXuatPhatTurn(deNum) {
    renderXuatPhatTurnUI(deNum);
}

function scrollXuatPhatTabs(direction) {
    let next = editingXuatPhatDe + direction;
    if (next < 1) next = 8;
    if (next > 8) next = 1;
    switchXuatPhatTurn(next);
}

// Debounced State Saving & Broadcasting to prevent input lag
let debouncedSaveTimeout = null;
function debouncedSaveAllData(delay = 250) {
    if (debouncedSaveTimeout) clearTimeout(debouncedSaveTimeout);
    debouncedSaveTimeout = setTimeout(() => {
        saveAllData(false);
    }, delay);
}

function updateXuatPhatItem(turn, index, field, value) {
    if (!gameData.xuatPhat[turn]) gameData.xuatPhat[turn] = [];
    if (!gameData.xuatPhat[turn][index]) gameData.xuatPhat[turn][index] = { q: '', a: '' };
    gameData.xuatPhat[turn][index][field] = value;
    debouncedSaveAllData(300);
}

// Vuot Song Crossword & character counter
let vsSyncTimeout = null;
function updateVuotSongState() {
    if (!gameData.vuotSong || Array.isArray(gameData.vuotSong)) {
        gameData.vuotSong = { h1: {q:"",a:""}, h2: {q:"",a:""}, h3: {q:"",a:""}, h4: {q:"",a:""}, center: {q:"",a:""}, keyword: "" };
    }
    for (let i = 1; i <= 4; i++) {
        const qEl = document.getElementById(`vs_q_${i}`);
        const aEl = document.getElementById(`vs_a_${i}`);
        if (qEl || aEl) {
            const qVal = qEl ? qEl.value : (gameData.vuotSong[`h${i}`]?.q || '');
            let aVal = aEl ? aEl.value : (gameData.vuotSong[`h${i}`]?.a || '');
            if (!aVal.trim() && qVal.trim()) {
                aVal = qVal;
            }
            gameData.vuotSong[`h${i}`] = { q: qVal, a: aVal };
        }

        const aVal = gameData.vuotSong[`h${i}`]?.a || gameData.vuotSong[`h${i}`]?.q || '';
        const boxContainer = document.getElementById(`vs_box_${i}`);
        const countSpan = document.getElementById(`vs_count_${i}`);
        
        if (boxContainer) {
            boxContainer.innerHTML = '';
            const cleanAns = aVal.replace(/\s+/g, '').toUpperCase();
            for (let c of cleanAns) {
                const cell = document.createElement('span');
                cell.className = 'box-cell';
                cell.innerText = c;
                boxContainer.appendChild(cell);
            }
            if (cleanAns.length === 0) {
                boxContainer.innerHTML = '<span style="color:#aaa; font-style:italic;">Chưa có đáp án</span>';
            }
        }
        if (countSpan) {
            const cleanLen = aVal.replace(/\s+/g, '').length;
            countSpan.innerText = `${cleanLen} kí tự`;
        }
    }

    // Center & Keyword
    const qcEl = document.getElementById('vs_q_center');
    const acEl = document.getElementById('vs_a_center');
    if (qcEl || acEl) {
        const qcVal = qcEl ? qcEl.value : (gameData.vuotSong.center?.q || '');
        let acVal = acEl ? acEl.value : (gameData.vuotSong.center?.a || '');
        if (!acVal.trim() && qcVal.trim()) acVal = qcVal;
        gameData.vuotSong.center = { q: qcVal, a: acVal };
    }

    const kwEl = document.getElementById('vs_keyword');
    if (kwEl) {
        gameData.vuotSong.keyword = kwEl.value;
    }
    if (!gameData.vuotSong.keyword && gameData.vuotSong.center?.a) {
        gameData.vuotSong.keyword = gameData.vuotSong.center.a;
    }
    const kwSpan = document.getElementById('vs_keyword_count');
    if (kwSpan) {
        const kwVal = gameData.vuotSong.keyword || gameData.vuotSong.center?.a || gameData.vuotSong.center?.q || '';
        kwSpan.innerText = `${kwVal.replace(/\s+/g, '').length} kí tự`;
    }

    const hintEl = document.getElementById('vs_hint_image');
    if (hintEl) {
        const rawHint = hintEl.value.trim();
        const cleanHint = rawHint === '...' ? '' : rawHint;
        gameData.vuotSong.hintImage = (typeof window.normalizeMediaUrl === 'function' && cleanHint)
            ? window.normalizeMediaUrl(cleanHint)
            : cleanHint;
    }

    if (vsSyncTimeout) clearTimeout(vsSyncTimeout);
    vsSyncTimeout = setTimeout(() => {
        debouncedSaveAllData(100);
        sendToProjector('VUOT_SONG_SYNC_GRID', { vuotSong: gameData.vuotSong });
    }, 200);
}

// Vinh Quang 5 packs (Gói 1..5 x 6 questions each: 3x20Đ and 3x30Đ)
function initVinhQuangData() {
    if (!gameData.vinhQuang || typeof gameData.vinhQuang !== 'object') {
        gameData.vinhQuang = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    }
    for (let pt of [1, 2, 3, 4, 5]) {
        if (!gameData.vinhQuang[pt] || !Array.isArray(gameData.vinhQuang[pt])) {
            gameData.vinhQuang[pt] = [];
        }
        while (gameData.vinhQuang[pt].length < 6) {
            gameData.vinhQuang[pt].push({ m: '', q: '', a: '' });
        }
    }
}

function switchVinhQuangPack(pack) {
    currentVinhQuangPack = pack;
    renderVinhQuangPackUI(pack);
}

function renderVinhQuangPackUI(pack) {
    initVinhQuangData();
    
    document.querySelectorAll('input[name="vq_pack"], input[name="tab0_vq_pack"]').forEach(radio => {
        radio.checked = (parseInt(radio.value) === pack);
    });

    const vqContestants = document.getElementById('vq_contestants');
    if (vqContestants) {
        vqContestants.innerHTML = '';
        for (let i = 1; i <= 4; i++) {
            const contestant = gameData.contestants?.[i-1] || { name: `Thí sinh ${i}`, score: 0 };
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '8px';
            div.innerHTML = `
                <div style="position: relative; width: 75px; height: 56px; background: #fff; border: 3px solid #dc2626; border-radius: 4px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <span id="vq_ts${i}_score_disp" style="font-size: 30px; font-weight: bold; color: #dc2626;">${contestant.score || 0}</span>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <div style="display: flex; background: #f59e0b; padding: 4px 8px; border-radius: 2px 2px 0 0; align-items: center; gap: 5px; border: 2px solid #d97706; border-bottom: none;">
                        <input type="text" value="${contestant.name}" style="background: transparent; border: none; font-weight: bold; color: #000; font-size: 14px; flex: 1; outline: none;" readonly>
                    </div>
                    <div style="height: 24px; background: #15803d; border-radius: 0 0 2px 2px; border: 2px solid #166534; border-top: none;"></div>
                </div>
            `;
            vqContestants.appendChild(div);
        }
    }

    const containers = [
        document.getElementById('vinhQuangRows'),
        document.getElementById('tab0_vinhQuangRows')
    ];

    containers.forEach(container => {
        if (!container) return;
        container.innerHTML = '';

        const headerRow = document.createElement('div');
        headerRow.style.display = 'grid';
        headerRow.style.gridTemplateColumns = '140px 1fr 1fr';
        headerRow.style.gap = '10px';
        headerRow.style.fontWeight = 'normal';
        headerRow.style.fontStyle = 'italic';
        headerRow.style.color = '#333';
        headerRow.style.marginBottom = '6px';
        headerRow.style.paddingBottom = '4px';
        headerRow.innerHTML = `
            <span></span>
            <span style="text-align: left;">Câu hỏi</span>
            <span style="text-align: left;">Đáp án</span>
        `;
        container.appendChild(headerRow);

        const questions = gameData.vinhQuang[pack] || [];

        for (let i = 0; i < 6; i++) {
            if (i === 3) {
                const hr = document.createElement('hr');
                hr.style.margin = '10px 0';
                hr.style.border = '1px solid #cbd5e1';
                container.appendChild(hr);
            }
            const item = questions[i] || { m: '', q: '', a: '' };
            const labelText = i < 3 ? `Câu 20Đ - ${i + 1}` : `Câu 30Đ - ${i - 2}`;
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '140px 1fr 1fr';
            row.style.gap = '10px';
            row.style.alignItems = 'center';
            row.style.marginBottom = '8px';
            row.innerHTML = `
                <span style="font-weight: bold; color: #1e293b;">${labelText}</span>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <input type="text" value="${escapeHtml(item.q || '')}" placeholder="Nội dung ${labelText}" oninput="updateVinhQuangItem(${pack}, ${i}, 'q', this.value)" style="padding: 5px; border: 1px solid #cbd5e1; border-radius: 4px;">
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <button type="button" class="btn" style="font-size: 11px; padding: 3px 8px;" onclick="triggerFilePicker('vq_m_${pack}_${i}', 'image/*,video/*')">Chọn ảnh hoặc video</button>
                        <span id="vq_m_${pack}_${i}_lbl" style="font-size: 11px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;">${item.m ? item.m.split('/').pop() : '...'}</span>
                        <input type="hidden" id="vq_m_${pack}_${i}" value="${escapeHtml(item.m || '')}" onchange="updateVinhQuangItem(${pack}, ${i}, 'm', this.value)">
                    </div>
                </div>
                <div>
                    <input type="text" value="${escapeHtml(item.a || '')}" placeholder="Đáp án ${labelText}" oninput="updateVinhQuangItem(${pack}, ${i}, 'a', this.value)" style="padding: 5px; border: 1px solid #cbd5e1; border-radius: 4px; width: 100%;">
                </div>
            `;
            container.appendChild(row);
        }
    });
}

function updateVinhQuangItem(pack, index, field, value) {
    initVinhQuangData();
    if (!gameData.vinhQuang[pack][index]) {
        gameData.vinhQuang[pack][index] = { m: '', q: '', a: '' };
    }
    gameData.vinhQuang[pack][index][field] = value;
    debouncedSaveAllData(300);
}

// Excel Upload Handler
function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const excelNameEl = document.getElementById('excelFileName');
    if (excelNameEl) excelNameEl.value = file.name;
    gameData.excelFileName = file.name;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            parseExcelWorkbook(workbook);

            const step4 = document.getElementById('step4-check');
            if (step4) {
                step4.className = 'status-check green-check';
                step4.innerText = '✅';
            }

            showToast(`Đã nhập dữ liệu thành công từ file ${file.name}!`);
            saveAllData(true);
        } catch (err) {
            console.error("Excel parse error:", err);
            alert("Lỗi khi đọc file Excel. Vui lòng kiểm tra đúng định dạng mẫu đề!");
        }
    };
    reader.readAsArrayBuffer(file);
}

function normalizeExcelText(val) {
    return (val === null || val === undefined ? '' : String(val))
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function normalizeExcelCompact(val) {
    return normalizeExcelText(val).replace(/[\s_.\-:]+/g, '');
}

function getWorksheetCellLink(worksheet, r, c) {
    if (!worksheet || typeof XLSX === 'undefined' || !XLSX.utils || typeof XLSX.utils.encode_cell !== 'function') return '';
    try {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[addr];
        if (cell && cell.l && cell.l.Target) {
            return String(cell.l.Target).trim();
        }
    } catch (e) {}
    return '';
}

function isExcelMediaLink(val) {
    const s = (val || '').toString().trim();
    if (!s || s === '...') return false;
    return /^(https?:|data:|file:|\/?(?:uploads|Media|media|Images|images|videos|assets)\/)/i.test(s) ||
        /\.(mp4|webm|mov|m4v|avi|mkv|ogv|png|jpe?g|gif|webp|bmp|svg|avif)(\?|#|$)/i.test(s);
}

function parseExcelWorkbook(workbook) {
    const sheetNames = workbook.SheetNames || [];

    sheetNames.forEach(sheetName => {
        const compactSheet = normalizeExcelCompact(sheetName);
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (compactSheet.includes("KHOIDONG") || compactSheet.includes("XUATPHAT")) {
            parseXuatPhatSheet(rawRows, worksheet);
        } else if (compactSheet.includes("TANGTOC") || compactSheet.includes("RAKHOI")) {
            parseRaKhoiSheet(rawRows, worksheet);
        } else if (compactSheet.includes("VCNV") || compactSheet.includes("VUOTSONG") || compactSheet.includes("VUOTCHUONGNGAIVAT")) {
            parseVuotSongSheet(rawRows, worksheet);
        } else if ((compactSheet.includes("VEDICH") && !compactSheet.includes("PHU")) || compactSheet.includes("VINHQUANG")) {
            parseVinhQuangSheet(rawRows, worksheet);
        } else if (compactSheet.includes("VEDICHPHU") || compactSheet.includes("CAUHOIPHU") || compactSheet === "CHP") {
            parseCauHoiPhuSheet(rawRows, worksheet);
        }
    });

    renderXuatPhatTurnUI(editingXuatPhatDe || 1);
    fillRaKhoiInputs();
    fillVuotSongInputs();
    renderVinhQuangPackUI(currentVinhQuangPack || 1);
    fillCauHoiPhuInputs();
    updateVuotSongState();
    if (typeof updateTab1Preview === 'function') updateTab1Preview();
    if (typeof updateTab2Preview === 'function') updateTab2Preview();
    if (typeof updateVQMediaIndicators === 'function') updateVQMediaIndicators();
    if (typeof updateTab5Preview === 'function') updateTab5Preview();
    if (typeof syncContestantsUI === 'function') syncContestantsUI();
}

function parseXuatPhatSheet(rows, worksheet) {
    // Check for multi-column KhoiDong header (Thí sinh 1..5 + Khởi động chung)
    let headerRowIdx = -1;
    let colMappings = [];

    for (let r = 0; r < Math.min(3, rows.length); r++) {
        const row = rows[r] || [];
        const found = [];
        for (let c = 0; c < row.length; c++) {
            const compact = normalizeExcelCompact(row[c]);
            if (!compact) continue;
            const tsMatch = compact.match(/^THISINH(\d+)$/);
            if (tsMatch) {
                const tsNum = parseInt(tsMatch[1], 10);
                // Thí sinh 1..4 -> Bộ đề 1..4; Thí sinh 5 -> Bộ đề 6 (vì Bộ đề 5 là Khởi động chung)
                const targetTurn = (tsNum >= 1 && tsNum <= 4) ? tsNum : (tsNum === 5 ? 6 : tsNum + 1);
                if (targetTurn >= 1 && targetTurn <= 8) {
                    found.push({ turn: targetTurn, qCol: c, aCol: c + 1 });
                }
            } else if (compact.includes("KHOIDONGCHUNG") || compact.includes("THICHUNG") || compact === "CHUNG") {
                found.push({ turn: 5, qCol: c, aCol: c + 1 });
            }
        }
        if (found.length > 0) {
            headerRowIdx = r;
            colMappings = found;
            break;
        }
    }

    if (headerRowIdx !== -1 && colMappings.length > 0) {
        const collected = {};
        colMappings.forEach(m => {
            collected[m.turn] = [];
        });

        for (let r = headerRowIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            colMappings.forEach(m => {
                const maxForTurn = (m.turn >= 1 && m.turn <= 4) ? 6 : 15;
                if (collected[m.turn].length >= maxForTurn) return;
                const qText = (row[m.qCol] !== undefined && row[m.qCol] !== null ? String(row[m.qCol]) : "").trim();
                const aText = (row[m.aCol] !== undefined && row[m.aCol] !== null ? String(row[m.aCol]) : "").trim();
                if (qText || aText) {
                    collected[m.turn].push({ q: qText, a: aText });
                }
            });
        }

        Object.keys(collected).forEach(turnKey => {
            const turn = parseInt(turnKey, 10);
            const items = collected[turn] || [];
            if (items.length === 0) return;
            const targetLen = (turn >= 1 && turn <= 4) ? 6 : Math.max(12, Math.min(15, items.length));
            while (items.length < targetLen) {
                items.push({ q: '', a: '' });
            }
            gameData.xuatPhat[turn] = items.slice(0, (turn >= 1 && turn <= 4) ? 6 : 15);
        });
        return;
    }

    // Fallback: Legacy 3-column XUẤT PHÁT format
    let currentTurn = 1;
    let currentItemIndex = 0;

    for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length < 2) continue;

        const sttDe = row[0] !== undefined && row[0] !== "" ? parseInt(row[0], 10) : null;
        const questionText = (row[1] || "").toString().trim();
        const answerText = (row[2] || "").toString().trim();

        if (!questionText && !answerText) continue;

        if (sttDe && !isNaN(sttDe)) {
            currentTurn = sttDe;
            currentItemIndex = 0;
        }

        const maxRows = (currentTurn >= 1 && currentTurn <= 4) ? 6 : 15;
        if (!gameData.xuatPhat[currentTurn]) {
            gameData.xuatPhat[currentTurn] = [];
            for (let i = 0; i < maxRows; i++) gameData.xuatPhat[currentTurn].push({ q: '', a: '' });
        }

        if (currentItemIndex < maxRows) {
            gameData.xuatPhat[currentTurn][currentItemIndex] = {
                q: questionText,
                a: answerText
            };
            currentItemIndex++;
        }
    }
}

function parseRaKhoiSheet(rows, worksheet) {
    if (!Array.isArray(gameData.raKhoi)) {
        gameData.raKhoi = [ {q:"",a:"",m:"",am:""}, {q:"",a:"",m:"",am:""}, {q:"",a:"",m:"",am:""}, {q:"",a:"",m:"",am:""} ];
    }

    // Detect header row (row 0 in new TangToc sheet has B1 blank/Câu hỏi and C1="Đáp án"; legacy has row 1 header)
    let startRow = 1;
    if (rows.length > 1) {
        const r0CompactA = normalizeExcelCompact(rows[0]?.[0]);
        const r0CompactB = normalizeExcelCompact(rows[0]?.[1]);
        const r0CompactC = normalizeExcelCompact(rows[0]?.[2]);
        const r1CompactA = normalizeExcelCompact(rows[1]?.[0]);
        const r1CompactC = normalizeExcelCompact(rows[1]?.[2]);
        if (r0CompactC.includes("DAPAN") || r0CompactB.includes("CAUHOI") || r0CompactB.includes("NOIDUNG")) {
            startRow = 1;
        } else if (r1CompactA === "CAU" || r1CompactC.includes("DAPAN") || r0CompactA === "RAKHOI") {
            startRow = 2;
        }
    }

    const parsedItems = [];
    for (let r = startRow; r < rows.length && parsedItems.length < 6; r++) {
        const row = rows[r];
        if (!row || row.length < 2) continue;

        const qText = (row[1] !== undefined && row[1] !== null ? String(row[1]) : "").trim();
        const aText = (row[2] !== undefined && row[2] !== null ? String(row[2]) : "").trim();
        const col3 = (row[3] !== undefined && row[3] !== null ? String(row[3]) : "").trim();
        const col4 = (row[4] !== undefined && row[4] !== null ? String(row[4]) : "").trim();
        const linkB = getWorksheetCellLink(worksheet, r, 1);

        if (qText || aText) {
            const idx = parsedItems.length;
            const prev = gameData.raKhoi[idx] || {};
            let nextM = (prev.m && prev.m !== '...') ? prev.m : '';
            if (isExcelMediaLink(col3)) {
                nextM = typeof window.normalizeMediaUrl === 'function' ? window.normalizeMediaUrl(col3) : col3;
            } else if (isExcelMediaLink(linkB)) {
                nextM = typeof window.normalizeMediaUrl === 'function' ? window.normalizeMediaUrl(linkB) : linkB;
            }

            const nextAm = isExcelMediaLink(col4)
                ? (typeof window.normalizeMediaUrl === 'function' ? window.normalizeMediaUrl(col4) : col4)
                : ((prev.am && prev.am !== '...') ? prev.am : '');

            parsedItems.push({
                q: qText,
                a: aText,
                m: nextM,
                am: nextAm,
                mt: prev.mt || ''
            });
        }
    }

    if (parsedItems.length > 0) {
        while (parsedItems.length < 4) {
            const prev = gameData.raKhoi[parsedItems.length] || {};
            parsedItems.push({
                q: '',
                a: '',
                m: (prev.m && prev.m !== '...') ? prev.m : '',
                am: (prev.am && prev.am !== '...') ? prev.am : '',
                mt: prev.mt || ''
            });
        }
        gameData.raKhoi = parsedItems.slice(0, 6);
    }
}

function parseVuotSongSheet(rows, worksheet) {
    const prevHintImage = (gameData.vuotSong && !Array.isArray(gameData.vuotSong) && gameData.vuotSong.hintImage)
        ? gameData.vuotSong.hintImage
        : "";
    if (!gameData.vuotSong || Array.isArray(gameData.vuotSong) || typeof gameData.vuotSong !== 'object') {
        gameData.vuotSong = { h1: {q:"",a:""}, h2: {q:"",a:""}, h3: {q:"",a:""}, h4: {q:"",a:""}, center: {q:"",a:""}, keyword: "", hintImage: prevHintImage };
    } else {
        for (let i = 1; i <= 4; i++) {
            if (!gameData.vuotSong[`h${i}`] || typeof gameData.vuotSong[`h${i}`] !== 'object') {
                gameData.vuotSong[`h${i}`] = { q: "", a: "" };
            }
        }
        if (!gameData.vuotSong.center || typeof gameData.vuotSong.center !== 'object') {
            gameData.vuotSong.center = { q: "", a: "" };
        }
    }

    // Detect VCNV crossword grid format: O CHU / KY TU on left + CAU HOI / NOI DUNG on right (cols Q/R)
    const row0 = rows[0] || [];
    let kyTuCol = -1;
    let qLabelCol = -1;
    let qContentCol = -1;
    for (let c = 0; c < row0.length; c++) {
        const comp = normalizeExcelCompact(row0[c]);
        if (comp === "KYTU") kyTuCol = c;
        else if (comp === "CAUHOI") qLabelCol = c;
        else if (comp === "NOIDUNG") qContentCol = c;
    }

    const hasNewGridHeader = (kyTuCol !== -1) || (qLabelCol !== -1 && qContentCol !== -1) ||
        rows.some(r => {
            const c0 = normalizeExcelCompact(r?.[0]);
            return c0.includes("TUKHOAVCNV") || c0 === "OCHU";
        });

    if (hasNewGridHeader) {
        const gridEndCol = kyTuCol > 0 ? kyTuCol : 15; // default A..O (0..14)
        const lblCol = qLabelCol !== -1 ? qLabelCol : 16; // default Q
        const cntCol = qContentCol !== -1 ? qContentCol : (lblCol + 1); // default R

        // Rows 2..5 (indices 1..4) contain crossword letters across A..O
        for (let i = 1; i <= 4; i++) {
            const row = rows[i] || [];
            let word = '';
            for (let c = 0; c < gridEndCol; c++) {
                const ch = (row[c] !== undefined && row[c] !== null ? String(row[c]) : "").trim();
                if (ch) word += ch;
            }
            if (!gameData.vuotSong[`h${i}`]) gameData.vuotSong[`h${i}`] = { q: '', a: '' };
            if (word) {
                gameData.vuotSong[`h${i}`].a = word;
            }
        }

        // Right-side questions table (Hàng 1..4, Trung tâm, Đ.án TT) & Từ khóa VCNV
        let parsedCenterAns = '';
        let parsedKeyword = '';
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r] || [];
            const lblCompact = normalizeExcelCompact(row[lblCol]);
            const contentVal = (row[cntCol] !== undefined && row[cntCol] !== null ? String(row[cntCol]) : "").trim();

            if (lblCompact === "HANG1") gameData.vuotSong.h1.q = contentVal;
            else if (lblCompact === "HANG2") gameData.vuotSong.h2.q = contentVal;
            else if (lblCompact === "HANG3") gameData.vuotSong.h3.q = contentVal;
            else if (lblCompact === "HANG4") gameData.vuotSong.h4.q = contentVal;
            else if (lblCompact === "TRUNGTAM") gameData.vuotSong.center.q = contentVal;
            else if (lblCompact === "DANTT" || lblCompact === "DAPANTT" || lblCompact === "DAPANTRUNGTAM") {
                parsedCenterAns = contentVal;
                gameData.vuotSong.center.a = contentVal;
            }

            const colACompact = normalizeExcelCompact(row[0]);
            if (colACompact.includes("TUKHOAVCNV") || colACompact === "TUKHOA") {
                let kw = '';
                for (let c = 1; c < gridEndCol; c++) {
                    const cellVal = (row[c] !== undefined && row[c] !== null ? String(row[c]) : "").trim();
                    if (cellVal) kw += cellVal;
                }
                if (kw) parsedKeyword = kw;
            }
        }

        gameData.vuotSong.keyword = parsedKeyword || parsedCenterAns || gameData.vuotSong.keyword || '';
        if (!gameData.vuotSong.center.a && parsedKeyword) {
            gameData.vuotSong.center.a = parsedKeyword;
        }
        gameData.vuotSong.hintImage = prevHintImage;
        return;
    }

    // Fallback: Legacy 3-column VƯỢT SÓNG format
    let rowIndex = 1;
    for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length < 2) continue;

        const colA = (row[0] || "").toString().trim();
        const qText = (row[1] || "").toString().trim();
        const aText = (row[2] || "").toString().trim();

        if (colA.toUpperCase().includes("TRUNG TÂM") || colA.toUpperCase().includes("TỪ KHÓA") || r === 6) {
            if (r === 6 && !colA.toUpperCase().includes("ĐÁP ÁN VÒNG THI")) {
                gameData.vuotSong.center = { q: qText, a: aText };
            }
        } else if (rowIndex <= 4) {
            gameData.vuotSong[`h${rowIndex}`] = { q: qText, a: aText };
            rowIndex++;
        }

        if (colA.toUpperCase().includes("TỪ KHÓA") || colA.toUpperCase().includes("ĐÁP ÁN VÒNG THI")) {
            gameData.vuotSong.keyword = aText || qText;
        }
    }
    gameData.vuotSong.hintImage = prevHintImage;
}

function parseVinhQuangSheet(rows, worksheet) {
    initVinhQuangData();

    // Detect new 5-package VeDich format: Gói câu hỏi 1..5 + Đáp án pairs in header row
    let headerRowIdx = -1;
    const packCols = [];
    for (let r = 0; r < Math.min(3, rows.length); r++) {
        const row = rows[r] || [];
        const found = [];
        for (let c = 0; c < row.length; c++) {
            const comp = normalizeExcelCompact(row[c]);
            const m = comp.match(/^GOI(?:CAUHOI)?([1-5])$/);
            if (m) {
                found.push({ packNum: parseInt(m[1], 10), qCol: c, aCol: c + 1 });
            }
        }
        if (found.length > 0) {
            headerRowIdx = r;
            found.forEach(item => packCols.push(item));
            break;
        }
    }

    if (headerRowIdx !== -1 && packCols.length > 0) {
        let count20 = 0;
        let count30 = 0;
        let lastTier = 20;

        for (let r = headerRowIdx + 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length < 2) continue;

            const colAComp = normalizeExcelCompact(row[0]);
            const hasAnyContent = packCols.some(pc => {
                const q = (row[pc.qCol] !== undefined && row[pc.qCol] !== null ? String(row[pc.qCol]) : "").trim();
                const a = (row[pc.aCol] !== undefined && row[pc.aCol] !== null ? String(row[pc.aCol]) : "").trim();
                return !!(q || a);
            });
            if (!hasAnyContent && !colAComp) continue;

            let targetIdx = -1;
            if (colAComp.includes("20")) {
                lastTier = 20;
                if (count20 < 3) targetIdx = count20++;
            } else if (colAComp.includes("30")) {
                lastTier = 30;
                if (count30 < 3) targetIdx = 3 + (count30++);
            } else {
                // Merged label or blank Col A: continue current tier, then move to 30
                if (lastTier === 20 && count20 < 3) {
                    targetIdx = count20++;
                } else if (count30 < 3) {
                    lastTier = 30;
                    targetIdx = 3 + (count30++);
                }
            }

            if (targetIdx < 0 || targetIdx > 5) continue;

            packCols.forEach(pc => {
                const qVal = (row[pc.qCol] !== undefined && row[pc.qCol] !== null ? String(row[pc.qCol]) : "").trim();
                const aVal = (row[pc.aCol] !== undefined && row[pc.aCol] !== null ? String(row[pc.aCol]) : "").trim();
                const prev = gameData.vinhQuang[pc.packNum]?.[targetIdx] || {};
                const linkQ = getWorksheetCellLink(worksheet, r, pc.qCol);
                const nextM = isExcelMediaLink(linkQ)
                    ? (typeof window.normalizeMediaUrl === 'function' ? window.normalizeMediaUrl(linkQ) : linkQ)
                    : (prev.m || '');
                gameData.vinhQuang[pc.packNum][targetIdx] = {
                    m: nextM,
                    q: qVal,
                    a: aVal
                };
            });
        }
        return;
    }

    // Legacy fallback: GÓI 10/20/30 ĐIỂM sheet -> distribute into packs 1..5 cleanly
    let questionIndex = 0;
    for (let r = 0; r < rows.length && questionIndex < 15; r++) {
        const row = rows[r];
        if (!row || row.length < 2) continue;
        const colA = normalizeExcelText(row[0]);
        const colB = normalizeExcelText(row[1]);
        if (colA.includes("VINH QUANG") || colA.includes("STT") || colA.includes("CAU") || colA.includes("GOI") || colB.includes("GOI 10") || colB.includes("MON HOC")) continue;

        const q20 = (row[5] || "").toString().trim();
        const a20 = (row[6] || "").toString().trim();
        const q30 = (row[8] || "").toString().trim();
        const a30 = (row[9] || "").toString().trim();
        const packNum = Math.floor(questionIndex / 3) + 1;
        const subIdx = questionIndex % 3;
        if (packNum <= 5) {
            if (q20 || a20) gameData.vinhQuang[packNum][subIdx] = { m: gameData.vinhQuang[packNum][subIdx]?.m || '', q: q20, a: a20 };
            if (q30 || a30) gameData.vinhQuang[packNum][3 + subIdx] = { m: gameData.vinhQuang[packNum][3 + subIdx]?.m || '', q: q30, a: a30 };
        }
        questionIndex++;
    }
}

function parseCauHoiPhuSheet(rows, worksheet) {
    let startRow = 1;
    if (rows.length > 0) {
        const r0B = normalizeExcelCompact(rows[0]?.[1]);
        const r0C = normalizeExcelCompact(rows[0]?.[2]);
        const r1A = normalizeExcelCompact(rows[1]?.[0]);
        const r1C = normalizeExcelCompact(rows[1]?.[2]);
        if (r0B.includes("CAUHOI") || r0B.includes("NOIDUNG") || r0C.includes("DAPAN")) {
            startRow = 1;
        } else if (r1A === "CAU" || r1C.includes("DAPAN") || normalizeExcelCompact(rows[0]?.[0]).includes("CAUHOIPHU")) {
            startRow = 2;
        }
    }

    const parsed = [];
    for (let r = startRow; r < rows.length && parsed.length < 10; r++) {
        const row = rows[r];
        if (!row || row.length < 2) continue;

        const qText = (row[1] !== undefined && row[1] !== null ? String(row[1]) : "").trim();
        const aText = (row[2] !== undefined && row[2] !== null ? String(row[2]) : "").trim();

        if (qText || aText) {
            parsed.push({ q: qText, a: aText });
        }
    }

    if (parsed.length > 0) {
        while (parsed.length < 3) {
            parsed.push({ q: '', a: '' });
        }
        gameData.cauHoiPhu = parsed.slice(0, 10);
    }
}

function sanitizeStoredMediaValue(val) {
    const clean = (val || '').toString().trim();
    if (!clean || clean === '...' || /^\.\/cau[1-4]\.mp4$/i.test(clean) || clean.startsWith('blob:')) return '';
    return typeof window.normalizeMediaUrl === 'function' ? window.normalizeMediaUrl(clean) : clean;
}

function syncRaKhoiRowVisibility() {
    const list = Array.isArray(gameData.raKhoi) ? gameData.raKhoi : [];
    const has5 = !!(list[4] && (list[4].q?.trim() || list[4].a?.trim() || list[4].m?.trim()));
    const has6 = !!(list[5] && (list[5].q?.trim() || list[5].a?.trim() || list[5].m?.trim()));
    const showCount = has6 ? 6 : (has5 ? 5 : 4);

    for (let i = 5; i <= 6; i++) {
        const visible = i <= showCount;
        const sysRow = document.getElementById(`rk_row_${i}`);
        if (sysRow) sysRow.style.display = visible ? '' : 'none';
        const btn = document.getElementById(`btn_rk_q${i}`);
        if (btn) btn.style.display = visible ? 'flex' : 'none';
    }
    const qTotalEl = document.getElementById('rk_preview_q_total');
    if (qTotalEl) qTotalEl.innerText = String(showCount);
}
window.syncRaKhoiRowVisibility = syncRaKhoiRowVisibility;

function fillRaKhoiInputs() {
    if (!Array.isArray(gameData.raKhoi)) {
        gameData.raKhoi = [
            { q: "", a: "", m: "", am: "" },
            { q: "", a: "", m: "", am: "" },
            { q: "", a: "", m: "", am: "" },
            { q: "", a: "", m: "", am: "" }
        ];
    }
    for (let i = 1; i <= 6; i++) {
        const item = gameData.raKhoi[i - 1] || { q: '', a: '', m: '', am: '' };
        const qEl = document.getElementById(`rk_q_${i}`);
        const aEl = document.getElementById(`rk_a_${i}`);
        const mEl = document.getElementById(`rk_m_${i}`);
        const amEl = document.getElementById(`rk_am_${i}`);
        if (qEl) qEl.value = item.q || '';
        if (aEl) aEl.value = item.a || '';
        if (mEl) {
            const cleanedM = sanitizeStoredMediaValue(item.m);
            mEl.value = cleanedM;
            mEl.dataset.mediaType = item.mt || '';
        }
        if (amEl) {
            amEl.value = sanitizeStoredMediaValue(item.am);
        }
    }
    syncRaKhoiRowVisibility();
    if (typeof updateTab2Preview === 'function') updateTab2Preview();
}

function fillVuotSongInputs() {
    if (!gameData.vuotSong || Array.isArray(gameData.vuotSong)) {
        gameData.vuotSong = { h1: {q:"",a:""}, h2: {q:"",a:""}, h3: {q:"",a:""}, h4: {q:"",a:""}, center: {q:"",a:""}, keyword: "", hintImage: "" };
    }
    for (let i = 1; i <= 4; i++) {
        const item = gameData.vuotSong[`h${i}`] || { q: '', a: '' };
        const qEl = document.getElementById(`vs_q_${i}`);
        const aEl = document.getElementById(`vs_a_${i}`);
        if (qEl) qEl.value = item.q || '';
        if (aEl) aEl.value = item.a || '';
    }
    const cItem = gameData.vuotSong.center || { q: '', a: '' };
    const qc = document.getElementById('vs_q_center');
    const ac = document.getElementById('vs_a_center');
    if (qc) qc.value = cItem.q || '';
    if (ac) ac.value = cItem.a || '';

    const kw = document.getElementById('vs_keyword');
    if (kw) kw.value = gameData.vuotSong.keyword || '';

    const hintEl = document.getElementById('vs_hint_image');
    if (hintEl) hintEl.value = sanitizeStoredMediaValue(gameData.vuotSong.hintImage);
}

function renderSysCHPRows() {
    const container = document.getElementById('sys_chp_rows');
    if (!container) return;
    if (!Array.isArray(gameData.cauHoiPhu)) gameData.cauHoiPhu = [];

    let nonEmptyCount = 0;
    for (let i = 0; i < Math.min(10, gameData.cauHoiPhu.length); i++) {
        const it = gameData.cauHoiPhu[i];
        if (it && ((it.q && it.q.trim()) || (it.a && it.a.trim()))) {
            nonEmptyCount = i + 1;
        }
    }
    const rowCount = Math.max(3, Math.min(10, Math.max(nonEmptyCount, gameData.cauHoiPhu.length)));
    container.innerHTML = '';
    for (let i = 1; i <= rowCount; i++) {
        const item = gameData.cauHoiPhu[i - 1] || { q: '', a: '' };
        const row = document.createElement('div');
        row.className = 'q-row';
        row.innerHTML = `
            <span>Câu Phụ ${i}</span>
            <div><input type="text" id="sys_chp_q_${i}" value="${escapeHtml(item.q || '')}" placeholder="Nội dung câu phụ ${i}" onchange="saveAllData(); if (typeof updateTab5Preview === 'function') updateTab5Preview();"></div>
            <div><input type="text" id="sys_chp_a_${i}" value="${escapeHtml(item.a || '')}" placeholder="Đáp án" onchange="saveAllData(); if (typeof updateTab5Preview === 'function') updateTab5Preview();"></div>
        `;
        container.appendChild(row);
    }
}
window.renderSysCHPRows = renderSysCHPRows;

function fillCauHoiPhuInputs() {
    if (!Array.isArray(gameData.cauHoiPhu)) gameData.cauHoiPhu = [];
    renderSysCHPRows();
    const total = Math.max(3, Math.min(10, gameData.cauHoiPhu.length));
    for (let i = 1; i <= total; i++) {
        const item = gameData.cauHoiPhu[i - 1] || { q: '', a: '' };
        const sysQ = document.getElementById(`sys_chp_q_${i}`);
        const sysA = document.getElementById(`sys_chp_a_${i}`);
        if (sysQ) sysQ.value = item.q || '';
        if (sysA) sysA.value = item.a || '';

        const qEl = document.getElementById(`chp_q_${i}`);
        const aEl = document.getElementById(`chp_a_${i}`);
        if (qEl) qEl.value = item.q || '';
        if (aEl) aEl.value = item.a || '';
    }
    if (typeof renderCHPQuestionButtons === 'function') renderCHPQuestionButtons();
    if (typeof updateTab5Preview === 'function') updateTab5Preview();
}

function fillIntroInputs() {
    if (!gameData.intros) return;
    const opEl = document.getElementById('intro_media_opening');
    const v1El = document.getElementById('intro_media_v1');
    const v2El = document.getElementById('intro_media_v2');
    const v3El = document.getElementById('intro_media_v3');
    const v4El = document.getElementById('intro_media_v4');
    if (opEl && gameData.intros.opening) opEl.value = gameData.intros.opening;
    if (v1El && gameData.intros.v1) v1El.value = gameData.intros.v1;
    if (v2El && gameData.intros.v2) v2El.value = gameData.intros.v2;
    if (v3El && gameData.intros.v3) v3El.value = gameData.intros.v3;
    if (v4El && gameData.intros.v4) v4El.value = gameData.intros.v4;

    for (let i = 1; i <= 10; i++) {
        const imgEl = document.getElementById(`intro_media_img${i}`);
        if (imgEl && gameData.intros[`img${i}`]) {
            imgEl.value = gameData.intros[`img${i}`];
        }
    }

    const customSoundEl = document.getElementById('controller_custom_sound_url');
    if (customSoundEl && gameData.intros.customSound) {
        customSoundEl.value = gameData.intros.customSound;
    }
}

function saveAllData(notify = false) {
    try {
        if (!Array.isArray(gameData.raKhoi)) gameData.raKhoi = [];
        for (let i = 1; i <= 6; i++) {
            const qEl = document.getElementById(`rk_q_${i}`);
            const aEl = document.getElementById(`rk_a_${i}`);
            const mEl = document.getElementById(`rk_m_${i}`);
            const amEl = document.getElementById(`rk_am_${i}`);
            if (i <= 4 || (qEl && qEl.value.trim()) || (aEl && aEl.value.trim()) || (mEl && mEl.value.trim()) || (amEl && amEl.value.trim())) {
                const prevItem = gameData.raKhoi[i - 1] || {};
                const qVal = qEl ? qEl.value : (prevItem.q || '');
                const aVal = aEl ? aEl.value : (prevItem.a || '');
                let rawM = mEl ? mEl.value.trim() : (prevItem.m || '');
                if (rawM === '...') rawM = '';
                if (rawM.startsWith('blob:') && prevItem.m && !prevItem.m.startsWith('blob:')) {
                    rawM = prevItem.m;
                }
                const mVal = (typeof window.normalizeMediaUrl === 'function' && rawM && !rawM.startsWith('blob:'))
                    ? window.normalizeMediaUrl(rawM)
                    : rawM;

                let rawAm = amEl ? amEl.value.trim() : (prevItem.am || '');
                if (rawAm === '...') rawAm = '';
                const amVal = (typeof window.normalizeMediaUrl === 'function' && rawAm && !rawAm.startsWith('blob:'))
                    ? window.normalizeMediaUrl(rawAm)
                    : rawAm;

                const mtVal = mEl?.dataset?.mediaType || prevItem.mt || '';
                gameData.raKhoi[i - 1] = {
                    q: qVal,
                    a: aVal,
                    m: mVal,
                    am: amVal,
                    mt: mtVal
                };
            }
        }
        if (typeof syncRaKhoiRowVisibility === 'function') syncRaKhoiRowVisibility();

        if (!gameData.vuotSong || Array.isArray(gameData.vuotSong)) {
            gameData.vuotSong = { h1: {q:"",a:""}, h2: {q:"",a:""}, h3: {q:"",a:""}, h4: {q:"",a:""}, center: {q:"",a:""}, keyword: "", hintImage: "" };
        }
        for (let i = 1; i <= 4; i++) {
            const qEl = document.getElementById(`vs_q_${i}`);
            const aEl = document.getElementById(`vs_a_${i}`);
            if (qEl || aEl) {
                gameData.vuotSong[`h${i}`] = {
                    q: qEl ? qEl.value : (gameData.vuotSong[`h${i}`]?.q || ''),
                    a: aEl ? aEl.value : (gameData.vuotSong[`h${i}`]?.a || '')
                };
            }
        }
        const qcEl = document.getElementById('vs_q_center');
        const acEl = document.getElementById('vs_a_center');
        if (qcEl || acEl) {
            gameData.vuotSong.center = {
                q: qcEl ? qcEl.value : (gameData.vuotSong.center?.q || ''),
                a: acEl ? acEl.value : (gameData.vuotSong.center?.a || '')
            };
        }
        const kwEl = document.getElementById('vs_keyword');
        if (kwEl) {
            gameData.vuotSong.keyword = kwEl.value;
        }
        const hintEl = document.getElementById('vs_hint_image');
        if (hintEl) {
            let rawHint = hintEl.value.trim();
            if (rawHint === '...') rawHint = '';
            if (rawHint.startsWith('blob:') && gameData.vuotSong.hintImage && !gameData.vuotSong.hintImage.startsWith('blob:')) {
                rawHint = gameData.vuotSong.hintImage;
            }
            gameData.vuotSong.hintImage = (typeof window.normalizeMediaUrl === 'function' && rawHint && !rawHint.startsWith('blob:'))
                ? window.normalizeMediaUrl(rawHint)
                : rawHint;
        }
        const excelNameEl = document.getElementById('excelFileName');
        if (excelNameEl && excelNameEl.value.trim()) {
            gameData.excelFileName = excelNameEl.value.trim();
        }

        initVinhQuangData();

        if (!Array.isArray(gameData.cauHoiPhu)) gameData.cauHoiPhu = [];
        for (let i = 1; i <= 10; i++) {
            const chpQEl = document.getElementById(`chp_q_${i}`);
            const sysQEl = document.getElementById(`sys_chp_q_${i}`);
            const chpAEl = document.getElementById(`chp_a_${i}`);
            const sysAEl = document.getElementById(`sys_chp_a_${i}`);
            if (!chpQEl && !sysQEl && !chpAEl && !sysAEl) continue;
            const qVal = chpQEl?.value ?? sysQEl?.value ?? '';
            const aVal = chpAEl?.value ?? sysAEl?.value ?? '';
            if (i <= 3 || qVal.trim() || aVal.trim() || gameData.cauHoiPhu[i - 1]) {
                gameData.cauHoiPhu[i - 1] = { q: qVal, a: aVal };
            }
        }

        if (!gameData.intros) {
            gameData.intros = {
                opening: './Opening.mp4',
                v1: './V1.mp4',
                v2: './V2.mp4',
                v3: './V3.mp4',
                v4: './V4.mp4'
            };
        }
        const opEl = document.getElementById('intro_media_opening');
        const v1El = document.getElementById('intro_media_v1');
        const v2El = document.getElementById('intro_media_v2');
        const v3El = document.getElementById('intro_media_v3');
        const v4El = document.getElementById('intro_media_v4');
        if (opEl) gameData.intros.opening = opEl.value;
        if (v1El) gameData.intros.v1 = v1El.value;
        if (v2El) gameData.intros.v2 = v2El.value;
        if (v3El) gameData.intros.v3 = v3El.value;
        if (v4El) gameData.intros.v4 = v4El.value;

        for (let i = 1; i <= 10; i++) {
            const imgEl = document.getElementById(`intro_media_img${i}`);
            if (imgEl) {
                gameData.intros[`img${i}`] = imgEl.value;
            }
        }

        const customSoundEl = document.getElementById('controller_custom_sound_url');
        if (customSoundEl) {
            gameData.intros.customSound = customSoundEl.value;
        }

        safeSetStorage('duong_den_vinh_quang_data', JSON.stringify(gameData));
        const syncPayload = {
            type: 'SYNC_GAME_DATA',
            gameData: gameData,
            contestants: gameData.contestants,
            timestamp: Date.now()
        };
        sendToProjector('SYNC_GAME_DATA', syncPayload);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(syncPayload);
        }
        if (typeof debouncePostServerState === 'function') {
            debouncePostServerState({
                contestants: gameData.contestants,
                gameData: gameData
            });
        }
        if (notify) {
            showToast('Đã lưu tất cả dữ liệu câu hỏi vào hệ thống!');
        }
    } catch(e) {
        console.warn("saveAllData error:", e);
    }
}

window.vsSubmissions = window.vsSubmissions || {};

function updateVSBuzzerLabels() {
    window.vsSubmissions = window.vsSubmissions || {};
    
    // Collect all contestants who have buzzed
    const submissions = Object.keys(window.vsSubmissions).map(idxStr => {
        const idx = parseInt(idxStr);
        const sub = window.vsSubmissions[idxStr];
        const timeVal = typeof sub === 'object' ? sub.time : sub;
        const numTime = typeof sub === 'object' ? (sub.numTime || parseFloat(timeVal) || 999) : (parseFloat(timeVal) || 999);
        const timestamp = (typeof sub === 'object' && sub.timestamp) ? sub.timestamp : 0;
        return { idx, timeVal, numTime, timestamp };
    });
    
    // Sort by numTime ascending, then by timestamp
    submissions.sort((a, b) => {
        if (Math.abs(a.numTime - b.numTime) > 0.001) {
            return a.numTime - b.numTime;
        }
        return a.timestamp - b.timestamp;
    });

    const count = submissions.length;

    // Update all 4 contestants' inputs: Red text, followed by (${timeStr}s) and (${rank})
    for (let i = 1; i <= 4; i++) {
        const nameInput = document.getElementById(`ts${i}_name_vs`);
        if (!nameInput) continue;
        
        const rawBase = gameData.contestants?.[i - 1]?.name || `Thí sinh ${i}`;
        const baseName = rawBase
            .replace(/\s*🔔.*$/gi, '')
            .replace(/\s*\(Thứ \d+.*?\)/gi, '')
            .replace(/\s*\([\d\.]+(?:s|giây|S)?\)/gi, '')
            .replace(/\s*\(\d+\)/g, '')
            .trim();
        
        const orderIdx = submissions.findIndex(s => s.idx === i);
        if (orderIdx !== -1) {
            const rank = orderIdx + 1;
            const timeStr = submissions[orderIdx].timeVal;
            const rankSuffix = submissions.length > 1 ? ` (${rank})` : '';
            // Format: Tên Thí Sinh (thời gian bấm) và (thứ tự bấm nếu có nhiều người bấm cùng lúc)
            nameInput.value = `${baseName} (${timeStr}s)${rankSuffix}`;
            nameInput.style.color = '#dc2626';
            nameInput.style.fontWeight = 'bold';
        } else {
            nameInput.value = baseName;
            nameInput.style.color = '#000000';
            nameInput.style.fontWeight = 'bold';
        }
    }
}
window.updateVSBuzzerLabels = updateVSBuzzerLabels;

function markVSContestantSubmitted(tsIdx, timeStr) {
    if (!tsIdx || tsIdx < 1 || tsIdx > 4) return;
    const idx = parseInt(tsIdx);
    
    if (!window.vsRoundStartTime) {
        const savedTime = parseInt(localStorage.getItem('s3_round_start_time'));
        window.vsRoundStartTime = (savedTime && Date.now() - savedTime < 3600000) ? savedTime : Date.now();
    }

    let cleanTime = (timeStr || '').toString().replace(/s|giây/gi, '').trim();
    if (!cleanTime || cleanTime === '00.00' || isNaN(parseFloat(cleanTime))) {
        let elapsed = (Date.now() - window.vsRoundStartTime) / 1000;
        cleanTime = elapsed < 10 ? '0' + elapsed.toFixed(2) : elapsed.toFixed(2);
    } else {
        let num = parseFloat(cleanTime);
        if (!isNaN(num)) {
            cleanTime = num < 10 ? '0' + num.toFixed(2) : num.toFixed(2);
        }
    }

    window.vsSubmissions = window.vsSubmissions || {};
    if (!window.vsSubmissions[idx]) {
        window.vsSubmissions[idx] = {
            time: cleanTime,
            numTime: parseFloat(cleanTime) || 999,
            timestamp: Date.now()
        };
    }

    updateVSBuzzerLabels();

    // Trigger full-screen orange flash on corresponding scoreboard (10 flashes)
    const flashPayload = {
        type: 'S3_FLASH_SCOREBOARD',
        contestantId: idx,
        round: 'VUOT_SONG',
        timestamp: Date.now()
    };
    sendToProjector('S3_FLASH_SCOREBOARD', flashPayload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(flashPayload);
    }

    const rawBase = gameData.contestants?.[idx - 1]?.name || `Thí sinh ${idx}`;
    const baseName = rawBase.replace(/\s*\(\d+\)/g, '').replace(/\s*\([\d\.]+(?:s|giây|S)?\)/gi, '').trim();
    if (typeof showToast === 'function') {
        showToast(`🔔 ${baseName} đã bấm chuông Vượt Sóng (${cleanTime}s)!`);
    }
}
window.markVSContestantSubmitted = markVSContestantSubmitted;

function syncContestantsUI() {
    if (gameData.contestants && Array.isArray(gameData.contestants)) {
        gameData.contestants.forEach((c, i) => {
            const idx = i + 1;
            const tab0Input = document.getElementById(`ts_name_${idx}`);
            if (tab0Input) tab0Input.value = c.name || `Thí sinh ${idx}`;
            const tab0InfoInput = document.getElementById(`ts_info_${idx}`);
            if (tab0InfoInput && document.activeElement !== tab0InfoInput) tab0InfoInput.value = c.info || '';
            const tab1Input = document.getElementById(`ts${idx}_name`);
            if (tab1Input) tab1Input.value = c.name || `Thí sinh ${idx}`;
            const tab2Input = document.getElementById(`ts${idx}_name_rk`);
            if (tab2Input) tab2Input.value = c.name || `Thí sinh ${idx}`;
            
            const tab3Input = document.getElementById(`ts${idx}_name_vs`);
            if (tab3Input) {
                const baseName = (c.name || `Thí sinh ${idx}`).replace(/\s*\(\d+\)/g, '').replace(/\s*\([\d\.]+(?:s|giây|S)?\)/gi, '').trim();
                if (!window.vsSubmissions || !window.vsSubmissions[idx]) {
                    tab3Input.value = baseName;
                    tab3Input.style.color = '#000';
                    tab3Input.style.fontWeight = 'normal';
                }
            }

            const tab4Input = document.getElementById(`ts${idx}_name_vq`);
            if (tab4Input) tab4Input.value = c.name || `Thí sinh ${idx}`;
            const tab5Input = document.getElementById(`ts${idx}_name_chp`);
            if (tab5Input) tab5Input.value = c.name || `Thí sinh ${idx}`;
            const chpRsName = document.getElementById(`chp_rs_name_${idx}`);
            if (chpRsName) chpRsName.innerText = c.name || `Thí sinh ${idx}`;
            
            const scoreVal = c.score !== undefined ? c.score : 0;
            const disp = document.getElementById(`ts${idx}_score_disp`);
            if (disp) disp.innerText = scoreVal;
            const dispRK = document.getElementById(`ts${idx}_score_disp_rk`);
            if (dispRK) dispRK.innerText = scoreVal;
            const dispVS = document.getElementById(`ts${idx}_score_disp_vs`);
            if (dispVS) dispVS.innerText = scoreVal;
            const dispVQ = document.getElementById(`ts${idx}_score_disp_vq`);
            if (dispVQ) dispVQ.innerText = scoreVal;
            const dispCHP = document.getElementById(`ts${idx}_score_disp_chp`);
            if (dispCHP) dispCHP.innerText = scoreVal;
        });
        updateVSBuzzerLabels();
        if (typeof updateTab1Preview === 'function') updateTab1Preview();
        try {
            localStorage.setItem('ddvq_contestants', JSON.stringify(gameData.contestants));
        } catch(e) {}
        sendToProjector('UPDATE_SCORES', { contestants: gameData.contestants, gameData: gameData });
        sendToProjector('UPDATE_CONTESTANTS', { contestants: gameData.contestants, gameData: gameData });
        if (typeof debouncePostServerState === 'function') {
            debouncePostServerState({
                contestants: gameData.contestants,
                gameData: gameData
            }, true);
        }
    }
}

function loadSavedData() {
    try {
        const saved = safeGetStorage('duong_den_vinh_quang_data');
        if (saved) {
            const parsed = JSON.parse(saved);
            gameData = Object.assign(gameData, parsed);
            if (Array.isArray(gameData.raKhoi)) {
                gameData.raKhoi = gameData.raKhoi.map(item => {
                    if (!item || typeof item !== 'object') return { q: '', a: '', m: '', am: '', mt: '' };
                    return {
                        ...item,
                        m: sanitizeStoredMediaValue(item.m),
                        am: sanitizeStoredMediaValue(item.am)
                    };
                });
            }
            if (gameData.vuotSong && !Array.isArray(gameData.vuotSong)) {
                gameData.vuotSong.hintImage = sanitizeStoredMediaValue(gameData.vuotSong.hintImage);
            }
            if (gameData.excelFileName) {
                const excelNameEl = document.getElementById('excelFileName');
                if (excelNameEl) excelNameEl.value = gameData.excelFileName;
            }
            renderXuatPhatTurnUI(editingXuatPhatDe || 1);
            fillRaKhoiInputs();
            fillVuotSongInputs();
            renderVinhQuangPackUI(currentVinhQuangPack);
            fillCauHoiPhuInputs();
            fillIntroInputs();
            updateVuotSongState();
            syncContestantsUI();
            if (typeof updateTab1Preview === 'function') updateTab1Preview();
            if (typeof loadAudioSettings === 'function') loadAudioSettings();

            const step4 = document.getElementById('step4-check');
            if (step4) {
                step4.className = 'status-check green-check';
                step4.innerText = '✅';
            }
        }
    } catch(e) {
        console.error('Error loading saved data:', e);
    }
}

function flushAllControllerPersistence() {
    try {
        if (debouncedSaveTimeout) {
            clearTimeout(debouncedSaveTimeout);
            debouncedSaveTimeout = null;
        }
        if (updateContestantNameTimeout) {
            clearTimeout(updateContestantNameTimeout);
            updateContestantNameTimeout = null;
        }
        if (updateContestantInfoTimeout) {
            clearTimeout(updateContestantInfoTimeout);
            updateContestantInfoTimeout = null;
        }
        saveAllData(false);
        if (typeof window.saveControllerRuntimeState === 'function') {
            window.saveControllerRuntimeState();
        }
    } catch(e) {}
}
window.flushAllControllerPersistence = flushAllControllerPersistence;
window.addEventListener('beforeunload', flushAllControllerPersistence);
window.addEventListener('pagehide', flushAllControllerPersistence);

function resetAllData() {
    if (confirm("Bạn có chắc chắn muốn xóa và thiết lập lại toàn bộ dữ liệu không?")) {
        if (gameData && gameData.contestants) {
            gameData.contestants.forEach((c, i) => {
                c.score = 0;
            });
        }
        sendToProjector('RESET_ALL_DATA');
        safeRemoveStorage('duong_den_vinh_quang_data');
        safeRemoveStorage('ddvq_controller_runtime_v1');
        safeRemoveStorage('ddvq_controller_active_tab');
        safeRemoveStorage('ddvq_current_timer');
        safeRemoveStorage('s3_round_start_time');
        try { sessionStorage.removeItem('ddvq_controller_runtime_v1'); } catch(e) {}
        location.reload();
    }
}

let updateContestantNameTimeout = null;
function updateContestantName(i, val) {
    if (!gameData.contestants) gameData.contestants = [];
    
    // Preserve raw input casing (uppercase & lowercase) for Vietnamese text, stripping time suffix if present
    const preservedName = (val || '').replace(/\s*\([\d\.]+(?:s|giây)?\)/gi, '').trim();

    if (!gameData.contestants[i - 1]) {
        gameData.contestants[i - 1] = { name: preservedName, info: '', score: 0 };
    } else {
        gameData.contestants[i - 1].name = preservedName;
    }

    // Synchronize to other tab inputs, but DO NOT modify currently focused input to avoid interrupting IME typing / space
    const activeEl = document.activeElement;
    const inputs = [
        document.getElementById(`ts_name_${i}`),
        document.getElementById(`ts${i}_name`),
        document.getElementById(`ts${i}_name_rk`),
        document.getElementById(`ts${i}_name_vs`),
        document.getElementById(`ts${i}_name_vq`),
        document.getElementById(`ts${i}_name_chp`)
    ];

    inputs.forEach(inp => {
        if (inp && inp !== activeEl && inp.value !== preservedName) {
            inp.value = preservedName;
        }
    });
    const chpRsName = document.getElementById(`chp_rs_name_${i}`);
    if (chpRsName) chpRsName.innerText = preservedName || `Thí sinh ${i}`;

    if (typeof updateTab1Preview === 'function') updateTab1Preview();
    if (typeof syncVQTurnDropdownNames === 'function') syncVQTurnDropdownNames();
    if (typeof updateTab5Preview === 'function') updateTab5Preview();

    // Debounce disk save and network broadcast to prevent lag while typing
    if (updateContestantNameTimeout) clearTimeout(updateContestantNameTimeout);
    updateContestantNameTimeout = setTimeout(() => {
        saveAllData(false);

        const payload = {
            type: 'UPDATE_SCORES',
            contestants: gameData.contestants,
            gameData: gameData,
            timestamp: Date.now()
        };

        sendToProjector('UPDATE_SCORES', payload);

        try {
            localStorage.setItem('ddvq_latest_action', JSON.stringify(payload));
            localStorage.setItem('ddvq_contestants', JSON.stringify(gameData.contestants));
        } catch(e) {}

        debouncePostServerState({
            contestants: gameData.contestants,
            gameData: gameData
        });
    }, 400);
}

let updateContestantInfoTimeout = null;
function updateContestantInfo(i, val) {
    if (!gameData.contestants) gameData.contestants = [];
    const infoVal = (val || '').toString();

    if (!gameData.contestants[i - 1]) {
        gameData.contestants[i - 1] = { name: `THÍ SINH ${i}`, info: infoVal, score: 0 };
    } else {
        gameData.contestants[i - 1].info = infoVal;
    }

    const activeEl = document.activeElement;
    const infoInp = document.getElementById(`ts_info_${i}`);
    if (infoInp && infoInp !== activeEl && infoInp.value !== infoVal) {
        infoInp.value = infoVal;
    }

    if (updateContestantInfoTimeout) clearTimeout(updateContestantInfoTimeout);
    updateContestantInfoTimeout = setTimeout(() => {
        saveAllData(false);

        const payload = {
            type: 'UPDATE_CONTESTANTS',
            contestants: gameData.contestants,
            gameData: gameData,
            timestamp: Date.now()
        };

        sendToProjector('UPDATE_CONTESTANTS', payload);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(payload);
        }

        try {
            localStorage.setItem('ddvq_latest_action', JSON.stringify(payload));
            localStorage.setItem('ddvq_contestants', JSON.stringify(gameData.contestants));
        } catch(e) {}

        debouncePostServerState({
            contestants: gameData.contestants,
            gameData: gameData
        });
    }, 400);
}
window.updateContestantInfo = updateContestantInfo;

let __postServerStateTimeout = null;
function debouncePostServerState(data, immediate = false) {
    if (__postServerStateTimeout) clearTimeout(__postServerStateTimeout);
    const doSend = () => {
        try {
            if (typeof hasLocalServerBackend === 'function' && hasLocalServerBackend()) {
                fetch(getApiUrl('/api/state'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                }).catch(() => {});
            }
        } catch(e) {}
    };
    if (immediate) {
        doSend();
    } else {
        __postServerStateTimeout = setTimeout(doSend, 600);
    }
}

function updateContestantNames() {
    for (let i = 1; i <= 4; i++) {
        const rawVal = document.getElementById(`ts_name_${i}`)?.value || `Thí sinh ${i}`;
        const val = rawVal.trim();
        updateContestantName(i, val);
        const infoEl = document.getElementById(`ts_info_${i}`);
        if (infoEl) {
            if (!gameData.contestants[i - 1]) {
                gameData.contestants[i - 1] = { name: val, info: infoEl.value || '', score: 0 };
            } else {
                gameData.contestants[i - 1].info = infoEl.value || '';
            }
        }
    }
    saveAllData(false);
    try {
        localStorage.setItem('ddvq_contestants', JSON.stringify(gameData.contestants));
    } catch(e) {}
    const payload = {
        type: 'UPDATE_CONTESTANTS',
        contestants: gameData.contestants,
        gameData: gameData,
        timestamp: Date.now()
    };
    sendToProjector('UPDATE_CONTESTANTS', payload);
    if (typeof sendSupabaseAction === 'function') sendSupabaseAction(payload);
    debouncePostServerState({
        contestants: gameData.contestants,
        gameData: gameData
    }, true);
    showToast('Đã cập nhật và đồng bộ tên & info thí sinh sang Bảng điểm, Projector và Máy thí sinh!');
}

function syncDataToProjector() {
    saveAllData();
    updateContestantNames();
    sendToProjector('UPDATE_SCORES', { contestants: gameData.contestants, gameData: gameData });
    debouncePostServerState({
        contestants: gameData.contestants,
        gameData: gameData
    });
    showToast('Đã đồng bộ toàn bộ dữ liệu sang Màn Hình Chiếu!');
}

function exportExcelFile() {
    saveAllData();
    const wb = XLSX.utils.book_new();

    // 1. Sheet KhoiDong
    const kdRows = [[
        "",
        "Thí sinh 1", "Đáp án",
        "Thí sinh 2", "Đáp án",
        "Thí sinh 3", "Đáp án",
        "Thí sinh 4", "Đáp án",
        "Thí sinh 5", "Đáp án",
        "Khởi động chung", "Đáp án"
    ]];
    for (let i = 0; i < 15; i++) {
        const row = [`Câu ${i + 1}`];
        if (i < 6) {
            for (let t of [1, 2, 3, 4, 6]) {
                const item = (gameData.xuatPhat[t] && gameData.xuatPhat[t][i]) || { q: "", a: "" };
                row.push(item.q || "", item.a || "");
            }
        } else {
            for (let k = 0; k < 10; k++) row.push("");
        }
        const chungItem = (gameData.xuatPhat[5] && gameData.xuatPhat[5][i]) || { q: "", a: "" };
        row.push(chungItem.q || "", chungItem.a || "");
        kdRows.push(row);
    }
    const wsKD = XLSX.utils.aoa_to_sheet(kdRows);
    XLSX.utils.book_append_sheet(wb, wsKD, "KhoiDong");

    // 2. Sheet VCNV
    const vcnvRows = [];
    const headerVCNV = Array(18).fill("");
    headerVCNV[0] = "Ô chữ";
    headerVCNV[15] = "Ký tự";
    headerVCNV[16] = "Câu hỏi";
    headerVCNV[17] = "Nội dung";
    vcnvRows.push(headerVCNV);

    for (let i = 1; i <= 4; i++) {
        const row = Array(18).fill("");
        const ansChars = (gameData.vuotSong[`h${i}`]?.a || "").replace(/\s+/g, '').toUpperCase().split('');
        for (let c = 0; c < Math.min(15, ansChars.length); c++) {
            row[c] = ansChars[c];
        }
        row[15] = ansChars.length;
        row[16] = `Hàng ${i}`;
        row[17] = gameData.vuotSong[`h${i}`]?.q || "";
        vcnvRows.push(row);
    }

    const row6VCNV = Array(18).fill("");
    for (let c = 0; c < 15; c++) row6VCNV[c] = c + 1;
    row6VCNV[16] = "Trung tâm";
    row6VCNV[17] = gameData.vuotSong.center?.q || "";
    vcnvRows.push(row6VCNV);

    const row7VCNV = Array(18).fill("");
    const kwVal = gameData.vuotSong.keyword || gameData.vuotSong.center?.a || "";
    row7VCNV[0] = "Từ khóa VCNV";
    row7VCNV[2] = kwVal;
    row7VCNV[15] = kwVal.replace(/\s+/g, '').length;
    row7VCNV[16] = "Đ.án TT";
    row7VCNV[17] = gameData.vuotSong.center?.a || kwVal;
    vcnvRows.push(row7VCNV);

    const wsVCNV = XLSX.utils.aoa_to_sheet(vcnvRows);
    XLSX.utils.book_append_sheet(wb, wsVCNV, "VCNV");

    // 3. Sheet TangToc
    const ttRows = [["", "", "Đáp án"]];
    for (let i = 0; i < 6; i++) {
        const item = (gameData.raKhoi && gameData.raKhoi[i]) || { q: "", a: "", m: "" };
        ttRows.push([`Câu ${i + 1}`, item.q || "", item.a || ""]);
    }
    const wsTT = XLSX.utils.aoa_to_sheet(ttRows);
    for (let i = 0; i < 6; i++) {
        const item = (gameData.raKhoi && gameData.raKhoi[i]) || {};
        if (item.m) {
            const addr = XLSX.utils.encode_cell({ r: i + 1, c: 1 });
            if (wsTT[addr]) wsTT[addr].l = { Target: item.m };
        }
    }
    XLSX.utils.book_append_sheet(wb, wsTT, "TangToc");

    // 4. Sheet VeDich
    initVinhQuangData();
    const vdRows = [[
        "",
        "Gói câu hỏi 1", "Đáp án",
        "Gói câu hỏi 2", "Đáp án",
        "Gói câu hỏi 3", "Đáp án",
        "Gói câu hỏi 4", "Đáp án",
        "Gói câu hỏi 5", "Đáp án"
    ]];
    for (let i = 0; i < 6; i++) {
        const label = i < 3 ? "Câu 20 điểm" : "Câu 30 điểm";
        const row = [label];
        for (let p = 1; p <= 5; p++) {
            const item = (gameData.vinhQuang[p] && gameData.vinhQuang[p][i]) || { m: "", q: "", a: "" };
            row.push(item.q || "", item.a || "");
        }
        vdRows.push(row);
    }
    const wsVD = XLSX.utils.aoa_to_sheet(vdRows);
    XLSX.utils.book_append_sheet(wb, wsVD, "VeDich");

    // 5. Sheet VeDichPhu
    const chpRows = [["", "Câu hỏi", "Đáp án"]];
    const chpList = Array.isArray(gameData.cauHoiPhu) ? gameData.cauHoiPhu : [];
    for (let i = 0; i < 10; i++) {
        const item = chpList[i] || { q: "", a: "" };
        chpRows.push([`Câu ${i + 1}`, item.q || "", item.a || ""]);
    }
    const wsCHP = XLSX.utils.aoa_to_sheet(chpRows);
    XLSX.utils.book_append_sheet(wb, wsCHP, "VeDichPhu");

    XLSX.writeFile(wb, "Bo_De_Duong_Len_Dinh_Olympia.xlsx");
    showToast("Đã xuất file Excel thành công!");
}

/* CONTROLLER - PROJECTOR CONNECTION */
let controllerChannel = null;
let projectorWindow = null;
let lastProjectorPing = 0;

const processedPlayerAnswersCache = new Map();

function handleIncomingPlayerAnswer(data) {
    if (!data) return;

    if (data.type === 'PLAYER_RING_BELL' || data.type === 'RING_BELL') {
        const tsIdx = parseInt(data.contestantId) || 1;
        const round = (data.round || window.currentActiveRound || '').toUpperCase();
        if (round === 'KD' || round === 'XUAT_PHAT' || round === 'KHOI_DONG' || round === 'XP' || window.currentActiveRound === 'XUAT_PHAT') {
            if (typeof handleXuatPhatBuzzFromPlayer === 'function') {
                handleXuatPhatBuzzFromPlayer(tsIdx, data);
            }
        } else if (round === 'VS' || round === 'VUOT_SONG' || round === 'VCNV' || round === 'CNV' || window.currentActiveRound === 'VUOT_SONG') {
            if (typeof markVSContestantSubmitted === 'function') {
                markVSContestantSubmitted(tsIdx, data.time || null);
            }
        } else if (round === 'VQ' || round === 'VINH_QUANG' || round === 'VE_DICH' || window.currentActiveRound === 'VINH_QUANG') {
            if (typeof handleVinhQuangBuzzFromPlayer === 'function') {
                handleVinhQuangBuzzFromPlayer(tsIdx, data);
            }
        } else if (round === 'CHP' || round === 'CAU_HOI_PHU' || window.currentActiveRound === 'CAU_HOI_PHU') {
            if (typeof handleCHPBuzzFromPlayer === 'function') {
                handleCHPBuzzFromPlayer(tsIdx, data);
            }
        }
        return;
    }

    if (data.type === 'PLAYER_SUBMIT_ANSWER') {
        const tsIdx = data.contestantId || 1;
        const ans = (data.answer || '').toString().trim();
        const rawTime = (data.time || '').toString();
        const cleanTime = rawTime.replace(/s|giây/gi, '').trim();
        const round = data.round || 'GEN';
        const dedupeKey = `${tsIdx}_${round}_${ans}_${cleanTime}_${data.id || ''}`;

        const lastProcessed = processedPlayerAnswersCache.get(dedupeKey);
        const now = Date.now();
        if (lastProcessed && (now - lastProcessed < 300)) {
            return; // Duplicate submission from multi-channel delivery within 300ms
        }
        processedPlayerAnswersCache.set(dedupeKey, now);
        if (processedPlayerAnswersCache.size > 100) {
            const oldestKey = processedPlayerAnswersCache.keys().next().value;
            processedPlayerAnswersCache.delete(oldestKey);
        }

        if (data.round === 'RK' || data.round === 'RA_KHOI' || data.round === 'TANG_TOC' || !data.round) {
            const inputAns = document.getElementById(`ts${tsIdx}_ans_rk`);
            if (inputAns && inputAns.value !== ans) inputAns.value = ans;
            const inputTime = document.getElementById(`ts${tsIdx}_extra_rk`);
            if (inputTime && inputTime.value !== (cleanTime || '00.00')) inputTime.value = cleanTime || '00.00';

            const rawBase = gameData.contestants?.[tsIdx - 1]?.name || `Thí sinh ${tsIdx}`;
            if (typeof showToast === 'function' && (data.round === 'RK' || data.round === 'RA_KHOI' || data.round === 'TANG_TOC')) {
                showToast(`🔔 ${rawBase} đã bấm chuông / gửi đáp án Ra Khơi (${cleanTime || '00.00'}s): ${ans || 'Đã gửi'}`);
            }
        }
        if (data.round === 'VS' || data.round === 'VUOT_SONG' || !data.round) {
            const inputAns = document.getElementById(`ts${tsIdx}_ans_vs`);
            const inputTime = document.getElementById(`ts${tsIdx}_extra_vs`);
            if (data.isVongThi === true) {
                // Thời gian màu đỏ: kể từ lúc bắt đầu vòng thi đến lúc bấm nút trả lời đáp án vòng thi
                if (typeof markVSContestantSubmitted === 'function') {
                    markVSContestantSubmitted(tsIdx, cleanTime || '00.00');
                } else if (typeof window.markVSContestantSubmitted === 'function') {
                    window.markVSContestantSubmitted(tsIdx, cleanTime || '00.00');
                }
                const cleanAns = (ans || '').replace(/^\[CNV\]\s*/i, '').trim();
                if (cleanAns && cleanAns !== 'Bấm chuông' && inputAns && !inputAns.value) {
                    inputAns.value = cleanAns;
                }
            } else {
                // Thí sinh trả lời câu hỏi hàng ngang (và nhấn Enter):
                // Thời gian trong ô màu trắng: tính từ lúc 20s trả lời câu hỏi hàng ngang
                // BẢNG ĐIỂM KHÔNG NHẤP NHÁY
                if (inputTime && inputTime.value !== (cleanTime || '00.00')) inputTime.value = cleanTime || '00.00';
                if (inputAns && inputAns.value !== ans) inputAns.value = ans;
            }
        }
        if (data.round === 'VQ' || data.round === 'VINH_QUANG') {
            const inputExtra = document.getElementById(`ts${tsIdx}_extra_vq`);
            if (inputExtra && inputExtra.value !== (cleanTime || '00.00')) inputExtra.value = cleanTime || '00.00';
            const inputAns = document.getElementById(`ts${tsIdx}_ans_vq`);
            if (inputAns && inputAns.value !== ans) inputAns.value = ans;
        }
        if (data.round === 'CHP' || data.round === 'CAU_HOI_PHU') {
            const inputExtra = document.getElementById(`ts${tsIdx}_extra_chp`);
            if (inputExtra && inputExtra.value !== (cleanTime || '00.00')) inputExtra.value = cleanTime || '00.00';
            const inputAns = document.getElementById(`ts${tsIdx}_ans_chp`);
            if (inputAns && inputAns.value !== ans) inputAns.value = ans;
        }

        // Forward to projector only once if not loop-forwarded
        if (!data._forwarded && !data._fromNetwork) {
            try {
                sendToProjector('PLAYER_SUBMIT_ANSWER', { ...data, _forwarded: true });
            } catch(e) {}
        }
        if (typeof window.saveControllerRuntimeState === 'function') {
            window.saveControllerRuntimeState();
        }
    } else if (data.playerAnswers && typeof data.playerAnswers === 'object') {
        Object.values(data.playerAnswers).forEach(ansObj => {
            if (ansObj && ansObj.contestantId) {
                const tsIdx = ansObj.contestantId;
                const ans = (ansObj.answer || '').toString().trim();
                const rawTime = (ansObj.time || '').toString();
                const cleanTime = rawTime.replace(/s|giây/gi, '').trim();

                if (ansObj.round === 'RK' || ansObj.round === 'RA_KHOI' || ansObj.round === 'TANG_TOC' || !ansObj.round) {
                    const inputAns = document.getElementById(`ts${tsIdx}_ans_rk`);
                    if (inputAns && inputAns.value !== ans) inputAns.value = ans;
                    const inputTime = document.getElementById(`ts${tsIdx}_extra_rk`);
                    if (inputTime && inputTime.value !== (cleanTime || '00.00')) inputTime.value = cleanTime || '00.00';
                }
                if (ansObj.round === 'VS' || ansObj.round === 'VUOT_SONG' || !ansObj.round) {
                    const inputAns = document.getElementById(`ts${tsIdx}_ans_vs`);
                    const inputTime = document.getElementById(`ts${tsIdx}_extra_vs`);
                    if (ansObj.isVongThi === true) {
                        if (typeof markVSContestantSubmitted === 'function') {
                            markVSContestantSubmitted(tsIdx, cleanTime || '00.00');
                        }
                        const cleanAns = (ans || '').replace(/^\[CNV\]\s*/i, '').trim();
                        if (cleanAns && cleanAns !== 'Bấm chuông' && inputAns && !inputAns.value) {
                            inputAns.value = cleanAns;
                        }
                    } else {
                        if (inputTime && inputTime.value !== (cleanTime || '00.00')) inputTime.value = cleanTime || '00.00';
                        if (inputAns && inputAns.value !== ans) inputAns.value = ans;
                    }
                }
                if (ansObj.round === 'VQ' || ansObj.round === 'VINH_QUANG' || !ansObj.round) {
                    const inputExtra = document.getElementById(`ts${tsIdx}_extra_vq`);
                    if (inputExtra && inputExtra.value !== (cleanTime || '00.00')) inputExtra.value = cleanTime || '00.00';
                    const inputAns = document.getElementById(`ts${tsIdx}_ans_vq`);
                    if (inputAns && inputAns.value !== ans) inputAns.value = ans;
                }
            }
        });
        if (typeof window.saveControllerRuntimeState === 'function') {
            window.saveControllerRuntimeState();
        }
    }
}
window.handleIncomingPlayerAnswer = handleIncomingPlayerAnswer;
