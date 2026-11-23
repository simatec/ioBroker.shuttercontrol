const path = require('path');
const { tests } = require('@iobroker/testing');

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
// Always test against the latest released js-controller (the default would be the "dev" nightly)
tests.integration(path.join(__dirname, '..'), {
    controllerVersion: 'latest',
});
