import React from 'react';

import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    Grid,
    IconButton,
    InputAdornment,
    InputLabel,
    MenuItem,
    Select,
    Tab,
    Tabs,
    TextField,
    Typography,
    useMediaQuery,
} from '@mui/material';

import { Check, Close, ListAlt, Settings, Tune, WbSunny } from '@mui/icons-material';

import { DialogSelectID, I18n, type AdminConnection, type IobTheme, type ThemeType } from '@iobroker/gui-components';

import {
    DRIVE_OPTIONS,
    SUN_TYPE_OPTIONS,
    TRIGGER_STATE_OPTIONS,
    TYPE_DOWN_OPTIONS,
    TYPE_UP_OPTIONS,
    toStr,
    type SelectOption,
    type ShutterEntry,
} from './shutterDefaults';

type FieldSize = { xs?: number; sm?: number; md?: number; lg?: number };

/** Description of one input of the dialog */
interface FieldDef {
    attr: string;
    label: string;
    type: 'number' | 'select' | 'checkbox' | 'objectId';
    options?: SelectOption[];
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    /** The field is only visible, if this checkbox is set */
    visibleIf?: string;
    size?: FieldSize;
    newLine?: boolean;
}

interface SectionDef {
    title?: string;
    fields: FieldDef[];
}

const NUMBER_SIZE: FieldSize = { xs: 12, sm: 6, md: 4, lg: 3 };
const SELECT_SIZE: FieldSize = { xs: 12, sm: 6, md: 4, lg: 4 };
const ID_SIZE: FieldSize = { xs: 12, sm: 12, md: 8, lg: 6 };
const CHECK_SIZE: FieldSize = { xs: 12, sm: 12, md: 6, lg: 6 };

/** "main settings" of the former materialize dialog */
const MAIN_SECTIONS: SectionDef[] = [
    {
        title: 'Automatic',
        fields: [
            { attr: 'typeUp', label: 'type up', type: 'select', options: TYPE_UP_OPTIONS, size: SELECT_SIZE },
            { attr: 'typeDown', label: 'type down', type: 'select', options: TYPE_DOWN_OPTIONS, size: SELECT_SIZE },
            {
                attr: 'heightUp',
                label: 'height up',
                type: 'number',
                min: 0,
                max: 100,
                unit: '%',
                size: NUMBER_SIZE,
                newLine: true,
            },
            {
                attr: 'heightDown',
                label: 'height down',
                type: 'number',
                min: 0,
                max: 100,
                unit: '%',
                size: NUMBER_SIZE,
            },
            {
                attr: 'elevation',
                label: 'Elevation',
                type: 'number',
                min: -50,
                max: 100,
                step: 0.1,
                unit: '°',
                size: NUMBER_SIZE,
            },
        ],
    },
    {
        title: 'Window contact / trigger',
        fields: [
            { attr: 'triggerID', label: 'Trigger ID', type: 'objectId', size: ID_SIZE },
            {
                attr: 'triggerState',
                label: 'State from Trigger',
                type: 'select',
                options: TRIGGER_STATE_OPTIONS,
                size: NUMBER_SIZE,
                newLine: true,
            },
            {
                attr: 'triggerStateTilted',
                label: 'State from Trigger Tilted',
                type: 'select',
                options: TRIGGER_STATE_OPTIONS,
                size: NUMBER_SIZE,
            },
            {
                attr: 'triggerChange',
                label: 'Drive by Trigger',
                type: 'select',
                options: DRIVE_OPTIONS,
                size: NUMBER_SIZE,
            },
            {
                attr: 'autoDrive',
                label: 'Automatic operation when trigger deviation',
                type: 'select',
                options: DRIVE_OPTIONS,
                size: NUMBER_SIZE,
            },
            {
                attr: 'triggerDrive',
                label: 'height for trigger',
                type: 'number',
                min: 0,
                max: 100,
                unit: '%',
                size: NUMBER_SIZE,
                newLine: true,
            },
            {
                attr: 'triggerDriveTildet',
                label: 'height for trigger tildet',
                type: 'number',
                min: 0,
                max: 100,
                unit: '%',
                size: NUMBER_SIZE,
            },
            {
                attr: 'useOpenWindowLevel',
                label: 'Also use these heights when an automatic closes with an open or tilted window',
                type: 'checkbox',
                size: { xs: 12 },
                newLine: true,
            },
        ],
    },
];

