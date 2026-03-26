import {
	createContext,
	useContext,
	createSignal,
	onMount,
	type ParentProps,
} from 'solid-js'

export type AppTheme = 'light' | 'dark' | 'warm' | 'slate' | 'system'

const THEME_CYCLE: AppTheme[] = ['light', 'warm', 'slate', 'dark', 'system']
const QUICK_CYCLE: AppTheme[] = ['light', 'warm', 'slate', 'dark']

interface SettingsStore {
	defaultNoteType: () => 'rich' | 'plain'
	setDefaultNoteType: (v: 'rich' | 'plain') => void
	showSettingsDialog: () => boolean
	setShowSettingsDialog: (v: boolean) => void
	theme: () => AppTheme
	setTheme: (v: AppTheme) => void
	cycleTheme: () => void
	popoutSkipTaskbar: () => boolean
	setPopoutSkipTaskbar: (v: boolean) => void
	syncServerUrl: () => string
	setSyncServerUrl: (v: string) => void
	syncToken: () => string
	setSyncToken: (v: string) => void
}

const SettingsStoreContext = createContext<SettingsStore>()

function applyTheme(theme: AppTheme) {
	const html = document.documentElement

	// Remove warm data attribute by default
	html.removeAttribute('data-theme')

	if (theme === 'warm') {
		window.electronAPI.darkModeUpdate('light')
		html.setAttribute('data-theme', 'warm')
	} else if (theme === 'slate') {
		window.electronAPI.darkModeUpdate('light')
		html.setAttribute('data-theme', 'slate')
	} else if (theme === 'light') {
		window.electronAPI.darkModeUpdate('light')
	} else if (theme === 'dark') {
		window.electronAPI.darkModeUpdate('dark')
	} else {
		window.electronAPI.darkModeSystem()
	}
}

export function SettingsStoreProvider(props: ParentProps) {
	const [defaultNoteType, _setDefaultNoteType] = createSignal<'rich' | 'plain'>(
		'rich'
	)
	const [showSettingsDialog, setShowSettingsDialog] = createSignal(false)
	const [theme, _setTheme] = createSignal<AppTheme>('system')
	const [popoutSkipTaskbar, _setPopoutSkipTaskbar] = createSignal(false)
	const [syncServerUrl, _setSyncServerUrl] = createSignal('')
	const [syncToken, _setSyncToken] = createSignal('')

	onMount(async () => {
		const savedType = await window.electronAPI.getSetting('defaultNoteType')
		if (savedType === 'plain' || savedType === 'rich') {
			_setDefaultNoteType(savedType)
		}

		const savedTheme = await window.electronAPI.getSetting('appTheme')
		if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'warm' || savedTheme === 'slate' || savedTheme === 'system') {
			_setTheme(savedTheme)
			applyTheme(savedTheme)
		}

		const savedSkip = await window.electronAPI.getSetting('popoutSkipTaskbar')
		if (savedSkip === 'true') {
			_setPopoutSkipTaskbar(true)
		}

		const appConfig = await window.electronAPI.getAppConfig()
		const savedSyncUrl = await window.electronAPI.getSetting('syncServerUrl')
		_setSyncServerUrl(savedSyncUrl || appConfig.syncServerUrl)

		const savedSyncToken = await window.electronAPI.getSetting('syncToken')
		_setSyncToken(savedSyncToken || appConfig.syncAuthToken)
	})

	function setDefaultNoteType(v: 'rich' | 'plain') {
		_setDefaultNoteType(v)
		window.electronAPI.setSetting('defaultNoteType', v)
	}

	function setTheme(v: AppTheme) {
		_setTheme(v)
		window.electronAPI.setSetting('appTheme', v)
		applyTheme(v)
	}

	function cycleTheme() {
		const current = theme()
		const idx = QUICK_CYCLE.indexOf(current)
		// If current theme is 'system' or not in quick cycle, start from light
		const next = idx === -1
			? QUICK_CYCLE[0]
			: QUICK_CYCLE[(idx + 1) % QUICK_CYCLE.length]
		setTheme(next)
	}

	function setPopoutSkipTaskbar(v: boolean) {
		_setPopoutSkipTaskbar(v)
		window.electronAPI.setSetting('popoutSkipTaskbar', String(v))
		window.electronAPI.popoutUpdateSkipTaskbar(v)
	}

	function setSyncServerUrl(v: string) {
		_setSyncServerUrl(v)
		window.electronAPI.setSetting('syncServerUrl', v)
	}

	function setSyncToken(v: string) {
		_setSyncToken(v)
		window.electronAPI.setSetting('syncToken', v)
	}

	const store: SettingsStore = {
		defaultNoteType,
		setDefaultNoteType,
		showSettingsDialog,
		setShowSettingsDialog,
		theme,
		setTheme,
		cycleTheme,
		popoutSkipTaskbar,
		setPopoutSkipTaskbar,
		syncServerUrl,
		setSyncServerUrl,
		syncToken,
		setSyncToken,
	}

	return (
		<SettingsStoreContext.Provider value={store}>
			{props.children}
		</SettingsStoreContext.Provider>
	)
}

export function useSettingsStore(): SettingsStore {
	const ctx = useContext(SettingsStoreContext)
	if (!ctx)
		throw new Error(
			'useSettingsStore must be used within SettingsStoreProvider'
		)
	return ctx
}
