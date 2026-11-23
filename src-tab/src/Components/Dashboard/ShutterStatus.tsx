import React from 'react';

import {
    AcUnit,
    Air,
    ArrowDownward,
    ArrowUpward,
    Celebration,
    HelpOutlined,
    LocalFireDepartment,
    PanTool,
    RemoveCircleOutlined,
    Umbrella,
    VerticalAlignCenter,
    WbSunny,
    Window,
} from '@mui/icons-material';

import { I18n } from '@iobroker/gui-components';

import { Pill } from './Parts';
import { type DashboardTokens } from './tokens';

type StatusKind = 'neutral' | 'open' | 'closed' | 'sun' | 'manual' | 'trigger' | 'alarm';

/** All values the adapter writes to `shutters.autoState.<name>` (currentAction) */
const STATUS: Record<string, { label: string; kind: StatusKind; icon: React.ComponentType<{ fontSize?: 'inherit' }> }> =
    {
        none: { label: 'status_none', kind: 'neutral', icon: RemoveCircleOutlined },
        up: { label: 'status_up', kind: 'open', icon: ArrowUpward },
        down: { label: 'status_down', kind: 'closed', icon: ArrowDownward },
        middle: { label: 'status_middle', kind: 'closed', icon: VerticalAlignCenter },
        Xmas: { label: 'status_Xmas', kind: 'closed', icon: Celebration },
        sunProtect: { label: 'status_sunProtect', kind: 'sun', icon: WbSunny },
        manu_sunProtect: { label: 'status_manu_sunProtect', kind: 'sun', icon: WbSunny },
        OpenInSunProtect: { label: 'status_OpenInSunProtect', kind: 'sun', icon: WbSunny },
        Manu_Mode: { label: 'status_Manu_Mode', kind: 'manual', icon: PanTool },
        triggered: { label: 'status_triggered', kind: 'trigger', icon: Window },
        frost: { label: 'status_frost', kind: 'alarm', icon: AcUnit },
        alarmFrost: { label: 'status_frost', kind: 'alarm', icon: AcUnit },
        rain: { label: 'status_rain', kind: 'alarm', icon: Umbrella },
        alarmRain: { label: 'status_rain', kind: 'alarm', icon: Umbrella },
        fire: { label: 'status_fire', kind: 'alarm', icon: LocalFireDepartment },
        alarmFire: { label: 'status_fire', kind: 'alarm', icon: LocalFireDepartment },
        wind1: { label: 'status_wind1', kind: 'alarm', icon: Air },
        wind2: { label: 'status_wind2', kind: 'alarm', icon: Air },
    };

/** Colors per kind: [text dark, text light, rgb of background and border] */
const COLORS: Record<StatusKind, [string, string, string]> = {
    neutral: ['#A7B4C6', '#475569', '100, 116, 139'],
    open: ['#4ADE80', '#15803D', '34, 197, 94'],
    closed: ['#7CC0FF', '#1D4ED8', '59, 130, 246'],
    sun: ['#FCD34D', '#B45309', '245, 158, 11'],
    manual: ['#C4B5FD', '#6D28D9', '139, 92, 246'],
    trigger: ['#5EEAD4', '#0F766E', '20, 184, 166'],
    alarm: ['#FCA5A5', '#B91C1C', '239, 68, 68'],
};

/**
 * Translated status of a shutter (`autoState`) as a colored pill with an icon.
 *
 * @param props properties
 * @param props.t colors of the dashboard
 * @param props.value raw value of the state
 */
export default function ShutterStatus(props: {
    t: DashboardTokens;
    value: ioBroker.StateValue | undefined;
}): React.JSX.Element {
    const { t } = props;
    if (props.value === undefined || props.value === null || props.value === '') {
        return <span style={{ color: t.textMuted }}>--</span>;
    }
    const raw = String(props.value);
    const status = STATUS[raw];
    const kind = status?.kind || 'neutral';
    const [dark, light, rgb] = COLORS[kind];

    return (
        <Pill
            color={t.dark ? dark : light}
            background={`rgba(${rgb}, ${t.dark ? 0.16 : 0.1})`}
            border={`rgba(${rgb}, ${t.dark ? 0.5 : 0.4})`}
            icon={
                <span style={{ display: 'inline-flex', fontSize: 15 }}>
                    {status ? <status.icon fontSize="inherit" /> : <HelpOutlined fontSize="inherit" />}
                </span>
            }
            title={raw}
        >
            {status ? I18n.t(status.label) : raw}
        </Pill>
    );
}
