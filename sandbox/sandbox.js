/*
 * Copyright (c) 2011-2013 by Animatron.
 * All rights are reserved.
 *
 * Animatron player is licensed under the MIT License, see LICENSE.
 */

var DEFAULT_REFRESH_RATE = 3000;

var _player = null;

function sandbox() {

    this.codeElm = document.getElementById('scene-source');
    this.errorsElm = document.getElementById('errors');
    this.selectElm = document.getElementById('examples-list');
    this.tangleElm = document.getElementById('refresh-calc');
    this.debugElm = document.getElementById('enable-debug');

    window.b = Builder._$;
    window.B = Builder;
    window.C = anm.C;

    this.player = createPlayer('my-canvas', {
        'muteErrors': true,
        'anim': {
            width: 400,
            height: 250,
            bgcolor: '#fff' }
    });
    this.player.mode = anm.C.M_PREVIEW;
    this.player._checkMode();
    _player = this.player;

    var lastCode = '';
    if (localStorage) lastCode = load_last_code();

    this.cm = CodeMirror.fromTextArea(this.codeElm,
              { mode: 'javascript',
                indentUnit: 4,
                lineNumbers: true,
                //gutters: ['cm-margin-gutter'],
                matchBrackets: true,
                wrapLines: true,
                autofocus: true });
    this.cm.setValue((lastCode.length > 0) ? lastCode : defaultCode);
    //this.cm.setValue('return <your code here>;');
    this.cm.setSize(null, '66%');
    this.cm.on('focus', function() {
      document.body.className = 'blur';
    });
    this.cm.on('blur', function() {
      document.body.className = '';
    });
    this.cm.on('change', function() {
      refresh();
    });

    var s = this;

    var curInterval = null,
        refreshRate = localStorage ? load_refresh_rate() : DEFAULT_REFRESH_RATE;
    var lastRefresh = undefined,
        lastPlayedFrom = undefined;

    function resetTime() {
        lastRefresh = undefined;
        lastPlayedFrom = undefined;
    }

    function makeSafe(code) {
        return ['(function(){',
                '  '+code,
                '})();'].join('\n');
    }

    function refresh() {
        var playFrom = 0;
        var now = new Date();
        if (lastRefresh != undefined) {
            var t_diff = (now - lastRefresh),
                playFrom = ((lastPlayedFrom || 0) + t_diff) % refreshRate;
            lastPlayedFrom = playFrom;
            playFrom /= 1000;
        }
        lastRefresh = now;
        s.errorsElm.style.display = 'none';
        try {
            s.player.stop();
            var userCode = s.cm.getValue();
            if (localStorage) save_current_code(userCode);
            var safeCode = makeSafe(userCode);
            var scene = eval(safeCode);
            player.load(scene, refreshRate / 1000);
            player.play(playFrom);
        } catch(e) {
            onerror(e);
        }
    };

    function onerror(e) {
        var e2;
        try {
          s.player.anim = null;
          s.player.stop();
          s.player.drawSplash();
        } catch(e) { e2 = e; };
        s.errorsElm.style.display = 'block';
        s.errorsElm.innerHTML = '<strong>Error:&nbsp;</strong>'+e.message;
        if (console && console.error) {
          console.error(e.stack);
          if (e2) console.error(e2.stack);
        }
        //throw e;
    }

    this.player.onerror(onerror);

    function updateInterval(to) {
        if (curInterval) clearTimeout(curInterval);
        //setTimeout(function() {
            refreshRate = to;
            save_refresh_rate(refreshRate);
            resetTime();
            var refresher = function() {
              refresh();
              curInterval = setTimeout(refresher, to);
            }
            refresher();
        //}, 1);
    }

    if (localStorage) {
        setTimeout(function() {
            store_examples(); // store current examples, it will skip if their versions match
            load_examples(); // load new examples, it will skip the ones with matching versions
            list_examples(s.selectElm); // list the examples in select element
        }, 1);
    }

    this.selectElm.onchange = function() {
        s.cm.setValue(examples[this.selectedIndex][1]);
        refresh();
    }

    this.debugElm.onchange = function() {
        s.player.debug = !s.player.debug;
        refresh();
    }

    var tangleModel = {
        initialize: function () {
            this.secPeriod = refreshRate / 1000;
        },
        update: function () {
            this.perMinute = Math.floor((60 / this.secPeriod) * 100) / 100;
            updateInterval(this.secPeriod * 1000);
        }
    };

    updateInterval(refreshRate);

    new Tangle(this.tangleElm, tangleModel);

    function change_mode(radio) {
      if (_player) {
        _player.mode = C[radio.value];
        _player._checkMode();
        refresh();
      }
    }

    window.change_mode = change_mode;

}

