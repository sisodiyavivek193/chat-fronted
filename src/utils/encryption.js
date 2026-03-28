import CryptoJS from 'crypto-js'

// In production, use proper asymmetric key exchange (e.g. Diffie-Hellman / Signal Protocol)
// For now: AES with a shared secret derived from both user IDs
const deriveKey = (userId1, userId2) => {
    const sorted = [userId1, userId2].sort().join('_')
    return CryptoJS.SHA256(sorted).toString()
}

export const encrypt = (message, userId1, userId2) => {
    const key = deriveKey(userId1, userId2)
    return CryptoJS.AES.encrypt(message, key).toString()
}

export const decrypt = (encryptedMessage, userId1, userId2) => {
    try {
        const key = deriveKey(userId1, userId2)
        const bytes = CryptoJS.AES.decrypt(encryptedMessage, key)
        return bytes.toString(CryptoJS.enc.Utf8) || '[Encrypted message]'
    } catch {
        return '[Could not decrypt]'
    }
}