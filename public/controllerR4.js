// ControllerR4.js - Round 4: Vinh Quang
let vqTimerInterval = null;
let vqTimeLeft = 20;

let currentVQPack = 10;
let currentVQSubject = '';
let currentVQQuestionText = '';
let currentVQAnswerText = '';
let currentVQQuestionIndex = 0;
let vqBuzzerOpen = false;
let vqBuzzerWinner = 0;
let vqBellUnlockTime = 0;
let vqBuzzerWinnerTime = '';
let vqAuto5sTimeout = null;
let vqQuestionStarUsed = false;
let vqMainStarDeducted = false;

function isVQStarActiveForMain(mainIdx) {
    return !!((window.vqStars && window.vqStars[mainIdx - 1]) || vqCenterStarActive);
}

function consumeVQStarForMain(mainIdx) {
    if (window.vqStars && window.vqStars[mainIdx - 1] && typeof toggleVQStar === 'function') {
        toggleVQStar(mainIdx);
    } else if (vqCenterStarActive) {
        updateVQCenterStarUI(false);
        const starPayload = {
            type: 'VINH_QUANG_STAR_OF_HOPE',
            contestantIndex: mainIdx || 0,
            active: false,
            hasStar: false,
            timestamp: Date.now()
        };
        sendToProjector('VINH_QUANG_STAR_OF_HOPE', starPayload);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(starPayload);
        }
    }
    updateVQCenterStarUI(false);
}

const defaultSubjectsList = [
    "Toán Học", "Vật Lý", "Hóa Học", "Sinh Học", "Văn Học", "Lịch Sử", "Địa Lý", "Tiếng Anh", "Tin Học", "Hiểu Biết Chung"
];

function onClickVQVideoVeDich() {
    sendToProjector('VINH_QUANG_VIDEO_VE_DICH');
    showToast('Phát Video Về Đích trên Projector');
}

function onClickVQPhanThi() {
    sendToProjector('VINH_QUANG_PHAN_THI');
    showToast('Hiển thị Phần Thi Về Đích trên Projector');
}

function onClickVQVideoCauHoi() {
    sendToProjector('VINH_QUANG_VIDEO_CAU_HOI');
    showToast('Phát Video Câu hỏi Vinh Quang');
}

function onClickVQTGThucNghiem() {
    sendToProjector('VINH_QUANG_TG_THUC_NGHIEM');
    showToast('Hiển thị Thời Gian Thực Nghiệm');
}

function onClickVQChuyenSlidePPT() {
    showToast('Chuyển slide PPT Vinh Quang');
}

function onClickVQVeDich() {
    const contestants = (typeof gameData !== 'undefined' && Array.isArray(gameData.contestants)) ? gameData.contestants : [];
    sendToProjector('VINH_QUANG_INTRO', {
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        contestants: contestants,
        timestamp: Date.now()
    });
    const statusEl = document.getElementById('vq_preview_status');
    if (statusEl) statusEl.innerText = vqTimeLeft;
    showToast('Bắt đầu Vòng thi Về Đích (Vinh Quang)');
}