/** "sun protection settings" of the former materialize dialog */
const SUN_SECTIONS: SectionDef[] = [
    {
        title: 'sun protection settings',
        fields: [
            { attr: 'type', label: 'Type of control', type: 'select', options: SUN_TYPE_OPTIONS, size: ID_SIZE },
            {
                attr: 'heightDownSun',
                label: 'shutter height for sun protection (percent)',
                type: 'number',
                min: 0,
                max: 100,
                unit: '%',
                size: NUMBER_SIZE,
                newLine: true,
            },
            { attr: 'direction', label: 'direction', type: 'number', min: 0, max: 400, unit: '°', size: NUMBER_SIZE },
            {
                attr: 'directionRange',
                label: '+/- range direction',
                type: 'number',
                min: 0,
                max: 400,
                unit: '°',
                size: NUMBER_SIZE,
            },
        ],
    },
    {
        title: 'Outside temperature',
        fields: [
            {
                attr: 'tempOutside',
                label: 'setpoint of the sun protection temperature',
                type: 'number',
                min: 0,
                max: 40,
                step: 0.1,
                unit: '°C',
                size: NUMBER_SIZE,
            },
            {
                attr: 'hysteresisOutside',
                label: 'hysteresis Outsidetemperature (percent)',
                type: 'number',
                min: 0,
                max: 100,
                step: 0.1,
                unit: '%',
                size: NUMBER_SIZE,
            },
            {
                attr: 'outsideTempSensor',
                label: 'Object ID Actual value of the sun protection temperature',
                type: 'objectId',
                size: ID_SIZE,
                newLine: true,
            },
        ],
    },
    {
        title: 'Light sensor',
        fields: [
            {
                attr: 'valueLight',
                label: 'setpoint of the sun protection Lightsensor',
                type: 'number',
                min: 0,
                max: 20000,
                step: 1,
                unit: 'lux',
                size: NUMBER_SIZE,
            },
            {
                attr: 'hysteresisLight',
                label: 'hysteresis Lightsensor (percent)',
                type: 'number',
                min: 0,
                max: 100,
                step: 0.1,
                unit: '%',
                size: NUMBER_SIZE,
            },
            {
                attr: 'lightSensor',
                label: 'Object ID of the sun protection Lightsensor',
                type: 'objectId',
                size: ID_SIZE,
                newLine: true,
            },
        ],
    },
    {
        title: 'Inside temperature',
        fields: [
            {
                attr: 'tempInside',
                label: 'Temp Inside',
                type: 'number',
                min: 0,
                max: 40,
                step: 0.1,
                unit: '°C',
                size: NUMBER_SIZE,
            },
            {
                attr: 'hysteresisInside',
                label: 'hysteresis Insidetemperature (percent)',
                type: 'number',
                min: 0,
                max: 100,
                step: 0.1,
                unit: '%',
                size: NUMBER_SIZE,
            },
            {
                attr: 'tempSensor',
                label: 'Object ID of the Inside Temperature',
                type: 'objectId',
                size: ID_SIZE,
                newLine: true,
            },
        ],
    },
];

/** "Extra Settings" of the former materialize dialog */
const EXTRA_SECTIONS: SectionDef[] = [
    {
        title: 'Shutter config',
        fields: [
            { attr: 'LateDown', label: 'late_down', type: 'checkbox', size: CHECK_SIZE },
            { attr: 'inSummerNotDown', label: 'inSummerNotDown', type: 'checkbox', size: CHECK_SIZE },
            { attr: 'driveAfterClose', label: 'DriveAfterClose', type: 'checkbox', size: CHECK_SIZE },
        ],
    },
    {
        title: 'xmas settings',
        fields: [
            { attr: 'useXmasLevel', label: 'useXmasLevel', type: 'checkbox', size: CHECK_SIZE },
            {
                attr: 'XmasLevel',
                label: 'XmasLevel',
                type: 'number',
                min: 0,
                max: 100,
                unit: '%',
                visibleIf: 'useXmasLevel',
                size: NUMBER_SIZE,
            },
        ],
    },
    {
        title: 'sun protection settings',
        fields: [
            { attr: 'KeepSunProtect', label: 'KeepSunProtect', type: 'checkbox', size: CHECK_SIZE },
            {
                attr: 'heatProtection',
                label: 'Heat protection (completely close the roller shutter in the heat)',
                type: 'checkbox',
                size: CHECK_SIZE,
            },
            {
                attr: 'sunProtectEndDely',
                label: 'sunProtectEndDely',
                type: 'number',
                min: 0,
                max: 999,
                size: CHECK_SIZE,
                newLine: true,
            },
            {
                attr: 'tempHeatProtection',
                label: 'Outdoor temperature upper limit for activating thermal protection',
                type: 'number',
                min: 0,
                max: 40,
                step: 0.1,
                unit: '°C',
                visibleIf: 'heatProtection',
                size: CHECK_SIZE,
            },
        ],
    },
    {
        title: 'Extra Settings',
        fields: [
            {
                attr: 'ignoreTriggerAutoState',
                label: 'Ignore the status of autoUp and autoDown when opening the window',
                type: 'checkbox',
                size: { xs: 12 },
            },
            {
                attr: 'betweenPosition',
                label: 'First move to an intermediate position and close later',
                type: 'checkbox',
                size: CHECK_SIZE,
                newLine: true,
            },
            {
                attr: 'betweenPositionLevel',
                label: 'shutter height in the intermediate position',
                type: 'number',
                min: 0,
                max: 100,
                unit: '%',
                visibleIf: 'betweenPosition',
                size: CHECK_SIZE,
            },
            {
                attr: 'trigDelyUp',
                label: 'trigDelyUp',
                type: 'number',
                min: 0,
                max: 999,
                size: CHECK_SIZE,
                newLine: true,
            },
            { attr: 'trigDelyDown', label: 'trigDelyDown', type: 'number', min: 0, max: 999, size: CHECK_SIZE },
        ],
    },
    {
        title: 'Alarm Settings',
        fields: [
            { attr: 'enableAlarmWind1', label: 'enableAlarmWind1', type: 'checkbox', size: CHECK_SIZE },
            { attr: 'enableAlarmWind2', label: 'enableAlarmWind2', type: 'checkbox', size: CHECK_SIZE },
            { attr: 'enableAlarmRain', label: 'enableAlarmRain', type: 'checkbox', size: CHECK_SIZE },
            { attr: 'enableAlarmFrost', label: 'enableAlarmFrost', type: 'checkbox', size: CHECK_SIZE },
            { attr: 'enableAlarmFire', label: 'enableAlarmFire', type: 'checkbox', size: CHECK_SIZE },
        ],
    },
];

