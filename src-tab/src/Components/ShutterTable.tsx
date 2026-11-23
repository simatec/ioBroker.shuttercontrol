import React from 'react';

import { Box, Slider, Switch, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

import { type AdminConnection, I18n } from '@iobroker/gui-components';

import { DashboardCard, Pill } from './Dashboard/Parts';
import { type DashboardTokens } from './Dashboard/tokens';

/** One configured shutter, with the IDs the adapter answers on the `tab` command */
export interface ShutterEntry {
    shutterName: string;
    /** Object ID of the shutter level (foreign state) */
    name: string;
    /** IDs relative to the instance, e.g. `shutters.autoUp.Kitchen` */
    autoState: string;
    autoDown: string;
    autoUp: string;
    autoSun: string;
}

interface LevelInfo {
    min: number;
    max: number;
    unit: string;
    writable: boolean;
}

interface ShutterTableProps {
    t: DashboardTokens;
    socket: AdminConnection;
    /** e.g. `shuttercontrol.0` */
    statePrefix: string;
    shutters: ShutterEntry[];
}

interface ShutterTableState {
    values: Record<string, ioBroker.StateValue | undefined>;
    levels: Record<string, LevelInfo>;
    /** Value of a slider while it is moved */
    dragging: Record<string, number>;
}

const SWITCHES: { attr: 'autoDown' | 'autoUp' | 'autoSun'; title: string }[] = [
    { attr: 'autoDown', title: 'Automatic closing' },
    { attr: 'autoUp', title: 'Automatic opening' },
    { attr: 'autoSun', title: 'Automatic sun protection' },
];

/**
 * Table of all configured shutters: mode, automatic switches and the shutter level.
 * It subscribes the states of the shutters on its own, so a moving shutter does not render the whole tab again.
 */
export default class ShutterTable extends React.Component<ShutterTableProps, ShutterTableState> {
    private subscribed: string[] = [];

    constructor(props: ShutterTableProps) {
        super(props);
        this.state = { values: {}, levels: {}, dragging: {} };
    }

    componentDidMount(): void {
        void this.subscribe();
    }

    componentDidUpdate(prevProps: ShutterTableProps): void {
        if (prevProps.shutters !== this.props.shutters || prevProps.statePrefix !== this.props.statePrefix) {
            this.unsubscribe();
            void this.subscribe();
        }
    }

    componentWillUnmount(): void {
        this.unsubscribe();
    }

    /** The full state ID of a shutter attribute */
    getId(shutter: ShutterEntry, attr: keyof ShutterEntry): string {
        if (attr === 'name') {
            return shutter.name;
        }
        return `${this.props.statePrefix}.${shutter[attr]}`;
    }

    async subscribe(): Promise<void> {
        const ids: string[] = [];
        const levelIds: string[] = [];
        for (const shutter of this.props.shutters) {
            ids.push(
                this.getId(shutter, 'autoState'),
                this.getId(shutter, 'autoDown'),
                this.getId(shutter, 'autoUp'),
                this.getId(shutter, 'autoSun'),
            );
            if (shutter.name) {
                ids.push(shutter.name);
                levelIds.push(shutter.name);
            }
        }
        const unique = [...new Set(ids)];
        this.subscribed = unique;

        const values: Record<string, ioBroker.StateValue | undefined> = {};
        const levels: Record<string, LevelInfo> = {};
        await Promise.all([
            ...unique.map(async id => {
                try {
                    const state = await this.props.socket.getState(id);
                    values[id] = state?.val;
                } catch {
                    values[id] = undefined;
                }
            }),
            ...[...new Set(levelIds)].map(async id => {
                try {
                    const obj = (await this.props.socket.getObject(id)) as ioBroker.StateObject | null | undefined;
                    const common = obj?.common;
                    levels[id] = {
                        min: typeof common?.min === 'number' ? common.min : 0,
                        max: typeof common?.max === 'number' ? common.max : 100,
                        unit: common?.unit ?? '%',
                        writable: common?.write !== false,
                    };
                } catch {
                    levels[id] = { min: 0, max: 100, unit: '%', writable: true };
                }
            }),
        ]);
        if (this.subscribed !== unique) {
            // the shutters changed in the meantime
            return;
        }
        this.setState({ values, levels });
        if (unique.length) {
            await this.props.socket.subscribeState(unique, this.onStateChange);
        }
    }

    unsubscribe(): void {
        if (this.subscribed.length) {
            this.props.socket.unsubscribeState(this.subscribed, this.onStateChange);
        }
        this.subscribed = [];
    }

    onStateChange = (id: string, state: ioBroker.State | null | undefined): void => {
        if (this.state.values[id] !== state?.val) {
            this.setState({ values: { ...this.state.values, [id]: state?.val } });
        }
    };

    renderSwitch(shutter: ShutterEntry, attr: 'autoDown' | 'autoUp' | 'autoSun', title: string): React.JSX.Element {
        const id = this.getId(shutter, attr);
        return (
            <Switch
                checked={!!this.state.values[id]}
                onChange={e => void this.props.socket.setState(id, e.target.checked, false)}
                slotProps={{ input: { 'aria-label': `${shutter.shutterName}: ${I18n.t(title)}` } }}
            />
        );
    }

    renderLevel(shutter: ShutterEntry): React.JSX.Element {
        const { t } = this.props;
        const id = shutter.name;
        if (!id) {
            return <span style={{ color: t.textMuted }}>--</span>;
        }
        const info = this.state.levels[id] || { min: 0, max: 100, unit: '%', writable: true };
        const stateValue = this.state.values[id];
        const numeric =
            this.state.dragging[id] ??
            (typeof stateValue === 'number' ? stateValue : parseFloat(stateValue as string) || 0);
        const value = Math.min(info.max, Math.max(info.min, numeric));

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 160 }}>
                <Slider
                    size="small"
                    min={info.min}
                    max={info.max}
                    value={value}
                    disabled={!info.writable}
                    valueLabelDisplay="auto"
                    onChange={(_e, newValue) => this.setState({ dragging: { ...this.state.dragging, [id]: newValue } })}
                    onChangeCommitted={(_e, newValue) => {
                        const dragging = { ...this.state.dragging };
                        delete dragging[id];
                        this.setState({
                            dragging,
                            values: { ...this.state.values, [id]: newValue },
                        });
                        void this.props.socket.setState(id, newValue, false);
                    }}
                    slotProps={{ input: { 'aria-label': `${shutter.shutterName}: ${I18n.t('Shutter level')}` } }}
                />
                <span style={{ minWidth: 48, textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {Math.round(value)}
                    {info.unit}
                </span>
            </div>
        );
    }

    renderMode(shutter: ShutterEntry): React.JSX.Element {
        const { t } = this.props;
        const mode = this.state.values[this.getId(shutter, 'autoState')];
        if (mode === undefined || mode === null || mode === '') {
            return <span style={{ color: t.textMuted }}>--</span>;
        }
        return (
            <Pill
                color={t.accent}
                background={t.iconBoxBg}
                border={t.iconBoxBorder}
            >
                {String(mode)}
            </Pill>
        );
    }

    render(): React.JSX.Element {
        const { t } = this.props;

        if (!this.props.shutters.length) {
            return (
                <DashboardCard
                    t={t}
                    style={{ padding: 16, color: t.textMuted }}
                >
                    {I18n.t('No shutters configured')}
                </DashboardCard>
            );
        }

        return (
            <>
                {/* small screens: one card per shutter, so no column is hidden off-screen */}
                <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: '10px' }}>
                    {this.props.shutters.map((shutter, i) => this.renderCard(shutter, i))}
                </Box>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>{this.renderTable()}</Box>
            </>
        );
    }

    /**
     * Card of one shutter for small screens.
     *
     * @param shutter shutter
     * @param index position in the list
     */
    renderCard(shutter: ShutterEntry, index: number): React.JSX.Element {
        const { t } = this.props;
        return (
            <DashboardCard
                key={`${shutter.shutterName}_${index}`}
                t={t}
                style={{ padding: '10px 12px' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span
                        style={{
                            flex: 1,
                            minWidth: 0,
                            fontWeight: 700,
                            color: t.text,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {shutter.shutterName}
                    </span>
                    {this.renderMode(shutter)}
                </div>
                {SWITCHES.map(sw => (
                    <div
                        key={sw.attr}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            borderTop: `1px solid ${t.rowDivider}`,
                            color: t.textSecondary,
                            fontSize: '0.9rem',
                        }}
                    >
                        {I18n.t(sw.title)}
                        {this.renderSwitch(shutter, sw.attr, sw.title)}
                    </div>
                ))}
                <div
                    style={{
                        borderTop: `1px solid ${t.rowDivider}`,
                        paddingTop: 6,
                        color: t.textSecondary,
                        fontSize: '0.9rem',
                    }}
                >
                    {I18n.t('Shutter level')}
                    <div style={{ padding: '0 6px', color: t.text }}>{this.renderLevel(shutter)}</div>
                </div>
            </DashboardCard>
        );
    }

    renderTable(): React.JSX.Element {
        const { t } = this.props;
        const headCell = { color: t.textSecondary, fontWeight: 700, borderColor: t.divider, whiteSpace: 'nowrap' };
        const cell = { color: t.text, borderColor: t.rowDivider };

        return (
            <DashboardCard
                t={t}
                style={{ overflow: 'hidden' }}
            >
                <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ ...headCell, width: '25%' }}>{I18n.t('Name')}</TableCell>
                                <TableCell sx={{ ...headCell, width: '15%' }}>{I18n.t('Shutter Mode')}</TableCell>
                                {SWITCHES.map(sw => (
                                    <TableCell
                                        key={sw.attr}
                                        align="center"
                                        sx={{ ...headCell, width: '15%' }}
                                    >
                                        {I18n.t(sw.title)}
                                    </TableCell>
                                ))}
                                <TableCell sx={{ ...headCell, width: '15%' }}>{I18n.t('Shutter level')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {this.props.shutters.map((shutter, i) => (
                                <TableRow
                                    key={`${shutter.shutterName}_${i}`}
                                    sx={{ '&:hover': { background: t.rowHover } }}
                                >
                                    <TableCell sx={{ ...cell, fontWeight: 600 }}>{shutter.shutterName}</TableCell>
                                    <TableCell sx={cell}>{this.renderMode(shutter)}</TableCell>
                                    {SWITCHES.map(sw => (
                                        <TableCell
                                            key={sw.attr}
                                            align="center"
                                            sx={cell}
                                        >
                                            {this.renderSwitch(shutter, sw.attr, sw.title)}
                                        </TableCell>
                                    ))}
                                    <TableCell sx={cell}>{this.renderLevel(shutter)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            </DashboardCard>
        );
    }
}
