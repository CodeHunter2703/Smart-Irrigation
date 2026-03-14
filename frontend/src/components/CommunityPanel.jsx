import { useState, useEffect, useCallback } from 'react'
import {
    MessageSquare, ThumbsUp, Send, Plus, X, Search, Filter,
    Sparkles, Tag, Clock, ChevronDown, ChevronUp, User,
    MessageCircle, Share2, Bookmark, TrendingUp, Loader2, Star
} from 'lucide-react'
import * as api from '../api'
import { askGeminiDirect, isGeminiConfigured } from '../gemini'

const TAG_OPTIONS = [
    { value: 'irrigation', label: '💧 Irrigation', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'pest-control', label: '🐛 Pest Control', color: 'bg-red-50 text-red-700 border-red-200' },
    { value: 'soil-health', label: '🌍 Soil Health', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { value: 'fertilizers', label: '🌾 Fertilizers', color: 'bg-green-50 text-green-700 border-green-200' },
    { value: 'organic', label: '🌿 Organic', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { value: 'weather', label: '☀️ Weather', color: 'bg-sky-50 text-sky-700 border-sky-200' },
    { value: 'seeds', label: '🌱 Seeds', color: 'bg-lime-50 text-lime-700 border-lime-200' },
    { value: 'equipment', label: '🔧 Equipment', color: 'bg-gray-50 text-gray-700 border-gray-200' },
    { value: 'tips', label: '💡 Tips', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { value: 'sustainable', label: '♻️ Sustainable', color: 'bg-teal-50 text-teal-700 border-teal-200' },
    { value: 'rainwater', label: '🌧️ Rainwater', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
]

const TAG_MAP = Object.fromEntries(TAG_OPTIONS.map(t => [t.value, t]))

function getTagStyle(tag) {
    return TAG_MAP[tag] || { label: tag, color: 'bg-surface-100 text-surface-600 border-surface-200' }
}

function timeAgo(dateString) {
    const now = new Date()
    const date = new Date(dateString)
    const seconds = Math.floor((now - date) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ═══════════════════════════════════════════════════════════════
// GeminiChat — Slide-over AI chat panel
// ═══════════════════════════════════════════════════════════════
function GeminiChat({ open, onClose, onPostAnswer, sensorData }) {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            text: '🌱 **Namaste!** I\'m your AI farming assistant.\n\nAsk me about irrigation, crop diseases, fertilizers, soil health, or any agriculture topic. I\'ll give you practical, easy-to-follow advice.\n\n*Try: "When should I water my wheat crop?"*',
        }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSend = async () => {
        const query = input.trim()
        if (!query || loading) return

        setInput('')
        setMessages(prev => [...prev, { role: 'user', text: query }])
        setLoading(true)

        try {
            const context = {}
            if (sensorData) {
                context.soilMoisture = sensorData.soilMoisture
                context.temperature = sensorData.temperature
                context.humidity = sensorData.humidity
            }

            let result
            // Use direct Gemini SDK (frontend) — bypasses backend rate limits
            if (isGeminiConfigured()) {
                try {
                    result = await askGeminiDirect(query, context)
                } catch (sdkErr) {
                    console.warn('Gemini SDK failed, trying backend:', sdkErr)
                    result = await api.askGemini(query, context)
                }
            } else {
                result = await api.askGemini(query, context)
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                text: result.answer,
                source: result.source,
                query: query,
            }])
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: '⚠️ Sorry, I couldn\'t process your question right now. Please try again.',
            }])
        } finally {
            setLoading(false)
        }
    }

    const handlePostToFeed = (msg) => {
        onPostAnswer({
            title: `💡 ${msg.query || 'Gemini AI Answer'}`,
            content: msg.text,
            tags: ['tips', 'gemini-answer'],
            isGeminiAnswer: true,
            author: 'Gemini AI',
            avatar: 'gemini',
        })
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-surface-200 bg-gradient-to-r from-violet-600 to-indigo-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                                <Sparkles size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-base">Ask Gemini AI</h3>
                                <p className="text-white/70 text-xs">Your smart farming assistant</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    {sensorData && (
                        <div className="mt-3 flex gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-white/15 text-white/90 text-xs">
                                💧 {sensorData.soilMoisture}% moisture
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white/15 text-white/90 text-xs">
                                🌡️ {sensorData.temperature}°C
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-white/15 text-white/90 text-xs">
                                💨 {sensorData.humidity}% humidity
                            </span>
                        </div>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] ${msg.role === 'user'
                                ? 'bg-primary-600 text-white rounded-2xl rounded-br-md px-4 py-3'
                                : 'bg-surface-50 border border-surface-200 rounded-2xl rounded-bl-md px-4 py-3'
                                }`}>
                                {msg.role === 'assistant' && (
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Sparkles size={14} className="text-violet-500" />
                                        <span className="text-xs font-semibold text-violet-600">Gemini AI</span>
                                    </div>
                                )}
                                <div className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'text-white' : 'text-surface-700'
                                    }`}>
                                    {formatMarkdown(msg.text)}
                                </div>
                                {msg.role === 'assistant' && msg.query && i > 0 && (
                                    <button
                                        onClick={() => handlePostToFeed(msg)}
                                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                                   bg-violet-50 text-violet-600 text-xs font-semibold
                                                   hover:bg-violet-100 transition-colors border border-violet-200"
                                    >
                                        <Share2 size={12} />
                                        Post to Community Feed
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-surface-50 border border-surface-200 rounded-2xl rounded-bl-md px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <Loader2 size={16} className="text-violet-500 animate-spin" />
                                    <span className="text-sm text-surface-500">Thinking...</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-surface-200 bg-white">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Ask about irrigation, crops, soil..."
                            className="input-field flex-1 !rounded-xl !py-2.5 text-sm"
                            disabled={loading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700
                                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                       flex items-center gap-1.5 font-semibold text-sm"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    <p className="text-xs text-surface-400 mt-2 text-center">
                        Gemini uses your sensor data for personalized advice
                    </p>
                </div>
            </div>
        </div>
    )
}

// Simple markdown-like formatting helper
function formatMarkdown(text) {
    if (!text) return text
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
        }
        return part
    })
}


