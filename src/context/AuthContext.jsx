import { createContext, useContext, useState, useEffect } from 'react'
import { connectSocket, disconnectSocket } from '../utils/socket'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
    })
    const [token, setToken] = useState(() => localStorage.getItem('token'))

    useEffect(() => {
        if (token && user) {
            connectSocket(token)
        } else {
            disconnectSocket()
        }
    }, [token, user])

    const login = (userData, tokenData) => {
        localStorage.setItem('token', tokenData)
        localStorage.setItem('user', JSON.stringify(userData))
        setToken(tokenData)
        setUser(userData)
        connectSocket(tokenData)
    }

    const logout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
        disconnectSocket()
    }

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)