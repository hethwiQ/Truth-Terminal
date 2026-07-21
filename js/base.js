import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, remove, onValue, get, set, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAaTjcne7xS1vjS7Tr14WfmWQmZSPhZ_lA",
    authDomain: "truth-terminal.firebaseapp.com",
    databaseURL: "https://truth-terminal-default-rtdb.firebaseio.com",
    projectId: "truth-terminal"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

let refs = { room: null, metadata: null, sessions: null, messages: null, mySession: null };
let heartbeatTimer = null;
let unsubCallbacks = { childAdded: null, value: null, presence: null };

export async function joinRoomDB(roomHash, sessionId, config) {
    refs.room = ref(db, `rooms/${roomHash}`);
    refs.metadata = ref(db, `rooms/${roomHash}/metadata`);
    refs.sessions = ref(db, `rooms/${roomHash}/sessions`);
    refs.messages = ref(db, `rooms/${roomHash}/messages`);
    refs.mySession = ref(db, `rooms/${roomHash}/sessions/${sessionId}`);

    const metaSnap = await get(refs.metadata);
    const now = Date.now();
    let roomExpiresAt = 0;

    if (!metaSnap.exists() || (metaSnap.exists() && now >= metaSnap.val().expiresAt)) {
        if (metaSnap.exists()) await remove(refs.room);
        roomExpiresAt = now + config.ROOM_LIFETIME_MS;
        await set(refs.metadata, { createdAt: now, expiresAt: roomExpiresAt, schemaVersion: config.SCHEMA_VERSION });
    } else {
        roomExpiresAt = metaSnap.val().expiresAt;
    }

    const sessSnap = await get(refs.sessions);
    if (sessSnap.exists()) {
        const sessions = sessSnap.val();
        let activeCount = 0;
        for (const [sId, sData] of Object.entries(sessions)) {
            if (now - sData.lastSeen > config.SESSION_TIMEOUT_MS) remove(ref(db, `rooms/${roomHash}/sessions/${sId}`));
            else activeCount++;
        }
        if (!sessionStorage.getItem('tt_session_id') && activeCount >= config.MAX_OPERATORS) {
            return { success: false, reason: "FULL" };
        }
    }

    await set(refs.mySession, { lastSeen: now });
    onDisconnect(refs.mySession).remove();

    heartbeatTimer = setInterval(() => { set(refs.mySession, { lastSeen: Date.now() }); }, config.HEARTBEAT_INTERVAL_MS);
    return { success: true, expiresAt: roomExpiresAt };
}

export function startPresenceListenerDB(timeoutMs, callback) {
    if (unsubCallbacks.presence) unsubCallbacks.presence();
    unsubCallbacks.presence = onValue(refs.sessions, (snap) => {
        if (!snap.exists()) return;
        let count = 0;
        const now = Date.now();
        for (const sData of Object.values(snap.val())) {
            if (now - sData.lastSeen <= timeoutMs) count++;
        }
        callback(count);
    });
}

export function startChatListenersDB(onChildAddedCallback, onPurgeCallback) {
    if (unsubCallbacks.childAdded) unsubCallbacks.childAdded();
    if (unsubCallbacks.value) unsubCallbacks.value();

    unsubCallbacks.value = onValue(refs.messages, (snapshot) => {
        if (!snapshot.exists()) onPurgeCallback();
    });
    unsubCallbacks.childAdded = onChildAdded(refs.messages, onChildAddedCallback);
}

export async function sendMessageDB(payload, timestamp, timeString) {
    await push(refs.messages, { encryptedPayload: payload, time: timeString, timestamp: timestamp });
}

export async function purgeMessagesDB() {
    await remove(refs.messages);
}

export async function getRoomStatusDB() {
    const snap = await get(refs.metadata);
    return snap.exists() ? snap.val() : null;
}

export async function exitRoomDB(timeoutMs) {
    clearInterval(heartbeatTimer);
    if (unsubCallbacks.childAdded) { unsubCallbacks.childAdded(); unsubCallbacks.childAdded = null; }
    if (unsubCallbacks.value) { unsubCallbacks.value(); unsubCallbacks.value = null; }
    if (unsubCallbacks.presence) { unsubCallbacks.presence(); unsubCallbacks.presence = null; }

    await remove(refs.mySession);

    const sessSnap = await get(refs.sessions);
    const msgSnap = await get(refs.messages);
    let activeCount = 0;
    
    if (sessSnap.exists()) {
        const now = Date.now();
        for (const sData of Object.values(sessSnap.val())) {
            if (now - sData.lastSeen <= timeoutMs) activeCount++;
        }
    }
    
    if (activeCount === 0 && !msgSnap.exists()) {
        await remove(refs.room);
    }
}