var _      = require('lodash');
var path   = require('path');
var semver = require('semver');

/*jshint -W079 */
var Filter = require('./filter');
var Parser = require('./parser');
var Worker = require('./worker');

var FileError      = require('./errors/file_error');
var ParserError    = require('./errors/parser_error');
var WorkerError    = require('./errors/worker_error');

// const
var SPECIFICATION_VERSION = '0.2.0';

var defaults = {
    excludeFilters: [],
    includeFilters: [ '.*\\.(coffee|cs|dart|erl|go|java|js|php?|py|rb|ts|pm)$' ],

    src: path.join(__dirname, '../example/'),

    filters: {},
    parsers: {},
    workers: {}
};

var app = {
    options     : {},
    log         : {},
    generator   : {},
    packageInfos: {},
    markdown    : false,
    filters: {
        apierror                 : './filters/api_error.js',
        apiheader                : './filters/api_header.js',
        apiparam                 : './filters/api_param.js',
        apisuccess               : './filters/api_success.js'
    },
    parsers: {
        api                      : './parsers/api.js',
        apidefine                : './parsers/api_define.js',
        apidefineerrorstructure  : './parsers/api_define_error_structure.js',
        apidefineheaderstructure : './parsers/api_define_header_structure.js',
        apidefinepermission      : './parsers/api_define_permission.js',
        apidefinestructure       : './parsers/api_define_structure.js',
        apidefinesuccessstructure: './parsers/api_define_success_structure.js',
        apigroupdescription      : './parsers/api_group_description.js',
        apidescription           : './parsers/api_description.js',
        apierror                 : './parsers/api_error.js',
        apierrorexample          : './parsers/api_error_example.js',
        apierrorstructure        : './parsers/api_error_structure.js',
        apierrortitle            : './parsers/api_error_title.js',
        apiexample               : './parsers/api_example.js',
        apiheader                : './parsers/api_header.js',
        apiheaderexample         : './parsers/api_header_example.js',
        apiheaderstructure       : './parsers/api_header_structure.js',
        apiheadertitle           : './parsers/api_header_title.js',
        apigroup                 : './parsers/api_group.js',
        apiname                  : './parsers/api_name.js',
        apiparam                 : './parsers/api_param.js',
        apiparamexample          : './parsers/api_param_example.js',
        apiparamtitle            : './parsers/api_param_title.js',
        apipermission            : './parsers/api_permission.js',
        apistructure             : './parsers/api_structure.js',
        apisuccess               : './parsers/api_success.js',
        apisuccessexample        : './parsers/api_success_example.js',
        apisuccessstructure      : './parsers/api_success_structure.js',
        apisuccesstitle          : './parsers/api_success_title.js',
        apiuse                   : './parsers/api_use.js',
        apiversion               : './parsers/api_version.js',
        apisamplerequest         : './parsers/api_sample_request.js'
    },
    workers: {
        apierrorstructure        : './workers/api_error_structure.js',
        apierrortitle            : './workers/api_error_title.js',
        apigroup                 : './workers/api_group.js',
        apiheaderstructure       : './workers/api_header_structure.js',
        apiheadertitle           : './workers/api_header_title.js',
        apiname                  : './workers/api_name.js',
        apiparamtitle            : './workers/api_param_title.js',
        apipermission            : './workers/api_permission.js',
        apisamplerequest         : './workers/api_sample_request.js',
        apistructure             : './workers/api_structure.js',
        apisuccessstructure      : './workers/api_success_structure.js',
        apisuccesstitle          : './workers/api_success_title.js',
        apiuse                   : './workers/api_use.js',

        deprecatedApiErrorTitle  : './workers/deprecated_api_error_title.js',
        deprecatedApiHeaderTitle : './workers/deprecated_api_header_title.js',
        deprecatedApiParamTitle  : './workers/deprecated_api_param_title.js',
        deprecatedApiSuccessTitle: './workers/deprecated_api_success_title.js'
    }
};

var defaultGenerator = {
    version: '0.0.0',
    time   : new Date(),
    name   : 'apidoc',
    url    : 'http://apidocjs.com'
};

// TODO: find abetter name for PackageInfos (-> apidoc-conf)
var defaultPackageInfos = {
    name       : '',
    version    : '0.0.0',
    description: '',
    sampleUrl  : false
};

