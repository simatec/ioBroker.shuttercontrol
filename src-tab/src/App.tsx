import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import {
    Box,
    CssBaseline,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Tab,
    Tabs,
    Tooltip,
} from '@mui/material';

import {
    AccessTime,
    BeachAccess,
    ChildCare,
    Explore,
    Favorite,
    Help,
    Height,
    Hotel,
    Info,
    Living,
    MoreVert,
    School,
    SettingsOutlined,
    Tune,
    TouchApp,
    WbSunny,
    WbTwilight,
    Window,
} from '@mui/icons-material';

import {
    GenericApp,
    I18n,
    Loader,
    AdminConnection,
    ScrollbarStyles,
    type GenericAppProps,
    type GenericAppState,
} from '@iobroker/gui-components';

import logo from './assets/shuttercontrol.svg';

import AliveLed from './Components/Dashboard/AliveLed';
import InfoTile from './Components/Dashboard/InfoTile';
import SwitchTile from './Components/Dashboard/SwitchTile';
import { revealSx } from './Components/Dashboard/motion';
import { getTokens, type DashboardTokens } from './Components/Dashboard/tokens';
import { ActionTile, DashboardCard, RoundButton, SectionHeader } from './Components/Dashboard/Parts';
import {
    ShutterAutoIcon,
    ShutterCloseIcon,
    ShutterOpenIcon,
    ShutterSunIcon,
} from './Components/Dashboard/ShutterIcons';
import ShutterTable, { type ShutterEntry } from './Components/ShutterTable';

const isDarkThemeName = (themeName?: string): boolean => themeName === 'modernDark' || themeName === 'dark';

const DONATE_URL = 'https://paypal.me/mk1676';
const WIKI_URL = 'https://github.com/simatec/ioBroker.shuttercontrol/wiki';
const README_URL = 'https://github.com/simatec/ioBroker.shuttercontrol/blob/master/README.md';

/** Pages of the tab, the same as the panels of the former jsonTab */
type TabPage = 'control' | 'shutters';

/** Read only states of the "Information and journey times" block */
const INFO_STATES: { id: string; label: string; unit?: string; icon: React.ReactNode }[] = [
    { id: 'info.Azimut', label: 'current Azimut', unit: '°', icon: <Explore fontSize="inherit" /> },
    { id: 'info.Elevation', label: 'current Elevation', unit: '°', icon: <Height fontSize="inherit" /> },
    { id: 'info.GoldenHour', label: 'Start GoldenHour', icon: <WbTwilight fontSize="inherit" /> },
    { id: 'info.GoldenHourEnd', label: 'End GoldenHour', icon: <WbTwilight fontSize="inherit" /> },
    { id: 'info.Sunrise', label: 'Sunrise Time', icon: <WbSunny fontSize="inherit" /> },
    { id: 'info.Sunset', label: 'Sunset Time', icon: <WbTwilight fontSize="inherit" /> },
    { id: 'info.downTimeChildren', label: 'down Time Children Area', icon: <AccessTime fontSize="inherit" /> },
    { id: 'info.downTimeLiving', label: 'down Time Living Area', icon: <AccessTime fontSize="inherit" /> },
    { id: 'info.downTimeSleep', label: 'down Time Sleep Area', icon: <AccessTime fontSize="inherit" /> },
    { id: 'info.upTimeChildren', label: 'Up Time Children Area', icon: <AccessTime fontSize="inherit" /> },
    { id: 'info.upTimeLiving', label: 'Up Time Living Area', icon: <AccessTime fontSize="inherit" /> },
    { id: 'info.upTimeSleep', label: 'Up Time Sleep Area', icon: <AccessTime fontSize="inherit" /> },
];

