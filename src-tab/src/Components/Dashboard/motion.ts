/**
 * Animations of the Shuttercontrol tab: blocks fade in when a page opens and tile icons answer the mouse.
 * All of them stop when the system asks for less motion.
 */
import { keyframes } from '@mui/material/styles';

/** Spread into an `sx` object: no animation and no transition for users who want less motion */
export const NO_MOTION = {
    '@media (prefers-reduced-motion: reduce)': {
        animation: 'none !important',
        transition: 'none !important',
    },
} as const;

const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: none; }
`;

const drop = keyframes`
    0%, 100% { transform: translateY(0); }
    35% { transform: translateY(5px); }
    65% { transform: translateY(-1px); }
`;

const lift = keyframes`
    0%, 100% { transform: translateY(0); }
    35% { transform: translateY(-5px); }
    65% { transform: translateY(1px); }
`;

const wiggle = keyframes`
    0%, 100% { transform: rotate(0); }
    25% { transform: rotate(-14deg); }
    60% { transform: rotate(10deg); }
`;

const lines = keyframes`
    0%, 100% { transform: scaleX(1); }
    40% { transform: scaleX(0.82); }
`;

/** How the icon of an action tile answers the mouse */
export type HoverEffect = 'spin' | 'drop' | 'lift' | 'wiggle' | 'lines';

/**
 * `sx` for the element around a tile icon (class `sc-tile-icon`), placed on the tile itself.
 *
 * @param effect kind of movement
 */
export function hoverEffectSx(effect: HoverEffect | undefined): Record<string, unknown> {
    if (!effect) {
        return {};
    }
    if (effect === 'spin') {
        return {
            '& .sc-tile-icon': { transition: 'transform 0.6s cubic-bezier(0.3, 1.4, 0.5, 1)' },
            '&:hover .sc-tile-icon, &:focus-visible .sc-tile-icon': { transform: 'rotate(90deg)' },
            '@media (prefers-reduced-motion: reduce)': { '& .sc-tile-icon': { transition: 'none' } },
        };
    }
    const animation = { drop, lift, wiggle, lines }[effect];
    return {
        '&:hover .sc-tile-icon, &:focus-visible .sc-tile-icon': {
            animation: `${animation} 0.55s ease-out`,
            transformOrigin: effect === 'lines' ? 'left center' : 'center',
        },
        '@media (prefers-reduced-motion: reduce)': {
            '&:hover .sc-tile-icon, &:focus-visible .sc-tile-icon': { animation: 'none' },
        },
    };
}

/**
 * `sx` of a block that fades in when the tab opens. The blocks follow each other.
 *
 * @param index position of the block
 */
export function revealSx(index: number): Record<string, unknown> {
    return {
        animation: `${fadeUp} 0.45s cubic-bezier(0.2, 0.7, 0.3, 1) both`,
        animationDelay: `${index * 70}ms`,
        ...NO_MOTION,
    };
}
