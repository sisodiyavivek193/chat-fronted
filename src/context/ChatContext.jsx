import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { getSocket } from '../utils/socket'
import { useAuth } from './AuthContext'
import { decrypt } from '../utils/encryption'
import api from '../utils/api'

const ChatContext = createContext(null)

export const ChatProvider = ({ children }) => {
    const { user } = useAuth()
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
            setConversations(res.data.conversations)
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

    useEffect(() => {
        if (!user) return
        const socket = getSocket()
        if (!socket) return

        socket.on('newMessage', ({ message, conversationId }) => {
            const current = selectedChatRef.current
            if (current?.conversationId === conversationId) {
                setMessages((prev) => {
                    if (prev.find(m => m._id === message._id)) return prev
                    return [...prev, message]
                })
            } else {
                setUnreadCounts((prev) => ({
                    ...prev,
                    [conversationId]: (prev[conversationId] || 0) + 1
                }))
            }
            loadConversations()
        })

        socket.on('messageDeleted', ({ messageId }) => {
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === messageId
                        ? { ...m, isDeleted: true, encryptedContent: 'This message was deleted' }
                        : m
                )
            )
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

        return () => {
            socket.off('newMessage')
            socket.off('messageDeleted')
            socket.off('friendRequestReceived')
            socket.off('friendRequestAccepted')
            socket.off('userTyping')
            socket.off('userStoppedTyping')
            socket.off('userOnline')
            socket.off('userOffline')
        }
    }, [user])

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
                    return decrypted
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