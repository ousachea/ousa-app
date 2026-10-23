// Whether the current app's settings page is showing (ToolPage), so a page can open it from its own links.
// It lives in the address, ?settings, so the settings are a page of their own: Back closes them, a link
// or a reload opens them straight away. Opening adds a history entry; closing steps back over it when
// it's the one we added, and otherwise just drops ?settings, so Back never leaves the app by surprise.
export function useAppSettingsOpen() {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get: () => route.query.settings !== undefined,
    set(open: boolean) {
      if (open === (route.query.settings !== undefined)) return
      const { settings: _, ...rest } = route.query
      if (open) return void router.push({ query: { ...route.query, settings: null } })
      const without = router.resolve({ query: rest }).fullPath
      if (import.meta.client && window.history.state?.back === without) router.back()
      else router.replace({ query: rest })
    }
  })
}
