import { useState } from 'react'
import api from '../../utils/api'
import toast from 'react-hot-toast'
import { useChat } from '../../context/ChatContext'

export default function UserSearch({ onBack }) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [requestStates, setRequestStates] = useState({})
    const { selectChat, conversations } = useChat()

    const search = async (val) => {
        setQuery(val)
        if (val.length < 2) { setResults([]); return }
        setLoading(true)
        try {
            const res = await api.get(`/api/users/search?username=${val}`)
            setResults(res.data.users)
        } catch { setResults([]) }
        finally { setLoading(false) }
    }

    const sendRequest = async (userId) => {
        setRequestStates((p) => ({ ...p, [userId]: 'sending' }))
        try {
            await api.post('/api/friends/request', { toUserId: userId })
            setRequestStates((p) => ({ ...p, [userId]: 'sent' }))
            toast.success('Friend request sent!')
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed')
            setRequestStates((p) => ({ ...p, [userId]: null }))
        }
    }

    const cancelRequest = async (userId, requestId) => {
        try {
            await api.delete(`/api/friends/cancel/${requestId}`)
            setRequestStates((p) => ({ ...p, [userId]: null }))
            setResults((prev) => prev.map((u) => u._id === userId ? { ...u, friendStatus: 'none', requestId: null } : u))
            toast.success('Request cancelled')
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed')
        }
    }

    const startChat = async (u) => {
        // Pehle existing conversation dhundo
        const existing = conversations.find(
            c => c.otherUser?._id === u._id
        )
        if (existing) {
            selectChat(u, existing._id)
            onBack()
            return
        }
        // Naya conversation banao
        try {
            const res = await api.post('/api/chat/conversation', {
                toUserId: u._id
            })
            selectChat(u, res.data.conversation._id)
            onBack()
        } catch (err) {
            toast.error('Could not open chat')
        }
    }

    const getButtonState = (user) => {
        const local = requestStates[user._id]
        const status = local !== undefined ? local : user.friendStatus
        return status
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-wa-green_dark">
                <button onClick={onBack} className="text-white p-1 rounded-full hover:bg-white/10">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="text-white font-medium">Find People</h2>
            </div>

            {/* Search input */}
            <div className="px-3 pt-3 pb-2">
                <div className="flex items-center bg-wa-search rounded-lg px-3 gap-2">
                    <svg className="w-4 h-4 text-wa-text_secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => search(e.target.value)}
                        placeholder="Search by username..."
                        className="bg-transparent text-wa-text placeholder-wa-text_secondary text-sm py-2.5 w-full focus:outline-none"
                    />
                    {loading && <div className="w-4 h-4 border-2 border-wa-green border-t-transparent rounded-full animate-spin" />}
                </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
                {query.length < 2 && (
                    <div className="flex flex-col items-center justify-center h-40 text-wa-text_secondary">
                        <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-sm">Type username to search</p>
                    </div>
                )}

                {query.length >= 2 && !loading && results.length === 0 && (
                    <div className="text-center py-10 text-wa-text_secondary text-sm">
                        No users found for "<span className="text-wa-text">{query}</span>"
                    </div>
                )}

                {results.map((u) => {
                    const btnState = getButtonState(u)
                    return (
                        <div key={u._id} className="flex items-center gap-3 px-4 py-3 border-b border-wa-border/30 hover:bg-wa-hover/50 transition-colors">
                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-full bg-wa-panel border border-wa-border flex items-center justify-center text-wa-text font-semibold text-lg flex-shrink-0">
                                {u.fullName?.charAt(0).toUpperCase()}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-wa-text font-medium text-sm">{u.fullName}</p>
                                <p className="text-wa-text_secondary text-xs">@{u.username}</p>
                                {u.bio && <p className="text-wa-text_secondary text-xs truncate mt-0.5">{u.bio}</p>}
                            </div>

                            {/* Action buttons */}
                            <div className="flex-shrink-0 flex items-center gap-2">
                                {/* Friends — Chat button */}
                                {btnState === 'friends' && (
                                    <button
                                        onClick={() => startChat(u)}
                                        className="text-xs bg-wa-green hover:bg-wa-green_dark text-white px-3 py-1.5 rounded-full transition-all font-medium flex items-center gap-1"
                                    >
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                                        </svg>
                                        Chat
                                    </button>
                                )}

                                {/* Sent request */}
                                {(btnState === 'sent' || btnState === 'pending_sent') && (
                                    <button
                                        onClick={() => cancelRequest(u._id, u.requestId)}
                                        className="text-xs text-wa-text_secondary border border-wa-border px-3 py-1.5 rounded-full hover:bg-red-500/10 hover:text-red-400 hover:border-red-400 transition-all"
                                    >
                                        Sent ✓
                                    </button>
                                )}

                                {/* Incoming request */}
                                {btnState === 'pending_received' && (
                                    <span className="text-xs text-wa-green border border-wa-green px-3 py-1.5 rounded-full">
                                        Incoming
                                    </span>
                                )}

                                {/* Add Friend */}
                                {(btnState === 'none' || !btnState) && (
                                    <button
                                        onClick={() => sendRequest(u._id)}
                                        className="text-xs bg-wa-green hover:bg-wa-green_dark text-white px-3 py-1.5 rounded-full transition-all font-medium"
                                    >
                                        Add Friend
                                    </button>
                                )}

                                {/* Sending spinner */}
                                {btnState === 'sending' && (
                                    <div className="w-5 h-5 border-2 border-wa-green border-t-transparent rounded-full animate-spin" />
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}