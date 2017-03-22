"use strict";

var fs = require("fs");
var Promise = require("bluebird");
var _ = require("underscore");

module.exports = class Tools {
    /**
     *
     */
    constructor() {
        throw "Cannot construct singleton";
    }

    /**
     *
     * @param path
     * @param root
     */
    static ensureFolderExists(path, root) {
        var parts = path.split("/");
        var curr = root;

        while (parts.length) {
            curr += "/" + parts.shift();

            if (!fs.existsSync(curr)) {
                fs.mkdirSync(curr);
            }
        }
    }

    /**
     *
     * @param config
     * @param path
     * @param defaultValue
     * @returns {*|null}
     */
    static getConfigValueByPath(config, path, defaultValue) {
        var pathParts = path.split(".");
        var currentConfig = JSON.parse(JSON.stringify(config));

        for (var i = 0; i < pathParts.length; i++) {
            var pathPart = pathParts[i];

            if (currentConfig[pathPart]) {
                currentConfig = currentConfig[pathPart];
            } else {
                return defaultValue || null;
            }
        }

        return currentConfig;
    }

    /**
     *
     * @param a
     * @param b
     * @returns {Array}
     */
    static getArrayDifferences(a, b) {
        var diff = [];

        for (var i = 0; i < b.length; i++) {
            var bval = b[i];
            var aval = a[i];

            if (bval instanceof Object) {
                for (var key in bval) {
                    if (aval instanceof Object) {
                        if (aval[key] != bval[key]) {
                            diff.push(bval);
                            break;
                        }
                    } else {
                        if (aval != bval[key]) {
                            diff.push(bval);
                            break;
                        }
                    }
                }
            } else {
                if (aval != bval) {
                    diff.push(bval);
                    break;
                }
            }
        }

        return diff;
    }

    /**
     *
     * @param str
     * @param delimiter
     * @returns {*}
     */
    static escapeForRegexp(str, delimiter) {
        if (!str) {
            return "";
        }

        str = str + "";
        return (str + '').replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&');
    }

    /**
     *
     * @param string
     * @returns {string}
     */
    static capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    /**
     *
     * @param path
     * @returns {*}
     */
    static loadCommentedConfigFile(path) {
        try {
            return this.parseCommentedJson(fs.readFileSync(path));
        } catch (e) {
            var Application = require('./Application.js');
            Application.log.error("Error loading JSON " + path);
        }
    }

    /**
     *
     * @param json
     */
    static parseCommentedJson(json) {
        return JSON.parse(this.minifyJson(json));
    }

    /**
     *
     * @param json
     * @returns {*}
     */
    static minifyJson(json) {
        if (json instanceof Buffer) {
            json = json.toString();
        }

        try {
            if (JSON.parse(json)) {
                return json;
            }
        } catch (e) {

        }

        var tokenizer = /"|(\/\*)|(\*\/)|(\/\/)|\n|\r/g,
            in_string = false,
            in_multiline_comment = false,
            in_singleline_comment = false,
            tmp, tmp2, new_str = [], ns = 0, from = 0, lc, rc
            ;

        tokenizer.lastIndex = 0;

        while (tmp = tokenizer.exec(json)) {
            lc = RegExp.leftContext;
            rc = RegExp.rightContext;
            if (!in_multiline_comment && !in_singleline_comment) {
                tmp2 = lc.substring(from);
                if (!in_string) {
                    tmp2 = tmp2.replace(/(\n|\r|\s)*/g, "");
                }
                new_str[ns++] = tmp2;
            }
            from = tokenizer.lastIndex;

            if (tmp[0] == "\"" && !in_multiline_comment && !in_singleline_comment) {
                tmp2 = lc.match(/(\\)*$/);
                if (!in_string || !tmp2 || (tmp2[0].length % 2) == 0) {	// start of string with ", or unescaped " character found to end string
                    in_string = !in_string;
                }
                from--; // include " character in next catch
                rc = json.substring(from);
            }
            else if (tmp[0] == "/*" && !in_string && !in_multiline_comment && !in_singleline_comment) {
                in_multiline_comment = true;
            }
            else if (tmp[0] == "*/" && !in_string && in_multiline_comment && !in_singleline_comment) {
                in_multiline_comment = false;
            }
            else if (tmp[0] == "//" && !in_string && !in_multiline_comment && !in_singleline_comment) {
                in_singleline_comment = true;
            }
            else if ((tmp[0] == "\n" || tmp[0] == "\r") && !in_string && !in_multiline_comment && in_singleline_comment) {
                in_singleline_comment = false;
            }
            else if (!in_multiline_comment && !in_singleline_comment && !(/\n|\r|\s/.test(tmp[0]))) {
                new_str[ns++] = tmp[0];
            }
        }
        new_str[ns++] = rc;
        return new_str.join("");
    }

    /**
     *
     * @param query
     */
    static getStringFromMongoQuery(query) {
        return JSON.stringify(query, function (k, v) {
            if (v instanceof RegExp) {
                v = JSON.stringify({
                    $regex: v.toString().slice(1, v.toString().length - 1)
                });
            } else if (typeof v === 'function') {
                return v + '';
            } else if (v === undefined) {
                v = "undefined";
            }
            return v;
        });

    }

    /**
     *
     * @returns {function()}
     */
    static measureTime() {
        var start = new Date().getTime();

        return () => {
            var end = new Date().getTime();
            return end - start;
        }
    }

    /**
     *
     * @param str
     * @returns {*}
     */
    static escapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }

    /**
     *
     * @param str
     * @param width
     * @returns {*}
     */
    static pad(str, width) {
        var len = Math.max(0, width - str.length);
        return str + Array(len + 1).join(' ');
    }

    /**
     *
     * @param val
     * @returns {boolean}
     */
    static isNumber(val) {
        return /^[\.0-9]+$/.test(String(val));
    }

    /**
     *
     * @param duration
     * @returns {string}
     */
    static formatDuration(duration) {
        var sec_num = parseInt(duration / 1000, 10); // don't forget the second param
        var hours = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        var seconds = sec_num - (hours * 3600) - (minutes * 60);

        if (hours < 10) {
            hours = "0" + hours;
        }
        if (minutes < 10) {
            minutes = "0" + minutes;
        }
        if (seconds < 10) {
            seconds = "0" + seconds;
        }
        return hours + ':' + minutes + ':' + seconds;
    }

    /**
     *
     * @param err
     * @returns {{}}
     */
    static formatMongooseError(err) {
        var formattedError = {};

        for (var field in err.errors) {
            formattedError[field] = err.errors[field].message;
        }

        return formattedError;
    }

    /**
     *
     * @param value
     * @param precision
     * @returns {string}
     */
    static toPrecision(value, precision) {
        var precision = precision || 0,
            power = Math.pow(10, precision),
            absValue = Math.abs(Math.round(value * power)),
            result = (value < 0 ? '-' : '') + String(Math.floor(absValue / power));

        if (precision > 0) {
            var fraction = String(absValue % power),
                padding = new Array(Math.max(precision - fraction.length, 0) + 1).join('0');
            result += '.' + padding + fraction;
        }
        return result;
    }

    /**
     *
     * @param min
     * @param max
     * @returns {*}
     */
    static getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min;
    }

    /**
     * Erweitert das Paging-Objekt um die entsprechenden URLs mit Paging Parameter.
     *
     * @param paging Das Objekt mit den Paging Infos
     * @param req aktueller Request
     * @param url aktuelle Url. Wrd diese nicht übergeben, wird die Url aus dem Request genommen
     * @returns {{nextUrl: String, prevUrl: String, lastUrl: String}} Das erweiterte Paging Objekt mit URLs
     */
    static extendPaging(paging, req, url) {
        if (!paging) {
            return paging;
        }

        //
        let pageObj = JSON.parse(JSON.stringify(paging));
        let currentUrl = url || req.originalUrl;
        // Wenn eine Url übergeben wird, dann per RegEx prüfen ob es Query-Params gibt
        let hasParams = url ? url.match(/\?\w/gi) != null : Object.keys(req.query).length > 0;

        pageObj.nextUrl = Tools.setPagingInUrl(currentUrl, pageObj.next, hasParams);
        pageObj.lastUrl = Tools.setPagingInUrl(currentUrl, pageObj.pageCount, hasParams);
        pageObj.firstUrl = Tools.setPagingInUrl(currentUrl, 0, hasParams);

        if (!isNaN(pageObj.prev)) {
            pageObj.prevUrl = Tools.setPagingInUrl(currentUrl, pageObj.prev, hasParams);
        }

        for (let i = 0; i < pageObj.pages.length; i++) {
            let page = pageObj.pages[i];
            page.url = Tools.setPagingInUrl(currentUrl, page.index, hasParams)
        }

        return Object.freeze(pageObj);
    }

    /**
     * Fügt der Url den Parameter für die Page an.
     * Prüft ob es bereits ein Paging-Parameter gibt, wenn ja wird diese aktualisiert.
     * Wenn nein wird er neu hinzugefügt.
     *
     * @param currentUrl die gerade aktive Url
     * @param page Seite die hinzugefügt werden soll
     * @param hasParams Ob es weitere Parameter an der Url gibt
     * @returns {String} Die neue Url mit dem Page-Parameter
     */
    static setPagingInUrl(currentUrl, page, hasParams) {
        let newUrl = currentUrl;

        if (!page) {
            page = 0;
        }

        if (newUrl.match(/p=(\d*)/gi)) {
            newUrl = newUrl.replace(/p=(\d*)/gi, "p=" + page);
        }
        else if (hasParams) {
            newUrl = newUrl + "&p=" + page;
        }
        else {
            newUrl = newUrl + (newUrl.indexOf("?") != -1 ? "p=" : "?p=") + page;
        }

        return newUrl;
    }

    /**
     *
     * @param count
     * @param limit
     * @param page
     * @param pagesInView
     * @returns {{prev: number, next: *, pages: Array, active: (Number|number|*), limit: (Number|*), total: (Number|number|*)}}
     */
    static getPaginationForCount(count, limit, page, pagesInView) {
        page = parseInt(page) || 0;
        count = parseInt(count) || 0;
        limit = parseInt(limit);
        pagesInView = parseInt(pagesInView) || 2;

        let maxPage = Math.ceil(count / limit) - 1;
        let pages = [];
        let startpage = page - pagesInView;
        let endpage = page + pagesInView;

        if (startpage < 0) {
            endpage += (startpage * -1);
            startpage = 0;
        }

        if (endpage > maxPage) {
            startpage -= (endpage - maxPage);
            endpage = maxPage;
        }

        if (startpage < 0) {
            startpage = 0;
        }

        for (let i = startpage; i <= endpage; i++) {
            pages.push({
                index: i,
                label: i + 1,
                active: i == page
            });
        }

        let prevPage = page - 1;
        let nextPage = page + 1;

        if (prevPage < 0) {
            prevPage = null;
        }

        if (nextPage > endpage) {
            nextPage = null;
        }

        return Object.freeze({
            prev: prevPage,
            next: nextPage,
            pageCount: maxPage,
            pages: pages,
            active: page,
            limit: limit,
            total: count
        });
    }

    /**
     *
     *
     * @param {object} obj
     * @param {string} path
     * @returns {*}
     */
    static getObjectValueByPath(obj, path) {
        if (typeof obj === "undefined") {
            return;
        } else if (typeof obj !== "object") {
            return obj;
        }

        if (path.indexOf(".") === -1) {
            return obj[path] || null;
        }

        let parts = path.split(".");
        let key = parts.shift();

        return Tools.getObjectValueByPath(obj[key], parts.join("."));
    }
}