/** Buttons of the "Shutter mode control" block, grouped by area like in the former jsonTab */
const ACTION_GROUPS: {
    title: string;
    icon: React.ReactNode;
    actions: { id: string; label: string; short: string; icon: React.ReactNode; primary?: boolean }[];
}[] = [
    {
        title: 'Living Area',
        icon: <Living fontSize="inherit" />,
        actions: [
            {
                id: 'openLiving',
                short: 'Open',
                label: 'Open all shutters in the living area',
                icon: <ShutterOpenIcon fontSize="inherit" />,
            },
            {
                id: 'closeLiving',
                short: 'Close',
                label: 'Close all shutters in the living area',
                icon: <ShutterCloseIcon fontSize="inherit" />,
            },
            {
                id: 'sunProtectLiving',
                short: 'Sun protection',
                label: 'Move Living area into the sun protection',
                icon: <ShutterSunIcon fontSize="inherit" />,
            },
        ],
    },
    {
        title: 'Sleep Area',
        icon: <Hotel fontSize="inherit" />,
        actions: [
            {
                id: 'openSleep',
                short: 'Open',
                label: 'Open all shutters in sleeping area',
                icon: <ShutterOpenIcon fontSize="inherit" />,
            },
            {
                id: 'closeSleep',
                short: 'Close',
                label: 'Close all shutters in sleeping area',
                icon: <ShutterCloseIcon fontSize="inherit" />,
            },
            {
                id: 'sunProtectSleep',
                short: 'Sun protection',
                label: 'Move Sleep area into the sun protection',
                icon: <ShutterSunIcon fontSize="inherit" />,
            },
        ],
    },
    {
        title: 'Children Area',
        icon: <ChildCare fontSize="inherit" />,
        actions: [
            {
                id: 'openChildren',
                short: 'Open',
                label: "Open all shutters in children's area",
                icon: <ShutterOpenIcon fontSize="inherit" />,
            },
            {
                id: 'closeChildren',
                short: 'Close',
                label: "Close all shutters in children's area",
                icon: <ShutterCloseIcon fontSize="inherit" />,
            },
            {
                id: 'sunProtectChildren',
                short: 'Sun protection',
                label: "Move children's area into the sun protection",
                icon: <ShutterSunIcon fontSize="inherit" />,
            },
        ],
    },
    {
        title: 'All shutters',
        icon: <Window fontSize="inherit" />,
        actions: [
            {
                id: 'openAll',
                short: 'Open',
                label: 'Open all shutters',
                icon: <ShutterOpenIcon fontSize="inherit" />,
                primary: true,
            },
            {
                id: 'closeAll',
                short: 'Close',
                label: 'Close all shutters',
                icon: <ShutterCloseIcon fontSize="inherit" />,
                primary: true,
            },
            {
                id: 'sunProtect',
                short: 'Sun protection',
                label: 'Move shutters into the sun protection',
                icon: <ShutterSunIcon fontSize="inherit" />,
            },
            {
                id: 'autoAll',
                short: 'Automatic mode',
                label: 'Automatic mode for all shutters',
                icon: <ShutterAutoIcon fontSize="inherit" />,
            },
        ],
    },
];

/** Switches of the "Control unit settings" block */
const SETTING_STATES: { id: string; label: string; icon: React.ReactNode; newLine?: boolean }[] = [
    { id: 'control.autoChildren', label: "Automatic children's area", icon: <ChildCare fontSize="inherit" /> },
    { id: 'control.autoLiving', label: 'Automatic living area', icon: <Living fontSize="inherit" /> },
    { id: 'control.autoSleep', label: 'Automatic sleeping area', icon: <Hotel fontSize="inherit" /> },
    { id: 'control.Holiday', label: 'Holiday', icon: <BeachAccess fontSize="inherit" /> },
    { id: 'control.schoolfree', label: 'Schoolfree', icon: <School fontSize="inherit" /> },
];

interface AppState extends GenericAppState {
    myAlive: boolean;
    tab: TabPage;
    /** Raw values of the info and control states, key is the ID relative to the instance */
    values: Record<string, ioBroker.StateValue | undefined>;
    /** Shutters of the configuration, like the adapter answers on the `tab` command */
    shutters: ShutterEntry[];
    moreMenu: HTMLElement | null;
    /** The language files from admin/tab/i18n are loaded */
    i18nLoaded: boolean;
}

/**
 * Loads one language file of the tab. The files are in admin/tab/i18n (copied there by the build),
 * so the adapter package ships them like the language files of the configuration.
 *
 * @param lang language
 */
async function loadLanguage(lang: string): Promise<Record<string, string> | null> {
    try {
        const response = await fetch(`tab/i18n/${lang}.json`);
        return response.ok ? ((await response.json()) as Record<string, string>) : null;
    } catch {
        return null;
    }
}

