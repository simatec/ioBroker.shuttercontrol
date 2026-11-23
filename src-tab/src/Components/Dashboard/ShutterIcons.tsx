import React from 'react';

import { SvgIcon, type SvgIconProps } from '@mui/material';

/** Icons of the shutter actions. The same drawings as in the former jsonTab. */

export function ShutterOpenIcon(props: SvgIconProps): React.JSX.Element {
    return (
        <SvgIcon {...props}>
            <path d="M3 4h18v4h-2v12h-2V8H7v12H5V8H3zm5 5h8v2H8z" />
        </SvgIcon>
    );
}

export function ShutterCloseIcon(props: SvgIconProps): React.JSX.Element {
    return (
        <SvgIcon {...props}>
            <path d="M3 4h18v4h-2v12h-2V8H7v12H5V8H3zm5 5h8v2H8zm0 3h8v2H8zm0 3h8v2H8zm0 3h8v2H8zm5 4h-2v2h2zm4 0h-2v2h2zm-8 0H7v2h2z" />
        </SvgIcon>
    );
}

export function ShutterSunIcon(props: SvgIconProps): React.JSX.Element {
    return (
        <SvgIcon {...props}>
            <path d="M2 4h18v4h-2v12h-2V8H6v12H4V8H2zm5 5h8v2H7zm0 3h8v2H7zm13 7v-2h2v2zm0-4v-5h2v5z" />
        </SvgIcon>
    );
}

export function ShutterAutoIcon(props: SvgIconProps): React.JSX.Element {
    return (
        <SvgIcon {...props}>
            <path d="M20 14h-2l-3.2 9h1.9l.7-2h3.2l.7 2h1.9zm-2.2 5.7L19 16l1.2 3.7zM7 9h8v2H7zm0 3h8v2H7zm0 3h8v1.5l-.2.5H7zm6.7 5H7v-2h7.5zM16 8H6v12H4V8H2V4h18v4h-2v4h-1.4l-.5 1.3l-.1.4z" />
        </SvgIcon>
    );
}
