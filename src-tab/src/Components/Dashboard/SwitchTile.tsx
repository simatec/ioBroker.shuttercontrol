import React from 'react';

import { Switch } from '@mui/material';

import { DashboardCard, IconBox } from './Parts';
import { type DashboardTokens } from './tokens';

/**
 * Card with a switch for a boolean state (automatic areas, holiday, school holidays).
 *
 * @param props properties
 * @param props.t colors
 * @param props.icon icon on the left side
 * @param props.label translated label
 * @param props.value current value of the state
 * @param props.disabled the switch can not be used
 * @param props.onChange called with the new value
 */
export default function SwitchTile(props: {
    t: DashboardTokens;
    icon: React.ReactNode;
    label: string;
    value: boolean;
    disabled?: boolean;
    onChange: (value: boolean) => void;
}): React.JSX.Element {
    const { t } = props;
    return (
        <DashboardCard
            t={t}
            style={{ padding: '8px 8px 8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}
        >
            <IconBox
                t={t}
                size={38}
            >
                {props.icon}
            </IconBox>
            <div
                style={{
                    flex: 1,
                    minWidth: 0,
                    color: t.text,
                    fontSize: '0.92rem',
                    fontWeight: 600,
                }}
            >
                {props.label}
            </div>
            <Switch
                checked={props.value}
                disabled={props.disabled}
                onChange={e => props.onChange(e.target.checked)}
                slotProps={{ input: { 'aria-label': props.label } }}
            />
        </DashboardCard>
    );
}
