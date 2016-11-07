"use strict";

// @IMPORTS
var fs = require("fs");
var os = require("os");
var winston = require("winston");
var moment = require("moment");
var merge = require("merge");
var EventEmitter = require('events').EventEmitter;
var emitterInstance = new EventEmitter();
var Tools = require("./Tools.js");
var Promise = require("bluebird");
var i18n = require("i18n");
var cluster = require("cluster");
var apeStatus = require('ape-status');
var lockfile = require("proper-lockfile");

module.exports = class Application {

    constructor() {
        throw "Cannot construct singleton";
    }

    static stop() {
        return Application.stopModules().then(() => {
            process.exit(0);
        }, (err) => {
            this.log.error(err);
            process.exit(1);
        });
    }

    static configure(config) {
        if (config.stage) {
            config.stage = config.stage.toLowerCase();
        }

        apeStatus.configure({
            root: __dirname + "/../"
        });

        Promise.config({
            warnings: {
                wForgottenReturn: false //config.stage === "dev"
            }
        });

        this.config = merge.recursive({
            logFormat: "dddd, MMMM Do YYYY, hh:mm:ss a",
            logLevelConsole: "debug",
            logLevelFile: "info",
            logDisabled: false,
            quiet: false
        }, config);
        this.moduleObjs = [];
        this.modules = {};

        winston.setLevels({
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        });

        winston.addColors({
            debug: 'blue',
            info: 'grey',
            warn: 'yellow',
            error: 'red'
        });

        this.log = this.getLogger("application");
        this.scriptName = null;

        Promise.onPossiblyUnhandledRejection((err) => {
            this.log.error(err);
        });

        process.on('uncaughtException', (err) => {
            this.log.error(err);
        })
    }

    static getLogger(name) {

        try {
            fs.accessSync(this.config.logDir, fs.R_OK);
        } catch (e) {
            try {
                fs.mkdirSync(this.config.logDir);
            } catch (err) {
                console.error(e);
                console.error(err);
            }
        }

        var transports = [];
        if (!Application.config.logDisabled) {
            transports = [
                new winston.transports.Console({
                    level: Application.config.logLevelConsole,
                    colorize: true,
                    json: false,
                    label: name.toUpperCase(),
                    timestamp: () => {
                        return moment().format(this.config.logFormat);
                    }
                }),
                new winston.transports.File({
                    level: Application.config.logLevelFile,
                    colorize: false,
                    json: false,
                    label: name.toUpperCase(),
                    timestamp: () => {
                        return moment().format(this.config.logFormat);
                    },
                    filename: this.config.logDir + '/' + name + '.log'
                })
            ]
        }

        return new (winston.Logger)({
            transports: transports
        });
    }

    static loadModuleConfig(moduleName, defaultConfig) {
        var configJsonLocation = this.config.config_path + "/" + moduleName + ".json";
        var localConfigJsonLocation = this.config.config_path + "/" + moduleName + ".local.json";
        var localConfig = {};

        if (!fs.existsSync(this.config.config_path)) {
            fs.mkdirSync(this.config.config_path);
        }

        if (!fs.existsSync(configJsonLocation)) {
            var temp = {};
            temp[this.config.stages[0]] = defaultConfig;

            fs.writeFileSync(configJsonLocation, JSON.stringify(temp));
        }

        try {
            var config = Tools.loadCommentedConfigFile(configJsonLocation);
        } catch (e) {
            throw new Error("config of module " + moduleName + " contains invalid json data: " + e.toString());
        }

        var stagedConfig = defaultConfig;

        var configHasStages = false;

        for (var i = 0; i < this.config.stages.length; i++) {
            var stage = this.config.stages[i];

            if (config[stage]) {
                configHasStages = true;
                stagedConfig = merge.recursive(stagedConfig, config[stage]);
            }

            if (stage == this.config.stage) {
                break;
            }
        }

        if (fs.existsSync(localConfigJsonLocation)) {
            localConfig = Tools.loadCommentedConfigFile(localConfigJsonLocation);
        }

        if (!configHasStages) {
            config = merge.recursive(config, localConfig);
            return config;
        } else {
            stagedConfig = merge.recursive(stagedConfig, localConfig);
            return stagedConfig;
        }
    }

    static loadScriptConfig(scriptName, defaultConfig) {
        var configJsonLocation = this.config.config_path + "/scripts/" + scriptName + ".json";
        var localConfigJsonLocation = this.config.config_path + "/scripts/" + scriptName + ".local.json";
        var localConfig = {};

        if (!fs.existsSync(this.config.config_path + "/scripts/")) {
            fs.mkdirSync(this.config.config_path + "/scripts/");
        }

        if (!fs.existsSync(configJsonLocation)) {
            var temp = {};
            temp[this.config.stages[0]] = defaultConfig;

            fs.writeFileSync(configJsonLocation, JSON.stringify(temp));
        }

        try {
            var config = Tools.loadCommentedConfigFile(configJsonLocation);
        } catch (e) {
            throw new Error("Config of script " + scriptName + " contains invalid json data: " + e.toString());
        }

        var stagedConfig = {};

        var configHasStages = false;

        for (var i = 0; i < this.config.stages.length; i++) {
            var stage = this.config.stages[i];

            if (config[stage]) {
                configHasStages = true;
                stagedConfig = merge.recursive(stagedConfig, config[stage]);
            }
        }

        if (fs.existsSync(localConfigJsonLocation)) {
            localConfig = Tools.loadCommentedConfigFile(localConfigJsonLocation);
        }

        if (!configHasStages) {
            config = merge.recursive(config, localConfig);
            return config;
        } else {
            stagedConfig = merge.recursive(stagedConfig, localConfig);
            return stagedConfig;
        }
    }

    static registerModule(moduleName, moduleClass) {
        var moduleConfig = this.loadModuleConfig(moduleName, moduleClass.defaultConfig());

        var moduleObj = {
            name: moduleName,
            config: moduleConfig
        };

        try {
            var moduleInstance = new moduleClass(moduleName, moduleConfig, moduleObj);
        } catch (e) {
            throw e;
        }

        moduleObj.instance = moduleInstance;

        this.moduleObjs.push(moduleObj);
        this.modules[moduleName] = moduleInstance;

        return moduleInstance;
    }

    static initModules() {
        return new Promise((resolve, reject) => {
            this.log.info("Initializing Modules");

            Promise.each(this.moduleObjs, (moduleObj, index, length) => {
                return moduleObj.instance.init();
            }).then(function () {
                resolve();
            }, function (err) {
                reject(err);
            });
        });
    }

    static startModules() {
        return new Promise((resolve, reject) => {
            this.log.info("Starting Modules");

            Promise.each(this.moduleObjs, (moduleObj, index, length) => {
                return moduleObj.instance.start();
            }).then(function () {
                resolve();
            }, function (err) {
                reject(err);
            });
        });
    }

    static stopModules() {
        return new Promise((resolve, reject) => {
            this.log.info("Stopping Modules");

            Promise.each(this.moduleObjs, (moduleObj, index, length) => {
                return moduleObj.instance.stop();
            }).then(function () {
                resolve();
            }, function (err) {
                reject(err);
            });
        });
    }

    static loadApplicationConfigs() {
        return new Promise((resolve, reject) => {
            var rootDir = Application.config.application_config_path;

            if (!fs.existsSync(rootDir)) {
                fs.mkdirSync(rootDir);
            }

            var files = fs.readdirSync(rootDir);
            var applicationConfig = {};

            for (var i = 0; i < files.length; i++) {
                var file = files[i];

                if (file.indexOf(".json") === -1) {
                    continue;
                }

                var config = Tools.loadCommentedConfigFile(rootDir + "/" + file);
                applicationConfig[file.replace(/^(.*?)\.json$/, "$1")] = config;
            }

            this.appConfigs = applicationConfig;

            resolve();
        });
    }

    static runScript(packageData) {
        var scriptInstance = null;
        var duration = Tools.measureTime();
        var lockAquired = false;
        var startTime = new Date();
        var scriptClass = null;

        this.loadApplicationConfigs().then(() => {
            this.scriptName = packageData.name;

            try {
                this.lastRun = new Date(fs.readFileSync(os.tmpdir() + "/" + this.scriptName + "_lastrun"));
            } catch (e) {
                this.lastRun = null;
            }

            if (isNaN(this.lastRun)) {
                this.lastRun = null;
            }

            return new Promise((resolve, reject) => {
                // Aquire lock file if needed
                if (packageData.scriptConfig.useLockFile) {
                    lockfile.lock(os.tmpdir() + "/" + this.scriptName, {realpath: false}, (err) => {
                        if (err) {
                            return reject(err);
                        }

                        lockAquired = true;
                        this.log.info("Lock aquired");
                        return resolve();
                    });
                } else {
                    return resolve();
                }
            })
        }).then(() => {
            var mainScriptFile = this.config.scripts_path + "/" + this.scriptName.toLowerCase() + "/" + packageData.main;

            if (!fs.existsSync(mainScriptFile)) {
                throw new Error("Missing " + packageData.main + " for module " + this.scriptName);
            }

            scriptClass = require(mainScriptFile);

            this.log.info("Registering modules");
            scriptClass.registerModules();
            return Promise.resolve();
        }).then(() => {
            return this.initModules();
        }).then(() => {
            return this.startModules();
        }).then(() => {
            var scriptConfig = this.loadScriptConfig(this.scriptName, scriptClass.defaultConfig());

            try {
                scriptInstance = new scriptClass(this.scriptName, scriptConfig, packageData.options, packageData.arguments);
                scriptInstance.lastRun = this.lastRun;
            } catch (e) {
                throw e;
            }

            return new Promise((resolve, reject) => {
                try {
                    scriptInstance.init(resolve, reject);
                } catch (e) {
                    reject(e);
                }
            })
        }).then(() => {
            return new Promise((resolve, reject) => {
                try {
                    scriptInstance.run(resolve, reject);
                } catch (e) {
                    reject(e);
                }
            })
        }).catch((err) => {
            if (!err) {
                err = new Error("Unkown error!");
            }

            if (this.config.stage == "dev") {
                this.log.error(err);
            } else {
                this.log.error(err.toString());
            }
        }).finally(() => {
            if (lockAquired) {
                lockfile.unlock(os.tmpdir() + "/" + this.scriptName);
                this.log.info("Lock released");
            }

            try {
                fs.writeFileSync(os.tmpdir() + "/" + this.scriptName + "_lastrun", startTime.toString());
            } catch (e) {

            }

            this.log.info("Script duration: " + Tools.formatDuration(duration()));
            process.exit(0);
        });
    }

    static run() {
        this.loadApplicationConfigs().then(() => {
            return this.initModules();
        }).then(() => {
            return this.startModules();
        }).then(() => {

            this.log.info("Application started");
            apeStatus.saveJSONInfo();

            if (cluster.isWorker) {
                process.send({
                    status: 'ready'
                });
            }

        }, (err) => {
            if (!err) {
                err = new Error("Unkown error!");
            }

            this.log.error(err);
        });
    }

    static on() {
        emitterInstance.on.apply(this, arguments);
    }

    static emit() {
        emitterInstance.emit.apply(this, arguments);
    }
}