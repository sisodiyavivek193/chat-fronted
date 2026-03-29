import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { connectSocket } from '../utils/socket'
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

    // Sync ref with state for socket listeners
    useEffect(() => {
        selectedChatRef.current = selectedChat
    }, [selectedChat])

    const loadConversations = useCallback(async () => {
        if (!token) return
        try {
            const res = await api.get('/api/chat/conversations')
            const sorted = [...res.data.conversations].sort(
                (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
            )
            setConversations(sorted)
        } catch (err) {
            console.error("Error loading conversations:", err)
        }
    }, [token])

    const loadNotifications = useCallback(async () => {
        if (!token) return
        try {
            const res = await api.get('/api/friends/pending')
            setNotifications(res.data.requests)
        } catch (err) { }
    }, [token])

    // Initial Load
    useEffect(() => {
        if (user && token) {
            loadConversations()
            loadNotifications()
        }
    }, [user, token, loadConversations, loadNotifications])

    useEffect(() => {
        if (!user || !token) return

        const socket = connectSocket(token)
        if (!socket) return

        const handleNewMessage = ({ message, conversationId }) => {
            // Robust ID extraction
            const msgConvId = (conversationId?._id || conversationId || message.conversationId?._id || message.conversationId)?.toString()

            console.log('🔔 New Message for Conv:', msgConvId)

            const current = selectedChatRef.current
            const isCurrentChat = current?.conversationId?.toString() === msgConvId

            // 1. Update Messages if Chat is Open
            if (isCurrentChat) {
                setMessages((prev) => {
                    if (prev.find((m) => m._id === message._id)) return prev
                    const withoutTemp = prev.filter((m) => !m._id?.startsWith('temp_'))
                    return [...withoutTemp, message]
                })
            } else {
                // Update Unread Count
                setUnreadCounts((prev) => ({
                    ...prev,
                    [msgConvId]: (prev[msgConvId] || 0) + 1,
                }))
            }

            // 2. Update Conversation List (Move to TOP)
            setConversations((prev) => {
                const updatedList = [...prev]
                const index = updatedList.findIndex((c) => c._id?.toString() === msgConvId)

                if (index !== -1) {
                    // Purana item nikaalo aur update karo
                    const convToUpdate = { ...updatedList[index] }
                    convToUpdate.lastMessage = message
                    convToUpdate.lastMessageAt = message.createdAt || new Date().toISOString()

                    // Remove from old position and push to start
                    updatedList.splice(index, 1)
                    updatedList.unshift(convToUpdate)
                    return updatedList
                } else {
                    // Agar list mein nahi hai (Naya match/chat), toh API call karo refresh ke liye
                    loadConversations()
                    return prev
                }
            })
        }

        // Cleanup and Attach Listeners
        const events = [
            'newMessage', 'messageDeleted', 'friendRequestReceived',
            'friendRequestAccepted', 'userTyping', 'userStoppedTyping',
            'userOnline', 'userOffline', 'connect'
        ]
        events.forEach(ev => socket.off(ev))

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

        socket.on('connect', () => {
            console.log('🔌 Socket connected')
            loadConversations()
        })

        return () => {
            events.forEach(ev => socket.off(ev))
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

        const content = conv.lastMessage.encryptedContent
        if (!content) return 'Say hello! 👋'

        if (user && conv.otherUser) {
            try {
                const decrypted = decrypt(content, user._id, conv.otherUser._id)
                if (decrypted && !decrypted.includes('[Could not decrypt]')) {
                    const isMe = conv.lastMessage.sender?._id === user._id || conv.lastMessage.sender === user._id
                    const prefix = isMe ? 'You: ' : `${conv.otherUser?.fullName?.split(' ')[0]}: `
                    return prefix + decrypted
                }
            } catch (e) { }
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

// import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
// import { getSocket, connectSocket } from '../utils/socket'
// import { useAuth } from './AuthContext'
// import { decrypt } from '../utils/encryption'
// import api from '../utils/api'

// const ChatContext = createContext(null)

// export const ChatProvider = ({ children }) => {
//     const { user, token } = useAuth()
//     const [conversations, setConversations] = useState([])
//     const [selectedChat, setSelectedChat] = useState(null)
//     const [messages, setMessages] = useState([])
//     const [notifications, setNotifications] = useState([])
//     const [typingUsers, setTypingUsers] = useState({})
//     const [onlineUsers, setOnlineUsers] = useState(new Set())
//     const [unreadCounts, setUnreadCounts] = useState({})

//     const selectedChatRef = useRef(null)
//     // ✅ conversations ka live ref — stale closure problem fix
//     const conversationsRef = useRef([])

//     useEffect(() => {
//         selectedChatRef.current = selectedChat
//     }, [selectedChat])

//     useEffect(() => {
//         conversationsRef.current = conversations
//     }, [conversations])

//     const loadConversations = useCallback(async () => {
//         try {
//             const res = await api.get('/api/chat/conversations')
//             const sorted = [...res.data.conversations].sort(
//                 (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
//             )
//             setConversations(sorted)
//             conversationsRef.current = sorted
//             return sorted
//         } catch { return [] }
//     }, [])

//     const loadNotifications = useCallback(async () => {
//         try {
//             const res = await api.get('/api/friends/pending')
//             setNotifications(res.data.requests)
//         } catch { }
//     }, [])

//     useEffect(() => {
//         if (!user) return
//         loadConversations()
//         loadNotifications()
//     }, [user])

//     useEffect(() => {
//         if (!user || !token) return

//         const socket = connectSocket(token)
//         if (!socket) return

//         const handleNewMessage = async ({ message, conversationId }) => {
//             console.log('🔔 newMessage received:', conversationId)

//             const current = selectedChatRef.current
//             const convIdStr = conversationId?.toString()
//             const isCurrentChat = current?.conversationId?.toString() === convIdStr

//             // ─── 1. Messages update ───
//             if (isCurrentChat) {
//                 setMessages((prev) => {
//                     if (prev.find((m) => m._id === message._id)) return prev
//                     const withoutTemp = prev.filter((m) => !m._id?.startsWith('temp_'))
//                     return [...withoutTemp, message]
//                 })
//             } else {
//                 setUnreadCounts((prev) => ({
//                     ...prev,
//                     [convIdStr]: (prev[convIdStr] || 0) + 1,
//                 }))
//             }

//             // ─── 2. Conversation TOP PE LAO ───
//             // conversationsRef se latest data lo — stale closure problem nahi hogi
//             let currentConvs = conversationsRef.current
//             let existingIndex = currentConvs.findIndex((c) => c._id?.toString() === convIdStr)

//             if (existingIndex === -1) {
//                 // Conversations abhi load nahi huin — API se fresh lo
//                 console.log('⚠️ Conversation not found locally, fetching from API...')
//                 currentConvs = await loadConversations()
//                 existingIndex = currentConvs.findIndex((c) => c._id?.toString() === convIdStr)
//                 // loadConversations ne already sorted set kar diya — bas return
//                 if (existingIndex === -1) return
//                 // Agar mil gayi toh ab neeche wala code chalega
//             }

//             // Optimistically top pe lao
//             const updated = [...currentConvs]
//             const conv = { ...updated[existingIndex] }
//             conv.lastMessage = message
//             conv.lastMessageAt = message.createdAt || new Date().toISOString()
//             updated.splice(existingIndex, 1)
//             updated.unshift(conv)
//             setConversations(updated)
//             conversationsRef.current = updated
//         }

//         socket.off('newMessage')
//         socket.off('messageDeleted')
//         socket.off('friendRequestReceived')
//         socket.off('friendRequestAccepted')
//         socket.off('userTyping')
//         socket.off('userStoppedTyping')
//         socket.off('userOnline')
//         socket.off('userOffline')
//         socket.off('connect')

//         socket.on('newMessage', handleNewMessage)

//         socket.on('messageDeleted', ({ messageId }) => {
//             setMessages((prev) =>
//                 prev.map((m) =>
//                     m._id === messageId
//                         ? { ...m, isDeleted: true, encryptedContent: 'This message was deleted' }
//                         : m
//                 )
//             )
//             loadConversations()
//         })

//         socket.on('friendRequestReceived', (data) => {
//             setNotifications((prev) => [data, ...prev])
//         })

//         socket.on('friendRequestAccepted', () => {
//             loadConversations()
//         })

//         socket.on('userTyping', ({ fromUserId }) => {
//             setTypingUsers((prev) => ({ ...prev, [fromUserId]: true }))
//         })
//         socket.on('userStoppedTyping', ({ fromUserId }) => {
//             setTypingUsers((prev) => ({ ...prev, [fromUserId]: false }))
//         })
//         socket.on('userOnline', ({ userId }) => {
//             setOnlineUsers((prev) => new Set([...prev, userId]))
//         })
//         socket.on('userOffline', ({ userId }) => {
//             setOnlineUsers((prev) => {
//                 const s = new Set(prev)
//                 s.delete(userId)
//                 return s
//             })
//         })

//         socket.on('connect', () => {
//             console.log('🔌 Socket reconnected — reloading conversations')
//             loadConversations()
//         })

//         return () => {
//             socket.off('newMessage')
//             socket.off('messageDeleted')
//             socket.off('friendRequestReceived')
//             socket.off('friendRequestAccepted')
//             socket.off('userTyping')
//             socket.off('userStoppedTyping')
//             socket.off('userOnline')
//             socket.off('userOffline')
//             socket.off('connect')
//         }
//     }, [user, token, loadConversations])

//     const selectChat = async (chatUser, conversationId) => {
//         setMessages([])
//         setSelectedChat({ user: chatUser, conversationId })
//         if (conversationId) {
//             setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }))
//         }
//         try {
//             const res = await api.get(`/api/chat/messages/${chatUser._id}`)
//             setMessages(res.data.messages)
//         } catch {
//             setMessages([])
//         }
//     }

//     const getLastMessagePreview = useCallback((conv) => {
//         if (!conv.lastMessage) return 'Say hello! 👋'
//         if (conv.lastMessage.isDeleted) return '🚫 This message was deleted'
//         if (!conv.lastMessage.encryptedContent) return 'Say hello! 👋'

//         if (user && conv.otherUser) {
//             try {
//                 const decrypted = decrypt(
//                     conv.lastMessage.encryptedContent,
//                     user._id,
//                     conv.otherUser._id
//                 )
//                 if (decrypted && decrypted !== '[Could not decrypt]' && decrypted !== '[Encrypted message]') {
//                     const isMe =
//                         conv.lastMessage.sender?._id === user._id ||
//                         conv.lastMessage.sender === user._id
//                     const prefix = isMe ? 'You: ' : `${conv.otherUser?.fullName?.split(' ')[0]}: `
//                     return prefix + decrypted
//                 }
//             } catch { }
//         }
//         return '🔒 Encrypted message'
//     }, [user])

//     return (
//         <ChatContext.Provider value={{
//             conversations, setConversations, loadConversations,
//             selectedChat, setSelectedChat, selectChat,
//             messages, setMessages,
//             notifications, setNotifications, loadNotifications,
//             typingUsers, onlineUsers,
//             unreadCounts,
//             getLastMessagePreview,
//         }}>
//             {children}
//         </ChatContext.Provider>
//     )
// }

// export const useChat = () => useContext(ChatContext)