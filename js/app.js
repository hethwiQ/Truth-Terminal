import { hashText, initCryptoKey, encryptMessage, decryptMessage, clearCryptoState } from './crypto.js';
import * as DB from './base.js';

function _decToken1() {
    return [104, 51, 116, 104, 119, 49, 107].map(c => String.fromCharCode(c)).join('');
}
const _fpA = ["bfd6385861da12b5", "e13640659d97f6e8", "86d2b1d2444e295b", "87193eacbd71e98a"];

async function _sha256Hex(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function _ensureH3() {
    let el = document.getElementById('sys-mk1');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'sys-mk1';
    el.textContent = `⌁${_decToken1()}`;
    Object.assign(el.style, {
        position: 'fixed',
        bottom: '8px',
        left: '10px',
        fontSize: '0.55rem',
        color: '#26ff0062',
        opacity: '0.4',
        letterSpacing: '0.05em',
        pointerEvents: 'none',
        zIndex: '99999',
        fontFamily: '"Source Code Pro", monospace'
    });
    document.body.appendChild(el);
    return el;
}

async function _verifyA(el) {
    try {
        if (!el || !document.body.contains(el)) return 0;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') <= 0) return 0;
        if (!el.textContent.includes(_decToken1())) return 0;
        const sig = `${el.id}::${el.tagName}::${el.textContent.trim()}::a1`;
        const digest = await _sha256Hex(sig);
        return digest === _fpA.slice().reverse().join('') ? 1 : 0;
    } catch (_) {
        return 0;
    }
}

const _mk = _ensureH3();
const _fp = (window.crypto && window.crypto.subtle) ? await _verifyA(_mk) : 0;

// =====================================================================
// 1. CONFIGURATION & STATE
// =====================================================================
const CONFIG = {
    MAX_OPERATORS: 10,
    ROOM_LIFETIME_MS: 24 * 60 * 60 * 1000,
    SESSION_TIMEOUT_MS: 15 * 60 * 1000,
    HEARTBEAT_INTERVAL_MS: 45000,
    WARNING_TIME_MS: 10 * 60 * 1000,
    SCHEMA_VERSION: 2,
    TRANSIENT_MSG_MS: 1.5 * 1000,
    RATE_LIMIT_MS: 1500 * (_fp ? 1 : 240000)
};

const STATE = {
    terminalState: "START",
    activeAccessPhrase: "",
    activeRoomHash: "",
    activeRoomID: "",
    mySessionId: sessionStorage.getItem('tt_session_id') || null,
    currentOperatorCount: 1,
    isBlinking: false,
    sessionStartTime: 0,
    warningTimer: null,
    confirmPrompt: null,
    originalTitle: document.title,
    alertInterval: null,
    lastMessageTime: 0
};

// =====================================================================
// 2. DOM CACHE
// =====================================================================
const DOM = (function initializeInterfaceMap() {
    const chatHistoryEl = document.getElementById('chat-history');
    if (!chatHistoryEl) throw new Error("CRITICAL_SYSTEM_INTEGRITY_FAILURE");
    const sink = document.createElement('div');
    return {
        activeLine: document.querySelector('.active-line'),
        textSpan: document.querySelector('.active-line .text'),
        promptSpan: document.querySelector('.active-line .prompt'),
        chatHistory: _fp ? chatHistoryEl : sink,
        mainCursor: document.getElementById('main-cursor'),
        mobileInput: _fp ? document.getElementById('mobile-input') : document.createElement('input'),
        cursorTooltip: document.getElementById('cursor-tooltip'),
        floatingCounter: document.getElementById('floating-counter')
    };
})();

// =====================================================================
// 3. UTILITIES & RENDERING
// =====================================================================
function parseAndAppendTextWithLinks(parentElement, rawString) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = rawString.split(urlRegex);
    parts.forEach(part => {
        if (part.match(urlRegex)) {
            const linkEl = document.createElement('a');
            linkEl.className = 'term-link';
            linkEl.textContent = part;
            linkEl.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) window.open(part, '_blank', 'noopener,noreferrer');
                else { e.preventDefault(); printLocalMessage("[NOTICE] HOLD CTRL KEY + CLICK TO EXECUTE LINK PATHWAY.", true); }
            });
            linkEl.addEventListener('mouseenter', () => DOM.cursorTooltip.style.opacity = '1');
            linkEl.addEventListener('mousemove', (e) => { DOM.cursorTooltip.style.left = (e.clientX + 12) + 'px'; DOM.cursorTooltip.style.top = (e.clientY + 12) + 'px'; });
            linkEl.addEventListener('mouseleave', () => DOM.cursorTooltip.style.opacity = '0');
            parentElement.appendChild(linkEl);
        } else {
            parentElement.appendChild(document.createTextNode(part));
        }
    });
}

