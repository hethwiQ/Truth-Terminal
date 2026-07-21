let cachedKey = null;

export async function hashText(text) {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function initCryptoKey(passphrase) {
    const saltBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase + "_salt"))).slice(0, 16);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    
    cachedKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
}

export function clearCryptoState() {
    cachedKey = null;
}

export async function encryptMessage(plaintext) {
    if (!cachedKey) throw new Error("Encryption key not initialized.");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, cachedKey, encoded);
    
    return {
        cipher: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
        iv: btoa(String.fromCharCode(...iv)),
        salt: "STATIC_V25" 
    };
}

export async function decryptMessage(cipherB64, ivB64, saltB64, fallbackPassphrase) {
    try {
        const ciphertext = new Uint8Array(atob(cipherB64).split("").map(c => c.charCodeAt(0)));
        const iv = new Uint8Array(atob(ivB64).split("").map(c => c.charCodeAt(0)));
        let keyToUse = cachedKey;
        
        if (saltB64 && saltB64 !== "STATIC_V25") {
            const saltBytes = new Uint8Array(atob(saltB64).split("").map(c => c.charCodeAt(0)));
            const enc = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(fallbackPassphrase), "PBKDF2", false, ["deriveKey"]);
            keyToUse = await crypto.subtle.deriveKey(
                { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" },
                keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
            );
        }

        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, keyToUse, ciphertext);
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        return "[UNAUTHORIZED: ENCRYPTED_LOG_GIBBERISH]";
    }
}