"use strict";
// @IMPORTS
var Application = require("./Application");
var merge = require("merge");
var Promise = require("bluebird");

module.exports = class Module {

    static defaultConfig() {
        return {}
    }

    constructor(name, config, moduleConfig) {
        this.name = name;
        this.config = merge.recursive({}, config);
        this.log = Application.getLogger(this.name);
        this.moduleConfig = moduleConfig;
    }

    /*
     LIFECYCLE
     */

    init() {
        return new Promise((resolve, reject) => {
            this.log.debug("Initializing...");
            resolve(this);
        });
    }

    start() {
        return new Promise((resolve, reject) => {
            this.log.debug("Starting...");
            resolve(this);
        });
    }

    stop() {
        return new Promise((resolve, reject) => {
            this.log.debug("Stopping...");
            resolve(this);
        });
    }

}