const TABS: { label: string; icon: React.JSX.Element; sections: SectionDef[] }[] = [
    { label: 'main settings', icon: <Settings />, sections: MAIN_SECTIONS },
    { label: 'sun protection settings', icon: <WbSunny />, sections: SUN_SECTIONS },
    { label: 'Extra Settings', icon: <Tune />, sections: EXTRA_SECTIONS },
];

/** Checks the value of a number field. Returns the error text or an empty string */
function checkNumber(field: FieldDef, value: unknown): string {
    if (value === '' || value === undefined || value === null) {
        return '';
    }
    const num = parseFloat(toStr(value).replace(',', '.'));
    if (isNaN(num)) {
        return I18n.t('Invalid number');
    }
    if (field.min !== undefined && num < field.min) {
        return `${I18n.t('Minimum')}: ${field.min}`;
    }
    if (field.max !== undefined && num > field.max) {
        return `${I18n.t('Maximum')}: ${field.max}`;
    }
    return '';
}

export interface ShutterEditDialogProps {
    shutter: ShutterEntry;
    socket: AdminConnection;
    theme: IobTheme;
    themeType: ThemeType;
    imagePrefix?: string;
    adapterName: string;
    onClose: (shutter: ShutterEntry | null) => void;
}

/** Dialog with all settings of one shutter (the former materialize dialog "dialog-shutter-edit") */
export default function ShutterEditDialog(props: ShutterEditDialogProps): React.JSX.Element {
    const [data, setData] = React.useState<ShutterEntry>(() => ({ ...props.shutter }));
    const [tab, setTab] = React.useState(0);
    const [selectIdFor, setSelectIdFor] = React.useState<string | null>(null);
    const fullScreen = useMediaQuery(props.theme.breakpoints.down('md'));

    const setValue = (attr: string, value: string | boolean): void => setData(old => ({ ...old, [attr]: value }));

    const allFields = TABS.flatMap(t => t.sections.flatMap(s => s.fields));
    const hasErrors = allFields.some(
        f => f.type === 'number' && (!f.visibleIf || data[f.visibleIf]) && checkNumber(f, data[f.attr]),
    );

    const renderField = (field: FieldDef): React.JSX.Element | null => {
        if (field.visibleIf && !data[field.visibleIf]) {
            return null;
        }
        const label = I18n.t(field.label);
        const value = data[field.attr];
        let control: React.JSX.Element;

        if (field.type === 'checkbox') {
            control = (
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={value === true || value === 'true'}
                            onChange={e => setValue(field.attr, e.target.checked)}
                        />
                    }
                    label={label}
                />
            );
        } else if (field.type === 'select') {
            const options = field.options || [];
            const strValue = toStr(value);
            control = (
                <FormControl
                    variant="standard"
                    fullWidth
                >
                    <InputLabel>{label}</InputLabel>
                    <Select
                        variant="standard"
                        value={strValue}
                        onChange={e => setValue(field.attr, e.target.value)}
                    >
                        {options.map(opt => (
                            <MenuItem
                                key={opt.value}
                                value={opt.value}
                            >
                                {I18n.t(opt.label)}
                            </MenuItem>
                        ))}
                        {strValue && !options.find(opt => opt.value === strValue) ? (
                            <MenuItem value={strValue}>{strValue}</MenuItem>
                        ) : null}
                    </Select>
                </FormControl>
            );
        } else if (field.type === 'objectId') {
            control = (
                <TextField
                    variant="standard"
                    fullWidth
                    label={label}
                    value={toStr(value)}
                    onChange={e => setValue(field.attr, e.target.value.trim())}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    {value ? (
                                        <IconButton
                                            size="small"
                                            title={I18n.t('Clear')}
                                            onClick={() => setValue(field.attr, '')}
                                        >
                                            <Close fontSize="small" />
                                        </IconButton>
                                    ) : null}
                                    <IconButton
                                        size="small"
                                        title={I18n.t('Select object ID')}
                                        onClick={() => setSelectIdFor(field.attr)}
                                    >
                                        <ListAlt fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                />
            );
        } else {
            const error = checkNumber(field, value);
            control = (
                <TextField
                    variant="standard"
                    fullWidth
                    type="number"
                    label={label}
                    value={toStr(value)}
                    error={!!error}
                    helperText={error || undefined}
                    onChange={e => setValue(field.attr, e.target.value)}
                    slotProps={{
                        htmlInput: { min: field.min, max: field.max, step: field.step || 1 },
                        input: field.unit
                            ? { endAdornment: <InputAdornment position="end">{field.unit}</InputAdornment> }
                            : undefined,
                    }}
                />
            );
        }

        return (
            <React.Fragment key={field.attr}>
                {field.newLine ? (
                    <Box
                        component="div"
                        sx={{ flexBasis: '100%', height: 0 }}
                    />
                ) : null}
                <Grid
                    size={field.size || NUMBER_SIZE}
                    data-attr={field.attr}
                >
                    {control}
                </Grid>
            </React.Fragment>
        );
    };

    const renderSection = (section: SectionDef, i: number): React.JSX.Element => (
        <Box
            key={i}
            sx={{
                mb: 2,
                p: 2,
                borderRadius: 1,
                border: theme => `1px solid ${theme.palette.divider}`,
            }}
        >
            {section.title ? (
                <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}
                >
                    {I18n.t(section.title)}
                </Typography>
            ) : null}
            <Grid
                container
                spacing={2}
                sx={{ alignItems: 'flex-end' }}
            >
                {section.fields.map(field => renderField(field))}
            </Grid>
        </Box>
    );

    return (
        <Dialog
            open={!0}
            fullWidth
            maxWidth="lg"
            fullScreen={fullScreen}
            onClose={(_e, reason) => reason !== 'backdropClick' && props.onClose(null)}
            slotProps={{ paper: { sx: { minHeight: fullScreen ? undefined : '80vh' } } }}
        >
            <DialogTitle sx={{ pb: 0 }}>
                {I18n.t('Edit Device:')} {data.shutterName}
                <Typography
                    component="div"
                    variant="caption"
                    sx={{ opacity: 0.7 }}
                >
                    {data.name || ''}
                </Typography>
            </DialogTitle>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
                <Tabs
                    value={tab}
                    onChange={(_e, value: number) => setTab(value)}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    {TABS.map((t, i) => (
                        <Tab
                            key={i}
                            icon={t.icon}
                            iconPosition="start"
                            label={I18n.t(t.label)}
                            sx={{ minHeight: 48 }}
                        />
                    ))}
                </Tabs>
            </Box>
            <DialogContent sx={{ pt: 2 }}>
                <Box sx={{ pt: 1 }}>{TABS[tab].sections.map((section, i) => renderSection(section, i))}</Box>
            </DialogContent>
            <DialogActions>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Check />}
                    disabled={hasErrors}
                    onClick={() => props.onClose(data)}
                >
                    {I18n.t('Ok')}
                </Button>
                <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<Close />}
                    onClick={() => props.onClose(null)}
                >
                    {I18n.t('Cancel')}
                </Button>
            </DialogActions>
            {selectIdFor ? (
                <DialogSelectID
                    imagePrefix={props.imagePrefix ?? '../..'}
                    dialogName={`admin.${props.adapterName}`}
                    themeType={props.themeType}
                    theme={props.theme}
                    socket={props.socket}
                    types={['state']}
                    selected={toStr(data[selectIdFor])}
                    onClose={() => setSelectIdFor(null)}
                    onOk={selected => {
                        const id = Array.isArray(selected) ? selected[0] : selected;
                        if (id) {
                            setValue(selectIdFor, id);
                        }
                        setSelectIdFor(null);
                    }}
                />
            ) : null}
        </Dialog>
    );
}
