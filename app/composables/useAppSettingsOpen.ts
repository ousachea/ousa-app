// Whether the current app's settings popup (ToolPage) is open, so a page can open it from its own links
export const useAppSettingsOpen = () => useState('app-settings-open', () => false)
