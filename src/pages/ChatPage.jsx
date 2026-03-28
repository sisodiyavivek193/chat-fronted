import ChatList from '../components/Chat/ChatList'
import ChatWindow from '../components/Chat/ChatWindow'

export default function ChatPage() {
    return (
        <div className="flex h-screen  w-screen overflow-hidden bg-wa-bg">
            {/* Left sidebar - chat list */}
            <div className="w-[380px] min-w-[320px] flex-shrink-0 flex flex-col border-r border-wa-border">
                <ChatList />
            </div>

            {/* Right panel - chat window */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">

                <ChatWindow />
            </div>
        </div>
    )
}