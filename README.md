![Logo](admin/shuttercontrol.png)
# ioBroker.shuttercontrol



![Number of Installations](http://iobroker.live/badges/shuttercontrol-installed.svg) 
![Number of Installations](http://iobroker.live/badges/shuttercontrol-stable.svg)
[![NPM version](http://img.shields.io/npm/v/iobroker.shuttercontrol.svg)](https://www.npmjs.com/package/iobroker.shuttercontrol)
[![Downloads](https://img.shields.io/npm/dm/iobroker.shuttercontrol.svg)](https://www.npmjs.com/package/iobroker.shuttercontrol)
[![Known Vulnerabilities](https://snyk.io/test/github/simatec/ioBroker.shuttercontrol/badge.svg)](https://snyk.io/test/github/simatec/ioBroker.shuttercontrol)

![Test and Release](https://github.com/simatec/ioBroker.shuttercontrol/workflows/Test%20and%20Release/badge.svg)
[![License](https://img.shields.io/github/license/simatec/ioBroker.shuttercontrol?style=flat)](https://github.com/simatec/ioBroker.shuttercontrol/blob/master/LICENSE)
[![Donate](https://img.shields.io/badge/paypal-donate%20|%20spenden-blue.svg)](https://paypal.me/mk1676)
[![](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86)](https://github.com/sponsors/simatec)


This adapter uses the service Sentry.io to automatically report exceptions and code errors and new device schemas to me as the developer. More details see below!


**If you like it, please consider a donation:**
  
[![paypal](https://www.paypalobjects.com/en_US/DK/i/btn/btn_donateCC_LG.gif)](https://paypal.me/mk1676)


## shuttercontrol adapter for ioBroker

automatische Rollladensteuerung

[Deutsche Beschreibung hier](https://github.com/simatec/ioBroker.shuttercontrol/wiki/Shuttercontrol-Wiki-Deutsch)

automatic control for shutters

[English Description here](https://github.com/simatec/ioBroker.shuttercontrol/wiki/Shuttercontrol-Wiki-English)


### What is Sentry.io and what is reported to the servers of that company?
Sentry.io is a service for developers to get an overview about errors from their applications. And exactly this is implemented in this adapter.

When the adapter crashes or an other Code error happens, this error message that also appears in the ioBroker log is submitted to Sentry. When you allowed iobroker GmbH to collect diagnostic data then also your installation ID (this is just a unique ID **without** any additional infos about you, email, name or such) is included. This allows Sentry to group errors and show how many unique users are affected by such an error. All of this helps me to provide error free adapters that basically never crashs.


*************************************************************************************************************************************



## Changelog
<!-- ### __WORK IN PROGRESS__ -->
### __WORK IN PROGRESS__
* (simatec) Update dependabot

### 2.1.1 (2026-08-21)
* (simatec) small Bugfix
* (simatec) Update dependabot
* (simatec) Fix Azimut & Elevation

### 2.1.0 (2026-08-18)
* (simatec) Code Cleaning
* (Eistee82) Add the ventilation height to the down automatics with an open window
* (simatec) Update dependabot

### 2.0.12 (2026-02-21)
* (simatec) License updated
* (simatec) Update dependabot

### 2.0.11 (2025-12-21)
* (simatec) Update dependabot

### 2.0.10 (2025-12-21)
* (simatec) Fix JSON Tab

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License
MIT License

Copyright (c) 2019 - 2026 simatec

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.