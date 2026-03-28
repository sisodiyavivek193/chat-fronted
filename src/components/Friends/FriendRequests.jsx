import { useState } from 'react'
import { useChat } from '../../context/ChatContext'
import api from '../../utils/api'
import toast from 'react-hot-toast'

export default function FriendRequests({ onBack }) {
    const { notifications, setNotifications, loadConversations } = useChat()
    const [processing, setProcessing] = useState({}) // { requestId: true }

    const accept = async (req) => {
        setProcessing((p) => ({ ...p, [req._id || req.requestId]: true }))
        try {
            const id = req._id || req.requestId
            await api.put(`/api/friends/accept/${id}`)
            setNotifications((prev) => prev.filter((r) => (r._id || r.requestId) !== id))
            loadConversations()
            toast.success(`You are now friends with ${req.fromUser?.fullName || req.fromUser?.username}!`)
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed')
        } finally {
            setProcessing((p) => ({ ...p, [req._id || req.requestId]: false }))
        }
    }

    const reject = async (req) => {
        setProcessing((p) => ({ ...p, [req._id || req.requestId]: true }))
        try {
            const id = req._id || req.requestId
            await api.put(`/api/friends/reject/${id}`)
            setNotifications((prev) => prev.filter((r) => (r._id || r.requestId) !== id))
            toast.success('Request rejected')
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed')
        } finally {
            setProcessing((p) => ({ ...p, [req._id || req.requestId]: false }))
        }
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
                <h2 className="text-white font-medium">Friend Requests</h2>
                {notifications.length > 0 && (
                    <span className="bg-white text-wa-green_dark text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                        {notifications.length}
                    </span>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-wa-text_secondary">
                        <svg className="w-12 h-12 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        <p className="text-sm">No pending requests</p>
                    </div>
                ) : (
                    notifications.map((req) => {
                        const id = req._id || req.requestId
                        const isProcessing = processing[id]
                        const sender = req.fromUser

                        return (
                            <div key={id} className="flex items-center gap-3 px-4 py-3 border-b border-wa-border/30 animate-fade-in">
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-full bg-wa-panel border border-wa-border flex items-center justify-center text-wa-text font-semibold text-lg flex-shrink-0">
                                    {sender?.fullName?.charAt(0).toUpperCase() || '?'}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-wa-text font-medium text-sm">{sender?.fullName}</p>
                                    <p className="text-wa-text_secondary text-xs">@{sender?.username}</p>
                                    <p className="text-wa-text_secondary text-xs mt-0.5">wants to connect with you</p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {isProcessing ? (
                                        <div className="w-5 h-5 border-2 border-wa-green border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => reject(req)}
                                                className="w-9 h-9 rounded-full border border-wa-border flex items-center justify-center text-wa-text_secondary hover:bg-red-500/10 hover:text-red-400 hover:border-red-400 transition-all"
                                                title="Reject"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => accept(req)}
                                                className="w-9 h-9 rounded-full bg-wa-green flex items-center justify-center text-white hover:bg-wa-green_dark transition-all"
                                                title="Accept"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}