export default class App extends GenericApp<GenericAppProps, AppState> {
    constructor(props: GenericAppProps) {
        const extendedProps = { ...props };
        // @ts-expect-error fix later
        extendedProps.Connection = AdminConnection;

        extendedProps.sentryDSN = window.sentryDSN;
        // extendedProps.socket = {
        //     protocol: 'http:',
        //     host: '192.168.178.45',
        //     port: 8081,
        // };

        super(props, extendedProps);

        let tab: TabPage = 'control';
        try {
            tab = window.localStorage.getItem('Shuttercontrol.tab') === 'shutters' ? 'shutters' : 'control';
        } catch {
            // ignore
        }

        this.state = {
            ...this.state,
            myAlive: false,
            tab,
            values: {},
            shutters: [],
            moreMenu: null,
            i18nLoaded: false,
        };
    }

    /**
     * Dark/Light is taken from this.state.themeName
     * (valid values: 'modernLight' | 'modernDark' | 'dark' | 'light').
     */
    isDark(): boolean {
        return isDarkThemeName(this.state.themeName);
    }

    /** For child components that still expect a themeType prop ('dark' | 'light') */
    get derivedThemeType(): 'dark' | 'light' {
        return this.isDark() ? 'dark' : 'light';
    }

    get statePrefix(): string {
        return `${this.adapterName}.${this.instance}`;
    }

    /** All states of this instance that are shown on the "Control and information" page */
    get watchedIds(): string[] {
        return [...INFO_STATES.map(s => s.id), ...SETTING_STATES.map(s => s.id)].map(id => `${this.statePrefix}.${id}`);
    }

    /**
     * Builds the shutter list from the configuration, the same way the adapter does on the `tab` command.
     *
     * @param native configuration of the instance
     */
    static getShutters(native: Record<string, any>): ShutterEntry[] {
        const events: { shutterName?: string; name?: string }[] = Array.isArray(native?.events) ? native.events : [];
        return events
            .filter(event => event && typeof event.shutterName === 'string')
            .map(event => {
                const shutterName = event.shutterName as string;
                const nameDevice = shutterName.replace(/[.;, ]/g, '_');
                return {
                    shutterName,
                    name: event.name || '',
                    autoState: `shutters.autoState.${nameDevice}`,
                    autoDown: `shutters.autoDown.${nameDevice}`,
                    autoUp: `shutters.autoUp.${nameDevice}`,
                    autoSun: `shutters.autoSun.${nameDevice}`,
                };
            });
    }

    /** Loads the language of the user and English as fallback from admin/tab/i18n */
    static async loadTranslations(): Promise<void> {
        const lang = I18n.getLanguage();
        const [en, words] = await Promise.all([loadLanguage('en'), lang === 'en' ? null : loadLanguage(lang)]);
        if (en) {
            I18n.extendTranslations(en, 'en');
        }
        if (words) {
            I18n.extendTranslations(words, lang);
        }
        if (!en && !words) {
            console.warn('Cannot load the language files of the tab');
        }
    }

    async onConnectionReady(): Promise<void> {
        // the language of the page is needed for the hyphenation of long labels
        document.documentElement.lang = I18n.getLanguage();
        await App.loadTranslations();
        this.setState({ i18nLoaded: true });
        const myAlive = await this.socket.getState(`system.adapter.${this.statePrefix}.alive`);
        const newState: Partial<AppState> = {
            myAlive: !!myAlive?.val,
            shutters: App.getShutters(this.state.native),
        };

        const values: Record<string, ioBroker.StateValue | undefined> = {};
        const prefixLength = this.statePrefix.length + 1;
        await Promise.all(
            this.watchedIds.map(async id => {
                const state = await this.socket.getState(id);
                values[id.substring(prefixLength)] = state?.val;
            }),
        );
        newState.values = values;

        await this.socket.subscribeState(`system.adapter.${this.statePrefix}.alive`, this.onAlive);
        await this.socket.subscribeObject(`system.adapter.${this.statePrefix}`, this.onSettings);
        await this.socket.subscribeState(this.watchedIds, this.onValue);

        this.setState(newState as AppState);
    }

    onSettings = (id: string, obj: ioBroker.Object | null | undefined): void => {
        if (obj && id === `system.adapter.${this.statePrefix}`) {
            const native = (obj as ioBroker.InstanceObject).native;
            this.setState({ native, shutters: App.getShutters(native) });
        }
    };

