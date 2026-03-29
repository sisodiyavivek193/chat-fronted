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
    const conversationsRef = useRef([])
    // ✅ Sending ke waqt polling rok do — duplicate messages se bachao
    const isSendingRef = useRef(false)

    useEffect(() => { selectedChatRef.current = selectedChat }, [selectedChat])
    useEffect(() => { conversationsRef.current = conversations }, [conversations])

    const loadConversations = useCallback(async () => {
        try {
            const res = await api.get('/api/chat/conversations')
            const sorted = [...res.data.conversations].sort(
                (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
            )
            setConversations(sorted)
            conversationsRef.current = sorted
            return sorted
        } catch { return [] }
    }, [])

    const loadNotifications = useCallback(async () => {
        try {
            const res = await api.get('/api/friends/pending')
            setNotifications(res.data.requests)
        } catch { }
    }, [])

    // ✅ Messages load karo — deduplication ke saath
    const loadMessages = useCallback(async (otherUserId) => {
        if (!otherUserId || isSendingRef.current) return
        try {
            const res = await api.get(`/api/chat/messages/${otherUserId}`)
            setMessages(res.data.messages)
        } catch { }
    }, [])

    useEffect(() => {
        if (!user) return
        loadConversations()
        loadNotifications()
    }, [user])

    // ✅ Chatlist polling — har 3 sec
    useEffect(() => {
        if (!user) return
        const interval = setInterval(() => { loadConversations() }, 3000)
        return () => clearInterval(interval)
    }, [user, loadConversations])

    // ✅ Messages polling — har 2 sec SIRF jab chat open ho
    useEffect(() => {
        if (!user || !selectedChat?.user?._id) return
        const otherUserId = selectedChat.user._id

        // Pehle turant load karo
        loadMessages(otherUserId)

        // Phir har 2 sec pe
        const interval = setInterval(() => {
            loadMessages(otherUserId)
        }, 2000)

        return () => clearInterval(interval)
    }, [user, selectedChat?.user?._id, loadMessages])

    useEffect(() => {
        if (!user || !token) return

        const socket = connectSocket(token)
        if (!socket) return

        const handleNewMessage = ({ message, conversationId }) => {
            console.log('🔔 newMessage received:', conversationId)

            const current = selectedChatRef.current
            const convIdStr = conversationId?.toString()
            const isCurrentChat = current?.conversationId?.toString() === convIdStr

            if (isCurrentChat) {
                // Socket se instant update — polling ka wait mat karo
                setMessages((prev) => {
                    if (prev.find((m) => m._id === message._id)) return prev
                    const withoutTemp = prev.filter((m) => !m._id?.startsWith('temp_'))
                    return [...withoutTemp, message]
                })
            } else {
                setUnreadCounts((prev) => ({
                    ...prev,
                    [convIdStr]: (prev[convIdStr] || 0) + 1,
                }))
            }

            loadConversations()
        }

        socket.off('newMessage')
        socket.off('messageDeleted')
        socket.off('friendRequestReceived')
        socket.off('friendRequestAccepted')
        socket.off('userTyping')
        socket.off('userStoppedTyping')
        socket.off('userOnline')
        socket.off('userOffline')
        socket.off('connect')

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
        socket.on('friendRequestAccepted', () => { loadConversations() })
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
            setOnlineUsers((prev) => { const s = new Set(prev); s.delete(userId); return s })
        })
        socket.on('connect', () => {
            console.log('🔌 Socket reconnected')
            loadConversations()
        })

        return () => {
            socket.off('newMessage')
            socket.off('messageDeleted')
            socket.off('friendRequestReceived')
            socket.off('friendRequestAccepted')
            socket.off('userTyping')
            socket.off('userStoppedTyping')
            socket.off('userOnline')
            socket.off('userOffline')
            socket.off('connect')
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
        } catch { setMessages([]) }
    }

    // ✅ isSendingRef expose karo ChatWindow ke liye
    const setSending = (val) => { isSendingRef.current = val }

    const getLastMessagePreview = useCallback((conv) => {
        if (!conv.lastMessage) return 'Say hello! 👋'
        if (conv.lastMessage.isDeleted) return '🚫 This message was deleted'
        if (!conv.lastMessage.encryptedContent) return 'Say hello! 👋'
        if (user && conv.otherUser) {
            try {
                const decrypted = decrypt(conv.lastMessage.encryptedContent, user._id, conv.otherUser._id)
                if (decrypted && decrypted !== '[Could not decrypt]' && decrypted !== '[Encrypted message]') {
                    const isMe = conv.lastMessage.sender?._id === user._id || conv.lastMessage.sender === user._id
                    const prefix = isMe ? 'You: ' : `${conv.otherUser?.fullName?.split(' ')[0]}: `
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
            setSending,
        }}>
            {children}
        </ChatContext.Provider>
    )
}

export const useChat = () => useContext(ChatContext)