/**
 * Parser
 *
 * @param {Object} options        Overwrite default options.
 * @param {Object} logger         Logger (with methods: debug, verbose, info, warn and error is necessary).
 * @param {Object} [packageInfos]             Collected from apidoc.json / package.json.
 * @param {String} [packageInfos.name]        Project name.
 * @param {String} [packageInfos.version]     Version (semver) of the project, e.g. 1.0.27
 * @param {String} [packageInfos.description] A short description.
 * @param {String} [packageInfos.sampleUrl]   @see http://apidocjs.com/#param-api-sample-request
 * @param {Object} [markdown]     Markdown parser.
 * @returns {Mixed} true = ok, but nothing todo | false = error | Object with parsed data and project-informations.
 *          {
 *              data   : { ... }
 *              project: { ... }
 *          }
 */
function parse(options, logger, generator, packageInfos, markdown) {
    _.defaults(options, defaults);

    // extend with custom functions
    app.filters = _.defaults(options.filters, app.filters);
    app.parsers = _.defaults(options.parsers, app.parsers);
    app.workers = _.defaults(options.workers, app.workers);

    // options
    app.options = options;

    // logger
    app.log = logger;

    // generator
    app.generator = generator || {};
    _.defaults(app.generator, defaultGenerator);

    // packageInfos
    app.packageInfos = packageInfos || {};
    _.defaults(app.packageInfos, defaultPackageInfos);

    // markdown parser
    app.markdown = markdown;

    var parsedFiles = [];
    var parsedFilenames = [];

    try {
        var parser = new Parser(app);
        var worker = new Worker(app);
        var filter = new Filter(app);

        // if input option for source is an array of folders,
        // parse each folder in the order provided.
        if (options.src instanceof Array) {
            options.src.forEach(function(folder) {
                // Keep same options for each folder, but ensure the 'src' of options
                // is the folder currently being processed.
                var folderOptions = options;
                folderOptions.src = path.join(folder, './');
                parser.parseFiles(folderOptions, parsedFiles, parsedFilenames);
            });
        }
        else {
            // if the input option for source is a single folder, parse as usual.
            options.src = path.join(options.src, './');
            parser.parseFiles(options, parsedFiles, parsedFilenames);
        }

        if (parsedFiles.length > 0) {
            // process transformations and assignments
            worker.process(parsedFiles, parsedFilenames, app.packageInfos);

            // cleanup
            var blocks = filter.process(parsedFiles, parsedFilenames);

            // sort by group ASC, name ASC, version DESC
            blocks.sort(function(a, b) {
                var nameA = a.group + a.name;
                var nameB = b.group + b.name;
                if (nameA === nameB) {
                    if (a.version === b.version)
                        return 0;
                    return (semver.gte(a.version, b.version)) ? -1 : 1;
                }
                return (nameA < nameB) ? -1 : 1;
            });

            // add apiDoc specification version
            app.packageInfos.apidoc = SPECIFICATION_VERSION;

            // add apiDoc specification version
            app.packageInfos.generator = app.generator;

            // api_data
            var apiData = JSON.stringify(blocks, null, 2);
            apiData = apiData.replace(/(\r\n|\n|\r)/g, '\r\n');

            // api_project
            var apiProject = JSON.stringify(app.packageInfos, null, 2);
            apiProject = apiProject.replace(/(\r\n|\n|\r)/g, '\r\n');

            return {
                data   : apiData,
                project: apiProject
            };
        }
        return true;
    } catch(e) {
        // display error by instance
        var extra;
        var meta = {};
        if (e instanceof FileError) {
            meta = { 'Path': e.path };
            app.log.error(e.message, meta);
        } else if (e instanceof ParserError) {
            extra = e.extra;
            if (e.source)
                extra.unshift({ 'Source': e.source });
            if (e.element)
                extra.unshift({ 'Element': '@' + e.element });
            if (e.block)
                extra.unshift({ 'Block': e.block });
            if (e.file)
                extra.unshift({ 'File': e.file });

            extra.forEach(function(obj) {
                var key = Object.keys(obj)[0];
                meta[key] = obj[key];
            });

            app.log.error(e.message, meta);
        }
        else if (e instanceof WorkerError) {
            extra = e.extra;
            if (e.definition)
                extra.push({ 'Definition': e.definition });
            if (e.example)
                extra.push({ 'Example': e.example });
            extra.unshift({ 'Element': '@' + e.element });
            extra.unshift({ 'Block': e.block });
            extra.unshift({ 'File': e.file });

            extra.forEach(function(obj) {
                var key = Object.keys(obj)[0];
                meta[key] = obj[key];
            });

            app.log.error(e.message, meta);
        }
        else {
            app.log.error(e.message);
            if (e.stack)
                app.log.debug(e.stack);
        }
        return false;
    }
}

module.exports = {
    parse: parse,
    SPECIFICATION_VERSION: SPECIFICATION_VERSION
};