import { Show, createSignal, onMount } from 'solid-js'
import { PinDialog } from '../editor/PinDialog'
import { css } from '../../../styled-system/css'
import { useSettingsStore, type AppTheme } from '../../stores/settings-store'
import {
	XIcon,
	SunIcon,
	MoonIcon,
	MonitorIcon,
	TypeIcon,
	PaletteIcon,
	InfoIcon,
	PenLineIcon,
	FileIcon,
	CoffeeIcon,
	CloudyIcon,
	ExternalLinkIcon,
	TerminalIcon,
	RefreshCwIcon,
	ShieldIcon,
} from 'lucide-solid'

// ─── Overlay + shell ──────────────────────────────────────

const overlay = css({
	position: 'fixed',
	inset: 0,
	bg: 'rgba(0,0,0,0.5)',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	zIndex: 50,
	animation: 'overlay-enter 0.15s ease-out',
})

const dialog = css({
	bg: 'gray.2',
	borderRadius: 'lg',
	width: '520px',
	maxHeight: '80vh',
	display: 'flex',
	flexDirection: 'column',
	overflow: 'hidden',
	boxShadow: '0 24px 64px -8px rgba(0, 0, 0, 0.4), 0 0 0 1px {colors.gray.a3}',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a3',
	animation: 'modal-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
})

// ─── Header ───────────────────────────────────────────────

const dialogHeader = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	px: '6',
	py: '5',
	borderBottom: '1px solid',
	borderBottomColor: 'gray.a2',
})

const headerLeft = css({
	display: 'flex',
	flexDirection: 'column',
	gap: '1',
})

const dialogTitle = css({
	fontSize: '18px',
	fontWeight: '700',
	color: 'fg.default',
	letterSpacing: '-0.02em',
})

const dialogSubtitle = css({
	fontSize: '13px',
	color: 'fg.muted',
})

const closeBtn = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '8',
	height: '8',
	borderRadius: 'md',
	cursor: 'pointer',
	color: 'fg.subtle',
	transition: 'all 0.15s',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
})

// ─── Body ─────────────────────────────────────────────────

const body = css({
	flex: 1,
	overflow: 'auto',
	px: '6',
	py: '5',
})

const sectionTitle = css({
	display: 'flex',
	alignItems: 'center',
	gap: '2',
	fontSize: '12px',
	fontWeight: '700',
	color: 'fg.subtle',
	textTransform: 'uppercase',
	letterSpacing: '0.05em',
	mb: '3',
})

const sectionIcon = css({
	width: '3.5',
	height: '3.5',
})

const sectionDivider = css({
	height: '1px',
	bg: 'gray.a2',
	my: '5',
})

// ─── Setting rows ─────────────────────────────────────────

const settingRow = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	gap: '4',
	py: '3',
})

const settingInfo = css({
	flex: 1,
})

const settingLabel = css({
	fontSize: '14px',
	fontWeight: '500',
	color: 'fg.default',
	letterSpacing: '-0.01em',
})

const settingDesc = css({
	fontSize: '12px',
	color: 'fg.muted',
	mt: '1',
	lineHeight: '1.5',
})

const settingInput = css({
	bg: 'gray.a2',
	border: '1px solid',
	borderColor: 'gray.a4',
	borderRadius: 'md',
	px: '3',
	py: '2',
	fontSize: '13px',
	color: 'fg.default',
	fontFamily: 'mono',
	width: '220px',
	outline: 'none',
	transition: 'border-color 0.15s',
	_focus: { borderColor: 'indigo.8' },
	'&::placeholder': { color: 'fg.subtle' },
})

// ─── Controls ─────────────────────────────────────────────

const segmentedGroup = css({
	display: 'flex',
	borderRadius: 'md',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a3',
	overflow: 'hidden',
	bg: 'gray.a2',
})