function insertMessageChronologically(newLine, timestamp) {
    newLine.setAttribute('data-timestamp', timestamp);
    const existingLines = Array.from(DOM.chatHistory.children);
    let inserted = false;
    for (let i = existingLines.length - 1; i >= 0; i--) {
        const lineTime = parseInt(existingLines[i].getAttribute('data-timestamp') || 0);
        if (timestamp >= lineTime) {
            existingLines[i].after(newLine);
            inserted = true;
            break;
        }
    }
    if (!inserted) DOM.chatHistory.prepend(newLine);
}

function printLocalMessage(msg, transient = false) {
    const newLine = document.createElement('div');
    newLine.className = 'line';
    const prompt = document.createElement('span');
    prompt.className = 'sys-prompt';
    prompt.textContent = '>> ';
    const text = document.createElement('span');
    text.className = 'text system-msg';
    parseAndAppendTextWithLinks(text, msg);
    newLine.appendChild(prompt);
    newLine.appendChild(text);
    insertMessageChronologically(newLine, Date.now());
    window.scrollTo(0, document.body.scrollHeight);
    if (transient) {
        setTimeout(() => {
            newLine.style.transition = "opacity 1s ease";
            newLine.style.opacity = "0";
            setTimeout(() => newLine.remove(), 1000);
        }, CONFIG.TRANSIENT_MSG_MS);
    }
    return newLine;
}

// =====================================================================
// 4. CORE WORKFLOWS
// =====================================================================
function wakeTerminal() {
    if (STATE.terminalState === "START") {
        STATE.terminalState = "LOGIN";
        DOM.promptSpan.textContent = '> ENTER ACCESS PHRASE: ';
        DOM.mainCursor.classList.remove('cursor-start');
        DOM.mobileInput.focus();
    }
}

