import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ChatProvider } from './context/ChatContext'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import ChatPage from './pages/ChatPage'

// Protected route wrapper
function PrivateRoute({ children }) {
    const { user } = useAuth()
    return user ? children : <Navigate to="/login" replace />
}

// Public route wrapper (redirect if already logged in)
function PublicRoute({ children }) {
    const { user } = useAuth()
    return user ? <Navigate to="/" replace /> : children
}

function AppRoutes() {
    return (
        <>
            <Toaster
                position="top-center"
                toastOptions={{
                    style: {
                        background: '#202C33',
                        color: '#E9EDEF',
                        border: '1px solid #2A3942',
                        fontSize: '13px',
                    },
                    success: { iconTheme: { primary: '#00A884', secondary: '#fff' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                    duration: 3000,
                }}
            />
            <Routes>
                <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                <Route path="/" element={<PrivateRoute><ChatProvider><ChatPage /></ChatProvider></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </>
    )
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    )
}