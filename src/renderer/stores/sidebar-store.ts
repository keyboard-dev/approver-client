import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  leftSidebarOpen: boolean
  rightSidebarOpen: boolean
  leftSidebarWidth: number
  rightSidebarWidth: number
  settingsPanelOpen: boolean
  activePanelTitle: string | null
  setLeftSidebarOpen: (open: boolean) => void
  setRightSidebarOpen: (open: boolean) => void
  setLeftSidebarWidth: (width: number) => void
  setRightSidebarWidth: (width: number) => void
  setSettingsPanelOpen: (open: boolean) => void
  setActivePanelTitle: (title: string | null) => void
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
      setLeftSidebarOpen: open => set({ leftSidebarOpen: open }),
      setRightSidebarOpen: open => set({ rightSidebarOpen: open }),
      setLeftSidebarWidth: width => set({ leftSidebarWidth: width }),
      setRightSidebarWidth: width => set({ rightSidebarWidth: width }),
      setSettingsPanelOpen: open => set({ settingsPanelOpen: open }),
      setActivePanelTitle: title => set({ activePanelTitle: title }),
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
