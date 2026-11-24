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
            style={{ padding: '12px 10px 12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
        >
            <IconBox
                t={t}
                size={40}
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
                    lineHeight: 1.3,
                    // wrap between words; only a word that does not fit at all is broken
                    overflowWrap: 'break-word',
                }}
            >
                {props.label}
            </div>
            <Switch
                sx={{ flexShrink: 0 }}
                checked={props.value}
                disabled={props.disabled}
                onChange={e => props.onChange(e.target.checked)}
                slotProps={{ input: { 'aria-label': props.label } }}
            />
        </DashboardCard>
    );
}