    onValue = (id: string, state: ioBroker.State | null | undefined): void => {
        const key = id.substring(this.statePrefix.length + 1);
        // functional update: several changes can arrive before React applied the previous one
        this.setState(prev =>
            prev.values[key] === state?.val ? null : { values: { ...prev.values, [key]: state?.val } },
        );
    };

    componentWillUnmount(): void {
        super.componentWillUnmount();
        this.socket.unsubscribeState(`system.adapter.${this.statePrefix}.alive`, this.onAlive);
        void this.socket.unsubscribeObject(`system.adapter.${this.statePrefix}`, this.onSettings);
        this.socket.unsubscribeState(this.watchedIds, this.onValue);
    }

    onAlive = (id: string, state: ioBroker.State | null | undefined): void => {
        if (id === `system.adapter.${this.statePrefix}.alive`) {
            if (!!state?.val !== this.state.myAlive) {
                this.setState({ myAlive: !!state?.val });
            }
        }
    };

    openConfiguration(): void {
        try {
            window.parent.postMessage(`goto:tab-instances/config/system.adapter.${this.statePrefix}`, '*');
        } catch {
            // ignore
        }
    }

    /**
     * Formats a value of an info state for the display.
     *
     * @param val raw value
     */
    formatValue(val: ioBroker.StateValue | undefined): string | null {
        if (val === undefined || val === null || val === '') {
            return null;
        }
        if (typeof val === 'number') {
            const text = (Math.round(val * 100) / 100).toString();
            return this.socket.systemConfig?.common.isFloatComma ? text.replace('.', ',') : text;
        }
        return String(val);
    }

    /**
     * Sends a command button, like the setState buttons of the former jsonTab.
     *
     * @param id ID of the button below `control`
     */
    async onAction(id: string): Promise<void> {
        try {
            await this.socket.setState(`${this.statePrefix}.control.${id}`, true, true);
        } catch (e) {
            this.showToast(`${I18n.t('Error')}: ${e}`);
        }
    }

    /**
     * Writes a setting of the control unit, like the state controls of the former jsonTab.
     *
     * @param id ID relative to the instance
     * @param value new value
     */
    async onSetting(id: string, value: boolean): Promise<void> {
        this.setState(prev => ({ values: { ...prev.values, [id]: value } }));
        try {
            await this.socket.setState(`${this.statePrefix}.${id}`, value, true);
        } catch (e) {
            this.showToast(`${I18n.t('Error')}: ${e}`);
        }
    }