function show_csheet(csheetElmId, overlayElmId) {
    var csheetElm = document.getElementById(csheetElmId);
    var overlayElm = document.getElementById(overlayElmId);

    csheetElm.style.display = 'block';
    overlayElm.style.display = 'block';

    csheetElm.onclick = function() {
        return hide_csheet(csheetElmId, overlayElmId);
    }

    return false;
}

function hide_csheet(csheetElmId, overlayElmId) {
    var csheetElm = document.getElementById(csheetElmId);
    var overlayElm = document.getElementById(overlayElmId);

    csheetElm.style.display = 'none';
    overlayElm.style.display = 'none';

}

function store_examples() {
    if (!localStorage) throw new Error('Local storage support required');
    var elen = examples.length;
    for (var i = 0; i < elen; i++) {
        store_example(i);
    }
}

function store_example(i) {
    var ekey = '_example'+i,
        vkey = ekey+'__v',
        ver = localStorage.getItem(vkey);
    if ((typeof ver === 'undefined') ||
        (ver === null) ||
        (ver < examples[i][0])) {
        localStorage.setItem(vkey, examples[i][0]);
        localStorage.setItem(ekey, examples[i][1]);
    }
    localStorage.setItem('_examples_count', examples.length);
}

function load_examples() {
    if (!localStorage) throw new Error('Local storage support required');
    var ckey = '_examples_count',
        count = localStorage.getItem(ckey) || 0,
        elen = examples.length;
    for (var i = 0; i < count; i++) {
        var ekey = '_example'+i,
            vkey = ekey+'__v',
            ver = localStorage.getItem(vkey);
        if ((typeof ver !== 'undefined') &&
            (ver !== null) &&
            ((i >= elen) ||
             (ver > examples[i][0]))) {
            examples[i] = [
                ver,
                localStorage.getItem(ekey)
            ];
        }
    }
}

function save_example(code) {
    var pos = examples.length;
    examples[pos] = [ 0, code ];
    store_example(pos);
}

function save_current_code(code) {
    if (!localStorage) throw new Error('Local storage support required');
    localStorage.setItem('_current_code', code);
}

function load_last_code() {
    if (!localStorage) throw new Error('Local storage support required');
    return localStorage.getItem('_current_code') || '';
}

function save_refresh_rate(rate) {
    if (!localStorage) throw new Error('Local storage support required');
    localStorage.setItem('_current_rate', rate);
}

function load_refresh_rate() {
    if (!localStorage) throw new Error('Local storage support required');
    return localStorage.getItem('_current_rate') || DEFAULT_REFRESH_RATE;
}

function list_examples(selectElm) {
    selectElm.innerHTML = '';
    var elen = examples.length;
    //selectElm.setAttribute('size', elen);
    for (var i = 0; i < elen; i++) {
        var optElm = document.createElement('option');
        optElm.setAttribute('value', i);
        optElm.innerHTML = i + ': [v' + examples[i][0] + '] : ' +
                           examples[i][1].substring(0, 45).split('\n').join('↵');
        selectElm.appendChild(optElm);
    }
}