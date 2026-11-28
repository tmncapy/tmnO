// ControllerR3.js - Round 3: Vượt sóng
let currentVSRow = 1;
let vsTimerInterval = null;
let vsTimeLeft = 15;
let vsRevealedKeyIndices = [];
window.vsOpenedPieces = window.vsOpenedPieces || { 1: false, 2: false, 3: false, 4: false, 5: false };
window.vsLockedContestants = window.vsLockedContestants || { 1: false, 2: false, 3: false, 4: false };
let vsAnswerStep = 'idle'; // 'idle' | 'counting' | 'ready'
let vsAnswerCountdownInterval = null;
let vsTimerEndAt = 0;
let vsAnswerCountdownEndAt = 0;

function sanitizeVSHintImageInput(raw) {
    if (raw === undefined || raw === null) return '';
    const cleaned = String(raw).trim().replace(/^['"]+|['"]+$/g, '');
    if (!cleaned || cleaned === '...' || cleaned === '…' || cleaned === 'null' || cleaned === 'undefined') return '';
    if (typeof window !== 'undefined' && typeof window.normalizeMediaUrl === 'function') {
        return window.normalizeMediaUrl(cleaned);
    }
    return cleaned;
}

function syncVSLockButtonsUI() {
    if (!window.vsLockedContestants) window.vsLockedContestants = { 1: false, 2: false, 3: false, 4: false };
    for (let i = 1; i <= 4; i++) {
        const isLocked = !!window.vsLockedContestants[i];
        const btn = document.getElementById(`btn_vs_lock_${i}`);
        if (btn) {
            btn.innerText = isLocked ? 'Mở máy' : 'Khóa máy';
            btn.style.background = isLocked ? '#dc2626' : '';
            btn.style.color = isLocked ? '#ffffff' : '';
            btn.style.borderColor = isLocked ? '#b91c1c' : '';
        }
        const ansInp = document.getElementById(`ts${i}_ans_vs`);
        if (ansInp) {
            ansInp.disabled = isLocked;
            ansInp.readOnly = isLocked;
        }
    }
}
window.syncVSLockButtonsUI = syncVSLockButtonsUI;

function toggleVSContestantLock(idx) {
    const id = parseInt(idx, 10);
    if (!id || id < 1 || id > 4) return;
    if (!window.vsLockedContestants) window.vsLockedContestants = { 1: false, 2: false, 3: false, 4: false };
    window.vsLockedContestants[id] = !window.vsLockedContestants[id];
    const isLocked = !!window.vsLockedContestants[id];
    syncVSLockButtonsUI();

    const payload = {
        type: 'VUOT_SONG_LOCK_CONTESTANT',
        contestantId: id,
        locked: isLocked,
        vsLockedContestants: { ...window.vsLockedContestants },
        round: 'VUOT_SONG',
        activeRound: 'VUOT_SONG',
        timestamp: Date.now()
    };
    sendToProjector('VUOT_SONG_LOCK_CONTESTANT', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') {
        window.saveControllerRuntimeState();
    }
    if (typeof showToast === 'function') {
        showToast(isLocked ? `Đã khóa máy Thí sinh ${id}` : `Đã mở máy Thí sinh ${id}`);
    }
}
window.toggleVSContestantLock = toggleVSContestantLock;

function unlockAllVSContestants() {
    window.vsLockedContestants = { 1: false, 2: false, 3: false, 4: false };
    syncVSLockButtonsUI();

    const payload = {
        type: 'VUOT_SONG_UNLOCK_ALL',
        contestantId: 'ALL',
        vsLockedContestants: { 1: false, 2: false, 3: false, 4: false },
        round: 'VUOT_SONG',
        activeRound: 'VUOT_SONG',
        timestamp: Date.now()
    };
    sendToProjector('VUOT_SONG_UNLOCK_ALL', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') {
        window.saveControllerRuntimeState();
    }
    if (typeof showToast === 'function') {
        showToast('Đã mở lại máy cho tất cả thí sinh');
    }
}
window.unlockAllVSContestants = unlockAllVSContestants;

function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    try {
        str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch(e) {}
    return str;
}

function selectVSRow(row) {
    if (typeof resetVSShowAnswersButton === 'function') resetVSShowAnswersButton();
    currentVSRow = row;
    const buttons = document.querySelectorAll('#tab2-content .vs-row-btn');
    buttons.forEach((btn, idx) => {
        if ((idx + 1 === row) || (row === 'center' && idx === 4)) {
            btn.style.background = '#0056b3';
            btn.style.color = '#fff';
        } else {
            btn.style.background = idx === 4 ? '#38bdf8' : '#80bfff';
            btn.style.color = idx === 4 ? '#fff' : '#002060';
        }
    });

    // Clear contestant 20s inputs on controller for the new horizontal row
    for (let i = 1; i <= 4; i++) {
        const extraEl = document.getElementById(`ts${i}_extra_vs`);
        if (extraEl) extraEl.value = '';
        const ansEl = document.getElementById(`ts${i}_ans_vs`);
        if (ansEl && !ansEl.value.startsWith('[CNV]')) {
            ansEl.value = '';
        }
    }

    sendToProjector('CLEAR_PLAYER_ANSWERS', { round: 'VS' });

    window.vsQuestionIsShown = false;
    const titleEl = document.getElementById('vs_preview_title');
    const qTextEl = document.getElementById('vs_preview_q_text');
    const aTextEl = document.getElementById('vs_preview_a_text');
    const statusEl = document.getElementById('vs_preview_status');
    if (statusEl) statusEl.innerText = "15";
    
    if (row === 'center') {
        if (titleEl) titleEl.innerText = "VÒNG THI VƯỢT CHƯỚNG NGẠI VẬT: Ô CHỮ TRUNG TÂM";
    } else {
        if (titleEl) titleEl.innerText = `VÒNG THI VƯỢT CHƯỚNG NGẠI VẬT: HÀNG NGANG ${row}`;
    }
    const q = row === 'center' ? (document.getElementById('vs_q_center')?.value || gameData.vuotSong?.center?.q || "") : (document.getElementById(`vs_q_${row}`)?.value || gameData.vuotSong?.[`h${row}`]?.q || "");
    const a = row === 'center' ? (document.getElementById('vs_a_center')?.value || gameData.vuotSong?.center?.a || "") : (document.getElementById(`vs_a_${row}`)?.value || gameData.vuotSong?.[`h${row}`]?.a || "");

    if (qTextEl) qTextEl.innerText = q || `Nội dung câu hỏi Hàng ngang ${row}`;
    if (aTextEl) aTextEl.innerText = `Đáp án: ${a || '...'} | Từ khóa CNV: ${gameData.vuotSong?.keyword || '...'}`;

    const payload = {
        type: 'VUOT_SONG_SELECT_ROW',
        row: row,
        round: 'VS',
        questionText: q,
        answerText: a,
        answer: a,
        vsQuestionShown: false,
        gameData: gameData,
        contestants: gameData.contestants,
        timestamp: Date.now()
    };
    sendToProjector('VUOT_SONG_SELECT_ROW', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast(`Đã chọn Hàng ngang ${row}`);
}

function onClickVSShowRows() {
    if (typeof resetVSShowAnswersButton === 'function') resetVSShowAnswersButton();
    if (!gameData.vuotSong || Array.isArray(gameData.vuotSong)) {
        gameData.vuotSong = { h1: {q:"",a:""}, h2: {q:"",a:""}, h3: {q:"",a:""}, h4: {q:"",a:""}, center: {q:"",a:""}, keyword: "" };
    }
    for (let i = 1; i <= 4; i++) {
        const qEl = document.getElementById(`vs_q_${i}`);
        const aEl = document.getElementById(`vs_a_${i}`);
        if (qEl || aEl) {
            const qVal = qEl ? qEl.value : (gameData.vuotSong[`h${i}`]?.q || '');
            let aVal = aEl ? aEl.value : (gameData.vuotSong[`h${i}`]?.a || '');
            if (!aVal.trim() && qVal.trim()) aVal = qVal;
            gameData.vuotSong[`h${i}`] = { q: qVal, a: aVal };
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
    if (!gameData.vuotSong.keyword && gameData.vuotSong.center?.a) {
        gameData.vuotSong.keyword = gameData.vuotSong.center.a;
    }
    const hintEl = document.getElementById('vs_hint_image');
    if (hintEl) {
        const normalizedHint = sanitizeVSHintImageInput(hintEl.value);
        gameData.vuotSong.hintImage = normalizedHint;
        if (hintEl.value !== normalizedHint) hintEl.value = normalizedHint;
    }
    if (typeof saveAllData === 'function') {
        saveAllData(false);
    }

    const payload = {
        type: 'VUOT_SONG_SHOW_ROWS',
        round: 'VUOT_SONG',
        activeRound: 'VUOT_SONG',
        vuotSong: gameData.vuotSong,
        openedPieces: window.vsOpenedPieces,
        contestants: gameData.contestants,
        timestamp: Date.now()
    };
    sendToProjector('VUOT_SONG_SHOW_ROWS', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast('Đã hiện hàng ngang Vượt Chướng Ngại Vật trên Projector');
}
window.onClickVSShowRows = onClickVSShowRows;

function syncVSPieceButtonsUI() {
    for (let i = 1; i <= 5; i++) {
        const btn = document.getElementById(`btn_vs_piece_${i}`);
        if (!btn) continue;
        const isOpened = !!(window.vsOpenedPieces && window.vsOpenedPieces[i]);
        const baseLabel = i === 5 ? 'Mở mảnh 5 (Ô trung tâm)' : `Mở mảnh ${i}`;
        if (isOpened) {
            btn.innerText = i === 5 ? 'Đã mở mảnh 5 (TT) ✓' : `Đã mở mảnh ${i} ✓`;
            btn.style.background = '#dcfce7';
            btn.style.color = '#166534';
            btn.style.borderColor = '#86efac';
        } else {
            btn.innerText = baseLabel;
            btn.style.background = '';
            btn.style.color = '';
            btn.style.borderColor = '';
        }
    }
}
window.syncVSPieceButtonsUI = syncVSPieceButtonsUI;

function onClickVSOpenPiece(pieceNum) {
    const p = parseInt(pieceNum, 10);
    if (p < 1 || p > 5) return;

    const hintEl = document.getElementById('vs_hint_image');
    if (hintEl) {
        if (!gameData.vuotSong || Array.isArray(gameData.vuotSong)) {
            gameData.vuotSong = { h1: {q:"",a:""}, h2: {q:"",a:""}, h3: {q:"",a:""}, h4: {q:"",a:""}, center: {q:"",a:""}, keyword: "", hintImage: "" };
        }
        const normalizedHint = sanitizeVSHintImageInput(hintEl.value);
        gameData.vuotSong.hintImage = normalizedHint;
        if (hintEl.value !== normalizedHint) hintEl.value = normalizedHint;
    }

    if (!window.vsOpenedPieces) window.vsOpenedPieces = { 1: false, 2: false, 3: false, 4: false, 5: false };
    window.vsOpenedPieces[p] = true;
    syncVSPieceButtonsUI();

    const payload = {
        type: 'VUOT_SONG_OPEN_PIECE',
        piece: p,
        openedPieces: { ...window.vsOpenedPieces },
        vuotSong: gameData.vuotSong,
        round: 'VUOT_SONG',
        activeRound: 'VUOT_SONG',
        timestamp: Date.now()
    };
    sendToProjector('VUOT_SONG_OPEN_PIECE', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast(p === 5 ? 'Đã mở mảnh ghép 5 (Ô trung tâm)' : `Đã mở mảnh ghép ${p}`);
}
window.onClickVSOpenPiece = onClickVSOpenPiece;

function onClickVSFlipRow() {
    sendToProjector('VUOT_SONG_SELECT_ROW', { row: currentVSRow });
    showToast(`Đã lật ô chữ hàng ngang ${currentVSRow} trên Projector`);
}

function onClickVSOpenRowAnswer() {
    if (!currentVSRow) {
        showToast('Chưa chọn hàng ngang nào!');
        return;
    }
    if (typeof resetVSShowAnswersButton === 'function') resetVSShowAnswersButton();

    let a = "";
    if (currentVSRow === 'center') {
        a = document.getElementById('vs_a_center')?.value || gameData.vuotSong?.center?.a || "";
    } else {
        a = document.getElementById(`vs_a_${currentVSRow}`)?.value || gameData.vuotSong?.[`h${currentVSRow}`]?.a || "";
    }

    const payload = {
        type: 'VUOT_SONG_OPEN_ROW_ANSWER',
        row: currentVSRow,
        answer: a,
        vuotSong: gameData.vuotSong,
        round: 'VUOT_SONG',
        activeRound: 'VUOT_SONG',
        timestamp: Date.now()
    };
    sendToProjector('VUOT_SONG_OPEN_ROW_ANSWER', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast(`Đã mở đáp án hàng ngang ${currentVSRow}`);
}
window.onClickVSOpenRowAnswer = onClickVSOpenRowAnswer;

function onClickVSCloseRowAnswer() {
    if (!currentVSRow) {
        showToast('Chưa chọn hàng ngang nào!');
        return;
    }
    if (typeof resetVSShowAnswersButton === 'function') resetVSShowAnswersButton();

    const payload = {
        type: 'VUOT_SONG_CLOSE_ROW_ANSWER',
        row: currentVSRow,
        vuotSong: gameData.vuotSong,
        round: 'VUOT_SONG',
        activeRound: 'VUOT_SONG',
        timestamp: Date.now()
    };
    sendToProjector('VUOT_SONG_CLOSE_ROW_ANSWER', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast(`Đã đóng đáp án hàng ngang ${currentVSRow}`);
}
window.onClickVSCloseRowAnswer = onClickVSCloseRowAnswer;

function onClickVSOpenKeywordLetters() {
    const kw = (gameData.vuotSong?.keyword || gameData.vuotSong?.center?.a || document.getElementById('vs_keyword')?.value || '').trim();
    const cleanKw = removeVietnameseTones(kw).replace(/\s+/g, '').toUpperCase();
    const totalLen = cleanKw.length;
    
    if (totalLen === 0) {
        showToast('Chưa nhập Từ khóa / Đáp án vòng thi Vượt Chướng Ngại Vật!');
        return;
    }

    // Filter out indices out of bounds if keyword length changed
    vsRevealedKeyIndices = vsRevealedKeyIndices.filter(i => i < totalLen);

    // Find unopened indices
    const unopened = [];
    for (let i = 0; i < totalLen; i++) {
        if (!vsRevealedKeyIndices.includes(i)) {
            unopened.push(i);
        }
    }

    if (unopened.length === 0) {
        showToast('Tất cả chữ cái của đáp án vòng thi đã được mở!');
        return;
    }

    // Rule: max per click = Math.floor(totalLen / 4), at least 1
    const maxPerClick = Math.max(1, Math.floor(totalLen / 4));
    const availableToOpen = Math.min(maxPerClick, unopened.length);
    // Random count between 1 and availableToOpen
    const numToOpen = Math.floor(Math.random() * availableToOpen) + 1;

    // Randomly pick numToOpen indices from unopened array
    const newlyOpened = [];
    const tempUnopened = [...unopened];
    for (let k = 0; k < numToOpen; k++) {
        const randomIndex = Math.floor(Math.random() * tempUnopened.length);
        const pickedIdx = tempUnopened.splice(randomIndex, 1)[0];
        newlyOpened.push(pickedIdx);
        vsRevealedKeyIndices.push(pickedIdx);
    }

    sendToProjector('VUOT_SONG_OPEN_KEYWORD_LETTERS', {
        keyword: cleanKw,
        revealedIndices: vsRevealedKeyIndices,
        newlyOpened: newlyOpened
    });

    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast(`Đã mở thêm ${numToOpen} chữ cái đáp án (${vsRevealedKeyIndices.length}/${totalLen} ô)`);
}

function onClickVSOpenAllAnswers() {
    const kw = (gameData.vuotSong?.keyword || gameData.vuotSong?.center?.a || '').trim();
    const cleanKw = removeVietnameseTones(kw).replace(/\s+/g, '').toUpperCase();
    vsRevealedKeyIndices = [];
    for (let i = 0; i < cleanKw.length; i++) {
        vsRevealedKeyIndices.push(i);
    }
    sendToProjector('VUOT_SONG_OPEN_ALL_ANSWERS', { vuotSong: gameData.vuotSong });
    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast('Đã mở đáp án Vòng thi Vượt Chướng Ngại Vật!');
}

function onClickVSShowQuestion() {
    if (!currentVSRow) {
        showToast('⚠️ Vui lòng chọn Hàng ngang trước khi bấm Hiện câu hỏi!');
        return;
    }
    window.vsQuestionIsShown = true;
    const q = currentVSRow === 'center' ? (document.getElementById('vs_q_center')?.value || gameData.vuotSong?.center?.q || "Chưa nhập câu hỏi trung tâm") : (document.getElementById(`vs_q_${currentVSRow}`)?.value || gameData.vuotSong?.[`h${currentVSRow}`]?.q || `Chưa nhập câu hỏi hàng ${currentVSRow}`);
    const a = currentVSRow === 'center' ? (document.getElementById('vs_a_center')?.value || gameData.vuotSong?.center?.a || "Chưa nhập đáp án") : (document.getElementById(`vs_a_${currentVSRow}`)?.value || gameData.vuotSong?.[`h${currentVSRow}`]?.a || `Chưa nhập đáp án`);

    const qTextEl = document.getElementById('vs_preview_q_text');
    const aTextEl = document.getElementById('vs_preview_a_text');
    if (qTextEl) qTextEl.innerText = q;
    if (aTextEl) aTextEl.innerText = `Đáp án: ${a} | Từ khóa CNV: ${gameData.vuotSong?.keyword || '...'}`;

    const payload = {
        type: 'VUOT_SONG_SHOW_QUESTION',
        row: currentVSRow,
        questionText: q,
        answerText: a,
        answer: a,
        vsQuestionShown: true,
        round: 'VS',
        timestamp: Date.now()
    };
    sendToProjector('VUOT_SONG_SHOW_QUESTION', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast('Đã hiển thị câu hỏi Vượt Chướng Ngại Vật trên Projector & Player');
}

function onClickVSStartTimer() {
    clearInterval(vsTimerInterval);
    vsTimerInterval = null;
    vsTimeLeft = 15;
    vsTimerEndAt = Date.now() + 15000;
    const timerEl = document.getElementById('vs_preview_timer');
    if (timerEl) timerEl.innerText = vsTimeLeft;
    const statusEl = document.getElementById('vs_preview_status');
    if (statusEl) statusEl.innerText = vsTimeLeft;
    
    vsTimerInterval = setInterval(() => {
        vsTimeLeft = Math.max(0, Math.ceil((vsTimerEndAt - Date.now()) / 1000));
        if (timerEl) timerEl.innerText = vsTimeLeft;
        const stEl = document.getElementById('vs_preview_status');
        if (stEl) stEl.innerText = vsTimeLeft;
        if (vsTimeLeft <= 0) {
            clearInterval(vsTimerInterval);
            vsTimerInterval = null;
            vsTimerEndAt = 0;
            if (timerEl) timerEl.innerText = "0";
            if (stEl) stEl.innerText = "0";
            if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
        }
    }, 250);

    const q = currentVSRow === 'center' ? (document.getElementById('vs_q_center')?.value || gameData.vuotSong?.center?.q || "") : (document.getElementById(`vs_q_${currentVSRow}`)?.value || gameData.vuotSong?.[`h${currentVSRow}`]?.q || "");
    const a = currentVSRow === 'center' ? (document.getElementById('vs_a_center')?.value || gameData.vuotSong?.center?.a || "") : (document.getElementById(`vs_a_${currentVSRow}`)?.value || gameData.vuotSong?.[`h${currentVSRow}`]?.a || "");

    const payload = {
        type: 'VUOT_SONG_START_TIMER',
        duration: 15,
        row: currentVSRow,
        questionText: q,
        answerText: a,
        answer: a,
        timestamp: Date.now()
    };
    sendToProjector('VUOT_SONG_START_TIMER', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast('Bắt đầu 15s Vượt Chướng Ngại Vật trên Projector');
}

function onClickVSReturnToGrid() {
    if (typeof resetVSShowAnswersButton === 'function') resetVSShowAnswersButton();
    window.vsQuestionIsShown = false;
    clearInterval(vsTimerInterval);
    vsTimerInterval = null;
    vsTimerEndAt = 0;
    const timerEl = document.getElementById('vs_preview_timer');
    if (timerEl) timerEl.innerText = vsTimeLeft;
    const statusEl = document.getElementById('vs_preview_status');
    if (statusEl) statusEl.innerText = vsTimeLeft;

    const qTextEl = document.getElementById('vs_preview_q_text');
    const aTextEl = document.getElementById('vs_preview_a_text');
    if (qTextEl) qTextEl.innerText = "🔒 [Đang ẩn] - Bấm [Hiện câu hỏi] để hiển thị nội dung cho Player & Máy chiếu";
    if (aTextEl) aTextEl.innerText = `Đáp án: 🔒 [Đang ẩn - Bấm Hiện câu hỏi để xem] | Từ khóa CNV: ${gameData.vuotSong?.keyword || '...'}`;

    const payload = {
        type: 'VUOT_SONG_RETURN_GRID',
        row: currentVSRow,
        round: 'VS',
        activeRound: 'VUOT_SONG',
        timestamp: Date.now()
    };
    sendToProjector('VUOT_SONG_RETURN_GRID', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast('Đã quay lại giao diện hàng ngang (giữ nguyên trạng thái chọn & đáp án)');
}

function resetVSShowAnswersButton() {
    if (vsAnswerCountdownInterval) {
        clearInterval(vsAnswerCountdownInterval);
        vsAnswerCountdownInterval = null;
    }
    vsAnswerCountdownEndAt = 0;
    vsAnswerStep = 'idle';
    const btn = document.getElementById('btn_vs_show_answers');
    if (btn) {
        btn.innerText = 'Hiện ĐA thí sinh';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
        btn.disabled = false;
    }
}
window.resetVSShowAnswersButton = resetVSShowAnswersButton;

function collectVSContestantAnswersPayload() {
    const contestants = [];
    for (let i = 1; i <= 4; i++) {
        const extraInput = document.getElementById(`ts${i}_extra_vs`);
        const ansInput = document.getElementById(`ts${i}_ans_vs`);
        let ansVal = ansInput?.value || '';
        let timeVal = extraInput?.value || '';

        // Clean any attached prefixes just in case (e.g. 🔔, [CNV], [Bấm chuông], etc.)
        ansVal = ansVal.replace(/^[🔔\s]*(\[CNV\]|\[Bấm chuông\])?\s*/gi, '').trim();

        // In case time was embedded in ansVal (e.g. "jhfurhusrehf (09.51s)" or "(09.51)")
        const match = ansVal.match(/\(([\d\.]+)(?:s|giây)?\)/i);
        if (match) {
            if (!timeVal || timeVal === '00.00') {
                timeVal = match[1];
            }
            ansVal = ansVal.replace(/\(([\d\.]+)(?:s|giây)?\)/i, '').trim();
        }

        // Clean timeVal to remove any 's' or 'giây'
        timeVal = (timeVal || '00.00').toString().replace(/s|giây/gi, '').trim();
        const num = parseFloat(timeVal);
        if (!isNaN(num)) {
            timeVal = num < 10 ? '0' + num.toFixed(2) : num.toFixed(2);
        } else {
            timeVal = '00.00';
        }

        const rawBase = gameData.contestants?.[i - 1]?.name || document.getElementById(`ts${i}_name_vs`)?.value || `Thí sinh ${i}`;
        const baseName = rawBase.replace(/\s*\(\d+\)/g, '').replace(/\s*\([\d\.]+(?:s|giây|S)?\)/gi, '').trim();

        contestants.push({
            name: baseName,
            answer: ansVal,
            time: timeVal
        });
    }
    return contestants;
}

function onClickVSShowAnswers() {
    const btn = document.getElementById('btn_vs_show_answers');

    if (vsAnswerStep === 'counting') {
        return;
    }

    if (vsAnswerStep === 'idle') {
        if (vsAnswerCountdownInterval) {
            clearInterval(vsAnswerCountdownInterval);
            vsAnswerCountdownInterval = null;
        }
        vsAnswerStep = 'counting';

        // Switch projector immediately to empty/blank Answer scene
        const preparePayload = {
            type: 'VUOT_SONG_PREPARE_ANSWERS',
            round: 'VUOT_SONG',
            activeRound: 'VUOT_SONG',
            contestants: gameData.contestants,
            timestamp: Date.now()
        };
        sendToProjector('VUOT_SONG_PREPARE_ANSWERS', preparePayload);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(preparePayload);
        }

        let secLeft = 3;
        vsAnswerCountdownEndAt = Date.now() + 3000;
        if (btn) {
            btn.innerText = `${secLeft}s`;
            btn.style.background = '#f59e0b';
            btn.style.color = '#ffffff';
            btn.style.borderColor = '#d97706';
        }

        vsAnswerCountdownInterval = setInterval(() => {
            secLeft = Math.max(0, Math.ceil((vsAnswerCountdownEndAt - Date.now()) / 1000));
            if (secLeft > 0) {
                if (btn) btn.innerText = `${secLeft}s`;
            } else {
                clearInterval(vsAnswerCountdownInterval);
                vsAnswerCountdownInterval = null;
                vsAnswerCountdownEndAt = 0;
                vsAnswerStep = 'ready';
                if (btn) {
                    btn.innerText = 'Hiện';
                    btn.style.background = '#059669';
                    btn.style.color = '#ffffff';
                    btn.style.borderColor = '#047857';
                }
                if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
            }
        }, 250);

        if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
        showToast('Đang chuyển sang màn hình đáp án trống (3s)...');
        return;
    }

    if (vsAnswerStep === 'ready') {
        resetVSShowAnswersButton();
        const contestants = collectVSContestantAnswersPayload();
        const showPayload = {
            type: 'VUOT_SONG_SHOW_CONTESTANT_ANSWERS',
            round: 'VUOT_SONG',
            activeRound: 'VUOT_SONG',
            contestants: contestants,
            timestamp: Date.now()
        };
        sendToProjector('VUOT_SONG_SHOW_CONTESTANT_ANSWERS', showPayload);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(showPayload);
        }
        if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
        showToast('Đang phát graphic & đáp án thí sinh Vượt Chướng Ngại Vật');
    }
}

function updateVSBuzzerLabels() {
    if (!window.vsSubmissions) window.vsSubmissions = {};

    const submissions = Object.keys(window.vsSubmissions).map(idxStr => {
        const idx = parseInt(idxStr);
        const sub = window.vsSubmissions[idxStr];
        const timeVal = typeof sub === 'object' ? sub.time : sub;
        const numTime = typeof sub === 'object' ? (sub.numTime || parseFloat(timeVal) || 999) : (parseFloat(timeVal) || 999);
        const timestamp = (typeof sub === 'object' && sub.timestamp) ? sub.timestamp : 0;
        return { idx, timeVal, numTime, timestamp };
    });

    submissions.sort((a, b) => {
        if (Math.abs(a.numTime - b.numTime) > 0.001) {
            return a.numTime - b.numTime;
        }
        return a.timestamp - b.timestamp;
    });

    for (let i = 1; i <= 4; i++) {
        const nameInput = document.getElementById(`ts${i}_name_vs`);
        const rawBase = (typeof gameData !== 'undefined' && gameData.contestants?.[i - 1]?.name) || `Thí sinh ${i}`;
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
            if (nameInput) {
                // Tên thí sinh bấm sang màu đỏ sau đó là ngoặc đơn ghi thời gian bấm và ngoặc đơn nữa ghi thứ tự bấm chuông (nếu có nhiều người bấm cùng lúc)
                nameInput.value = `${baseName} (${timeStr}s)${rankSuffix}`;
                nameInput.style.color = '#dc2626';
                nameInput.style.fontWeight = 'bold';
            }
        } else {
            if (nameInput) {
                nameInput.value = baseName;
                nameInput.style.color = '#000000';
                nameInput.style.fontWeight = 'bold';
            }
        }
    }
}
window.updateVSBuzzerLabels = updateVSBuzzerLabels;

function markVSContestantSubmitted(tsIdx, timeStr) {
    if (!window.vsSubmissions) window.vsSubmissions = {};
    const idx = parseInt(tsIdx);
    if (isNaN(idx) || idx < 1 || idx > 4) return;

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

    if (!window.vsSubmissions[idx]) {
        window.vsSubmissions[idx] = {
            time: cleanTime,
            numTime: parseFloat(cleanTime) || 999,
            timestamp: Date.now()
        };
    }

    updateVSBuzzerLabels();

    const rawBase = (typeof gameData !== 'undefined' && gameData.contestants?.[idx - 1]?.name) || `Thí sinh ${idx}`;
    const cleanName = rawBase
        .replace(/\s*🔔.*$/gi, '')
        .replace(/\s*\(Thứ \d+.*?\)/gi, '')
        .replace(/\s*\([\d\.]+(?:s|giây|S)?\)/gi, '')
        .replace(/\s*\(\d+\)/g, '')
        .trim() || `Thí sinh ${idx}`;

    // Trigger full-screen orange flash on corresponding scoreboard & Projector buzzer ribbon
    const flashPayload = {
        type: 'S3_FLASH_SCOREBOARD',
        contestantId: idx,
        contestantName: cleanName,
        time: cleanTime,
        round: 'VUOT_SONG',
        timestamp: Date.now()
    };
    sendToProjector('S3_FLASH_SCOREBOARD', flashPayload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(flashPayload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
}
window.markVSContestantSubmitted = markVSContestantSubmitted;

function triggerVSBell(idx) {
    if (!window.vsRoundStartTime) {
        const savedTime = parseInt(localStorage.getItem('s3_round_start_time'));
        window.vsRoundStartTime = (savedTime && Date.now() - savedTime < 3600000) ? savedTime : Date.now();
    }
    let elapsed = (Date.now() - window.vsRoundStartTime) / 1000;
    let timeStr = elapsed < 10 ? '0' + elapsed.toFixed(2) : elapsed.toFixed(2);
    
    markVSContestantSubmitted(idx, timeStr);
}

function resetVSContestantBell(tsIdx) {
    if (tsIdx === 'ALL' || !tsIdx) {
        window.vsSubmissions = {};
        for (let i = 1; i <= 4; i++) {
            const ansInput = document.getElementById(`ts${i}_ans_vs`);
            if (ansInput && (ansInput.value === '[CNV] Bấm chuông' || ansInput.value.startsWith('[CNV]'))) {
                ansInput.value = '';
            }
        }
        if (typeof updateVSBuzzerLabels === 'function') {
            updateVSBuzzerLabels();
        } else {
            for (let i = 1; i <= 4; i++) {
                const nameInput = document.getElementById(`ts${i}_name_vs`);
                if (nameInput) {
                    const rawBase = gameData.contestants?.[i - 1]?.name || `Thí sinh ${i}`;
                    const baseName = rawBase.replace(/\s*\(\d+\)/g, '').replace(/\s*\([\d\.]+(?:s|giây|S)?\)/gi, '').trim();
                    nameInput.value = baseName;
                    nameInput.style.color = '#000';
                    nameInput.style.fontWeight = 'bold';
                }
            }
        }
        const payloadAll = {
            type: 'RESET_VS_BELL',
            contestantId: 'ALL',
            round: 'VS',
            activeRound: 'VUOT_SONG',
            timestamp: Date.now()
        };
        sendToProjector('RESET_VS_BELL', payloadAll);
        sendToProjector('VUOT_SONG_RESET_BELL', payloadAll);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(payloadAll);
            sendSupabaseAction({ ...payloadAll, type: 'VUOT_SONG_RESET_BELL' });
        }
        if (typeof showToast === 'function') showToast('Đã reset nút chuông cho tất cả thí sinh');
    } else {
        if (window.vsSubmissions) delete window.vsSubmissions[tsIdx];
        const ansInput = document.getElementById(`ts${tsIdx}_ans_vs`);
        if (ansInput && (ansInput.value === '[CNV] Bấm chuông' || ansInput.value.startsWith('[CNV]'))) {
            ansInput.value = '';
        }
        if (typeof updateVSBuzzerLabels === 'function') {
            updateVSBuzzerLabels();
        } else {
            const nameInput = document.getElementById(`ts${tsIdx}_name_vs`);
            if (nameInput) {
                const rawBase = gameData.contestants?.[tsIdx - 1]?.name || `Thí sinh ${tsIdx}`;
                const baseName = rawBase.replace(/\s*\(\d+\)/g, '').replace(/\s*\([\d\.]+(?:s|giây|S)?\)/gi, '').trim();
                nameInput.value = baseName;
                nameInput.style.color = '#000';
                nameInput.style.fontWeight = 'bold';
            }
        }
        const payloadSingle = {
            type: 'RESET_VS_BELL',
            contestantId: tsIdx,
            round: 'VS',
            activeRound: 'VUOT_SONG',
            timestamp: Date.now()
        };
        sendToProjector('RESET_VS_BELL', payloadSingle);
        sendToProjector('VUOT_SONG_RESET_BELL', payloadSingle);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(payloadSingle);
            sendSupabaseAction({ ...payloadSingle, type: 'VUOT_SONG_RESET_BELL' });
        }
        if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
        if (typeof showToast === 'function') showToast(`Đã reset nút chuông cho Thí sinh ${tsIdx}`);
    }
}

function onClickVSDatLai() {
    if (typeof resetVSShowAnswersButton === 'function') resetVSShowAnswersButton();
    resetVSContestantBell('ALL');
    window.vsLockedContestants = { 1: false, 2: false, 3: false, 4: false };
    syncVSLockButtonsUI();
    window.vsRoundStartTime = Date.now();
    try { localStorage.setItem('s3_round_start_time', window.vsRoundStartTime); } catch(e) {}
    vsRevealedKeyIndices = [];
    window.vsOpenedPieces = { 1: false, 2: false, 3: false, 4: false, 5: false };
    syncVSPieceButtonsUI();
    clearInterval(vsTimerInterval);
    vsTimerInterval = null;
    vsTimerEndAt = 0;
    vsTimeLeft = 15;
    const timerEl = document.getElementById('vs_preview_timer');
    if (timerEl) timerEl.innerText = "15";
    const statusEl = document.getElementById('vs_preview_status');
    if (statusEl) statusEl.innerText = "15";

    // Clear contestant inputs on controller
    for (let i = 1; i <= 5; i++) {
        const ansEl = document.getElementById(`ts${i}_ans_vs`);
        if (ansEl) ansEl.value = '';
        const extraEl = document.getElementById(`ts${i}_extra_vs`);
        if (extraEl) extraEl.value = '';
    }

    if (typeof syncContestantsUI === 'function') {
        syncContestantsUI();
    }

    currentVSRow = null;
    const buttons = document.querySelectorAll('#tab2-content .vs-row-btn');
    buttons.forEach((btn, idx) => {
        btn.style.background = idx === 4 ? '#38bdf8' : '#80bfff';
        btn.style.color = idx === 4 ? '#fff' : '#002060';
    });
    const titleEl = document.getElementById('vs_preview_title');
    const qTextEl = document.getElementById('vs_preview_q_text');
    const aTextEl = document.getElementById('vs_preview_a_text');
    if (titleEl) titleEl.innerText = "CHƯA CHỌN HÀNG NGANG";
    if (qTextEl) qTextEl.innerText = "Nội dung câu hỏi...";
    if (aTextEl) aTextEl.innerText = "Đáp án...";
    
    sendToProjector('VUOT_SONG_RESET', { round: 'VUOT_SONG', activeRound: 'VUOT_SONG', vsQuestionShown: false, vuotSong: gameData.vuotSong });
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction({
            type: 'VUOT_SONG_RESET',
            round: 'VUOT_SONG',
            activeRound: 'VUOT_SONG',
            vsQuestionShown: false,
            vuotSong: gameData.vuotSong,
            timestamp: Date.now()
        });
    }

    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast('Đã đặt lại vòng Vượt Chướng Ngại Vật');
}

function onClickVSScoreKeyword() {
    // List contestants with bell times if available
    let buzzedList = [];
    for (let i = 1; i <= 4; i++) {
        const rawName = gameData.contestants?.[i - 1]?.name || document.getElementById(`ts${i}_name_vs`)?.value || `Thí sinh ${i}`;
        const cleanName = rawName.replace(/\s*🔔.*$/gi, '').replace(/\s*\(Thứ \d+.*?\)/gi, '').replace(/\s*\([\d\.]+(?:s|giây|S)?\)/gi, '').trim();
        const sub = window.vsSubmissions?.[i];
        const bellTime = sub ? (typeof sub === 'object' ? sub.time : sub) : null;
        const ansVal = (document.getElementById(`ts${i}_ans_vs`)?.value || '').trim();
        buzzedList.push({
            idx: i,
            name: cleanName,
            bellTime: bellTime,
            ans: ansVal
        });
    }

    let defaultTs = "1";
    // If someone buzzed first, suggest them
    const buzzedOnly = buzzedList.filter(b => b.bellTime);
    buzzedOnly.sort((a, b) => (parseFloat(a.bellTime) || 999) - (parseFloat(b.bellTime) || 999));
    if (buzzedOnly.length > 0) {
        defaultTs = buzzedOnly[0].idx.toString();
    }

    let msg = `🎯 CHẤM ĐIỂM ĐÁP ÁN VÒNG THI VƯỢT CHƯỚNG NGẠI VẬT\n`;
    msg += `Thang điểm theo thời điểm trả lời: 50 - 40 - 30 - 20 - 10\n\n`;
    msg += `Danh sách thí sinh:\n`;
    buzzedList.forEach(b => {
        let rankStr = '';
        if (b.bellTime && buzzedOnly.length > 0) {
            const rank = buzzedOnly.findIndex(x => x.idx === b.idx) + 1;
            rankStr = ` (Thứ ${rank})`;
        }
        const bellInfo = b.bellTime ? `🔔 Chuông: ${b.bellTime}s${rankStr}` : `Chưa bấm chuông`;
        msg += `[TS ${b.idx}] ${b.name} (${bellInfo}) - Đáp án: "${b.ans}"\n`;
    });
    msg += `\nNhập số thứ tự Thí sinh trả lời đúng (1-4):`;

    const tsInput = prompt(msg, defaultTs);
    if (!tsInput) return;
    const tsIdx = parseInt(tsInput.trim());
    if (isNaN(tsIdx) || tsIdx < 1 || tsIdx > 4) {
        alert("Số thứ tự thí sinh không hợp lệ (phải từ 1 đến 4)!");
        return;
    }

    let timeMsg = `Chọn thời điểm trả lời cho [TS ${tsIdx}] (Thang điểm: 50, 40, 30, 20, 10):\n`;
    timeMsg += `1: +50 điểm (Thời điểm 1: Trước hoặc khi đang mở Hàng ngang 1)\n`;
    timeMsg += `2: +40 điểm (Thời điểm 2: Sau Hàng ngang 1 / Trước HN 2)\n`;
    timeMsg += `3: +30 điểm (Thời điểm 3: Sau Hàng ngang 2 / Trước HN 3)\n`;
    timeMsg += `4: +20 điểm (Thời điểm 4: Sau Hàng ngang 3 / Trước HN 4)\n`;
    timeMsg += `5: +10 điểm (Thời điểm 5: Sau Hàng ngang 4 / Ô trung tâm)\n\n`;
    timeMsg += `Nhập số 1-5 hoặc nhập trực tiếp số điểm (50, 40, 30, 20, 10):`;

    const timeChoice = prompt(timeMsg, "1");
    if (!timeChoice) return;

    let pts = 0;
    const cleanChoice = timeChoice.trim();
    if (cleanChoice === '1' || cleanChoice === '50') pts = 50;
    else if (cleanChoice === '2' || cleanChoice === '40') pts = 40;
    else if (cleanChoice === '3' || cleanChoice === '30') pts = 30;
    else if (cleanChoice === '4' || cleanChoice === '20') pts = 20;
    else if (cleanChoice === '5' || cleanChoice === '10') pts = 10;
    else {
        alert("Lựa chọn thời điểm không hợp lệ!");
        return;
    }

    if (typeof adjustScore === 'function') {
        adjustScore(tsIdx, pts);
    }
    if (typeof showToast === 'function') {
        showToast(`Đã cộng +${pts} điểm Đáp án vòng thi cho Thí sinh ${tsIdx}!`);
    }
}
window.onClickVSScoreKeyword = onClickVSScoreKeyword;

window.__controllerR3State = {
    getState: function() {
        const answers = {};
        const extras = {};
        for (let i = 1; i <= 5; i++) {
            const aEl = document.getElementById(`ts${i}_ans_vs`);
            const eEl = document.getElementById(`ts${i}_extra_vs`);
            if (aEl) answers[i] = aEl.value;
            if (eEl) extras[i] = eEl.value;
        }
        return {
            currentVSRow,
            vsOpenedPieces: window.vsOpenedPieces ? { ...window.vsOpenedPieces } : { 1: false, 2: false, 3: false, 4: false, 5: false },
            vsQuestionIsShown: !!window.vsQuestionIsShown,
            vsRoundStartTime: window.vsRoundStartTime || 0,
            vsSubmissions: window.vsSubmissions ? JSON.parse(JSON.stringify(window.vsSubmissions)) : {},
            vsLockedContestants: window.vsLockedContestants ? { ...window.vsLockedContestants } : { 1: false, 2: false, 3: false, 4: false },
            vsRevealedKeyIndices: Array.isArray(vsRevealedKeyIndices) ? vsRevealedKeyIndices.slice() : [],
            vsTimeLeft,
            vsTimerRunning: !!vsTimerInterval,
            vsTimerEndAt,
            vsAnswerStep,
            vsAnswerCountdownEndAt,
            answers,
            extras,
            previewTitle: document.getElementById('vs_preview_title')?.innerText || '',
            previewQ: document.getElementById('vs_preview_q_text')?.innerText || '',
            previewA: document.getElementById('vs_preview_a_text')?.innerText || '',
            previewStatus: document.getElementById('vs_preview_status')?.innerText || ''
        };
    },
    restoreState: function(st) {
        if (!st || typeof st !== 'object') return;
        clearInterval(vsTimerInterval);
        vsTimerInterval = null;
        if (vsAnswerCountdownInterval) {
            clearInterval(vsAnswerCountdownInterval);
            vsAnswerCountdownInterval = null;
        }

        currentVSRow = st.currentVSRow !== undefined ? st.currentVSRow : 1;
        window.vsOpenedPieces = (st.vsOpenedPieces && typeof st.vsOpenedPieces === 'object')
            ? { 1: !!st.vsOpenedPieces[1], 2: !!st.vsOpenedPieces[2], 3: !!st.vsOpenedPieces[3], 4: !!st.vsOpenedPieces[4], 5: !!st.vsOpenedPieces[5] }
            : { 1: false, 2: false, 3: false, 4: false, 5: false };
        window.vsQuestionIsShown = !!st.vsQuestionIsShown;
        if (st.vsRoundStartTime) window.vsRoundStartTime = Number(st.vsRoundStartTime) || 0;
        window.vsSubmissions = (st.vsSubmissions && typeof st.vsSubmissions === 'object') ? st.vsSubmissions : {};
        window.vsLockedContestants = (st.vsLockedContestants && typeof st.vsLockedContestants === 'object')
            ? { 1: !!st.vsLockedContestants[1], 2: !!st.vsLockedContestants[2], 3: !!st.vsLockedContestants[3], 4: !!st.vsLockedContestants[4] }
            : { 1: false, 2: false, 3: false, 4: false };
        vsRevealedKeyIndices = Array.isArray(st.vsRevealedKeyIndices) ? st.vsRevealedKeyIndices.slice() : [];

        const buttons = document.querySelectorAll('#tab2-content .vs-row-btn');
        buttons.forEach((btn, idx) => {
            if ((idx + 1 === currentVSRow) || (currentVSRow === 'center' && idx === 4)) {
                btn.style.background = '#0056b3';
                btn.style.color = '#fff';
            } else {
                btn.style.background = idx === 4 ? '#38bdf8' : '#80bfff';
                btn.style.color = idx === 4 ? '#fff' : '#002060';
            }
        });

        for (let i = 1; i <= 5; i++) {
            const aEl = document.getElementById(`ts${i}_ans_vs`);
            const eEl = document.getElementById(`ts${i}_extra_vs`);
            if (aEl && st.answers && st.answers[i] !== undefined) aEl.value = st.answers[i];
            if (eEl && st.extras && st.extras[i] !== undefined) eEl.value = st.extras[i];
        }

        syncVSPieceButtonsUI();
        updateVSBuzzerLabels();
        syncVSLockButtonsUI();

        const titleEl = document.getElementById('vs_preview_title');
        const qTextEl = document.getElementById('vs_preview_q_text');
        const aTextEl = document.getElementById('vs_preview_a_text');
        const statusEl = document.getElementById('vs_preview_status');
        const timerEl = document.getElementById('vs_preview_timer');
        if (titleEl && st.previewTitle) titleEl.innerText = st.previewTitle;
        if (qTextEl && st.previewQ) qTextEl.innerText = st.previewQ;
        if (aTextEl && st.previewA) aTextEl.innerText = st.previewA;

        vsTimerEndAt = Number(st.vsTimerEndAt) || 0;
        if (st.vsTimerRunning && vsTimerEndAt > Date.now()) {
            vsTimeLeft = Math.max(0, Math.ceil((vsTimerEndAt - Date.now()) / 1000));
            if (timerEl) timerEl.innerText = vsTimeLeft;
            if (statusEl) statusEl.innerText = vsTimeLeft;
            vsTimerInterval = setInterval(() => {
                vsTimeLeft = Math.max(0, Math.ceil((vsTimerEndAt - Date.now()) / 1000));
                if (timerEl) timerEl.innerText = vsTimeLeft;
                const sEl = document.getElementById('vs_preview_status');
                if (sEl) sEl.innerText = vsTimeLeft;
                if (vsTimeLeft <= 0) {
                    clearInterval(vsTimerInterval);
                    vsTimerInterval = null;
                    vsTimerEndAt = 0;
                }
            }, 250);
        } else if (st.vsTimerRunning && vsTimerEndAt > 0) {
            vsTimeLeft = 0;
            vsTimerEndAt = 0;
            if (timerEl) timerEl.innerText = '0';
            if (statusEl) statusEl.innerText = '0';
        } else {
            vsTimeLeft = (st.vsTimeLeft !== undefined) ? Number(st.vsTimeLeft) : 15;
            if (timerEl) timerEl.innerText = String(vsTimeLeft);
            if (statusEl) statusEl.innerText = st.previewStatus || String(vsTimeLeft);
        }

        vsAnswerStep = st.vsAnswerStep || 'idle';
        vsAnswerCountdownEndAt = Number(st.vsAnswerCountdownEndAt) || 0;
        const ansBtn = document.getElementById('btn_vs_show_answers');
        if (vsAnswerStep === 'counting' && vsAnswerCountdownEndAt > Date.now()) {
            let secLeft = Math.max(1, Math.ceil((vsAnswerCountdownEndAt - Date.now()) / 1000));
            if (ansBtn) {
                ansBtn.innerText = `${secLeft}s`;
                ansBtn.style.background = '#f59e0b';
                ansBtn.style.color = '#ffffff';
                ansBtn.style.borderColor = '#d97706';
            }
            vsAnswerCountdownInterval = setInterval(() => {
                secLeft = Math.max(0, Math.ceil((vsAnswerCountdownEndAt - Date.now()) / 1000));
                if (secLeft > 0) {
                    if (ansBtn) ansBtn.innerText = `${secLeft}s`;
                } else {
                    clearInterval(vsAnswerCountdownInterval);
                    vsAnswerCountdownInterval = null;
                    vsAnswerCountdownEndAt = 0;
                    vsAnswerStep = 'ready';
                    if (ansBtn) {
                        ansBtn.innerText = 'Hiện';
                        ansBtn.style.background = '#059669';
                        ansBtn.style.color = '#ffffff';
                        ansBtn.style.borderColor = '#047857';
                    }
                }
            }, 250);
        } else if (vsAnswerStep === 'ready' || (vsAnswerStep === 'counting' && vsAnswerCountdownEndAt > 0)) {
            vsAnswerStep = 'ready';
            vsAnswerCountdownEndAt = 0;
            if (ansBtn) {
                ansBtn.innerText = 'Hiện';
                ansBtn.style.background = '#059669';
                ansBtn.style.color = '#ffffff';
                ansBtn.style.borderColor = '#047857';
            }
        } else {
            resetVSShowAnswersButton();
        }
    }
};