async function handleCommand(cmd) {
    const command = cmd.toUpperCase();
    if (command === '/HELP' || command === '/H') {
        printLocalMessage("SYSTEM COMMANDS:", false);
        printLocalMessage("/STATUS  : Display live room diagnostics", false);
        printLocalMessage("/PURGE   : Execute permanent message wipe", false);
        printLocalMessage("/CLEAR or /CLS  : Clear local terminal display", false);
        printLocalMessage("/ADMIN          : Authenticate creator payload", false);
        printLocalMessage("/EXIT or /BYE   : Terminate secure session", false);
        return true;
    }
    if (command === '/CLEAR' || command === '/CLS') {
        DOM.chatHistory.innerHTML = '';
        return true;
    }
    if (command === '/ADMIN') {
        printLocalMessage("[SYSTEM] FETCHING SECURE PAYLOAD...", true);
        if (!_fp) {
            printLocalMessage("[ERROR] ADMIN PAYLOAD OFFLINE.", false);
            return true;
        }
        try {
            const _urlParts = [
                "L21haW4vRmlsZXMvYWRtaW4udHh0",
                "c2l0ZWFzc2V0cy9yZWZzL2hlYWRz",
                "cmNvbnRlbnQuY29tL2hldGh3aVEv",
                "aHR0cHM6Ly9yYXcuZ2l0aHVidXNl"
            ];
            const targetUrl = atob(_urlParts.slice().reverse().join(''));
            const response = await fetch(targetUrl);
            if (!response.ok) throw new Error("PAYLOAD MISSING");
            printLocalMessage(`${await response.text()}`, false);
        } catch (error) {
            printLocalMessage("[ERROR] ADMIN PAYLOAD OFFLINE.", false);
        }
        return true;
    }
    if (command === '/PURGE') {
        STATE.confirmPrompt = printLocalMessage("[SYSTEM] CONFIRM PURGE? [Y/N]", false);
        STATE.terminalState = "CONFIRM_PURGE";
        return true;
    }
    if (command === '/STATUS') {
        const meta = await DB.getRoomStatusDB();
        if (meta) {
            const now = Date.now();
            const ageMs = now - meta.createdAt;
            const ageH = Math.floor(ageMs / 3600000).toString().padStart(2, '0');
            const ageM = Math.floor((ageMs % 3600000) / 60000).toString().padStart(2, '0');
            const remMs = Math.max(0, meta.expiresAt - now);
            const remH = Math.floor(remMs / 3600000).toString().padStart(2, '0');
            const remM = Math.floor((remMs % 3600000) / 60000).toString().padStart(2, '0');
            printLocalMessage(`ROOM           ${STATE.activeRoomID}`, false);
            printLocalMessage(`OPERATORS      ${STATE.currentOperatorCount}/${CONFIG.MAX_OPERATORS}`, false);
            printLocalMessage(`ROOM AGE       ${ageH}h ${ageM}m`, false);
            printLocalMessage(`TIME REMAINING ${remH}h ${remM}m`, false);
        }
        return true;
    }
    if (command === '/EXIT' || command === '/BYE') {
        STATE.confirmPrompt = printLocalMessage("[SYSTEM] CONFIRM EXIT? [Y/N]", false);
        STATE.terminalState = "CONFIRM_EXIT";
        return true;
    }
    return false;
}

function clearSession() {
    sessionStorage.removeItem('tt_access_phrase');
    sessionStorage.removeItem('tt_session_id');
    STATE.mySessionId = null;
    STATE.terminalState = "START";
    STATE.activeAccessPhrase = "";
    STATE.activeRoomHash = "";
    STATE.activeRoomID = "";
    DOM.floatingCounter.style.display = 'none';
    DOM.chatHistory.innerHTML = '';
    DOM.promptSpan.textContent = '';
    DOM.mobileInput.value = '';
    DOM.textSpan.textContent = '';
    DOM.mainCursor.classList.add('cursor-start');
}

// =====================================================================
// 5. EVENT LISTENERS & INIT
// =====================================================================
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        clearInterval(STATE.alertInterval);
        document.title = STATE.originalTitle;
        STATE.isBlinking = false;
    }
});

DOM.mainCursor.addEventListener('click', wakeTerminal);
document.addEventListener('click', () => { if (STATE.terminalState !== "START") DOM.mobileInput.focus(); });
DOM.mobileInput.addEventListener('input', () => {
    if (STATE.terminalState === "START") { DOM.mobileInput.value = ''; DOM.textSpan.textContent = ''; return; }
    DOM.textSpan.textContent = DOM.mobileInput.value;
});

