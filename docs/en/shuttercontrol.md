## Shuttercontrol is an adapter for the automatic control of roller shutters and awnings.

The adapter works with the enums of IoBroker.

The following scenarios and functions are currently supported.

* Time control for shutters in the living area
* Time control for shutters in the living area with automatic and manual operation
* Time control for shutters in the sleeping area
* Time control for shutters in the sleeping area with automatic and manual mode switching Control of shutters over sunrise and sunset
* Control of the shutters depending on holidays (here the adapter holidays is additionally required)
* Timed regulation of roller shutters for sun protection in summer

## What is needed?

For the use of the adapter only enumerations (ENUMS) are needed as a function.
To use all the functions, the shutters must be assigned to 5 different enumerations.
The created functions can then be selected in the adapter settings.
The following functions can be created:

### Shutters for the living area:
* All roller shutters should be created here, which are located in the living area and should always run at the calculated times of shuttercontrol.

### Shutters for the living area with automatic / manual mode switching:
* Here, all shutters should be created, which are located in the living area, but should only go to the calculated times of shuttercontrol when switching to automatic mode. Switching between automatic mode and manual mode takes place via the data point "autoLiving" created by shuttercontrol. This can e.g. via the VIS or via Homekit etc.
The background to this feature is that there may be shutters in the living area that are not allowed to automatically shut down in the presence (e.g., a patio door).

### Shutters for the sleeping area:
* Shutters should be created here which are in the sleeping area and should always run at the calculated times of shuttercontrol.

### Shutters for the sleeping area with automatic / manual mode switching:

* Here, all shutters should be created that are in the sleeping area, but should only drive when switching to automatic mode at the calculated times of shuttercontrol. The changeover between automatic mode and manual mode is made via the data point "autoSleep" created by shuttercontrol. This can e.g. via the VIS or via Homekit etc.
The background for this function is that there can be blinds in the sleeping area, which should not automatically start up in certain situations (illness, holidays or holidays).

### Shutters for the sunscreen function:
* All roller shutters needed for the sun protection function should be created here.
All shutters that are created here are moved to the set level when the set setpoint temperature is exceeded and are only restarted after falling below the set setpoint temperature or after the set sun protection time has expired.
Again, you should make sure that shutters on patio doors, etc. are not necessarily included in this function, so as not to lock itself out. ;-)

### More functions
* Shuttercontrol distinguishes between the working week, weekend and public holidays.
Different times can be stored here for free days and working days.
Furthermore, there is a data point "Holiday", which can also be set via the VIS, Homekit etc.
If the data point is true, the shutter speeds are used for weekends / public holidays.

* If the holiday function is activated, the holiday adapter is required and the installed instance must be selected in the settings of shuttercontrol.
If the function is activated, on weekends and the evening before, the roller shutter times for weekends will also be set.