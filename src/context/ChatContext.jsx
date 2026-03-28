import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSocket } from '../utils/socket'
import { useAuth } from './AuthContext'
import api from '../utils/api'

const ChatContext = createContext(null)

export const ChatProvider = ({ children }) => {
    const { user } = useAuth()
    const [conversations, setConversations] = useState([])
    const [selectedChat, setSelectedChat] = useState(null) // { user, conversationId }
    const [messages, setMessages] = useState([])
    const [notifications, setNotifications] = useState([]) // friend requests
    const [typingUsers, setTypingUsers] = useState({}) // { userId: true/false }
    const [onlineUsers, setOnlineUsers] = useState(new Set())
    const [unreadCounts, setUnreadCounts] = useState({}) // { conversationId: count }

    // Load conversations
    const loadConversations = useCallback(async () => {
        try {
            const res = await api.get('/api/chat/conversations')
            setConversations(res.data.conversations)
        } catch { }
    }, [])

    // Load pending friend requests for notification bell
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

    // Socket listeners
    useEffect(() => {
        if (!user) return
        const socket = getSocket()
        if (!socket) return

        // New message received
        socket.on('newMessage', ({ message, conversationId }) => {
            setMessages((prev) => {
                if (prev[0]?.conversationId === conversationId || selectedChat?.conversationId === conversationId) {
                    return [...prev, message]
                }
                return prev
            })
            // Update unread count if not currently viewing this conversation
            setUnreadCounts((prev) => {
                const isViewing = selectedChat?.conversationId === conversationId
                if (isViewing) return prev
                return { ...prev, [conversationId]: (prev[conversationId] || 0) + 1 }
            })
            loadConversations()
        })

        // Message deleted
        socket.on('messageDeleted', ({ messageId }) => {
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === messageId ? { ...m, isDeleted: true, encryptedContent: 'This message was deleted' } : m
                )
            )
        })

        // Friend request received
        socket.on('friendRequestReceived', (data) => {
            setNotifications((prev) => [data, ...prev])
        })

        // Friend request accepted
        socket.on('friendRequestAccepted', () => {
            loadConversations()
        })

        // Typing
        socket.on('userTyping', ({ fromUserId }) => {
            setTypingUsers((prev) => ({ ...prev, [fromUserId]: true }))
        })
        socket.on('userStoppedTyping', ({ fromUserId }) => {
            setTypingUsers((prev) => ({ ...prev, [fromUserId]: false }))
        })

        // Online/offline
        socket.on('userOnline', ({ userId }) => {
            setOnlineUsers((prev) => new Set([...prev, userId]))
        })
        socket.on('userOffline', ({ userId }) => {
            setOnlineUsers((prev) => { const s = new Set(prev); s.delete(userId); return s })
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
    }, [user, selectedChat])

    const selectChat = async (chatUser, conversationId) => {
        setSelectedChat({ user: chatUser, conversationId })
        // Clear unread
        setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }))
        // Load messages
        try {
            const res = await api.get(`/api/chat/messages/${chatUser._id}`)
            setMessages(res.data.messages)
        } catch {
            setMessages([])
        }
    }

    return (
        <ChatContext.Provider value={{
            conversations, setConversations, loadConversations,
            selectedChat, setSelectedChat, selectChat,
            messages, setMessages,
            notifications, setNotifications, loadNotifications,
            typingUsers, onlineUsers,
            unreadCounts,
        }}>
            {children}
        </ChatContext.Provider>
    )
}

export const useChat = () => useContext(ChatContext)