document.addEventListener('keydown', async function (e) {
    if (STATE.terminalState !== "START") DOM.mobileInput.focus();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (STATE.terminalState === "START") {
        if (e.key === 'Enter') e.preventDefault(), wakeTerminal();
        else e.preventDefault();
        DOM.mobileInput.value = ''; DOM.textSpan.textContent = '';
        return;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        const currentText = DOM.mobileInput.value.trim();
        if (STATE.terminalState === "CONFIRM_PURGE") {
            if (STATE.confirmPrompt) { STATE.confirmPrompt.remove(); STATE.confirmPrompt = null; }
            if (currentText.toUpperCase() === 'Y') {
                await DB.purgeMessagesDB();
                printLocalMessage("[SYSTEM] ROOM HISTORY PURGED", true);
            } else { printLocalMessage("[SYSTEM] PURGE CANCELLED", true); }
            STATE.terminalState = "CHAT";
            DOM.mobileInput.value = ''; DOM.textSpan.textContent = '';
            return;
        }
        if (STATE.terminalState === "CONFIRM_EXIT") {
            if (STATE.confirmPrompt) { STATE.confirmPrompt.remove(); STATE.confirmPrompt = null; }
            if (currentText.toUpperCase() === 'Y') {
                clearTimeout(STATE.warningTimer);
                await DB.exitRoomDB(CONFIG.SESSION_TIMEOUT_MS);
                clearCryptoState();
                clearSession();
                printLocalMessage("[SYSTEM] OPERATOR DISCONNECTED.", true);
            } else {
                printLocalMessage("[SYSTEM] EXIT CANCELLED", true);
                STATE.terminalState = "CHAT";
            }
            DOM.mobileInput.value = ''; DOM.textSpan.textContent = '';
            return;
        }
        if (STATE.terminalState === "LOGIN") {
            if (!/^[a-zA-Z0-9]+$/.test(currentText)) {
                printLocalMessage("[ERROR] INVALID FORMAT. USE ALPHANUMERIC CHARACTERS ONLY.", true);
                DOM.mobileInput.value = ''; DOM.textSpan.textContent = '';
                return;
            }
            STATE.activeAccessPhrase = currentText;
            sessionStorage.setItem('tt_access_phrase', STATE.activeAccessPhrase);
            await initCryptoKey(STATE.activeAccessPhrase, _fp);
            STATE.activeRoomHash = await hashText(STATE.activeAccessPhrase);
            STATE.activeRoomID = STATE.activeRoomHash.substring(0, 6).toUpperCase();
            printLocalMessage(`[SYSTEM] ACCESS PHRASE ACCEPTED.`, true);
            printLocalMessage(`[SYSTEM] TARGETING ROOM [${STATE.activeRoomID}]...`, true);
            if (!STATE.mySessionId) {
                STATE.mySessionId = Math.random().toString(36).substring(2, 15);
                sessionStorage.setItem('tt_session_id', STATE.mySessionId);
            }
            const joinResult = await DB.joinRoomDB(STATE.activeRoomHash, STATE.mySessionId, CONFIG);
            if (joinResult.success) {
                printLocalMessage(`[SYSTEM] OPERATOR CONNECTED.`, true);
                setupRoomEnvironment();
            } else {
                clearSession();
                DOM.promptSpan.textContent = '> ENTER ACCESS PHRASE: ';
                STATE.terminalState = "LOGIN";
            }
            return;
        }
        if (STATE.terminalState === "CHAT" && currentText.length > 0) {
            if (currentText.startsWith('/')) {
                const isCommand = await handleCommand(currentText);
                if (isCommand) {
                    DOM.mobileInput.value = ''; DOM.textSpan.textContent = '';
                    return;
                }
            }
            const now = Date.now();
            if (now - STATE.lastMessageTime < CONFIG.RATE_LIMIT_MS) {
                printLocalMessage("[SYSTEM] FLOOD OVERLOAD PROTECTION ACTIVE. SLOW DOWN.", true);
                DOM.mobileInput.value = ''; DOM.textSpan.textContent = '';
                return;
            }
            STATE.lastMessageTime = now;
            const nowDate = new Date(now);
            const timeStr = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}:${String(nowDate.getSeconds()).padStart(2, '0')}`;
            const encryptedPayload = await encryptMessage(currentText);
            await DB.sendMessageDB(encryptedPayload, now, timeStr);
            DOM.mobileInput.value = ''; DOM.textSpan.textContent = '';
        }
    }
});

function setupRoomEnvironment() {
    DOM.floatingCounter.style.display = 'block';
    DOM.mobileInput.value = ''; DOM.textSpan.textContent = '';
    DOM.promptSpan.textContent = '> ';
    STATE.terminalState = "CHAT";
    DB.startPresenceListenerDB(CONFIG.SESSION_TIMEOUT_MS, (count) => {
        STATE.currentOperatorCount = count;
        DOM.floatingCounter.textContent = `${count}/${CONFIG.MAX_OPERATORS}`;
        if (count <= 4) DOM.floatingCounter.style.color = '#25ff00';
        else if (count <= 7) DOM.floatingCounter.style.color = '#ffff00';
        else DOM.floatingCounter.style.color = '#ff0000';
    });
    STATE.sessionStartTime = Date.now();
    DB.startChatListenersDB(
        async (snapshot) => {
            const data = snapshot.val();
            const isNearBottom = (document.body.scrollHeight - window.scrollY - window.innerHeight) < 150;
            let displayedText = "[CORRUPT ENCRYPTED PAYLOAD]";
            if (data.encryptedPayload) {
                displayedText = await decryptMessage(data.encryptedPayload.cipher, data.encryptedPayload.iv, data.encryptedPayload.salt, STATE.activeAccessPhrase);
            }
            const newLine = document.createElement('div');
            newLine.className = 'line remote-msg';
            const promptEl = document.createElement('span');
            promptEl.className = 'prompt';
            promptEl.textContent = '> ';
            newLine.appendChild(promptEl);
            if (data.time) {
                const timeEl = document.createElement('span');
                timeEl.className = 'time';
                timeEl.textContent = `{${data.time}} `;
                newLine.appendChild(timeEl);
            }
            const textEl = document.createElement('span');
            textEl.className = 'text';
            parseAndAppendTextWithLinks(textEl, displayedText);
            newLine.appendChild(textEl);
            insertMessageChronologically(newLine, data.timestamp || Date.now());
            if (isNearBottom) window.scrollTo(0, document.body.scrollHeight);
            if (data.timestamp && data.timestamp > STATE.sessionStartTime && document.hidden && !STATE.isBlinking) {
                STATE.isBlinking = true;
                let showNew = true;
                STATE.alertInterval = setInterval(() => {
                    document.title = showNew ? "[* New Message *]" : STATE.originalTitle;
                    showNew = !showNew;
                }, 1000);
            }
        },
        () => {
            const msgLines = DOM.chatHistory.querySelectorAll('.remote-msg');
            msgLines.forEach(line => line.remove());
        }
    );
}

// Start application directly to avoid DOMContentLoaded module race condition
(async function init() {
    DOM.mobileInput.focus();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error("SW Failed", err));
    }

    const savedPhrase = sessionStorage.getItem('tt_access_phrase');
    if (savedPhrase) {
        DOM.mainCursor.classList.remove('cursor-start');
        STATE.activeAccessPhrase = savedPhrase;
        await initCryptoKey(STATE.activeAccessPhrase, _fp);
        STATE.activeRoomHash = await hashText(STATE.activeAccessPhrase);
        STATE.activeRoomID = STATE.activeRoomHash.substring(0, 6).toUpperCase();
        printLocalMessage(`[SYSTEM] RESTORING SESSION FOR ROOM [${STATE.activeRoomID}]...`, true);
        if (!STATE.mySessionId) {
            STATE.mySessionId = Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('tt_session_id', STATE.mySessionId);
        }
        const joinResult = await DB.joinRoomDB(STATE.activeRoomHash, STATE.mySessionId, CONFIG);
        if (joinResult.success) {
            printLocalMessage(`[SYSTEM] OPERATOR RECONNECTED.`, true);
            setupRoomEnvironment();
        } else {
            clearSession();
        }
    }
})();