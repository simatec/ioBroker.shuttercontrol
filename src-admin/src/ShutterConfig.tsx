import React from 'react';

import {
    Box,
    Button,
    Checkbox,
    IconButton,
    InputAdornment,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';

import { Add, ArrowDownward, ArrowUpward, ContentCopy, Delete, Edit, ListAlt } from '@mui/icons-material';

import { DialogConfirm, DialogSelectID, I18n, Utils } from '@iobroker/gui-components';
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from '@iobroker/json-config';

import ShutterEditDialog from './Components/ShutterEditDialog';
import {
    getNewShutter,
    toStr,
    TYPE_DOWN_OPTIONS,
    TYPE_UP_OPTIONS,
    type ShutterEntry,
} from './Components/shutterDefaults';

interface ShutterConfigState extends ConfigGenericState {
    /** Index of the shutter, which is edited in the dialog */
    editIndex: number | null;
    /** Index of the shutter, for which the object ID is selected */
    selectIdIndex: number | null;
    /** Index of the shutter, which should be deleted (confirmation dialog) */
    deleteIndex: number | null;
}

const cellSx = { py: 0.5, px: 1 };

/**
 * The shutter table of the configuration (`native.events`).
 *
 * It replaces the materialize table with the buttons "add", "edit", "select ID", "copy", "up", "down"
 * and "delete" and the dialog with the settings of a single shutter.
 * jsonConfig has no table with an edit dialog, therefore it is a custom component.
 */
export default class ShutterConfig extends ConfigGeneric<ConfigGenericProps, ShutterConfigState> {
    constructor(props: ConfigGenericProps) {
        super(props);
        Object.assign(this.state, { editIndex: null, selectIdIndex: null, deleteIndex: null });
    }

    getShutters(): ShutterEntry[] {
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr) as ShutterEntry[] | undefined;
        return Array.isArray(value) ? value : [];
    }

    setShutters(shutters: ShutterEntry[], cb?: () => void): void {
        void this.onChange(this.props.attr, shutters, cb);
    }

    updateShutter(index: number, changes: Partial<ShutterEntry>): void {
        const shutters = [...this.getShutters()];
        shutters[index] = { ...shutters[index], ...changes };
        this.setShutters(shutters);
    }

    /** Reads the name of the object. If the object has no name, "Shutter <n>" is used */
    async getNameOfObject(id: string, index: number): Promise<string> {
        try {
            const obj = await this.props.oContext.socket.getObject(id);
            if (obj) {
                const name = Utils.getObjectNameFromObj(obj, I18n.getLanguage(), {}, false, true);
                if (name && name !== id) {
                    return name;
                }
            }
        } catch (e) {
            console.warn(`Cannot read object ${id}: ${e}`);
        }
        return `${I18n.t('Shutter')}${index + 1}`;
    }

    async onObjectSelected(index: number, id: string): Promise<void> {
        const shutterName = await this.getNameOfObject(id, index);
        this.updateShutter(index, { name: id, shutterName });
    }

    onAdd(): void {
        const shutters = [...this.getShutters()];
        shutters.push(getNewShutter(`${I18n.t('Shutter')}${shutters.length + 1}`));
        // like before: add the shutter and open the dialog for selecting the object ID of the shutter
        this.setShutters(shutters, () => this.setState({ selectIdIndex: shutters.length - 1 }));
    }

    onCopy(index: number): void {
        const shutters = [...this.getShutters()];
        const copy: ShutterEntry = JSON.parse(JSON.stringify(shutters[index]));
        copy.shutterName = `${copy.shutterName} (${I18n.t('copy')})`;
        shutters.splice(index + 1, 0, copy);
        this.setShutters(shutters);
    }

    onMove(index: number, direction: -1 | 1): void {
        const shutters = [...this.getShutters()];
        const target = index + direction;
        if (target < 0 || target >= shutters.length) {
            return;
        }
        [shutters[index], shutters[target]] = [shutters[target], shutters[index]];
        this.setShutters(shutters);
    }

    onDelete(index: number): void {
        const shutters = [...this.getShutters()];
        shutters.splice(index, 1);
        this.setShutters(shutters);
    }

    renderEditDialog(): React.JSX.Element | null {
        const index = this.state.editIndex;
        const shutters = this.getShutters();
        if (index === null || !shutters[index]) {
            return null;
        }
        return (
            <ShutterEditDialog
                shutter={shutters[index]}
                socket={this.props.oContext.socket}
                theme={this.props.oContext.theme}
                themeType={this.props.oContext.themeType}
                imagePrefix={this.props.oContext.imagePrefix}
                adapterName={this.props.oContext.adapterName}
                onClose={shutter => {
                    if (shutter) {
                        this.updateShutter(index, shutter);
                    }
                    this.setState({ editIndex: null });
                }}
            />
        );
    }

    renderSelectIdDialog(): React.JSX.Element | null {
        const index = this.state.selectIdIndex;
        if (index === null) {
            return null;
        }
        const shutter = this.getShutters()[index];
        return (
            <DialogSelectID
                imagePrefix={this.props.oContext.imagePrefix ?? '../..'}
                dialogName={`admin.${this.props.oContext.adapterName}`}
                themeType={this.props.oContext.themeType}
                theme={this.props.oContext.theme}
                socket={this.props.oContext.socket}
                types={['state']}
                selected={shutter?.name || ''}
                onClose={() => this.setState({ selectIdIndex: null })}
                onOk={selected => {
                    const id = Array.isArray(selected) ? selected[0] : selected;
                    this.setState({ selectIdIndex: null });
                    if (id) {
                        void this.onObjectSelected(index, id);
                    }
                }}
            />
        );
    }

    renderDeleteDialog(): React.JSX.Element | null {
        const index = this.state.deleteIndex;
        const shutter = index === null ? null : this.getShutters()[index];
        if (index === null || !shutter) {
            return null;
        }
        return (
            <DialogConfirm
                title={I18n.t('Delete shutter')}
                text={I18n.t('Do you really want to delete the shutter "%s"?', shutter.shutterName)}
                ok={I18n.t('Delete')}
                cancel={I18n.t('Cancel')}
                onClose={ok => {
                    this.setState({ deleteIndex: null });
                    if (ok) {
                        this.onDelete(index);
                    }
                }}
            />
        );
    }

    static getOptionLabel(options: { value: string; label: string }[], value: unknown): string {
        const option = options.find(opt => opt.value === value);
        return option ? I18n.t(option.label) : toStr(value);
    }

    renderRow(shutter: ShutterEntry, index: number, count: number, names: Record<string, number>): React.JSX.Element {
        const duplicate = (names[shutter.shutterName] || 0) > 1;
        return (
            <TableRow
                key={index}
                hover
                className="shutter-row"
                sx={{ opacity: shutter.enabled ? 1 : 0.6 }}
            >
                <TableCell sx={{ ...cellSx, textAlign: 'center', width: 40 }}>{index + 1}</TableCell>
                <TableCell sx={{ ...cellSx, width: 60, textAlign: 'center' }}>
                    <Checkbox
                        checked={shutter.enabled === true || (shutter.enabled as unknown) === 'true'}
                        onChange={e => this.updateShutter(index, { enabled: e.target.checked })}
                    />
                </TableCell>
                <TableCell sx={{ ...cellSx, minWidth: { xs: 140, md: 180 } }}>
                    <TextField
                        variant="standard"
                        fullWidth
                        value={shutter.shutterName || ''}
                        error={duplicate || !shutter.shutterName}
                        helperText={duplicate ? I18n.t('The name is used more than once') : undefined}
                        onChange={e => this.updateShutter(index, { shutterName: e.target.value })}
                    />
                </TableCell>
                <TableCell sx={{ ...cellSx, minWidth: { xs: 200, md: 260 } }}>
                    <TextField
                        variant="standard"
                        fullWidth
                        value={shutter.name || ''}
                        error={!shutter.name}
                        onChange={e => this.updateShutter(index, { name: e.target.value.trim() })}
                        slotProps={{
                            input: {
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            title={I18n.t('Select object ID')}
                                            onClick={() => this.setState({ selectIdIndex: index })}
                                        >
                                            <ListAlt fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />
                </TableCell>
                <TableCell sx={{ ...cellSx, minWidth: 120, display: { xs: 'none', lg: 'table-cell' } }}>
                    <Typography variant="body2">
                        {ShutterConfig.getOptionLabel(TYPE_UP_OPTIONS, shutter.typeUp)}
                    </Typography>
                </TableCell>
                <TableCell sx={{ ...cellSx, minWidth: 120, display: { xs: 'none', lg: 'table-cell' } }}>
                    <Typography variant="body2">
                        {ShutterConfig.getOptionLabel(TYPE_DOWN_OPTIONS, shutter.typeDown)}
                    </Typography>
                </TableCell>
                <TableCell
                    sx={{
                        ...cellSx,
                        whiteSpace: 'nowrap',
                        width: 210,
                        position: 'sticky',
                        right: 0,
                        bgcolor: 'background.paper',
                    }}
                >
                    <Tooltip title={I18n.t('Edit shutter settings')}>
                        <IconButton
                            size="small"
                            color="primary"
                            className="shutter-edit"
                            onClick={() => this.setState({ editIndex: index })}
                        >
                            <Edit />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={I18n.t('Copy shutter')}>
                        <IconButton
                            size="small"
                            onClick={() => this.onCopy(index)}
                        >
                            <ContentCopy />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={I18n.t('Move up')}>
                        <span>
                            <IconButton
                                size="small"
                                disabled={index === 0}
                                onClick={() => this.onMove(index, -1)}
                            >
                                <ArrowUpward />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={I18n.t('Move down')}>
                        <span>
                            <IconButton
                                size="small"
                                disabled={index === count - 1}
                                onClick={() => this.onMove(index, 1)}
                            >
                                <ArrowDownward />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={I18n.t('Delete')}>
                        <IconButton
                            size="small"
                            color="error"
                            onClick={() => this.setState({ deleteIndex: index })}
                        >
                            <Delete />
                        </IconButton>
                    </Tooltip>
                </TableCell>
            </TableRow>
        );
    }

    renderItem(): React.JSX.Element {
        const shutters = this.getShutters();
        const names: Record<string, number> = {};
        shutters.forEach(s => (names[s.shutterName] = (names[s.shutterName] || 0) + 1));

        return (
            <Box sx={{ width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<Add />}
                        className="shutter-add"
                        onClick={() => this.onAdd()}
                    >
                        {I18n.t('Add shutter')}
                    </Button>
                    <Typography
                        variant="body2"
                        sx={{ opacity: 0.7 }}
                    >
                        {I18n.t(
                            '%s shutters configured, %s active',
                            shutters.length,
                            shutters.filter(s => s.enabled).length,
                        )}
                    </Typography>
                </Box>
                <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}
                >
                    <Table
                        size="small"
                        stickyHeader
                    >
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ ...cellSx, textAlign: 'center' }}>{I18n.t('Nr')}</TableCell>
                                <TableCell sx={{ ...cellSx, textAlign: 'center' }}>{I18n.t('active')}</TableCell>
                                <TableCell sx={cellSx}>{I18n.t('Name')}</TableCell>
                                <TableCell sx={cellSx}>{I18n.t('Object-ID shutter')}</TableCell>
                                <TableCell sx={{ ...cellSx, display: { xs: 'none', lg: 'table-cell' } }}>
                                    {I18n.t('type up')}
                                </TableCell>
                                <TableCell sx={{ ...cellSx, display: { xs: 'none', lg: 'table-cell' } }}>
                                    {I18n.t('type down')}
                                </TableCell>
                                <TableCell sx={{ ...cellSx, position: 'sticky', right: 0, zIndex: 3 }} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {shutters.length ? (
                                shutters.map((shutter, i) => this.renderRow(shutter, i, shutters.length, names))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        sx={{ textAlign: 'center', py: 4, opacity: 0.7 }}
                                    >
                                        {I18n.t('No shutters configured yet. Click on "Add shutter".')}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                {this.renderEditDialog()}
                {this.renderSelectIdDialog()}
                {this.renderDeleteDialog()}
            </Box>
        );
    }
}
