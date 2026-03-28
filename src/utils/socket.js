import { io } from 'socket.io-client'

let socket = null

export const connectSocket = (token) => {
    if (socket?.connected) return socket

    // Agar purana disconnected socket hai toh hata do
    if (socket) {
        socket.disconnect()
        socket = null
    }

    if (!token) {
        console.warn("❌ No token, socket not connected")
        return null
    }

    socket = io(
        import.meta.env.VITE_SOCKET_URL ||
        'https://chat-backend-production-87bd.up.railway.app',
        {
            auth: { token },
            // ✅ polling se start karo, phir websocket upgrade hoga
            transports: ['polling', 'websocket'],
        }
    )

    socket.on('connect', () => {
        console.log('🔌 Socket connected:', socket.id)
    })

    socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason)
        // Auto reconnect
        if (reason === 'io server disconnect') {
            socket.connect()
        }
    })

    socket.on('connect_error', (err) => {
        console.error('Socket error:', err.message)
    })

    return socket
}

export const getSocket = () => socket

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect()
        socket = null
    }
}

// import { io } from 'socket.io-client'

// let socket = null

// export const connectSocket = (token) => {
//     if (socket?.connected) return socket

//     socket = io(import.meta.env.VITE_SOCKET_URL || 'https://chat-backend-production-87bd.up.railway.app', {
//         auth: { token },
//         transports: ['websocket'],
//     })

//     socket.on('connect', () => console.log('🔌 Socket connected:', socket.id))
//     socket.on('disconnect', () => console.log('❌ Socket disconnected'))
//     socket.on('connect_error', (err) => console.error('Socket error:', err.message))

//     return socket
// }

// export const getSocket = () => socket

// export const disconnectSocket = () => {
//     if (socket) {
//         socket.disconnect()
//         socket = null
//     }
// }