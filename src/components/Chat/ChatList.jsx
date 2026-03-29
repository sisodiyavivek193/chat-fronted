import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useChat } from '../../context/ChatContext'
import { format, isToday, isYesterday } from 'date-fns'
import UserSearch from '../Friends/UserSearch'
import FriendRequests from '../Friends/FriendRequests'

export default function ChatList() {
    const { user, logout } = useAuth()
    const { conversations, selectedChat, selectChat, notifications, onlineUsers, unreadCounts, getLastMessagePreview } = useChat()
    const [tab, setTab] = useState('chats')
    const [showMenu, setShowMenu] = useState(false)

    const totalNotifs = notifications.length

    return (
        <div className="flex flex-col h-full bg-wa-sidebar border-r border-wa-border">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-wa-panel">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-wa-green flex items-center justify-center text-white font-bold text-sm cursor-pointer">
                        {user?.fullName?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-wa-text font-medium text-sm">{user?.fullName}</span>
                </div>

                <div className="flex items-center gap-1">
                    {/* Notification bell */}
                    <button
                        onClick={() => setTab(tab === 'requests' ? 'chats' : 'requests')}
                        className="relative p-2 rounded-full hover:bg-wa-hover text-wa-icon transition-colors"
                        title="Friend Requests"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        {totalNotifs > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 bg-wa-green text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                {totalNotifs > 9 ? '9+' : totalNotifs}
                            </span>
                        )}
                    </button>

                    {/* Search */}
                    <button
                        onClick={() => setTab(tab === 'search' ? 'chats' : 'search')}
                        className="p-2 rounded-full hover:bg-wa-hover text-wa-icon transition-colors"
                        title="Search Users"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>

                    {/* Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="p-2 rounded-full hover:bg-wa-hover text-wa-icon transition-colors"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="5" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="12" cy="19" r="1.5" />
                            </svg>
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 top-10 bg-wa-panel border border-wa-border rounded-md shadow-xl z-50 w-40 py-1">
                                <button
                                    onClick={() => { logout(); setShowMenu(false) }}
                                    className="w-full text-left px-4 py-2 text-wa-text text-sm hover:bg-wa-hover transition-colors"
                                >
                                    Log out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            {tab === 'chats' && (
                <>
                    {/* Search bar */}
                    <div className="px-3 py-2 bg-wa-sidebar">
                        <div className="flex items-center bg-wa-search rounded-lg px-3 gap-2">
                            <svg className="w-4 h-4 text-wa-text_secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search or start new chat"
                                className="bg-transparent text-wa-text placeholder-wa-text_secondary text-sm py-2 w-full focus:outline-none"
                                readOnly
                                onClick={() => setTab('search')}
                            />
                        </div>
                    </div>

                    {/* Conversation list */}
                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 text-wa-text_secondary">
                                <svg className="w-12 h-12 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <p className="text-sm">No chats yet</p>
                                <p className="text-xs mt-1">Search users to start chatting</p>
                            </div>
                        ) : (
                            // Latest message wali conversation top pe
                            [...conversations]
                                .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
                                .map((conv) => (
                                    <ConversationItem
                                        key={conv._id}
                                        conv={conv}
                                        isSelected={selectedChat?.user?._id === conv.otherUser?._id}
                                        isOnline={onlineUsers.has(conv.otherUser?._id)}
                                        unread={unreadCounts[conv._id] || 0}
                                        preview={getLastMessagePreview(conv)}
                                        onClick={() => selectChat(conv.otherUser, conv._id)}
                                    />
                                ))
                        )}
                    </div>
                </>
            )}

            {tab === 'search' && <UserSearch onBack={() => setTab('chats')} />}
            {tab === 'requests' && <FriendRequests onBack={() => setTab('chats')} />}
        </div>
    )
}

function ConversationItem({ conv, isSelected, isOnline, unread, preview, onClick }) {
    const getTime = (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        if (isToday(date)) return format(date, 'h:mm a')
        if (isYesterday(date)) return 'Yesterday'
        return format(date, 'dd/MM/yy')
    }
    const lastMsgTime = getTime(conv.lastMessageAt)

    return (
        <div
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-wa-border/30 ${isSelected ? 'bg-wa-hover' : 'hover:bg-wa-hover/50'}`}
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-wa-panel border border-wa-border flex items-center justify-center text-wa-text font-semibold text-lg">
                    {conv.otherUser?.fullName?.charAt(0).toUpperCase()}
                </div>
                {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-wa-green rounded-full border-2 border-wa-sidebar" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                    <span className="text-wa-text font-medium text-sm truncate">{conv.otherUser?.fullName}</span>
                    <span className="text-wa-text_secondary text-[11px] ml-2 flex-shrink-0">{lastMsgTime}</span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                    {/* ✅ Actual last message dikhega */}
                    <p className="text-wa-text_secondary text-xs truncate">{preview}</p>
                    {unread > 0 && (
                        <span className="bg-wa-green text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ml-1 flex-shrink-0">
                            {unread}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}