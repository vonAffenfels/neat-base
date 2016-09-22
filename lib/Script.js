"use strict";
// @IMPORTS
var Application = require("./Application.js");
var Tools = require("./Tools.js");
var merge = require("merge");
var ProgressBar = require("progress");
var Promise = require("bluebird");

module.exports = class Script {

    constructor(name, config, options, args) {
        this.name = name;
        this.config = merge.recursive({}, config);
        this.log = Application.getLogger(this.name);
        this.options = options;
        this.arguments = args;
    }

    init(resolve, reject) {
        this.log.debug("Init script " + this.name + "...");
        resolve();
    }

    run(resolve, reject) {
        this.log.debug("Running script " + this.name + "...");
        resolve();
    }

    progress(title, total) {
        if (Application.config.quiet) {
            return;
        }
        if (this.progressBar && this.progressBar.complete) {
            // Delete current progressbar if it is completed
            this.progressBar = null;
        }

        if (!this.progressBar) {
            this.progressBar = new ProgressBar("  :title [:bar] :percent (:current/:total) :etas ", {
                total: total,
                width: 40,
                complete: "=",
                incomplete: " "
            });

            this.progressBar._render = this.progressBar.render;
            this.progressBar.render = function (tokens) {
                if (this.lastRender && this.lastRender() < 100 && this.curr < this.total - 100) {
                    return;
                }

                this._render(tokens);
                this.lastRender = Tools.measureTime();
            }
        }

        if (total != this.progressBar.total) {
            this.progressBar.total = total;
        }

        this.progressBar.tick({
            title: title
        })
    }

}