// ═══════════════════════════════════════════════════════════════
// CreatePostModal — Modal for creating new posts
// ═══════════════════════════════════════════════════════════════
function CreatePostModal({ open, onClose, onSubmit, userName }) {
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [selectedTags, setSelectedTags] = useState([])
    const [submitting, setSubmitting] = useState(false)

    const toggleTag = (tag) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        )
    }

    const handleSubmit = async () => {
        if (!title.trim() || !content.trim()) return
        setSubmitting(true)
        try {
            await onSubmit({
                author: userName || 'Anonymous Farmer',
                title: title.trim(),
                content: content.trim(),
                tags: selectedTags,
            })
            setTitle('')
            setContent('')
            setSelectedTags([])
            onClose()
        } finally {
            setSubmitting(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                            <Plus size={18} className="text-primary-600" />
                        </div>
                        <h3 className="font-bold text-surface-900 text-lg">Ask the Community</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-100 text-surface-500">
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className="label">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g., Best time to water rice seedlings?"
                            className="input-field"
                            maxLength={150}
                        />
                    </div>
                    <div>
                        <label className="label">Description</label>
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Describe your question or share your experience in detail..."
                            className="input-field !min-h-[120px] resize-none"
                            rows={4}
                        />
                    </div>
                    <div>
                        <label className="label">Tags</label>
                        <div className="flex flex-wrap gap-2">
                            {TAG_OPTIONS.map(tag => (
                                <button
                                    key={tag.value}
                                    onClick={() => toggleTag(tag.value)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150
                                        ${selectedTags.includes(tag.value)
                                            ? tag.color + ' ring-2 ring-offset-1 ring-primary-300'
                                            : 'bg-surface-50 text-surface-500 border-surface-200 hover:border-surface-300'
                                        }`}
                                >
                                    {tag.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t border-surface-200 bg-surface-50 flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary text-sm">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!title.trim() || !content.trim() || submitting}
                        className="btn-primary text-sm"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Posting...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                Post Question
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}


// ═══════════════════════════════════════════════════════════════
// PostCard — Individual post in the discussion feed
// ═══════════════════════════════════════════════════════════════
function PostCard({ post, onUpvote, userId }) {
    const [expanded, setExpanded] = useState(false)
    const [comments, setComments] = useState([])
    const [showComments, setShowComments] = useState(false)
    const [commentText, setCommentText] = useState('')
    const [loadingComments, setLoadingComments] = useState(false)
    const [submittingComment, setSubmittingComment] = useState(false)

    const hasUpvoted = (post.upvotedBy || []).includes(userId)
    const isGemini = post.isGeminiAnswer

    const loadComments = async () => {
        setLoadingComments(true)
        try {
            const result = await api.getComments(post.id)
            setComments(result.comments || [])
        } catch { }
        setLoadingComments(false)
    }

    const toggleComments = () => {
        if (!showComments && comments.length === 0) loadComments()
        setShowComments(!showComments)
    }

    const handleComment = async () => {
        if (!commentText.trim()) return
        setSubmittingComment(true)
        try {
            const newComment = await api.addComment(post.id, {
                author: 'You',
                text: commentText.trim(),
            })
            setComments(prev => [...prev, newComment])
            setCommentText('')
        } catch { }
        setSubmittingComment(false)
    }

    // Truncation
    const MAX_LEN = 200
    const isLong = post.content && post.content.length > MAX_LEN
    const displayContent = expanded || !isLong
        ? post.content
        : post.content.slice(0, MAX_LEN) + '…'

    return (
        <div className={`card hover:shadow-card-hover transition-all duration-200 ${isGemini ? 'border-violet-200 bg-gradient-to-br from-white to-violet-50/30' : ''
            }`}>
            {/* Author row */}
            <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                    ${isGemini
                        ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
                        : 'bg-primary-100 text-primary-700'
                    }`}>
                    {isGemini ? <Sparkles size={18} /> : (post.author?.[0]?.toUpperCase() || 'F')}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-surface-900 text-sm">{post.author}</span>
                        {isGemini && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                           bg-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-wider">
                                <Sparkles size={10} /> AI Answer
                            </span>
                        )}
                        <span className="text-xs text-surface-400 flex items-center gap-1">
                            <Clock size={11} />
                            {timeAgo(post.createdAt)}
                        </span>
                    </div>
                    <h3 className="font-bold text-surface-900 mt-1 text-base leading-snug">{post.title}</h3>
                </div>
            </div>

            {/* Content */}
            <div className="text-sm text-surface-600 leading-relaxed whitespace-pre-wrap pl-[52px]">
                {formatMarkdown(displayContent)}
                {isLong && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="ml-1 text-primary-600 font-semibold text-xs hover:text-primary-700"
                    >
                        {expanded ? 'Show less' : 'Read more'}
                    </button>
                )}
            </div>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pl-[52px]">
                    {post.tags.filter(t => t !== 'gemini-answer').map(tag => {
                        const style = getTagStyle(tag)
                        return (
                            <span key={tag} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${style.color}`}>
                                {style.label}
                            </span>
                        )
                    })}
                </div>
            )}

            {/* Action bar */}
            <div className="flex items-center gap-4 mt-4 pl-[52px] border-t border-surface-100 pt-3">
                <button
                    onClick={() => onUpvote(post.id)}
                    className={`flex items-center gap-1.5 text-sm font-semibold transition-colors
                        ${hasUpvoted
                            ? 'text-primary-600'
                            : 'text-surface-400 hover:text-primary-600'
                        }`}
                >
                    <ThumbsUp size={16} className={hasUpvoted ? 'fill-current' : ''} />
                    <span>{post.upvotes || 0}</span>
                </button>
                <button
                    onClick={toggleComments}
                    className="flex items-center gap-1.5 text-sm font-semibold text-surface-400 hover:text-surface-700 transition-colors"
                >
                    <MessageCircle size={16} />
                    <span>{post.commentCount || 0} Comments</span>
                </button>
            </div>

            {/* Comments section */}
            {showComments && (
                <div className="mt-3 ml-[52px] border-t border-surface-100 pt-3 space-y-3">
                    {loadingComments ? (
                        <div className="flex items-center gap-2 py-2">
                            <Loader2 size={14} className="animate-spin text-surface-400" />
                            <span className="text-sm text-surface-400">Loading comments...</span>
                        </div>
                    ) : (
                        <>
                            {comments.map(cmt => (
                                <div key={cmt.id} className={`flex gap-2.5 ${cmt.isGeminiAnswer ? 'bg-violet-50/50 -mx-2 px-2 py-2 rounded-xl border border-violet-100' : ''}`}>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                                        ${cmt.isGeminiAnswer || cmt.author === 'Gemini AI'
                                            ? 'bg-violet-500 text-white'
                                            : 'bg-surface-200 text-surface-600'
                                        }`}>
                                        {cmt.isGeminiAnswer || cmt.author === 'Gemini AI'
                                            ? <Sparkles size={12} />
                                            : (cmt.author?.[0]?.toUpperCase() || 'U')}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-surface-700">{cmt.author}</span>
                                            {(cmt.isGeminiAnswer || cmt.author === 'Gemini AI') && (
                                                <span className="text-[9px] font-bold text-violet-600 uppercase tracking-wider">AI</span>
                                            )}
                                            <span className="text-[11px] text-surface-400">{timeAgo(cmt.createdAt)}</span>
                                        </div>
                                        <p className="text-sm text-surface-600 mt-0.5 leading-relaxed">
                                            {formatMarkdown(cmt.text)}
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {/* Add comment */}
                            <div className="flex gap-2 items-start pt-2">
                                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                                    Y
                                </div>
                                <div className="flex-1 flex gap-2">
                                    <input
                                        type="text"
                                        value={commentText}
                                        onChange={e => setCommentText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleComment()}
                                        placeholder="Write a reply..."
                                        className="flex-1 px-3 py-1.5 rounded-lg border border-surface-200 text-sm
                                                   focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                                                   placeholder-surface-400"
                                    />
                                    <button
                                        onClick={handleComment}
                                        disabled={!commentText.trim() || submittingComment}
                                        className="p-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700
                                                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {submittingComment
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <Send size={14} />
                                        }
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════════════════
// CommunityPanel — Main exported component
// ═══════════════════════════════════════════════════════════════
export default function CommunityPanel({ user, sensorData }) {
    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showGeminiChat, setShowGeminiChat] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTagFilter, setActiveTagFilter] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    const userId = user?.uid || 'demo-user-001'
    const userName = user?.displayName || user?.email?.split('@')[0] || 'Demo Farmer'

    // Fetch posts
    const fetchPosts = useCallback(async () => {
        setLoading(true)
        try {
            const result = await api.getCommunityPosts()
            setPosts(result.posts || [])
        } catch (err) {
            console.error('Failed to fetch community posts:', err)
        }
        setLoading(false)
    }, [])

    useEffect(() => { fetchPosts() }, [fetchPosts])

    // Create post
    const handleCreatePost = async (postData) => {
        try {
            await api.createCommunityPost(postData)
            fetchPosts()
        } catch (err) {
            console.error('Failed to create post:', err)
        }
    }

    // Post Gemini answer to feed
    const handlePostGeminiAnswer = async (answerData) => {
        try {
            await api.createCommunityPost(answerData)
            fetchPosts()
        } catch (err) {
            console.error('Failed to post Gemini answer:', err)
        }
    }

    // Upvote
    const handleUpvote = async (postId) => {
        try {
            const result = await api.upvotePost(postId, userId)
            setPosts(prev => prev.map(p =>
                p.id === postId
                    ? { ...p, upvotes: result.upvotes, upvotedBy: result.upvotedBy }
                    : p
            ))
        } catch (err) {
            console.error('Failed to upvote:', err)
        }
    }

    // Filter & search
    const filteredPosts = posts.filter(p => {
        const matchesSearch = !searchQuery ||
            p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.author?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesTag = !activeTagFilter ||
            (p.tags || []).includes(activeTagFilter)
        return matchesSearch && matchesTag
    })

    const communityStats = {
        totalPosts: posts.length,
        totalUpvotes: posts.reduce((sum, p) => sum + (p.upvotes || 0), 0),
        geminiAnswers: posts.filter(p => p.isGeminiAnswer).length,
    }

    return (
        <div className="space-y-6">
            {/* ── Hero banner ────────────────────────────────────── */}
            <div className="card !p-0 overflow-hidden">
                <div className="bg-gradient-to-r from-primary-700 via-primary-600 to-emerald-500 px-6 py-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <MessageSquare size={22} />
                                Farmer Community
                            </h2>
                            <p className="text-white/80 text-sm mt-1">
                                Ask questions, share knowledge, and grow together 🌾
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                id="ask-gemini-btn"
                                onClick={() => setShowGeminiChat(true)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 backdrop-blur
                                           text-white font-semibold rounded-xl hover:bg-white/25 transition-all
                                           border border-white/20 text-sm"
                            >
                                <Sparkles size={16} />
                                Ask Gemini AI
                            </button>
                            <button
                                id="create-post-btn"
                                onClick={() => setShowCreateModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-primary-700
                                           font-semibold rounded-xl hover:bg-white/90 transition-all text-sm shadow-sm"
                            >
                                <Plus size={16} />
                                New Post
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <MessageCircle size={14} className="text-white/60" />
                            <span className="text-white/90 text-sm font-medium">{communityStats.totalPosts} Posts</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThumbsUp size={14} className="text-white/60" />
                            <span className="text-white/90 text-sm font-medium">{communityStats.totalUpvotes} Upvotes</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-white/60" />
                            <span className="text-white/90 text-sm font-medium">{communityStats.geminiAnswers} AI Answers</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Search & Filters ───────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                        id="community-search"
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search posts, topics, or farmers..."
                        className="input-field !pl-10 text-sm"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`btn-secondary text-sm ${showFilters ? '!bg-primary-50 !text-primary-700 !border-primary-300' : ''}`}
                >
                    <Filter size={16} />
                    Filters
                    {activeTagFilter && (
                        <span className="w-2 h-2 rounded-full bg-primary-500" />
                    )}
                </button>
            </div>

            {/* Tag filters */}
            {showFilters && (
                <div className="card !py-4 animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <Tag size={14} className="text-surface-500" />
                        <span className="text-sm font-semibold text-surface-700">Filter by topic</span>
                        {activeTagFilter && (
                            <button
                                onClick={() => setActiveTagFilter('')}
                                className="ml-auto text-xs font-semibold text-primary-600 hover:text-primary-700"
                            >
                                Clear filter
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {TAG_OPTIONS.map(tag => (
                            <button
                                key={tag.value}
                                onClick={() => setActiveTagFilter(activeTagFilter === tag.value ? '' : tag.value)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                                    ${activeTagFilter === tag.value
                                        ? tag.color + ' ring-2 ring-offset-1 ring-primary-300 shadow-sm'
                                        : 'bg-surface-50 text-surface-500 border-surface-200 hover:border-surface-300 hover:bg-surface-100'
                                    }`}
                            >
                                {tag.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Feed ───────────────────────────────────────────── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 size={28} className="animate-spin text-primary-500" />
                    <p className="text-surface-500 text-sm font-medium">Loading community posts...</p>
                </div>
            ) : filteredPosts.length === 0 ? (
                <div className="card flex flex-col items-center justify-center py-16 text-center">
                    <MessageSquare size={40} className="text-surface-300 mb-3" />
                    <p className="text-surface-600 font-semibold">No posts found</p>
                    <p className="text-surface-400 text-sm mt-1">
                        {searchQuery || activeTagFilter
                            ? 'Try adjusting your search or filters'
                            : 'Be the first to start a discussion!'}
                    </p>
                    {!searchQuery && !activeTagFilter && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="btn-primary mt-4 text-sm"
                        >
                            <Plus size={16} />
                            Create First Post
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredPosts.map(post => (
                        <PostCard
                            key={post.id}
                            post={post}
                            onUpvote={handleUpvote}
                            userId={userId}
                        />
                    ))}
                </div>
            )}

            {/* ── Modals ─────────────────────────────────────────── */}
            <CreatePostModal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSubmit={handleCreatePost}
                userName={userName}
            />

            <GeminiChat
                open={showGeminiChat}
                onClose={() => setShowGeminiChat(false)}
                onPostAnswer={handlePostGeminiAnswer}
                sensorData={sensorData}
            />
        </div>
    )
}