const segmentedOption = css({
	display: 'flex',
	alignItems: 'center',
	gap: '1.5',
	px: '3.5',
	py: '2',
	fontSize: '13px',
	fontWeight: '500',
	cursor: 'pointer',
	color: 'fg.muted',
	transition: 'all 0.15s',
	borderRight: '1px solid',
	borderRightColor: 'gray.a3',
	_hover: { color: 'fg.default', bg: 'gray.a3' },
	_last: { borderRight: 'none' },
	'&[data-active="true"]': {
		bg: 'indigo.a2',
		color: 'indigo.11',
		fontWeight: '600',
	},
})

const segmentedIcon = css({
	width: '3.5',
	height: '3.5',
})

const themeGroup = css({
	display: 'flex',
	borderRadius: 'md',
	borderWidth: '1px',
	borderStyle: 'solid',
	borderColor: 'gray.a3',
	overflow: 'hidden',
	bg: 'gray.a2',
})

const themeOption = css({
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	gap: '1.5',
	px: '4',
	py: '3',
	cursor: 'pointer',
	transition: 'all 0.15s',
	color: 'fg.muted',
	borderRight: '1px solid',
	borderRightColor: 'gray.a3',
	_hover: { bg: 'gray.a3', color: 'fg.default' },
	_last: { borderRight: 'none' },
	'&[data-active="true"]': {
		bg: 'indigo.a2',
		color: 'indigo.11',
	},
})

const themeOptionIcon = css({
	width: '5',
	height: '5',
})

const themeOptionLabel = css({
	fontSize: '11px',
	fontWeight: '600',
})

// ─── Toggle switch ────────────────────────────────────

const toggleTrack = css({
	position: 'relative',
	width: '40px',
	height: '22px',
	borderRadius: 'full',
	bg: 'gray.a4',
	cursor: 'pointer',
	transition: 'background 0.2s',
	flexShrink: 0,
	'&[data-active="true"]': {
		bg: 'indigo.9',
	},
	'&[data-active="true"] > div': {
		transform: 'translateX(18px)',
	},
})

const toggleThumb = css({
	position: 'absolute',
	top: '2px',
	left: '2px',
	width: '18px',
	height: '18px',
	borderRadius: 'full',
	bg: 'white',
	boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
	transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
})

// ─── Footer ───────────────────────────────────────────────

const footer = css({
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	gap: '1.5',
	px: '6',
	py: '4',
	borderTop: '1px solid',
	borderTopColor: 'gray.a2',
	fontSize: '12px',
	color: 'fg.subtle',
})

