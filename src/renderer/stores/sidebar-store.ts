import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  leftSidebarOpen: boolean
  rightSidebarOpen: boolean
  leftSidebarWidth: number
  rightSidebarWidth: number
  settingsPanelOpen: boolean
  activePanelTitle: string | null
  toastMessage: string | null
  chatAppsByThread: Record<string, string[]>
  setLeftSidebarOpen: (open: boolean) => void
  setRightSidebarOpen: (open: boolean) => void
  setLeftSidebarWidth: (width: number) => void
  setRightSidebarWidth: (width: number) => void
  setSettingsPanelOpen: (open: boolean) => void
  setActivePanelTitle: (title: string | null) => void
  showToast: (message: string) => void
  hideToast: () => void
  addChatApp: (threadId: string, chatId: string) => void
  removeChatApp: (threadId: string, chatId: string) => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    set => ({
      leftSidebarOpen: false,
      rightSidebarOpen: false,
      leftSidebarWidth: 280,
      rightSidebarWidth: 280,
      settingsPanelOpen: false,
      activePanelTitle: null,
      toastMessage: null,
      chatAppsByThread: {},
      setLeftSidebarOpen: open => set({ leftSidebarOpen: open }),
      setRightSidebarOpen: open => set({ rightSidebarOpen: open }),
      setLeftSidebarWidth: width => set({ leftSidebarWidth: width }),
      setRightSidebarWidth: width => set({ rightSidebarWidth: width }),
      setSettingsPanelOpen: open => set({ settingsPanelOpen: open }),
      setActivePanelTitle: title => set({ activePanelTitle: title }),
      showToast: (message) => {
        set({ toastMessage: message })
        setTimeout(() => set({ toastMessage: null }), 3500)
      },
      hideToast: () => set({ toastMessage: null }),
      addChatApp: (threadId, chatId) => set(state => ({
        chatAppsByThread: {
          ...state.chatAppsByThread,
          [threadId]: [...(state.chatAppsByThread[threadId] || []), chatId],
        },
      })),
      removeChatApp: (threadId, chatId) => set(state => ({
        chatAppsByThread: {
          ...state.chatAppsByThread,
          [threadId]: (state.chatAppsByThread[threadId] || []).filter(id => id !== chatId),
        },
      })),
    }),
    {
      name: 'sidebar-store',
      partialize: state => ({
        leftSidebarWidth: state.leftSidebarWidth,
        rightSidebarWidth: state.rightSidebarWidth,
      }),
    },
  ),
)
