import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getSocket, connectSocket } from '../utils/socket'
import { useAuth } from './AuthContext'
import { decrypt } from '../utils/encryption'
import api from '../utils/api'

const ChatContext = createContext(null)

export const ChatProvider = ({ children }) => {
    const { user, token } = useAuth()
    const [conversations, setConversations] = useState([])
    const [selectedChat, setSelectedChat] = useState(null)
    const [messages, setMessages] = useState([])
    const [notifications, setNotifications] = useState([])
    const [typingUsers, setTypingUsers] = useState({})
    const [onlineUsers, setOnlineUsers] = useState(new Set())
    const [unreadCounts, setUnreadCounts] = useState({})

    const selectedChatRef = useRef(null)
    useEffect(() => {
        selectedChatRef.current = selectedChat
    }, [selectedChat])

    const loadConversations = useCallback(async () => {
        try {
            const res = await api.get('/api/chat/conversations')
            const sorted = [...res.data.conversations].sort(
                (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
            )
            setConversations(sorted)
        } catch { }
    }, [])

    const loadNotifications = useCallback(async () => {
        try {
            const res = await api.get('/api/friends/pending')
            setNotifications(res.data.requests)
        } catch { }
    }, [])

    useEffect(() => {
        if (!user) return
        loadConversations()
        loadNotifications()
    }, [user])

    // ─── Socket Effect — reliably attach karo ───
    useEffect(() => {
        if (!user || !token) return

        // Socket already connected ho sakta hai ya nahi bhi
        // Ensure connection + attach listeners
        const attachListeners = (socket) => {
            const handleNewMessage = ({ message, conversationId }) => {
                console.log('🔔 newMessage received:', conversationId)

                const current = selectedChatRef.current
                const convIdStr = conversationId?.toString()
                const isCurrentChat = current?.conversationId?.toString() === convIdStr

                // ─── Messages update (agar chat open hai) ───
                if (isCurrentChat) {
                    setMessages((prev) => {
                        if (prev.find((m) => m._id === message._id)) return prev
                        const withoutTemp = prev.filter((m) => !m._id?.startsWith('temp_'))
                        return [...withoutTemp, message]
                    })
                } else {
                    // ─── Unread count ───
                    setUnreadCounts((prev) => ({
                        ...prev,
                        [convIdStr]: (prev[convIdStr] || 0) + 1,
                    }))
                }

                // ─── Conversation list TOP PE LAO — sender + receiver dono ───
                setConversations((prev) => {
                    const existingIndex = prev.findIndex((c) => c._id?.toString() === convIdStr)

                    if (existingIndex === -1) {
                        // Nahi mili — fresh load
                        loadConversations()
                        return prev
                    }

                    const updated = [...prev]
                    const conv = { ...updated[existingIndex] }
                    conv.lastMessage = message
                    conv.lastMessageAt = message.createdAt || new Date().toISOString()
                    updated.splice(existingIndex, 1)
                    updated.unshift(conv)
                    return updated
                })
            }

            // ─── Pehle purane listeners hata do (duplicate se bachne ke liye) ───
            socket.off('newMessage')
            socket.off('messageDeleted')
            socket.off('friendRequestReceived')
            socket.off('friendRequestAccepted')
            socket.off('userTyping')
            socket.off('userStoppedTyping')
            socket.off('userOnline')
            socket.off('userOffline')

            // ─── Ab fresh attach karo ───
            socket.on('newMessage', handleNewMessage)

            socket.on('messageDeleted', ({ messageId }) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m._id === messageId
                            ? { ...m, isDeleted: true, encryptedContent: 'This message was deleted' }
                            : m
                    )
                )
                loadConversations()
            })

            socket.on('friendRequestReceived', (data) => {
                setNotifications((prev) => [data, ...prev])
            })

            socket.on('friendRequestAccepted', () => {
                loadConversations()
            })

            socket.on('userTyping', ({ fromUserId }) => {
                setTypingUsers((prev) => ({ ...prev, [fromUserId]: true }))
            })
            socket.on('userStoppedTyping', ({ fromUserId }) => {
                setTypingUsers((prev) => ({ ...prev, [fromUserId]: false }))
            })
            socket.on('userOnline', ({ userId }) => {
                setOnlineUsers((prev) => new Set([...prev, userId]))
            })
            socket.on('userOffline', ({ userId }) => {
                setOnlineUsers((prev) => {
                    const s = new Set(prev)
                    s.delete(userId)
                    return s
                })
            })
        }

        // Socket mil gaya toh seedha attach, warna connect event ka wait karo
        const socket = connectSocket(token)
        if (!socket) return

        if (socket.connected) {
            // Already connected — seedha attach karo
            attachListeners(socket)
        } else {
            // Wait karo connect hone ka, phir attach karo
            socket.once('connect', () => {
                attachListeners(socket)
            })
            // Agar already connecting hai toh bhi try karo
            attachListeners(socket)
        }

        return () => {
            const s = getSocket()
            if (s) {
                s.off('newMessage')
                s.off('messageDeleted')
                s.off('friendRequestReceived')
                s.off('friendRequestAccepted')
                s.off('userTyping')
                s.off('userStoppedTyping')
                s.off('userOnline')
                s.off('userOffline')
            }
        }
    }, [user, token, loadConversations])

    const selectChat = async (chatUser, conversationId) => {
        setMessages([])
        setSelectedChat({ user: chatUser, conversationId })
        if (conversationId) {
            setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }))
        }
        try {
            const res = await api.get(`/api/chat/messages/${chatUser._id}`)
            setMessages(res.data.messages)
        } catch {
            setMessages([])
        }
    }

    const getLastMessagePreview = useCallback((conv) => {
        if (!conv.lastMessage) return 'Say hello! 👋'
        if (conv.lastMessage.isDeleted) return '🚫 This message was deleted'
        if (!conv.lastMessage.encryptedContent) return 'Say hello! 👋'

        if (user && conv.otherUser) {
            try {
                const decrypted = decrypt(
                    conv.lastMessage.encryptedContent,
                    user._id,
                    conv.otherUser._id
                )
                if (decrypted && decrypted !== '[Could not decrypt]' && decrypted !== '[Encrypted message]') {
                    const isMe =
                        conv.lastMessage.sender?._id === user._id ||
                        conv.lastMessage.sender === user._id
                    const prefix = isMe
                        ? 'You: '
                        : `${conv.otherUser?.fullName?.split(' ')[0]}: `
                    return prefix + decrypted
                }
            } catch { }
        }
        return '🔒 Encrypted message'
    }, [user])

    return (
        <ChatContext.Provider value={{
            conversations, setConversations, loadConversations,
            selectedChat, setSelectedChat, selectChat,
            messages, setMessages,
            notifications, setNotifications, loadNotifications,
            typingUsers, onlineUsers,
            unreadCounts,
            getLastMessagePreview,
        }}>
            {children}
        </ChatContext.Provider>
    )
}

export const useChat = () => useContext(ChatContext)