export function SettingsDialog() {
	const settings = useSettingsStore()
	const [cliInstalled, setCliInstalled] = createSignal(false)
	const [hasPinSet, setHasPinSet] = createSignal(false)

	onMount(async () => {
		setCliInstalled(await window.electronAPI.isCliInstalled())
		setHasPinSet(await window.electronAPI.hasLockPin())
	})

	const [pinDialog, setPinDialog] = createSignal<{
		title: string; description: string; confirmLabel: string;
		onConfirm: (pin: string) => void | Promise<void>
	} | null>(null)

	function toggleLockPin() {
		if (hasPinSet()) {
			setPinDialog({
				title: 'Remove lock PIN',
				description: 'Enter your current PIN to remove it. All notes will be unlocked.',
				confirmLabel: 'Remove PIN',
				onConfirm: async (pin) => {
					const valid = await window.electronAPI.verifyLockPin(pin)
					if (!valid) throw new Error('Incorrect PIN')
					await window.electronAPI.removeLockPin()
					setHasPinSet(false)
					setPinDialog(null)
				},
			})
		} else {
			setPinDialog({
				title: 'Set a lock PIN',
				description: 'This PIN will be used to lock and unlock notes.',
				confirmLabel: 'Set PIN',
				onConfirm: async (pin) => {
					await window.electronAPI.setLockPin(pin)
					setHasPinSet(true)
					setPinDialog(null)
				},
			})
		}
	}

	async function toggleCli() {
		if (cliInstalled()) {
			const result = await window.electronAPI.uninstallCli()
			if (result.success) setCliInstalled(false)
		} else {
			const result = await window.electronAPI.installCli()
			if (result.success) setCliInstalled(true)
		}
	}

	return (
		<>
		<Show when={settings.showSettingsDialog()}>
			<div
				class={overlay}
				onClick={() => settings.setShowSettingsDialog(false)}
			>
				<div class={dialog} onClick={(e) => e.stopPropagation()}>
					{/* Header */}
					<div class={dialogHeader}>
						<div class={headerLeft}>
							<span class={dialogTitle}>Settings</span>
							<span class={dialogSubtitle}>Customize your noted. experience</span>
						</div>
						<button
							class={closeBtn}
							onClick={() => settings.setShowSettingsDialog(false)}
						>
							<XIcon class={css({ width: '4', height: '4' })} />
						</button>
					</div>

					{/* Body */}
					<div class={body}>
						{/* Appearance section */}
						<div class={sectionTitle}>
							<PaletteIcon class={sectionIcon} />
							Appearance
						</div>

						<div class={settingRow}>
							<div class={settingInfo}>
								<div class={settingLabel}>Theme</div>
								<div class={settingDesc}>
									Choose how Notes looks to you
								</div>
							</div>
							<div class={themeGroup}>
								<div
									class={themeOption}
									data-active={settings.theme() === 'light'}
									onClick={() => settings.setTheme('light')}
								>
									<SunIcon class={themeOptionIcon} />
									<span class={themeOptionLabel}>Light</span>
								</div>
								<div
									class={themeOption}
									data-active={settings.theme() === 'warm'}
									onClick={() => settings.setTheme('warm')}
								>
									<CoffeeIcon class={themeOptionIcon} />
									<span class={themeOptionLabel}>Warm</span>
								</div>
								<div
									class={themeOption}
									data-active={settings.theme() === 'slate'}
									onClick={() => settings.setTheme('slate')}
								>
									<CloudyIcon class={themeOptionIcon} />
									<span class={themeOptionLabel}>Slate</span>
								</div>
								<div
									class={themeOption}
									data-active={settings.theme() === 'dark'}
									onClick={() => settings.setTheme('dark')}
								>
									<MoonIcon class={themeOptionIcon} />
									<span class={themeOptionLabel}>Dark</span>
								</div>
								<div
									class={themeOption}
									data-active={settings.theme() === 'system'}
									onClick={() => settings.setTheme('system')}
								>
									<MonitorIcon class={themeOptionIcon} />
									<span class={themeOptionLabel}>System</span>
								</div>
							</div>
						</div>

						<div class={sectionDivider} />

						{/* Editor section */}
						<div class={sectionTitle}>
							<TypeIcon class={sectionIcon} />
							Editor
						</div>

						<div class={settingRow}>
							<div class={settingInfo}>
								<div class={settingLabel}>Default note type</div>
								<div class={settingDesc}>
									New notes will open with this editor
								</div>
							</div>
							<div class={segmentedGroup}>
								<div
									class={segmentedOption}
									data-active={settings.defaultNoteType() === 'rich'}
									onClick={() => settings.setDefaultNoteType('rich')}
								>
									<PenLineIcon class={segmentedIcon} />
									Rich Text
								</div>
								<div
									class={segmentedOption}
									data-active={settings.defaultNoteType() === 'plain'}
									onClick={() => settings.setDefaultNoteType('plain')}
								>
									<FileIcon class={segmentedIcon} />
									Plain Text
								</div>
							</div>
						</div>

						<div class={sectionDivider} />

						{/* Security section */}
						<div class={sectionTitle}>
							<ShieldIcon class={sectionIcon} />
							Security
						</div>

						<div class={settingRow}>
							<div class={settingInfo}>
								<div class={settingLabel}>Lock PIN</div>
								<div class={settingDesc}>
									{hasPinSet()
										? 'A PIN is set. Locked notes require this PIN to view.'
										: 'Set a PIN to enable note locking. Lock individual notes from the editor controls.'}
								</div>
							</div>
							<button
								class={toggleTrack}
								data-active={hasPinSet()}
								onClick={toggleLockPin}
							>
								<div class={toggleThumb} />
							</button>
						</div>

						<div class={sectionDivider} />

						{/* Popout section */}
						<div class={sectionTitle}>
							<ExternalLinkIcon class={sectionIcon} />
							Popout
						</div>

						<div class={settingRow}>
							<div class={settingInfo}>
								<div class={settingLabel}>Hide from Alt+Tab</div>
								<div class={settingDesc}>
									When enabled, pinned popout windows won't appear in the task switcher
								</div>
							</div>
							<button
								class={toggleTrack}
								data-active={settings.popoutSkipTaskbar()}
								onClick={() => settings.setPopoutSkipTaskbar(!settings.popoutSkipTaskbar())}
							>
								<div class={toggleThumb} />
							</button>
						</div>

						<div class={sectionDivider} />

						{/* Sync section */}
						<div class={sectionTitle}>
							<RefreshCwIcon class={sectionIcon} />
							Collaboration
						</div>

						<div class={settingRow}>
							<div class={settingInfo}>
								<div class={settingLabel}>Sync server</div>
								<div class={settingDesc}>
									WebSocket URL for real-time collaboration
								</div>
							</div>
							<input
								class={settingInput}
								value={settings.syncServerUrl()}
								onInput={(e) => settings.setSyncServerUrl(e.currentTarget.value)}
								placeholder="wss://your-sync-server.com"
							/>
						</div>

						<div class={settingRow}>
							<div class={settingInfo}>
								<div class={settingLabel}>Auth token</div>
								<div class={settingDesc}>
									Token for authenticating with the sync server
								</div>
							</div>
							<input
								class={settingInput}
								value={settings.syncToken()}
								onInput={(e) => settings.setSyncToken(e.currentTarget.value)}
								placeholder="Optional"
							/>
						</div>

						<div class={sectionDivider} />

						{/* CLI section */}
						<div class={sectionTitle}>
							<TerminalIcon class={sectionIcon} />
							Command Line
						</div>

						<div class={settingRow}>
							<div class={settingInfo}>
								<div class={settingLabel}>Install CLI</div>
								<div class={settingDesc}>
									Adds the <code style={{ 'font-family': 'var(--fonts-mono)', 'font-size': '11px', background: 'var(--colors-gray-a3)', padding: '1px 5px', 'border-radius': '3px' }}>noted-cli</code> command to your system PATH for creating and managing notes from the terminal
								</div>
							</div>
							<button
								class={toggleTrack}
								data-active={cliInstalled()}
								onClick={toggleCli}
							>
								<div class={toggleThumb} />
							</button>
						</div>

						<div class={sectionDivider} />

						{/* About section */}
						<div class={sectionTitle}>
							<InfoIcon class={sectionIcon} />
							About
						</div>

						<div class={settingRow}>
							<div class={settingInfo}>
								<div class={settingLabel}>Version</div>
								<div class={settingDesc}>
									noted. — a minimal, distraction-free note-taking app
								</div>
							</div>
							<span class={css({ fontSize: '13px', color: 'fg.muted', fontWeight: '500' })}>
								1.0.0
							</span>
						</div>
					</div>

					{/* Footer */}
					<div class={footer}>
						<img
							src="./noted-logo.svg"
							alt="noted"
							style={{ height: '14px' }}
							draggable={false}
						/>
						<span>Made with care by Eyetu Kingsley</span>
					</div>
				</div>
			</div>
		</Show>
		<Show when={pinDialog()}>
			{(dlg) => (
				<PinDialog
					title={dlg().title}
					description={dlg().description}
					confirmLabel={dlg().confirmLabel}
					onConfirm={dlg().onConfirm}
					onCancel={() => setPinDialog(null)}
				/>
			)}
		</Show>
		</>
	)
}