    renderHeader(t: DashboardTokens): React.JSX.Element {
        return (
            <Box
                component="header"
                sx={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: { xs: '10px', sm: '14px' },
                    padding: { xs: '6px 12px', sm: '8px 28px' },
                    borderBottom: `1px solid ${t.divider}`,
                    background: t.dark ? 'rgba(255, 255, 255, 0.015)' : '#FFFFFF',
                }}
            >
                <img
                    src={logo}
                    alt="Shuttercontrol"
                    style={{
                        height: 40,
                        flexShrink: 0,
                        filter: t.dark ? 'invert(1) drop-shadow(0 0 8px rgba(56, 160, 255, 0.35))' : undefined,
                    }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontSize: '1.35rem',
                            fontWeight: 700,
                            letterSpacing: '-0.01em',
                            lineHeight: 1.15,
                            color: t.text,
                        }}
                    >
                        Shuttercontrol
                        <AliveLed
                            socket={this.socket}
                            instanceId={this.statePrefix}
                            alive={this.state.myAlive}
                        />
                    </div>
                    <div
                        style={{
                            color: t.textSecondary,
                            fontSize: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.9rem)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {I18n.t('Control and monitoring of Shuttercontrol')}
                    </div>
                </div>
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: '8px' }}>
                    <RoundButton
                        t={t}
                        title="PayPal.Me"
                        onClick={() => window.open(DONATE_URL, '_blank')}
                    >
                        <Favorite />
                    </RoundButton>
                    <RoundButton
                        t={t}
                        title="Wiki"
                        onClick={() => window.open(WIKI_URL, '_blank')}
                    >
                        <School />
                    </RoundButton>
                    <RoundButton
                        t={t}
                        title={I18n.t('Show adapter documentation')}
                        onClick={() => window.open(README_URL, '_blank')}
                    >
                        <Help />
                    </RoundButton>
                </Box>
                <Tooltip
                    title={I18n.t('More')}
                    slotProps={{ popper: { sx: { pointerEvents: 'none' } } }}
                >
                    <IconButton
                        onClick={e => this.setState({ moreMenu: e.currentTarget })}
                        sx={{ color: t.text }}
                    >
                        <MoreVert />
                    </IconButton>
                </Tooltip>
                <Menu
                    open={!!this.state.moreMenu}
                    anchorEl={this.state.moreMenu}
                    onClose={() => this.setState({ moreMenu: null })}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <MenuItem
                        onClick={() => {
                            this.setState({ moreMenu: null });
                            this.openConfiguration();
                        }}
                    >
                        <ListItemIcon>
                            <SettingsOutlined fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>{I18n.t('Open adapter configuration')}</ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            this.setState({ moreMenu: null });
                            window.open(DONATE_URL, '_blank');
                        }}
                        sx={{ display: { xs: 'flex', sm: 'none' } }}
                    >
                        <ListItemIcon>
                            <Favorite fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>PayPal.Me</ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            this.setState({ moreMenu: null });
                            window.open(WIKI_URL, '_blank');
                        }}
                        sx={{ display: { xs: 'flex', sm: 'none' } }}
                    >
                        <ListItemIcon>
                            <School fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Wiki</ListItemText>
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            this.setState({ moreMenu: null });
                            window.open(README_URL, '_blank');
                        }}
                        sx={{ display: { xs: 'flex', sm: 'none' } }}
                    >
                        <ListItemIcon>
                            <Help fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>{I18n.t('Show adapter documentation')}</ListItemText>
                    </MenuItem>
                </Menu>
            </Box>
        );
    }

    renderTabs(t: DashboardTokens): React.JSX.Element {
        return (
            <Tabs
                value={this.state.tab}
                onChange={(_e, tab: TabPage) => {
                    try {
                        window.localStorage.setItem('Shuttercontrol.tab', tab);
                    } catch {
                        // ignore
                    }
                    this.setState({ tab });
                }}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                    flexShrink: 0,
                    minHeight: 44,
                    padding: { xs: '0 4px', sm: '0 20px' },
                    borderBottom: `1px solid ${t.divider}`,
                    '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 600 },
                }}
            >
                <Tab
                    value="control"
                    icon={<Tune fontSize="small" />}
                    iconPosition="start"
                    label={I18n.t('Control and information')}
                />
                <Tab
                    value="shutters"
                    icon={<Window fontSize="small" />}
                    iconPosition="start"
                    label={I18n.t('Shutter control')}
                />
            </Tabs>
        );
    }

    renderInfo(t: DashboardTokens): React.JSX.Element {
        return (
            <>
                <SectionHeader
                    t={t}
                    icon={<Info fontSize="inherit" />}
                    title={I18n.t('Information and journey times')}
                />
                <Box
                    sx={{
                        display: 'grid',
                        // 12 values: 6 per row on wide screens, 2 rows
                        gridTemplateColumns: {
                            xs: 'repeat(2, minmax(0, 1fr))',
                            sm: 'repeat(3, minmax(0, 1fr))',
                            lg: 'repeat(6, minmax(0, 1fr))',
                        },
                        columnGap: { xs: '8px', sm: '20px' },
                        rowGap: { xs: '8px', sm: '14px' },
                    }}
                >
                    {INFO_STATES.map(info => (
                        <InfoTile
                            key={info.id}
                            t={t}
                            icon={info.icon}
                            label={I18n.t(info.label)}
                            value={this.formatValue(this.state.values[info.id])}
                            unit={info.unit}
                        />
                    ))}
                </Box>
            </>
        );
    }

    renderActions(t: DashboardTokens): React.JSX.Element {
        return (
            <>
                <SectionHeader
                    t={t}
                    icon={<TouchApp fontSize="inherit" />}
                    title={I18n.t('Shutter mode control')}
                />
                {/* one card per area, side by side on wide screens, so the whole page fits without scrolling */}
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, minmax(0, 1fr))',
                            lg: 'repeat(4, minmax(0, 1fr))',
                        },
                        columnGap: { xs: '10px', sm: '20px' },
                        rowGap: { xs: '10px', sm: '14px' },
                    }}
                >
                    {ACTION_GROUPS.map(group => (
                        <DashboardCard
                            key={group.title}
                            t={t}
                            style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '0 4px',
                                    color: t.text,
                                    fontSize: '0.92rem',
                                    fontWeight: 700,
                                }}
                            >
                                <span style={{ display: 'flex', fontSize: 18, color: t.accent }}>{group.icon}</span>
                                {I18n.t(group.title)}
                            </div>
                            {group.actions.map(action => (
                                <ActionTile
                                    key={action.id}
                                    t={t}
                                    primary={action.primary}
                                    icon={action.icon}
                                    hoverEffect={action.id.startsWith('close') ? 'drop' : 'lift'}
                                    label={I18n.t(action.short)}
                                    ariaLabel={I18n.t(action.label)}
                                    disabled={!this.state.myAlive}
                                    title={
                                        this.state.myAlive ? I18n.t(action.label) : I18n.t('Instance is not running')
                                    }
                                    onClick={() => void this.onAction(action.id)}
                                />
                            ))}
                        </DashboardCard>
                    ))}
                </Box>
            </>
        );
    }

    renderSettings(t: DashboardTokens): React.JSX.Element {
        return (
            <>
                <SectionHeader
                    t={t}
                    icon={<SettingsOutlined fontSize="inherit" />}
                    title={I18n.t('Control unit settings')}
                />
                {/* the 5 switches fill the whole width: 5 per row on wide screens */}
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, minmax(0, 1fr))',
                            md: 'repeat(3, minmax(0, 1fr))',
                            lg: 'repeat(5, minmax(0, 1fr))',
                        },
                        columnGap: { xs: '10px', sm: '20px' },
                        rowGap: { xs: '10px', sm: '14px' },
                    }}
                >
                    {SETTING_STATES.map(setting => (
                        <SwitchTile
                            key={setting.id}
                            t={t}
                            icon={setting.icon}
                            label={I18n.t(setting.label)}
                            value={!!this.state.values[setting.id]}
                            onChange={value => void this.onSetting(setting.id, value)}
                        />
                    ))}
                </Box>
            </>
        );
    }

    renderShutters(t: DashboardTokens): React.JSX.Element {
        return (
            <>
                <SectionHeader
                    t={t}
                    icon={<Window fontSize="inherit" />}
                    title={I18n.t('Shutter control')}
                />
                <ShutterTable
                    t={t}
                    socket={this.socket}
                    statePrefix={this.statePrefix}
                    shutters={this.state.shutters}
                />
            </>
        );
    }

    render(): React.JSX.Element {
        if (!this.state.loaded || !this.state.i18nLoaded) {
            return (
                <StyledEngineProvider injectFirst>
                    <ThemeProvider theme={this.state.theme}>
                        <Loader themeType={this.derivedThemeType} />
                    </ThemeProvider>
                </StyledEngineProvider>
            );
        }

        const t = getTokens(this.isDark());

        return (
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <CssBaseline />
                    <ScrollbarStyles theme={this.state.theme} />
                    <div
                        className="App"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            background: this.state.theme.palette.background.default,
                            color: t.text,
                        }}
                    >
                        {this.renderHeader(t)}
                        {this.renderTabs(t)}
                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                overflow: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: { xs: '0 12px 16px', sm: '0 28px 24px' },
                            }}
                        >
                            {/* the blocks fade in one after another when the page opens */}
                            {this.state.tab === 'control' ? (
                                <React.Fragment key="control">
                                    <Box sx={revealSx(0)}>{this.renderInfo(t)}</Box>
                                    <Box sx={revealSx(1)}>{this.renderActions(t)}</Box>
                                    <Box sx={revealSx(2)}>{this.renderSettings(t)}</Box>
                                </React.Fragment>
                            ) : (
                                <Box
                                    key="shutters"
                                    sx={revealSx(0)}
                                >
                                    {this.renderShutters(t)}
                                </Box>
                            )}
                            {this.renderError()}
                        </Box>
                    </div>
                    {this.renderToast()}
                </ThemeProvider>
            </StyledEngineProvider>
        );
    }
}
