import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../utils/api'
import toast from 'react-hot-toast'

export default function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ identifier: '', password: '' })
    const [loading, setLoading] = useState(false)
    const [showPass, setShowPass] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.identifier || !form.password) return toast.error('Please fill all fields')
        setLoading(true)
        try {
            const res = await api.post('/api/auth/login', form)
            login(res.data.user, res.data.token)
            toast.success('Welcome back!')
            navigate('/')
        } catch (err) {
            toast.error(err.response?.data?.error || 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-wa-bg flex flex-col items-center justify-center px-4">
            {/* Top green bar like WhatsApp */}
            <div className="absolute top-0 left-0 right-0 h-[220px] bg-wa-green_dark" />

            <div className="relative z-10 w-full max-w-sm">
                {/* Card */}
                <div className="bg-wa-panel rounded-lg shadow-2xl px-8 py-10">
                    {/* Logo */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-wa-green rounded-full flex items-center justify-center mb-3 shadow-lg">
                            <svg viewBox="0 0 24 24" className="w-9 h-9 fill-white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.121 1.528 5.849L.057 23.704a.75.75 0 0 0 .92.92l5.855-1.471A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.806 9.806 0 0 1-5.044-1.394l-.361-.214-3.737.938.953-3.642-.235-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z" />
                            </svg>
                        </div>
                        <h1 className="text-wa-text text-2xl font-semibold tracking-wide">ChatApp</h1>
                        <p className="text-wa-text_secondary text-sm mt-1">Sign in to your account</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-wa-green text-xs font-medium uppercase tracking-wider mb-1 block">
                                Username or Email
                            </label>
                            <input
                                type="text"
                                value={form.identifier}
                                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                                placeholder="Enter username or email"
                                className="w-full bg-wa-search border-b border-wa-border text-wa-text placeholder-wa-text_secondary px-3 py-3 rounded-md focus:outline-none focus:border-wa-green transition-colors text-sm"
                            />
                        </div>

                        <div className="relative">
                            <label className="text-wa-green text-xs font-medium uppercase tracking-wider mb-1 block">
                                Password
                            </label>
                            <input
                                type={showPass ? 'text' : 'password'}
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder="Enter password"
                                className="w-full bg-wa-search border-b border-wa-border text-wa-text placeholder-wa-text_secondary px-3 py-3 rounded-md focus:outline-none focus:border-wa-green transition-colors text-sm pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-2 top-8 text-wa-text_secondary hover:text-wa-icon"
                            >
                                {showPass ? (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-wa-green hover:bg-wa-green_dark disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-all duration-200 mt-2 text-sm tracking-wide shadow-md"
                        >
                            {loading ? 'Signing in...' : 'SIGN IN'}
                        </button>
                    </form>

                    <p className="text-center text-wa-text_secondary text-sm mt-6">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-wa-green hover:underline font-medium">
                            Register
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}