function onClickVQTinhThoiGian() {
    clearTimeout(vqAuto5sTimeout);
    vqAuto5sTimeout = null;
    clearInterval(vqTimerInterval);
    vqBuzzerOpen = false;
    vqBuzzerWinner = 0;
    vqQuestionStarUsed = false;
    vqMainStarDeducted = false;
    clearVQBuzzerUI();

    const pts = parseInt(currentVQPack, 10);
    const duration = (pts === 30) ? 20 : 15;
    vqTimeLeft = duration;
    const timerEl = document.getElementById('vq_preview_timer');
    if (timerEl) timerEl.innerText = vqTimeLeft;
    const statusEl = document.getElementById('vq_preview_status');
    if (statusEl) statusEl.innerText = vqTimeLeft;

    vqTimerInterval = setInterval(() => {
        vqTimeLeft--;
        if (timerEl) timerEl.innerText = vqTimeLeft;
        const statusEl = document.getElementById('vq_preview_status');
        if (statusEl) statusEl.innerText = vqTimeLeft;
        if (vqTimeLeft <= 0) {
            clearInterval(vqTimerInterval);
            if (timerEl) timerEl.innerText = "0";
            if (statusEl) statusEl.innerText = "0";
        }
    }, 1000);

    const payload = {
        type: 'VINH_QUANG_START_TIMER',
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        duration: duration,
        pack: duration === 20 ? 30 : 20,
        slot: currentVQSlot || 1,
        mainContestant: (vqTurnContestant >= 1 && vqTurnContestant <= 4) ? vqTurnContestant : 1,
        subject: currentVQSubject,
        questionIndex: currentVQQuestionIndex,
        questionText: currentVQQuestionText,
        answerText: currentVQAnswerText,
        answer: currentVQAnswerText,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_START_TIMER', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast(`Bắt đầu tính thời gian ${duration}s Vinh Quang`);
}

function onClickVQAnCauHoi() {
    window.vqQuestionIsShown = false;
    const qEl = document.getElementById('vq_preview_q_text');
    if (qEl) qEl.innerText = `🔒 [Đang ẩn trên Projector/Graphic] ${currentVQQuestionText || ''}`;
    const payload = {
        type: 'VINH_QUANG_HIDE_QUESTION',
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        pack: currentVQPack,
        subject: currentVQSubject,
        questionText: currentVQQuestionText || '',
        answerText: currentVQAnswerText || '',
        vqQuestionShown: false,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_HIDE_QUESTION', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast('Đã ẩn câu hỏi Vinh Quang trên Projector & Graphic');
}

function onClickVQ5sTraLoi() {
    clearTimeout(vqAuto5sTimeout);
    vqAuto5sTimeout = null;
    clearInterval(vqTimerInterval);

    const mainIdx = (vqTurnContestant >= 1 && vqTurnContestant <= 4) ? vqTurnContestant : 1;
    const basePts = (parseInt(currentVQPack, 10) === 30) ? 30 : 20;
    if (isVQStarActiveForMain(mainIdx) && !vqMainStarDeducted) {
        if (typeof adjustScore === 'function') {
            adjustScore(mainIdx, -basePts);
        }
        vqQuestionStarUsed = true;
        vqMainStarDeducted = true;
        consumeVQStarForMain(mainIdx);
    }

    vqBuzzerOpen = true;
    vqBuzzerWinner = 0;
    clearVQBuzzerUI();
    vqBellUnlockTime = Date.now();

    vqTimeLeft = 5;
    const timerEl = document.getElementById('vq_preview_timer');
    if (timerEl) timerEl.innerText = "5";
    const statusEl = document.getElementById('vq_preview_status');
    if (statusEl) statusEl.innerText = "5";

    vqTimerInterval = setInterval(() => {
        vqTimeLeft--;
        if (timerEl) timerEl.innerText = vqTimeLeft;
        const statusEl = document.getElementById('vq_preview_status');
        if (statusEl) statusEl.innerText = vqTimeLeft;
        if (vqTimeLeft <= 0) {
            clearInterval(vqTimerInterval);
            if (timerEl) timerEl.innerText = "0";
            if (statusEl) statusEl.innerText = "0";
            if (vqBuzzerOpen && vqBuzzerWinner === 0) {
                vqBuzzerOpen = false;
                const lockPayload = {
                    type: 'VINH_QUANG_LOCK_BELLS',
                    round: 'VQ',
                    mainContestant: mainIdx,
                    timestamp: Date.now()
                };
                sendToProjector('VINH_QUANG_LOCK_BELLS', lockPayload);
                if (typeof sendSupabaseAction === 'function') {
                    sendSupabaseAction(lockPayload);
                }
            }
        }
    }, 1000);

    const contestants = (typeof gameData !== 'undefined' && Array.isArray(gameData.contestants)) ? gameData.contestants : [];
    const payload = {
        type: 'VINH_QUANG_START_TIMER_5S',
        duration: 5,
        round: 'VQ',
        mainContestant: mainIdx,
        unlockBells: true,
        contestants: contestants,
        questionText: currentVQQuestionText,
        vqQuestionShown: !!window.vqQuestionIsShown,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_START_TIMER_5S', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast('Bắt đầu 5s giành quyền trả lời!');
}

function onClickVQDung() {
    clearTimeout(vqAuto5sTimeout);
    vqAuto5sTimeout = null;
    clearInterval(vqTimerInterval);

    const basePts = (parseInt(currentVQPack, 10) === 30) ? 30 : 20;
    const mainIdx = (vqTurnContestant >= 1 && vqTurnContestant <= 4) ? vqTurnContestant : 1;
    const stealerIdx = vqBuzzerWinner;
    let toastDeltaText = `+${basePts}đ`;

    if (stealerIdx >= 1 && stealerIdx <= 4) {
        if (typeof adjustScore === 'function') {
            adjustScore(stealerIdx, basePts);
            if (!vqQuestionStarUsed) {
                adjustScore(mainIdx, -basePts);
            }
        }
        vqQuestionStarUsed = false;
        vqMainStarDeducted = false;
    } else {
        const hasStar = isVQStarActiveForMain(mainIdx);
        const delta = (hasStar && !vqMainStarDeducted) ? basePts * 2 : basePts;
        toastDeltaText = `+${delta}đ`;
        if (typeof adjustScore === 'function') {
            adjustScore(mainIdx, delta);
        }
        if (hasStar) {
            consumeVQStarForMain(mainIdx);
        }
        vqQuestionStarUsed = false;
        vqMainStarDeducted = false;
    }

    vqBuzzerOpen = false;
    vqBuzzerWinner = 0;
    clearVQBuzzerUI();

    const contestants = (typeof gameData !== 'undefined' && Array.isArray(gameData.contestants)) ? gameData.contestants : [];
    const payload = {
        type: 'VINH_QUANG_RIGHT',
        round: 'VQ',
        pack: basePts,
        mainContestant: mainIdx,
        stealerId: stealerIdx,
        contestants: contestants,
        questionText: currentVQQuestionText || '',
        answerText: currentVQAnswerText || '',
        answer: currentVQAnswerText || '',
        gameData: gameData,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_RIGHT', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (stealerIdx >= 1 && stealerIdx <= 4) {
        const stealerName = contestants[stealerIdx - 1]?.name || `Thí sinh ${stealerIdx}`;
        const mainName = contestants[mainIdx - 1]?.name || `Thí sinh ${mainIdx}`;
        showToast(`Chấm ĐÚNG cho ${stealerName} (+${basePts}đ${vqQuestionStarUsed ? '' : ` từ ${mainName}`})`);
    } else {
        showToast(`Chấm ĐÚNG cho thí sinh chính (${toastDeltaText})`);
    }
}

function onClickVQSai() {
    clearTimeout(vqAuto5sTimeout);
    vqAuto5sTimeout = null;
    clearInterval(vqTimerInterval);

    const basePts = (parseInt(currentVQPack, 10) === 30) ? 30 : 20;
    const mainIdx = (vqTurnContestant >= 1 && vqTurnContestant <= 4) ? vqTurnContestant : 1;
    const stealerIdx = vqBuzzerWinner;

    if (stealerIdx >= 1 && stealerIdx <= 4) {
        const penalty = Math.round(basePts / 2);
        if (typeof adjustScore === 'function') {
            adjustScore(stealerIdx, -penalty);
        }
        vqQuestionStarUsed = false;
        vqMainStarDeducted = false;
    } else {
        const hasStar = isVQStarActiveForMain(mainIdx);
        if (hasStar && !vqMainStarDeducted) {
            if (typeof adjustScore === 'function') {
                adjustScore(mainIdx, -basePts);
            }
            vqQuestionStarUsed = true;
            vqMainStarDeducted = true;
            consumeVQStarForMain(mainIdx);
        }
    }

    vqBuzzerOpen = false;
    vqBuzzerWinner = 0;
    clearVQBuzzerUI();

    const contestants = (typeof gameData !== 'undefined' && Array.isArray(gameData.contestants)) ? gameData.contestants : [];
    const payload = {
        type: 'VINH_QUANG_WRONG',
        round: 'VQ',
        pack: basePts,
        mainContestant: mainIdx,
        stealerId: stealerIdx,
        contestants: contestants,
        questionText: currentVQQuestionText || '',
        answerText: currentVQAnswerText || '',
        answer: currentVQAnswerText || '',
        gameData: gameData,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_WRONG', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }

    if (stealerIdx >= 1 && stealerIdx <= 4) {
        const stealerName = contestants[stealerIdx - 1]?.name || `Thí sinh ${stealerIdx}`;
        const penalty = Math.round(basePts / 2);
        showToast(`Chấm SAI cho ${stealerName} (-${penalty}đ)`);
    } else {
        showToast('Chấm SAI cho thí sinh chính');
        const chk5s = document.getElementById('vq_check_5s');
        if (chk5s && chk5s.checked) {
            vqAuto5sTimeout = setTimeout(() => {
                onClickVQ5sTraLoi();
            }, 900);
        }
    }
}

function onClickVQChonGoiDiem(pack) {
    currentVQPack = pack;
    initVinhQuangData();
    
    // Clear contestant extra answers on controller
    for (let i = 1; i <= 5; i++) {
        const extraEl = document.getElementById(`ts${i}_extra_vq`);
        if (extraEl) extraEl.value = '';
    }
    
    const packQuestions = gameData.vinhQuang[pack] || [];
    let availableIndices = [];
    for (let i = 0; i < packQuestions.length; i++) {
        if (packQuestions[i] && (packQuestions[i].q || packQuestions[i].m)) {
            availableIndices.push(i);
        }
    }
    
    let selectedIdx = 0;
    if (availableIndices.length > 0) {
        selectedIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    } else {
        selectedIdx = Math.floor(Math.random() * 12);
    }
    
    currentVQQuestionIndex = selectedIdx;
    const item = packQuestions[selectedIdx] || { m: '', q: '', a: '' };
    
    if (item.m && item.m.trim() !== '') {
        currentVQSubject = item.m.trim();
    } else {
        currentVQSubject = defaultSubjectsList[Math.floor(Math.random() * defaultSubjectsList.length)];
    }
    
    currentVQQuestionText = item.q || `Nội dung câu hỏi gói ${pack} điểm (Câu ${selectedIdx + 1})`;
    currentVQAnswerText = item.a || '';

    const badge = document.getElementById('vq_current_pack_badge');
    if (badge) {
        badge.innerText = `Gói ${pack}Đ: Môn ${currentVQSubject}`;
        badge.style.background = pack === 10 ? '#dbeafe' : (pack === 20 ? '#fef3c7' : '#fee2e2');
        badge.style.color = pack === 10 ? '#1e40af' : (pack === 20 ? '#92400e' : '#991b1b');
    }

    const titleEl = document.getElementById('vq_preview_title');
    if (titleEl) titleEl.innerText = `GÓI ${pack} ĐIỂM - ${currentVQSubject.toUpperCase()}`;
    const qEl = document.getElementById('vq_preview_q_text');
    if (qEl) qEl.innerText = currentVQQuestionText || `Nội dung câu hỏi gói ${pack} điểm`;
    const aEl = document.getElementById('vq_preview_a_text');
    if (aEl) aEl.innerText = `Đáp án: ${currentVQAnswerText || '...'}`;
    const statusEl = document.getElementById('vq_preview_status');
    if (statusEl) statusEl.innerText = vqTimeLeft;

    // Clear contestant inputs on controller for the new question
    for (let i = 1; i <= 5; i++) {
        const ansEl = document.getElementById(`ts${i}_ans_vq`);
        if (ansEl) ansEl.value = '';
        const extraEl = document.getElementById(`ts${i}_extra_vq`);
        if (extraEl) extraEl.value = '';
    }
    sendToProjector('CLEAR_PLAYER_ANSWERS', { round: 'VQ' });

    window.vqQuestionIsShown = false;
    const payload = {
        type: 'VINH_QUANG_SELECT_PACK',
        round: 'VQ',
        pack: pack,
        subject: currentVQSubject,
        questionText: currentVQQuestionText || '',
        answerText: currentVQAnswerText || '',
        answer: currentVQAnswerText || '',
        vqQuestionShown: false,
        gameData: gameData,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_SELECT_PACK', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }

    showToast(`Đã chọn Gói ${pack} Điểm: Môn ${currentVQSubject}`);
}

function onClickVQHienChonGoiDiem() {
    window.vqQuestionIsShown = false;
    initVinhQuangData();
    
    // Nếu chưa chọn gói, mặc định chọn gói 10 điểm (hoặc giữ gói đã chọn)
    if (!currentVQPack) {
        currentVQPack = 10;
    }
    
    // Nếu chưa có câu hỏi hoặc rỗng, sinh môn và câu hỏi cho gói điểm
    if (!currentVQQuestionText) {
        const packQuestions = gameData.vinhQuang ? (gameData.vinhQuang[currentVQPack] || []) : [];
        let availableIndices = [];
        for (let i = 0; i < packQuestions.length; i++) {
            if (packQuestions[i] && (packQuestions[i].q || packQuestions[i].m)) {
                availableIndices.push(i);
            }
        }
        let selectedIdx = availableIndices.length > 0 ? availableIndices[Math.floor(Math.random() * availableIndices.length)] : 0;
        currentVQQuestionIndex = selectedIdx;
        const item = packQuestions[selectedIdx] || { m: '', q: '', a: '' };
        currentVQSubject = (item.m && item.m.trim() !== '') ? item.m.trim() : defaultSubjectsList[Math.floor(Math.random() * defaultSubjectsList.length)];
        currentVQQuestionText = item.q || `Nội dung câu hỏi gói ${currentVQPack} điểm (Câu ${selectedIdx + 1})`;
        currentVQAnswerText = item.a || '';
    }

    const badge = document.getElementById('vq_current_pack_badge');
    if (badge) {
        badge.innerText = `Gói ${currentVQPack}Đ: Môn ${currentVQSubject}`;
        badge.style.background = currentVQPack === 10 ? '#dbeafe' : (currentVQPack === 20 ? '#fef3c7' : '#fee2e2');
        badge.style.color = currentVQPack === 10 ? '#1e40af' : (currentVQPack === 20 ? '#92400e' : '#991b1b');
    }

    const titleEl = document.getElementById('vq_preview_title');
    if (titleEl) titleEl.innerText = `GÓI ${currentVQPack} ĐIỂM - ${currentVQSubject.toUpperCase()}`;
    const qEl = document.getElementById('vq_preview_q_text');
    if (qEl) qEl.innerText = currentVQQuestionText || `Nội dung câu hỏi gói ${currentVQPack} điểm`;
    const aEl = document.getElementById('vq_preview_a_text');
    if (aEl) aEl.innerText = `Đáp án: ${currentVQAnswerText || '...'}`;

    const payload = {
        type: 'VINH_QUANG_SHOW_PACKS',
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        pack: currentVQPack,
        subject: currentVQSubject,
        questionIndex: currentVQQuestionIndex,
        questionText: currentVQQuestionText || '',
        answerText: currentVQAnswerText || '',
        answer: currentVQAnswerText || '',
        vqQuestionShown: false,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_SHOW_PACKS', payload);
    const statusEl = document.getElementById('vq_preview_status');
    if (statusEl) statusEl.innerText = vqTimeLeft;
    showToast(`Hiển thị bảng chọn điểm trên Projector & Graphic (Gói ${currentVQPack}Đ - Môn ${currentVQSubject})`);
}

function onClickVQAnChonGoiDiem() {
    window.vqQuestionIsShown = false;
    const qEl = document.getElementById('vq_preview_q_text');
    if (qEl) qEl.innerText = `🔒 [Đang ẩn trên máy chiếu] ${currentVQQuestionText || 'Bấm Hiện câu hỏi để hiển thị'}`;
    const aEl = document.getElementById('vq_preview_a_text');
    if (aEl) aEl.innerText = `Đáp án: ${currentVQAnswerText || '...'}`;

    const anyStarActive = Array.isArray(window.vqStars) && window.vqStars.some(s => !!s);
    const payload = {
        type: 'VINH_QUANG_HIDE_PACK',
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        pack: currentVQPack || 10,
        subject: currentVQSubject,
        questionIndex: currentVQQuestionIndex,
        questionText: currentVQQuestionText || '',
        answerText: currentVQAnswerText || '',
        answer: currentVQAnswerText || '',
        vqQuestionShown: false,
        hasStar: anyStarActive,
        starActive: anyStarActive,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_HIDE_PACK', payload);
    const statusEl = document.getElementById('vq_preview_status');
    if (statusEl) statusEl.innerText = vqTimeLeft;
    showToast('Đã ẩn giao diện chọn gói điểm trên Projector (Chờ bấm Hiện câu hỏi)');
}

function onClickVQHienCauHoi() {
    window.vqQuestionIsShown = true;
    initVinhQuangData();
    if (!currentVQPack) currentVQPack = 10;
    if (!currentVQQuestionText) {
        const packQuestions = gameData.vinhQuang ? (gameData.vinhQuang[currentVQPack] || []) : [];
        let availableIndices = [];
        for (let i = 0; i < packQuestions.length; i++) {
            if (packQuestions[i] && (packQuestions[i].q || packQuestions[i].m)) availableIndices.push(i);
        }
        let selectedIdx = availableIndices.length > 0 ? availableIndices[Math.floor(Math.random() * availableIndices.length)] : 0;
        currentVQQuestionIndex = selectedIdx;
        const item = packQuestions[selectedIdx] || { m: '', q: '', a: '' };
        currentVQSubject = (item.m && item.m.trim() !== '') ? item.m.trim() : defaultSubjectsList[Math.floor(Math.random() * defaultSubjectsList.length)];
        currentVQQuestionText = item.q || `Nội dung câu hỏi gói ${currentVQPack} điểm (Câu ${selectedIdx + 1})`;
        currentVQAnswerText = item.a || '';
    }

    // Clear contestant inputs on controller for the new question
    for (let i = 1; i <= 5; i++) {
        const ansEl = document.getElementById(`ts${i}_ans_vq`);
        if (ansEl) ansEl.value = '';
        const extraEl = document.getElementById(`ts${i}_extra_vq`);
        if (extraEl) extraEl.value = '';
    }

    const badge = document.getElementById('vq_current_pack_badge');
    if (badge) {
        badge.innerText = `Gói ${currentVQPack}Đ: Môn ${currentVQSubject}`;
        badge.style.background = currentVQPack === 10 ? '#dbeafe' : (currentVQPack === 20 ? '#fef3c7' : '#fee2e2');
        badge.style.color = currentVQPack === 10 ? '#1e40af' : (currentVQPack === 20 ? '#92400e' : '#991b1b');
    }
    const titleEl = document.getElementById('vq_preview_title');
    if (titleEl) titleEl.innerText = `GÓI ${currentVQPack} ĐIỂM - ${currentVQSubject.toUpperCase()}`;
    const qEl = document.getElementById('vq_preview_q_text');
    if (qEl) qEl.innerText = currentVQQuestionText || "Nội dung câu hỏi Vinh Quang...";
    const aEl = document.getElementById('vq_preview_a_text');
    if (aEl) aEl.innerText = `Đáp án: ${currentVQAnswerText || '...'}`;

    const anyStarActive = Array.isArray(window.vqStars) && window.vqStars.some(s => !!s);
    const payload = {
        type: 'VINH_QUANG_SHOW_QUESTION',
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        pack: currentVQPack,
        subject: currentVQSubject,
        questionIndex: currentVQQuestionIndex,
        questionText: currentVQQuestionText || "Nội dung câu hỏi Vinh Quang...",
        answerText: currentVQAnswerText || '',
        answer: currentVQAnswerText || '',
        vqQuestionShown: true,
        hasStar: anyStarActive,
        starActive: anyStarActive,
        gameData: gameData,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_SHOW_QUESTION', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    const statusEl = document.getElementById('vq_preview_status');
    if (statusEl) statusEl.innerText = vqTimeLeft;
    showToast('Hiển thị câu hỏi Vinh Quang trên Projector & Graphic');
}

function onClickVQ25s() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }
    clearInterval(vqTimerInterval);
    vqTimeLeft = 25;
    const timerEl = document.getElementById('vq_preview_timer');
    if (timerEl) timerEl.innerText = "25";
    const statusEl = document.getElementById('vq_preview_status');
    if (statusEl) statusEl.innerText = "25";

    vqTimerInterval = setInterval(() => {
        vqTimeLeft--;
        if (timerEl) timerEl.innerText = vqTimeLeft;
        const statusEl = document.getElementById('vq_preview_status');
        if (statusEl) statusEl.innerText = vqTimeLeft;
        if (vqTimeLeft <= 0) {
            clearInterval(vqTimerInterval);
            if (timerEl) timerEl.innerText = "0";
            if (statusEl) statusEl.innerText = "0";
        }
    }, 1000);

    const payload25s = {
        type: 'VINH_QUANG_START_TIMER',
        duration: 25,
        round: 'VQ',
        pack: currentVQPack,
        subject: currentVQSubject,
        questionIndex: currentVQQuestionIndex,
        questionText: currentVQQuestionText,
        answerText: currentVQAnswerText,
        answer: currentVQAnswerText,
        vqQuestionShown: !!window.vqQuestionIsShown,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_START_TIMER', payload25s);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload25s);
    }
    showToast('Bắt đầu đếm ngược 25 giây');
}

function onClickVQHienDapAnTS() {
    let contestantsData = [];
    for (let i = 1; i <= 4; i++) {
        const contestant = gameData.contestants?.[i-1] || {};
        const extraInput = document.getElementById(`ts${i}_extra_vq`);
        const ansInput = document.getElementById(`ts${i}_ans_vq`);
        const ansVal = ansInput?.value || extraInput?.value || '';
        contestantsData.push({
            name: contestant.name || `Thí sinh ${i}`,
            score: contestant.score || 0,
            answer: ansVal
        });
    }

    sendToProjector('VINH_QUANG_SHOW_ANSWERS', {
        contestants: contestantsData
    });
    const statusEl = document.getElementById('vq_preview_status');
    if (statusEl) statusEl.innerText = vqTimeLeft;
    showToast('Hiển thị đáp án thí sinh Vinh Quang + Phát âm thanh Answer.mp3');
}

function onClickVQAnTatCa() {
    sendToProjector('VINH_QUANG_HIDE_ALL');
    showToast('Đã ẩn mọi giao diện Vinh Quang trên Projector & Graphic');
}

function onClickVQHoanThanh() {
    clearTimeout(vqAuto5sTimeout);
    vqAuto5sTimeout = null;
    clearInterval(vqTimerInterval);
    vqBuzzerOpen = false;
    vqBuzzerWinner = 0;
    vqQuestionStarUsed = false;
    vqMainStarDeducted = false;
    window.vqQuestionIsShown = false;

    if (Array.isArray(window.vqStars)) {
        window.vqStars = [false, false, false, false];
    }
    updateVQCenterStarUI(false);
    clearVQBuzzerUI();

    const contestants = (typeof gameData !== 'undefined' && Array.isArray(gameData.contestants)) ? gameData.contestants : [];
    const payload = {
        type: 'VINH_QUANG_FINISH',
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        mainContestant: vqTurnContestant || 0,
        contestants: contestants,
        vqQuestionShown: false,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_FINISH', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast('Hoàn thành phần thi của thí sinh!');
}
window.onClickVQHoanThanh = onClickVQHoanThanh;

function onClickVQDatLai() {
    window.vqQuestionIsShown = false;
    clearTimeout(vqAuto5sTimeout);
    vqAuto5sTimeout = null;
    clearInterval(vqTimerInterval);
    vqBuzzerOpen = false;
    vqBuzzerWinner = 0;
    vqTimeLeft = 20;
    const timerEl = document.getElementById('vq_preview_timer');
    if (timerEl) timerEl.innerText = "20";
    const statusEl = document.getElementById('vq_preview_status');
    if (statusEl) statusEl.innerText = "20";

    // Clear contestant extra answers on controller
    for (let i = 1; i <= 5; i++) {
        const extraEl = document.getElementById(`ts${i}_extra_vq`);
        if (extraEl) extraEl.value = '';
        const ansEl = document.getElementById(`ts${i}_ans_vq`);
        if (ansEl) ansEl.value = '';
    }

    currentVQPack = null;
    currentVQPackageNum = null;
    currentVQSelectMode = 'ordered';
    currentVQSlot = 0;
    vqTurnContestant = 0;
    currentVQSubject = "";
    currentVQQuestionText = "";
    currentVQAnswerText = "";
    vqSlotConfigs = {
        1: { points: null, qIdx: null },
        2: { points: null, qIdx: null },
        3: { points: null, qIdx: null }
    };

    updateVQPackButtonLabel();
    updateVQActiveContestantCards(0);
    const goiMenu = document.getElementById('vq_goi_dropdown_menu');
    if (goiMenu) goiMenu.style.display = 'none';
    const turnSel = document.getElementById('vq_turn_contestant');
    if (turnSel) turnSel.value = '0';
    const chk5s = document.getElementById('vq_check_5s');
    if (chk5s) chk5s.checked = false;
    const orderedRadio = document.querySelector('input[name="vq_select_mode"][value="ordered"]');
    if (orderedRadio) orderedRadio.checked = true;

    for (let s = 1; s <= 3; s++) {
        const chk20 = document.getElementById(`vq_slot_${s}_20_chk`);
        const chk30 = document.getElementById(`vq_slot_${s}_30_chk`);
        if (chk20) chk20.checked = false;
        if (chk30) chk30.checked = false;
        document.querySelectorAll(`input[name="vq_slot_${s}_20_idx"], input[name="vq_slot_${s}_30_idx"]`).forEach(r => {
            r.checked = false;
        });
        const badgeSlot = document.getElementById(`vq_q_badge_${s}`);
        if (badgeSlot) badgeSlot.innerText = '';
        const qBtn = document.getElementById(`btn_vq_q_${s}`);
        if (qBtn) {
            qBtn.style.background = '#80c4ff';
            qBtn.style.color = '#ffffff';
        }
    }
    refreshVQManualRadiosUI();
    if (Array.isArray(window.vqStars)) {
        window.vqStars = [false, false, false, false];
    }
    vqQuestionStarUsed = false;
    vqMainStarDeducted = false;
    updateVQCenterStarUI(false);
    updateVQMediaIndicators();

    const badge = document.getElementById('vq_current_pack_badge');
    if (badge) {
        badge.innerText = "Chưa chọn gói";
        badge.style.background = "transparent";
        badge.style.color = "#475569";
    }
    const titleEl = document.getElementById('vq_preview_title');
    if (titleEl) titleEl.innerText = "VÒNG THI VỀ ĐÍCH";
    const qNumEl = document.getElementById('vq_preview_q_num');
    if (qNumEl) qNumEl.innerText = "1";
    const qTotalEl = document.getElementById('vq_preview_q_total');
    if (qTotalEl) qTotalEl.innerText = "3";
    const qEl = document.getElementById('vq_preview_q_text');
    if (qEl) qEl.innerText = "Nội dung câu hỏi Về Đích...";
    const aEl = document.getElementById('vq_preview_a_text');
    if (aEl) aEl.innerText = "Đáp án: ...";

    sendToProjector('VINH_QUANG_RESET', { vqQuestionShown: false, round: 'VINH_QUANG', activeRound: 'VINH_QUANG' });
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction({
            type: 'VINH_QUANG_RESET',
            vqQuestionShown: false,
            round: 'VINH_QUANG',
            activeRound: 'VINH_QUANG',
            timestamp: Date.now()
        });
    }

    showToast('Đã đặt lại vòng Về Đích');
}

function cycleVQQuestion() {
    showToast('Chuyển lượt câu hỏi Về Đích');
}

// --- New Tab 4 (Về Đích) Controls matching updated UI ---
let currentVQPackageNum = null; // 1..5
let currentVQSelectMode = 'ordered'; // 'ordered' | 'random' | 'manual'
let currentVQSlot = 0; // 1..3
let vqTurnContestant = 0; // 0..4
let vqCenterStarActive = false;
let vqSlotConfigs = {
    1: { points: null, qIdx: null },
    2: { points: null, qIdx: null },
    3: { points: null, qIdx: null }
};

function syncVQTurnDropdownNames() {
    const sel = document.getElementById('vq_turn_contestant');
    if (!sel) return;
    for (let i = 1; i <= 4; i++) {
        const opt = sel.options[i];
        if (opt) {
            const name = (typeof gameData !== 'undefined' && gameData.contestants?.[i - 1]?.name) || `Thí sinh ${i}`;
            opt.textContent = `${i}. ${name}`;
        }
    }
}
window.syncVQTurnDropdownNames = syncVQTurnDropdownNames;

function updateVQMediaIndicators() {
    initVinhQuangData();
    const pkg = currentVQPackageNum || 1;
    const packList = (gameData.vinhQuang && gameData.vinhQuang[pkg]) ? gameData.vinhQuang[pkg] : [];
    for (let s = 1; s <= 3; s++) {
        for (let idx = 0; idx < 3; idx++) {
            const el20 = document.getElementById(`vq_media_mark_${s}_20_${idx}`);
            if (el20) {
                el20.textContent = (packList[idx] && packList[idx].m && packList[idx].m.trim()) ? '(*)' : '';
                el20.style.color = '#dc2626';
                el20.style.fontWeight = 'bold';
            }
        }
        for (let idx = 3; idx < 6; idx++) {
            const el30 = document.getElementById(`vq_media_mark_${s}_30_${idx}`);
            if (el30) {
                el30.textContent = (packList[idx] && packList[idx].m && packList[idx].m.trim()) ? '(*)' : '';
                el30.style.color = '#dc2626';
                el30.style.fontWeight = 'bold';
            }
        }
    }
}
window.updateVQMediaIndicators = updateVQMediaIndicators;

function refreshVQManualRadiosUI() {
    const isManual = currentVQSelectMode === 'manual';
    for (let s = 1; s <= 3; s++) {
        const pts = vqSlotConfigs[s]?.points;
        const qIdx = vqSlotConfigs[s]?.qIdx;
        document.querySelectorAll(`input[name="vq_slot_${s}_20_idx"]`).forEach(r => {
            r.disabled = !(isManual && pts === 20);
            r.checked = (pts === 20 && parseInt(r.value, 10) === qIdx);
        });
        document.querySelectorAll(`input[name="vq_slot_${s}_30_idx"]`).forEach(r => {
            r.disabled = !(isManual && pts === 30);
            r.checked = (pts === 30 && parseInt(r.value, 10) === qIdx);
        });
    }
}

function recomputeVQSlotQuestionIndices() {
    if (currentVQSelectMode === 'ordered') {
        let count20 = 0;
        let count30 = 0;
        for (let s = 1; s <= 3; s++) {
            const pts = vqSlotConfigs[s].points;
            if (pts === 20) {
                vqSlotConfigs[s].qIdx = Math.min(2, count20);
                count20++;
            } else if (pts === 30) {
                vqSlotConfigs[s].qIdx = 3 + Math.min(2, count30);
                count30++;
            } else {
                vqSlotConfigs[s].qIdx = null;
            }
        }
    } else if (currentVQSelectMode === 'random') {
        const pool20 = [0, 1, 2].sort(() => Math.random() - 0.5);
        const pool30 = [3, 4, 5].sort(() => Math.random() - 0.5);
        let p20 = 0;
        let p30 = 0;
        for (let s = 1; s <= 3; s++) {
            const pts = vqSlotConfigs[s].points;
            if (pts === 20) {
                vqSlotConfigs[s].qIdx = pool20[p20++] ?? 0;
            } else if (pts === 30) {
                vqSlotConfigs[s].qIdx = pool30[p30++] ?? 3;
            } else {
                vqSlotConfigs[s].qIdx = null;
            }
        }
    } else {
        for (let s = 1; s <= 3; s++) {
            const pts = vqSlotConfigs[s].points;
            if (pts === 20 && (vqSlotConfigs[s].qIdx === null || vqSlotConfigs[s].qIdx > 2)) {
                vqSlotConfigs[s].qIdx = s - 1;
            } else if (pts === 30 && (vqSlotConfigs[s].qIdx === null || vqSlotConfigs[s].qIdx < 3)) {
                vqSlotConfigs[s].qIdx = 3 + (s - 1);
            } else if (!pts) {
                vqSlotConfigs[s].qIdx = null;
            }
        }
    }
    refreshVQManualRadiosUI();
}

function onChangeVQSelectMode(mode) {
    currentVQSelectMode = mode || 'ordered';
    recomputeVQSlotQuestionIndices();
}
window.onChangeVQSelectMode = onChangeVQSelectMode;

function updateVQActiveContestantCards(activeIdx) {
    for (let i = 1; i <= 4; i++) {
        const card = document.getElementById(`vq_card_${i}`);
        const hdr = document.getElementById(`vq_card_hdr_${i}`);
        const isSelected = (i === activeIdx);
        if (card) {
            card.style.borderColor = isSelected ? '#2563eb' : 'transparent';
            card.style.background = isSelected ? '#dbeafe' : 'transparent';
        }
        if (hdr) {
            hdr.style.background = isSelected ? '#bfdbfe' : '#f1f5f9';
            hdr.style.borderColor = isSelected ? '#3b82f6' : '#cbd5e1';
        }
    }
}

function clearVQBuzzerUI() {
    vqBellUnlockTime = 0;
    vqBuzzerWinnerTime = '';
    updateVQActiveContestantCards(vqTurnContestant);
    for (let i = 1; i <= 4; i++) {
        const extraEl = document.getElementById(`ts${i}_extra_vq`);
        if (extraEl) extraEl.value = '';
        const ansEl = document.getElementById(`ts${i}_ans_vq`);
        if (ansEl && (ansEl.value.includes('BẤM CHUÔNG') || ansEl.value.includes('GIÀNH QUYỀN'))) {
            ansEl.value = '';
        }
    }
    const titleEl = document.getElementById('vq_preview_title');
    if (titleEl && titleEl.innerText && titleEl.innerText.includes('🔔 GIÀNH QUYỀN:')) {
        if (currentVQSlot && currentVQPackageNum) {
            const pts = (parseInt(currentVQPack, 10) === 30) ? 30 : 20;
            titleEl.innerText = `GÓI ${currentVQPackageNum} - CÂU HỎI THỨ ${currentVQSlot} (${pts} ĐIỂM)`;
        } else {
            titleEl.innerText = 'VÒNG THI VỀ ĐÍCH';
        }
    }
}

function setVQBuzzerWinnerUI(winnerIdx, bellTimeStr) {
    updateVQActiveContestantCards(vqTurnContestant);
    const cleanSec = bellTimeStr ? String(bellTimeStr).replace(/s|giây/gi, '').trim() : '';
    vqBuzzerWinnerTime = cleanSec;
    if (winnerIdx >= 1 && winnerIdx <= 4) {
        const card = document.getElementById(`vq_card_${winnerIdx}`);
        const hdr = document.getElementById(`vq_card_hdr_${winnerIdx}`);
        if (card) {
            card.style.borderColor = '#f59e0b';
            card.style.background = '#fef3c7';
        }
        if (hdr) {
            hdr.style.background = '#fde68a';
            hdr.style.borderColor = '#f59e0b';
        }
        const extraEl = document.getElementById(`ts${winnerIdx}_extra_vq`);
        if (extraEl) {
            extraEl.value = cleanSec ? `${cleanSec}s` : '';
        }
        const ansEl = document.getElementById(`ts${winnerIdx}_ans_vq`);
        if (ansEl) {
            ansEl.value = cleanSec ? `🔔 BẤM CHUÔNG NHANH NHẤT (${cleanSec}s)` : '🔔 BẤM CHUÔNG NHANH NHẤT';
        }
        const cName = (typeof gameData !== 'undefined' && gameData.contestants?.[winnerIdx - 1]?.name) || `Thí sinh ${winnerIdx}`;
        const titleEl = document.getElementById('vq_preview_title');
        if (titleEl) {
            const baseTitle = (currentVQSlot && currentVQPackageNum)
                ? `GÓI ${currentVQPackageNum} - CÂU HỎI THỨ ${currentVQSlot} (${(parseInt(currentVQPack, 10) === 30) ? 30 : 20} ĐIỂM)`
                : 'VÒNG THI VỀ ĐÍCH';
            const timeSuffix = cleanSec ? ` (${cleanSec}s)` : '';
            titleEl.innerText = `${baseTitle} | 🔔 GIÀNH QUYỀN: ${cName}${timeSuffix}`;
        }
    }
}

window.handleVinhQuangBuzzFromPlayer = function(tsIdx, data) {
    const id = parseInt(tsIdx || (data && (data.winnerId || data.contestantId || data.contestantIndex)), 10);
    if (!id || id < 1 || id > 4) return;
    if (id === vqTurnContestant) return;
    if (!vqBuzzerOpen || vqBuzzerWinner !== 0) return;
    if (data && data.winnerId && parseInt(data.winnerId, 10) !== id) return;

    const unlockAtSnapshot = vqBellUnlockTime;
    let bellSecondsStr = '';
    if (unlockAtSnapshot > 0) {
        bellSecondsStr = Math.max(0, (Date.now() - unlockAtSnapshot) / 1000).toFixed(2);
    } else if (data && (data.bellTime !== undefined || (data.time && data.time !== '00.00'))) {
        const rawBell = (data.bellTime !== undefined && data.bellTime !== null && String(data.bellTime).trim() !== '') ? data.bellTime : data.time;
        const parsed = parseFloat(String(rawBell).replace(/s|giây/gi, '').trim());
        if (!isNaN(parsed) && parsed >= 0) {
            bellSecondsStr = parsed.toFixed(2);
        }
    }

    vqBellUnlockTime = 0;
    vqBuzzerWinner = id;
    vqBuzzerOpen = false;
    clearInterval(vqTimerInterval);
    setVQBuzzerWinnerUI(id, bellSecondsStr);

    const cName = (typeof gameData !== 'undefined' && gameData.contestants && gameData.contestants[id - 1]?.name)
        || (data && data.contestantName)
        || `Thí sinh ${id}`;

    const payload = {
        type: 'VINH_QUANG_SHOW_FASTEST_HL',
        round: 'VQ',
        contestantId: id,
        contestantIndex: id,
        whoBuzzed: id,
        winnerId: id,
        contestantName: cName,
        bellTime: bellSecondsStr,
        mainContestant: vqTurnContestant || 1,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_SHOW_FASTEST_HL', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    const timeBadge = bellSecondsStr ? ` (${bellSecondsStr}s)` : '';
    showToast(`🔔 ${cName} giành quyền trả lời nhanh nhất${timeBadge}!`);
};

function selectVQMainContestant(idx) {
    clearTimeout(vqAuto5sTimeout);
    vqAuto5sTimeout = null;
    vqBuzzerOpen = false;
    vqBuzzerWinner = 0;
    vqQuestionStarUsed = false;
    vqMainStarDeducted = false;

    const num = parseInt(idx, 10) || 0;
    if (num < 1 || num > 4) {
        vqTurnContestant = 0;
        clearVQBuzzerUI();
        const sel = document.getElementById('vq_turn_contestant');
        if (sel) sel.value = '0';
        return;
    }

    vqTurnContestant = num;
    syncVQTurnDropdownNames();
    const sel = document.getElementById('vq_turn_contestant');
    if (sel) sel.value = String(num);
    clearVQBuzzerUI();

    const activeStar = !!(window.vqStars && window.vqStars[num - 1]);
    updateVQCenterStarUI(activeStar);

    const contestants = (typeof gameData !== 'undefined' && Array.isArray(gameData.contestants)) ? gameData.contestants : [];
    const name = contestants[num - 1]?.name || `Thí sinh ${num}`;
    const payload = {
        type: 'VINH_QUANG_SELECT_PLAYER',
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        contestantIndex: num,
        mainContestant: num,
        contestants: contestants,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_SELECT_PLAYER', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast(`Thí sinh thi chính Về Đích: ${name}`);
}
window.selectVQMainContestant = selectVQMainContestant;

function updateVQPackButtonLabel() {
    const goiBtn = document.getElementById('btn_vq_goi_select');
    if (!goiBtn) return;
    const p1 = vqSlotConfigs[1]?.points || null;
    const p2 = vqSlotConfigs[2]?.points || null;
    const p3 = vqSlotConfigs[3]?.points || null;
    if (!p1 && !p2 && !p3) {
        goiBtn.innerText = currentVQPackageNum ? `Gói ${currentVQPackageNum}` : 'Gói...';
        return;
    }
    goiBtn.innerText = `${p1 || '...'} - ${p2 || '...'} - ${p3 || '...'}`;
}
window.updateVQPackButtonLabel = updateVQPackButtonLabel;

function onToggleVQSlotPoint(slot, pts) {
    const chk20 = document.getElementById(`vq_slot_${slot}_20_chk`);
    const chk30 = document.getElementById(`vq_slot_${slot}_30_chk`);
    let isTicked = false;
    if (pts === 20) {
        if (chk20 && chk20.checked) {
            if (chk30) chk30.checked = false;
            vqSlotConfigs[slot].points = 20;
            isTicked = true;
        } else {
            vqSlotConfigs[slot].points = (chk30 && chk30.checked) ? 30 : null;
        }
    } else if (pts === 30) {
        if (chk30 && chk30.checked) {
            if (chk20) chk20.checked = false;
            vqSlotConfigs[slot].points = 30;
            isTicked = true;
        } else {
            vqSlotConfigs[slot].points = (chk20 && chk20.checked) ? 20 : null;
        }
    }
    recomputeVQSlotQuestionIndices();
    const badgeSlot = document.getElementById(`vq_q_badge_${slot}`);
    if (badgeSlot) {
        badgeSlot.innerText = vqSlotConfigs[slot].points ? `${vqSlotConfigs[slot].points}` : '';
    }
    updateVQPackButtonLabel();

    const payload = {
        type: 'VINH_QUANG_PICK_POINT',
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        slot: slot,
        points: vqSlotConfigs[slot].points,
        slots: vqSlotConfigs,
        playPickSound: isTicked,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_PICK_POINT', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
}
window.onToggleVQSlotPoint = onToggleVQSlotPoint;

function onSelectVQSlotManual(slot, pts, idx) {
    vqSlotConfigs[slot].points = pts;
    vqSlotConfigs[slot].qIdx = parseInt(idx, 10);
    refreshVQManualRadiosUI();
}
window.onSelectVQSlotManual = onSelectVQSlotManual;

function toggleVQPackageMenu() {
    const menu = document.getElementById('vq_goi_dropdown_menu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}
window.toggleVQPackageMenu = toggleVQPackageMenu;

function selectVQPackageNumber(pkgNum) {
    const num = parseInt(pkgNum, 10) || 1;
    currentVQPackageNum = num;
    updateVQPackButtonLabel();
    const menu = document.getElementById('vq_goi_dropdown_menu');
    if (menu) menu.style.display = 'none';

    updateVQMediaIndicators();
    const badge = document.getElementById('vq_current_pack_badge');
    if (badge) {
        badge.innerText = `Đang chọn Gói ${num}`;
        badge.style.background = '#dbeafe';
        badge.style.color = '#1e40af';
    }
    showToast(`Đã chọn Gói ${num} (Về Đích)`);
}
window.selectVQPackageNumber = selectVQPackageNumber;

function onClickVQChonGoi() {
    clearTimeout(vqAuto5sTimeout);
    vqAuto5sTimeout = null;
    clearInterval(vqTimerInterval);
    vqBuzzerOpen = false;
    vqBuzzerWinner = 0;
    vqQuestionStarUsed = false;
    vqMainStarDeducted = false;
    clearVQBuzzerUI();

    initVinhQuangData();
    if (!currentVQPackageNum) {
        currentVQPackageNum = 1;
        updateVQMediaIndicators();
        updateVQPackButtonLabel();
        const badge = document.getElementById('vq_current_pack_badge');
        if (badge) {
            badge.innerText = `Đang chọn Gói 1`;
            badge.style.background = '#dbeafe';
            badge.style.color = '#1e40af';
        }
    }
    recomputeVQSlotQuestionIndices();

    const summaryPts = [];
    for (let s = 1; s <= 3; s++) {
        const pts = vqSlotConfigs[s].points;
        const badgeSlot = document.getElementById(`vq_q_badge_${s}`);
        if (badgeSlot) badgeSlot.innerText = pts ? `${pts}` : '';
        summaryPts.push(pts ? `${pts}đ` : '--');
    }

    const firstConfigured = [1, 2, 3].find(s => vqSlotConfigs[s].points);
    const packVal = firstConfigured ? vqSlotConfigs[firstConfigured].points : 20;
    currentVQPack = packVal;

    const contestants = (typeof gameData !== 'undefined' && Array.isArray(gameData.contestants)) ? gameData.contestants : [];
    const payload = {
        type: 'VINH_QUANG_SHOW_PACKS',
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        packageNum: currentVQPackageNum,
        pack: packVal,
        mainContestant: vqTurnContestant || 0,
        contestants: contestants,
        slots: vqSlotConfigs,
        vqQuestionShown: false,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_SHOW_PACKS', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast(`Hiển thị bảng chọn gói câu hỏi (Gói ${currentVQPackageNum})`);
}
window.onClickVQChonGoi = onClickVQChonGoi;

function onClickVQPackButton() {
    const hasPickedPoints = [1, 2, 3].some(s => !!vqSlotConfigs[s]?.points);
    if (!hasPickedPoints) {
        toggleVQPackageMenu();
        return;
    }

    clearTimeout(vqAuto5sTimeout);
    vqAuto5sTimeout = null;
    clearInterval(vqTimerInterval);
    vqBuzzerOpen = false;
    vqBuzzerWinner = 0;
    vqQuestionStarUsed = false;
    vqMainStarDeducted = false;
    clearVQBuzzerUI();

    initVinhQuangData();
    if (!currentVQPackageNum) {
        currentVQPackageNum = 1;
        updateVQMediaIndicators();
    }
    recomputeVQSlotQuestionIndices();

    const menu = document.getElementById('vq_goi_dropdown_menu');
    if (menu) menu.style.display = 'none';

    const pickedLabel = [];
    for (let s = 1; s <= 3; s++) {
        const pts = vqSlotConfigs[s].points;
        const badgeSlot = document.getElementById(`vq_q_badge_${s}`);
        if (badgeSlot) badgeSlot.innerText = pts ? `${pts}` : '';
        pickedLabel.push(pts ? `${pts}` : '--');
    }
    updateVQPackButtonLabel();

    const firstConfigured = [1, 2, 3].find(s => vqSlotConfigs[s].points);
    if (firstConfigured) {
        currentVQPack = vqSlotConfigs[firstConfigured].points;
    }

    const badge = document.getElementById('vq_current_pack_badge');
    if (badge) {
        badge.innerText = `Gói ${currentVQPackageNum}: ${pickedLabel.join(' - ')}`;
        badge.style.background = '#dbeafe';
        badge.style.color = '#1e40af';
    }

    const contestants = (typeof gameData !== 'undefined' && Array.isArray(gameData.contestants)) ? gameData.contestants : [];
    const mainIdx = (vqTurnContestant >= 1 && vqTurnContestant <= 4) ? vqTurnContestant : 1;
    const payload = {
        type: 'VINH_QUANG_CHOOSE_PACK',
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        packageNum: currentVQPackageNum,
        mainContestant: mainIdx,
        slots: vqSlotConfigs,
        contestants: contestants,
        vqQuestionShown: false,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_CHOOSE_PACK', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast(`Chốt gói câu hỏi: ${pickedLabel.join(' - ')}`);
}
window.onClickVQPackButton = onClickVQPackButton;

function selectVQQuestionSlot(slot) {
    clearTimeout(vqAuto5sTimeout);
    vqAuto5sTimeout = null;
    clearInterval(vqTimerInterval);
    vqBuzzerOpen = false;
    vqBuzzerWinner = 0;
    vqQuestionStarUsed = false;
    vqMainStarDeducted = false;
    clearVQBuzzerUI();

    const s = parseInt(slot, 10) || 1;
    currentVQSlot = s;
    initVinhQuangData();
    if (!currentVQPackageNum) {
        selectVQPackageNumber(1);
    }
    syncVQTurnDropdownNames();

    for (let i = 1; i <= 3; i++) {
        const btn = document.getElementById(`btn_vq_q_${i}`);
        if (btn) {
            if (i === s) {
                btn.style.background = '#2563eb';
                btn.style.color = '#ffffff';
            } else {
                btn.style.background = '#80c4ff';
                btn.style.color = '#ffffff';
            }
        }
    }

    const cfg = vqSlotConfigs[s] || {};
    const pts = cfg.points || 20;
    const qIdx = (cfg.qIdx !== null && cfg.qIdx !== undefined) ? cfg.qIdx : (pts === 30 ? (3 + s - 1) : (s - 1));
    currentVQPack = pts;
    currentVQQuestionIndex = qIdx;

    const packList = (gameData.vinhQuang && gameData.vinhQuang[currentVQPackageNum]) ? gameData.vinhQuang[currentVQPackageNum] : [];
    const item = packList[qIdx] || { m: '', q: '', a: '' };
    currentVQQuestionText = item.q || `Nội dung Gói ${currentVQPackageNum} - Câu hỏi thứ ${s} (${pts} điểm)`;
    currentVQAnswerText = item.a || '';
    currentVQSubject = `Gói ${currentVQPackageNum} (${pts}Đ)`;

    const badgeSlot = document.getElementById(`vq_q_badge_${s}`);
    if (badgeSlot) badgeSlot.innerText = `${pts}`;

    clearInterval(vqTimerInterval);
    vqTimeLeft = (pts === 30) ? 20 : 15;
    const statusEl = document.getElementById('vq_preview_status');
    if (statusEl) statusEl.innerText = vqTimeLeft;

    const titleEl = document.getElementById('vq_preview_title');
    if (titleEl) titleEl.innerText = `GÓI ${currentVQPackageNum} - CÂU HỎI THỨ ${s} (${pts} ĐIỂM)`;
    const qNumEl = document.getElementById('vq_preview_q_num');
    if (qNumEl) qNumEl.innerText = String(s);
    const qTotalEl = document.getElementById('vq_preview_q_total');
    if (qTotalEl) qTotalEl.innerText = "3";
    const qEl = document.getElementById('vq_preview_q_text');
    if (qEl) qEl.innerText = currentVQQuestionText;
    const aEl = document.getElementById('vq_preview_a_text');
    if (aEl) aEl.innerText = `Đáp án: ${currentVQAnswerText || '...'}`;

    window.vqQuestionIsShown = true;
    const anyStarActive = vqCenterStarActive || (Array.isArray(window.vqStars) && window.vqStars.some(st => !!st));
    const contestants = (typeof gameData !== 'undefined' && Array.isArray(gameData.contestants)) ? gameData.contestants : [];
    const payload = {
        type: 'VINH_QUANG_SHOW_QUESTION',
        round: 'VINH_QUANG',
        activeRound: 'VINH_QUANG',
        packageNum: currentVQPackageNum,
        slot: s,
        pack: pts,
        mainContestant: vqTurnContestant || 1,
        slots: vqSlotConfigs,
        contestants: contestants,
        subject: currentVQSubject,
        questionIndex: qIdx,
        questionText: currentVQQuestionText,
        answerText: currentVQAnswerText,
        answer: currentVQAnswerText,
        mediaUrl: item.m || '',
        vqQuestionShown: true,
        hasStar: anyStarActive,
        starActive: anyStarActive,
        gameData: gameData,
        timestamp: Date.now()
    };
    sendToProjector('VINH_QUANG_SHOW_QUESTION', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast(`Mở Câu hỏi thứ ${s} - Gói ${currentVQPackageNum} (${pts} điểm)`);
}
window.selectVQQuestionSlot = selectVQQuestionSlot;

function onChangeVQTurnContestant(val) {
    const idx = parseInt(val, 10) || 0;
    selectVQMainContestant(idx);
}
window.onChangeVQTurnContestant = onChangeVQTurnContestant;

function updateVQCenterStarUI(isActive) {
    vqCenterStarActive = !!isActive;
    const svg = document.getElementById('vq_star_center_svg');
    if (svg) {
        svg.setAttribute('fill', vqCenterStarActive ? '#facc15' : '#94a3b8');
        svg.setAttribute('stroke', vqCenterStarActive ? '#ca8a04' : '#64748b');
        svg.style.filter = vqCenterStarActive ? 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.8))' : 'none';
    }
}

function onClickVQCenterStar() {
    if (vqTurnContestant >= 1 && vqTurnContestant <= 4 && typeof toggleVQStar === 'function') {
        toggleVQStar(vqTurnContestant);
        const isOn = !!(window.vqStars && window.vqStars[vqTurnContestant - 1]);
        updateVQCenterStarUI(isOn);
        if (!isOn) {
            vqQuestionStarUsed = false;
            vqMainStarDeducted = false;
        }
    } else {
        updateVQCenterStarUI(!vqCenterStarActive);
        if (!vqCenterStarActive) {
            vqQuestionStarUsed = false;
            vqMainStarDeducted = false;
        }
        const starPayload = {
            type: 'VINH_QUANG_STAR_OF_HOPE',
            contestantIndex: vqTurnContestant || 0,
            active: vqCenterStarActive,
            hasStar: vqCenterStarActive,
            timestamp: Date.now()
        };
        sendToProjector('VINH_QUANG_STAR_OF_HOPE', starPayload);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(starPayload);
        }
        showToast(vqCenterStarActive ? 'Đã bật Ngôi sao hy vọng!' : 'Đã tắt Ngôi sao hy vọng');
    }
}
window.onClickVQCenterStar = onClickVQCenterStar;

document.addEventListener('click', (e) => {
    const menu = document.getElementById('vq_goi_dropdown_menu');
    const btn = document.getElementById('btn_vq_goi_select');
    const toggleBtn = document.getElementById('btn_vq_goi_menu_toggle');
    if (menu && menu.style.display === 'block' && !menu.contains(e.target) && (!btn || !btn.contains(e.target)) && (!toggleBtn || !toggleBtn.contains(e.target))) {
        menu.style.display = 'none';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        syncVQTurnDropdownNames();
        updateVQMediaIndicators();
    }, 200);
});
