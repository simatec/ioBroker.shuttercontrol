import React from 'react';

import { DashboardCard, IconBox } from './Parts';
import { type DashboardTokens } from './tokens';

/**
 * Read only value of the adapter (sun position, journey times), shown as a small card.
 *
 * @param props properties
 * @param props.t colors
 * @param props.icon icon on the left side
 * @param props.label translated label
 * @param props.value formatted value or null if the state has no value
 * @param props.unit optional unit, e.g. °
 */
export default function InfoTile(props: {
    t: DashboardTokens;
    icon: React.ReactNode;
    label: string;
    value: string | null;
    unit?: string;
}): React.JSX.Element {
    const { t } = props;
    return (
        <DashboardCard
            t={t}
            style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
        >
            <IconBox
                t={t}
                size={40}
            >
                {props.icon}
            </IconBox>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        color: t.textSecondary,
                        fontSize: '0.8rem',
                        lineHeight: 1.25,
                        // long compound words ("Sonnenaufgangszeit") get a hyphen instead of a break mid-word
                        hyphens: 'auto',
                        WebkitHyphens: 'auto',
                        overflowWrap: 'break-word',
                    }}
                >
                    {props.label}
                </div>
                <div
                    style={{
                        color: props.value === null ? t.textMuted : t.text,
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {props.value === null ? '--' : props.value}
                    {props.value !== null && props.unit ? (
                        <span style={{ fontWeight: 500, marginLeft: 2 }}>{props.unit}</span>
                    ) : null}
                </div>
            </div>
        </DashboardCard>
    );
}
