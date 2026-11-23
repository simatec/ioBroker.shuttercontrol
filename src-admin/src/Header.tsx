import React from 'react';

import { Box, Link, Typography } from '@mui/material';

import { I18n } from '@iobroker/gui-components';
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from '@iobroker/json-config';

import logo from './assets/shuttercontrol.png';

const SPONSOR_URL = 'https://github.com/sponsors/simatec';
const SPONSOR_BADGE = 'https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86';
const PAYPAL_URL = 'https://paypal.me/mk1676';
const PAYPAL_BADGE = 'https://img.shields.io/badge/paypal-donate%20%7C%20spenden-blue.svg';

/** Logo, title and donate buttons of the former materialize header */
export default class Header extends ConfigGeneric<ConfigGenericProps, ConfigGenericState> {
    // eslint-disable-next-line class-methods-use-this
    renderItem(): React.JSX.Element {
        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                    width: '100%',
                }}
            >
                <Box
                    component="img"
                    src={logo}
                    alt="Shuttercontrol"
                    sx={{ width: 56, height: 56 }}
                />
                <Box sx={{ flexGrow: 1 }}>
                    <Typography
                        variant="h5"
                        sx={{ fontWeight: 'bold', lineHeight: 1.2 }}
                    >
                        Shuttercontrol
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ opacity: 0.7 }}
                    >
                        {I18n.t('Controlling your Shutter…')}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Link
                        href={SPONSOR_URL}
                        target="_blank"
                        rel="noreferrer"
                        title="GitHub Sponsors"
                    >
                        <img
                            src={SPONSOR_BADGE}
                            alt="GitHub Sponsors"
                        />
                    </Link>
                    <Link
                        href={PAYPAL_URL}
                        target="_blank"
                        rel="noreferrer"
                        title="PayPal.Me"
                    >
                        <img
                            src={PAYPAL_BADGE}
                            alt="PayPal"
                        />
                    </Link>
                </Box>
            </Box>
        );
    }
}
