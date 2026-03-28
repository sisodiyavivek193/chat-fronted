import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { getSocket } from '../../utils/socket'
import { encrypt, decrypt } from '../../utils/encryption'
import api from '../../utils/api'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function ChatWindow() {
    const { user } = useAuth()
    const { selectedChat, messages, setMessages, typingUsers, onlineUsers } = useChat()
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [contextMenu, setContextMenu] = useState(null)
    const bottomRef = useRef(null)
    const messagesAreaRef = useRef(null)
    const typingTimeout = useRef(null)

    const otherUser = selectedChat?.user
    const isTyping = typingUsers[otherUser?._id]
    const isOnline = onlineUsers.has(otherUser?._id)

    // ✅ Fix 1: Chat switch hone pe messages clear + scroll reset
    useEffect(() => {
        if (messagesAreaRef.current) {
            messagesAreaRef.current.scrollTop = 0
        }
    }, [selectedChat?.user?._id])

    // ✅ Fix 2: Naye messages aane pe bottom scroll
    useEffect(() => {
        if (messages.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages.length, isTyping])

    // ✅ Fix 3: decryptMessage — otherUser change hone pe fresh decrypt
    const decryptMessage = useCallback((msg) => {
        if (msg._plainText) return msg._plainText
        if (msg.isDeleted) return null
        if (!otherUser?._id) return '[Encrypted message]'
        return decrypt(msg.encryptedContent, user._id, otherUser._id)
    }, [user._id, otherUser?._id])

    const handleInputChange = (e) => {
        setInput(e.target.value)
        const socket = getSocket()
        if (socket && otherUser) {
            socket.emit('typing', { toUserId: otherUser._id })
            clearTimeout(typingTimeout.current)
            typingTimeout.current = setTimeout(() => {
                socket.emit('stopTyping', { toUserId: otherUser._id })
            }, 1500)
        }
    }

    const sendMessage = async () => {
        if (!input.trim() || !selectedChat || sending) return
        const text = input.trim()
        setInput('')
        setSending(true)

        const encrypted = encrypt(text, user._id, otherUser._id)

        // Optimistic UI
        const tempMsg = {
            _id: 'temp_' + Date.now(),
            sender: { _id: user._id, fullName: user.fullName, username: user.username },
            encryptedContent: encrypted,
            _plainText: text,
            isDeleted: false,
            readBy: [user._id],
            createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, tempMsg])

        try {
            const res = await api.post('/api/chat/send', {
                toUserId: otherUser._id,
                encryptedContent: encrypted,
            })
            setMessages((prev) =>
                prev.map((m) => m._id === tempMsg._id ? { ...res.data.message, _plainText: text } : m)
            )
        } catch (err) {
            setMessages((prev) => prev.filter((m) => m._id !== tempMsg._id))
            toast.error(err.response?.data?.error || 'Failed to send')
        } finally {
            setSending(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const deleteMessage = async (messageId) => {
        try {
            await api.delete(`/api/chat/message/${messageId}`)
            setMessages((prev) =>
                prev.map((m) =>
                    m._id === messageId
                        ? { ...m, isDeleted: true, encryptedContent: 'This message was deleted' }
                        : m
                )
            )
            setContextMenu(null)
        } catch (err) {
            toast.error(err.response?.data?.error || 'Cannot delete')
        }
    }

    const handleBlock = async () => {
        try {
            await api.post(`/api/users/block/${otherUser._id}`)
            toast.success(`${otherUser.username} blocked`)
            setShowMenu(false)
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to block')
        }
    }

    if (!selectedChat) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-wa-chat">
                <div className="flex flex-col items-center gap-4 opacity-60">
                    <div className="w-24 h-24 rounded-full bg-wa-panel flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-14 h-14 fill-wa-text_secondary">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.121 1.528 5.849L.057 23.704a.75.75 0 0 0 .92.92l5.855-1.471A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.806 9.806 0 0 1-5.044-1.394l-.361-.214-3.737.938.953-3.642-.235-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
                        </svg>
                    </div>
                    <div className="text-center">
                        <h2 className="text-wa-text text-xl font-light">ChatApp Web</h2>
                        <p className="text-wa-text_secondary text-sm mt-1">Send and receive messages</p>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-wa-text_secondary text-xs">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                        </svg>
                        End-to-end encrypted
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            className="flex-1 flex flex-col bg-wa-chat overflow-hidden"

            onClick={() => { setContextMenu(null); setShowMenu(false) }}
        >
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-3 bg-wa-panel border-b border-wa-border">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-wa-sidebar border border-wa-border flex items-center justify-center text-wa-text font-semibold">
                            {otherUser?.fullName?.charAt(0).toUpperCase()}
                        </div>
                        {isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-wa-green rounded-full border-2 border-wa-panel" />
                        )}
                    </div>
                    <div>
                        <p className="text-wa-text font-medium text-sm">{otherUser?.fullName}</p>
                        <p className="text-wa-text_secondary text-xs">
                            {isTyping ? (
                                <span className="text-wa-green">typing...</span>
                            ) : isOnline ? (
                                <span className="text-wa-green">online</span>
                            ) : (
                                `@${otherUser?.username}`
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                            className="p-2 rounded-full hover:bg-wa-hover text-wa-icon"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="5" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="12" cy="19" r="1.5" />
                            </svg>
                        </button>
                        {showMenu && (
                            <div
                                className="absolute right-0 top-10 bg-wa-panel border border-wa-border rounded-md shadow-xl z-50 w-44 py-1"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    onClick={handleBlock}
                                    className="w-full text-left px-4 py-2 text-red-400 text-sm hover:bg-wa-hover"
                                >
                                    Block {otherUser?.username}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ✅ Messages area with ref for scroll control */}
            <div
                ref={messagesAreaRef}
                className="flex-1 overflow-y-auto px-4 py-3 space-y-1 min-h-0"

                style={{
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='30' cy='30' r='1' fill='%23ffffff05'/%3E%3C/svg%3E\")"
                }}
            >
                {messages.length === 0 && (
                    <div className="flex justify-center py-8">
                        <span className="bg-wa-panel text-wa-text_secondary text-xs px-3 py-1.5 rounded-full">
                            No messages yet. Say hello! 👋
                        </span>
                    </div>
                )}

                {messages.map((msg, idx) => {
                    const isMine = msg.sender?._id === user._id || msg.sender === user._id
                    const plainText = decryptMessage(msg)
                    const showDateSep = idx === 0 ||
                        new Date(msg.createdAt).toDateString() !== new Date(messages[idx - 1]?.createdAt).toDateString()
                    const isRead = msg.readBy?.length > 1

                    return (
                        <div key={msg._id}>
                            {showDateSep && (
                                <div className="flex justify-center py-2">
                                    <span className="bg-wa-panel text-wa-text_secondary text-[11px] px-3 py-1 rounded-full">
                                        {format(new Date(msg.createdAt), 'MMMM d, yyyy')}
                                    </span>
                                </div>
                            )}
                            <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-0.5 animate-fade-in`}>
                                <div
                                    onContextMenu={(e) => {
                                        if (isMine && !msg.isDeleted) {
                                            e.preventDefault()
                                            setContextMenu({ x: e.clientX, y: e.clientY, messageId: msg._id })
                                        }
                                    }}
                                    className={`relative max-w-[65%] px-3 py-2 rounded-lg text-sm shadow-sm cursor-pointer
                                        ${isMine
                                            ? 'bg-wa-bubble_out text-wa-text rounded-tr-none bubble-out'
                                            : 'bg-wa-bubble_in text-wa-text rounded-tl-none bubble-in'
                                        }
                                        ${msg.isDeleted ? 'opacity-60 italic' : ''}
                                    `}
                                >
                                    {msg.isDeleted ? (
                                        <span className="flex items-center gap-1 text-wa-text_secondary">
                                            🚫 This message was deleted
                                        </span>
                                    ) : (
                                        <span className="break-words">{plainText}</span>
                                    )}
                                    <div className="flex items-center justify-end gap-1 mt-0.5">
                                        <span className="text-[10px] text-wa-text_secondary">
                                            {format(new Date(msg.createdAt), 'h:mm a')}
                                        </span>
                                        {isMine && !msg.isDeleted && (
                                            <svg className={`w-4 h-4 ${isRead ? 'tick-read' : 'tick-single'}`} viewBox="0 0 18 18" fill="currentColor">
                                                {isRead ? (
                                                    <path d="M17.394 5.035l-.57-.444a.434.434 0 0 0-.609.076L8.094 13.492 5.817 11.215a.434.434 0 0 0-.614 0l-.483.483a.434.434 0 0 0 0 .614l3.037 3.037a.433.433 0 0 0 .645-.031l8.943-9.65a.434.434 0 0 0-.051-.633z M3.017 9.017L.947 6.947a.434.434 0 0 0-.614 0l-.483.483a.434.434 0 0 0 0 .614l2.39 2.39 .777-.777z" />
                                                ) : (
                                                    <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.033l-.359.34a.32.32 0 0 0 .033.484l1.868 1.686a.32.32 0 0 0 .484-.033l5.895-8.252a.366.366 0 0 0-.065-.51z" />
                                                )}
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}

                {/* Typing indicator */}
                {isTyping && (
                    <div className="flex justify-start animate-fade-in">
                        <div className="bg-wa-bubble_in rounded-lg rounded-tl-none px-4 py-3 flex items-center gap-1">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                        </div>
                    </div>
                )}

                {/* ✅ Bottom anchor for scroll */}
                <div ref={bottomRef} />
            </div>

            {/* Context menu */}
            {contextMenu && (
                <div
                    className="fixed bg-wa-panel border border-wa-border rounded-md shadow-xl z-50 py-1 w-36"
                    style={{
                        left: Math.max(10, Math.min(contextMenu.x - 120, window.innerWidth - 150)),
                        top: contextMenu.y
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={() => deleteMessage(contextMenu.messageId)}
                        className="w-full text-left px-4 py-2 text-red-400 text-sm hover:bg-wa-hover"
                    >
                        Delete message
                    </button>
                </div>
            )}

            {/* E2E badge */}
            <div className="flex justify-center py-1">
                <span className="text-wa-text_secondary text-[11px] flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                    </svg>
                    Messages are end-to-end encrypted
                </span>
            </div>

            {/* Input bar */}
            <div className="flex items-end gap-2 px-3 py-2 bg-wa-panel border-t border-wa-border">
                <div className="flex-1 bg-wa-search rounded-full px-4 py-2 flex items-end">
                    <textarea
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message"
                        rows={1}
                        className="flex-1 bg-transparent text-wa-text placeholder-wa-text_secondary text-sm focus:outline-none resize-none max-h-32 overflow-y-auto leading-5"
                        style={{ scrollbarWidth: 'none' }}
                    />
                </div>
                <button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="w-11 h-11 bg-wa-green hover:bg-wa-green_dark disabled:opacity-40 rounded-full flex items-center justify-center text-white transition-colors flex-shrink-0 shadow-md"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                </button>
            </div>
        </div>
    )
}