declare var $: any;

interface String {
    startsWith: (x: any) => any;
}

module MDwiki.Core {
    export class ScriptResource {
        constructor (
            public url: string,
            public loadstage: string = 'skel_ready',
            public finishstage: string = 'gimmick'
        ) { }
    }

    export class CssResource {
        constructor (
            public url: string,
            public finishstage: string = 'gimmick'
        ) { }
    }

    export interface IGimmickCallback {
        ($links: Array, options: any, trigger: string): void;
    }

    // [gimmick:trigger({option1: value1, option2:value2})](href)
    class GimmickLinkParts {
        constructor (
            public trigger:string,
            public options: any,
            public href: string
        ) { }
    }

    export class GimmickHandler {
        constructor(
            public trigger: string,
            public handler: IGimmickCallback
        ) {}
    }


    export class Module {
        init() { }

        private registerScriptResource (res: ScriptResource) {
            var loadDone = $.Deferred();

            // load the script
            $.md.stage(res.loadstage).subscribe(done => {
                if (res.url.startsWith('//') || res.url.startsWith('http')) {
                    $.getScript(res.url, () => loadDone.resolve());
                } else {
                    // inline script that we directly insert
                    // jQuery does some magic when inserting inline scripts, so better
                    // use vanilla JS. See:
                    // http://stackoverflow.com/questions/610995/jquery-cant-append-script-element
                    // scripts always need to go directly into the DOM
                    var script = document.createElement('script');
                    script.type = 'text/javascript';
                    script.text = res.url;
                    document.body.appendChild(script);
                    loadDone.resolve();
                }
                done();
            });

            // wait for the script to be fully loaded
            $.md.stage(res.finishstage).subscribe(done => {
                loadDone.done(() => done());
            });
        }
        private registerCssResource (resource: CssResource) {
        }
        private registerResource (resource: any, type: string = "script") {
            if (resource && typeof resource == "CssResource")
                this.registerCssResource(resource);
            else if (resource && typeof resource == "ScriptResource")
                this.registerScriptResource(resource);
            else if (resource && typeof resource == "string") {
                if (type == "script") {
                    this.registerScriptResource(new ScriptResource(resource));
                } else {
                   this.registerCssResource(new CssResource(resource));
                }
            }
        }
    }

    export class Gimmick extends Module {
        Handlers: GimmickHandler[] = [];
        // only gets called if any of the gimmick's trigger are active
        init () {}
        private addHandler(trigger: string, cb: IGimmickCallback) {
            var handler = new GimmickHandler(trigger, cb);
            this.Handlers.push(handler);
        }
    }

    function getGimmickLinkParts($link: any) {
        var link_text = $.trim($link.toptext());
        // returns linkTrigger, options, linkText
        if (link_text.match(/gimmick:/i) === null) {
            return null;
        }
        var href = $.trim($link.attr('href'));
        var r = /gimmick\s?:\s*([^(\s]*)\s*\(?\s*{?(.*)\s*}?\)?/i;
        var matches = r.exec(link_text);
        if (matches === null || matches[1] === undefined) {
            $.error('Error matching a gimmick: ' + link_text);
            return null;
        }
        var trigger = matches[1].toLowerCase();
        var args = null;
        // getting the parameters
        if (matches[2].toLowerCase().indexOf("gimmick") != 0) {
            // remove whitespaces
            var params = $.trim(matches[2].toString());
            if (params.charAt (params.length - 1) === ')') {
                params = params.substring(0, params.length - 1);
            }
            // remove the closing } if present
            if (params.charAt (params.length - 1) === '}') {
                params = params.substring(0, params.length - 1);
            }

            // add surrounding braces and paranthese
            params = '({' + params + '})';

            // replace any single quotes by double quotes
            var replace_quotes = new RegExp ("'", 'g');
            params = params.replace (replace_quotes, '"');
            // finally, try if the json object is valid
            try {
                /*jshint -W061 */
                args = eval(params);
            } catch (err) {
                $.error('error parsing argument of gimmick: ' + link_text + 'giving error: ' + err);
            }
        }
        return new GimmickLinkParts (trigger, args, href);
    }


    export class GimmickLoader {
        // all available gimmicks
        private registeredModules: Module[] = [];
        // all really required (existing on page) gimmicks
        private requiredGimmicks: string[] = [];
        private gimmicks: Gimmick[] = [];


        constructor() {
        }
        initModules() {
            this.registeredModules.map(m => m.init());
        }
        registerModule(mod: Module) {
           this.registeredModules.push(mod);
        }
        registerGimmick(gmck: Gimmick) {
           this.gimmicks.push(gmck);
        }

        initGimmicks() {
            var $gimmick_links = $('a:icontains(gimmick:)');
            $gimmick_links.map((i,e) => {
                var $link = $(e);
                var parts = getGimmickLinkParts($link);

                var gmck = this.selectGimmick(parts.trigger);
                gmck.init();
            });
        }

        loadGimmicks() {
            var $gimmick_links = $('a:icontains(gimmick:)');
            $gimmick_links.map((i,e) => {
                var $link = $(e);
                var parts = getGimmickLinkParts($link);
                var handler = this.selectGimmickHandler(parts.trigger);
                handler.handler($link, parts.options, $link.attr('href'));
            });
        }
        private selectGimmick(trigger: string) {
            var gimmicks = this.gimmicks.filter(g => {
                var triggers = g.Handlers.map(h => h.trigger);
                if (triggers.indexOf(trigger) >= 0)
                    return true;
            });
            return gimmicks[0];
        }
        private selectGimmickHandler(trigger: string) {
            var gimmick = this.selectGimmick(trigger);
            var handler = gimmick.Handlers.filter(h => h.trigger == trigger)[0];
            return handler;
        }
        private findActiveLinkTrigger() {
            // log.debug('Scanning for required gimmick links: ' + JSON.stringify(activeLinkTriggers));
            var activeLinkTriggers = [];

            var $gimmicks = $('a:icontains(gimmick:)');
            $gimmicks.each((i,e) => {
                var parts = getGimmickLinkParts($(e));
                if (activeLinkTriggers.indexOf(parts.trigger) === -1)
                    activeLinkTriggers.push(parts.trigger);
            });
            return activeLinkTriggers;
        }
    }
}
