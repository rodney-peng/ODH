/* global api */
class encn_Cambridge_tc {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '剑桥英汉双解(繁体)';
        if (locale.indexOf('TW') != -1) return '劍橋英漢雙解(繁体)';
        return 'Cambridge EN->CN Dictionary (TC)';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async findTerm(word) {
        this.word = word;
        let promises = [this.findCambridge(word), this.findYoudao(word)];
        let results = await Promise.all(promises);
        return [].concat(...results).filter(x => x);
    }

    pushPosBody( expression, header, posbody, definitions ) {

        function T(node) {
            if (!node)
                return '';
            else
                return node.innerText.trim();
        }

        let pr_dsenses = posbody.querySelectorAll('.pr .dsense') || [];
//console.log( "cb_tc:pushPosBody() pr_dsenses: " + pr_dsenses.length );
        for (const pr_dsense of pr_dsenses) {
            let dsense_h = pr_dsense.querySelector('.dsense_h');
            let sense_h = '';
            if (dsense_h) sense_h = `<span class='dsense_h'>${dsense_h.textContent}</span><br>`;

            let sensbodys = pr_dsense.querySelectorAll('.sense-body') || [];
//console.log( "cb_tc:pushPosBody() sensbodys: " + sensbodys.length );
            for (const sensbody of sensbodys) {
                let sensblocks = sensbody.childNodes || [];
//console.log( "cb_tc:pushPosBody() sensblocks: " + sensblocks.length );
                for (const sensblock of sensblocks) {
                    let phrasehead = '';
                    let defblocks = [];

                    if (sensblock.classList && sensblock.classList.contains('phrase-block')) {
                        phrasehead = T(sensblock.querySelector('.phrase-title'));
                        phrasehead = phrasehead ? `<div class="phrasehead">${phrasehead}</div>` : '';
                        defblocks = sensblock.querySelectorAll('.def-block') || [];
                    }
                    if (sensblock.classList && sensblock.classList.contains('def-block')) {
                        defblocks = [sensblock];
                    }
                    if (defblocks.length <= 0) continue;

                    // make definition segement
                    for (const defblock of defblocks) {
                        let definition = '';

                        if (header) { definition += header; header = ''; }
                        if (sense_h) { definition += sense_h; sense_h = ''; }
                        if (phrasehead) { definition += phrasehead; phrasehead = ''; };

                        let def_info = T(defblock.querySelector('.def-info'));
                        if (def_info) definition += `<span class='def-info'>${def_info}</span><br>`;

                        let eng_tran = T(defblock.querySelector('.ddef_h .def'));
                        let chn_tran = T(defblock.querySelector('.def-body .trans'));
                        if (!eng_tran) eng_tran = "";
                        let bold_exp = `<b>${expression}</b>`;
                        eng_tran = `<span class='eng_tran'>${eng_tran.replace(RegExp(expression, 'gi'), bold_exp)}</span>`;
                        chn_tran = `<span class='chn_tran'>${chn_tran}</span>`;
                        let tran = `<span class='tran'>${eng_tran}${chn_tran}</span>`;
                        definition += tran;

                        // make exmaple segement
                        let examps = defblock.querySelectorAll('.def-body .examp') || [];
                        if (examps.length > 0 && this.maxexample > 0) {
                            definition += '<ul class="sents">';
                            for (const [index, examp] of examps.entries()) {
                                if (index > this.maxexample - 1) break; // to control only 2 example sentence.
                                let eng_examp = T(examp.querySelector('.eg'));
                                let chn_examp = T(examp.querySelector('.trans'));
                                definition += `<li class='sent'><span class='eng_sent'>
                                    ${eng_examp.replace(RegExp(expression, 'gi'), bold_exp)}</span>
                                    <span class='chn_sent'>${chn_examp}</span></li>`;
                            }
                            definition += '</ul>';
                        }

                        let xref = T(defblock.querySelector('.xref'));
                        if (xref) definition += `<br><span class='xref'>${xref}</span><br>`;

                        if (definition) definitions.push(definition);
                    }
                }
            }
        }
    }

    async findCambridge(word) {
        let notes = [];
        if (!word) return notes; // return empty notes

        function T(node) {
            if (!node)
                return '';
            else
                return node.innerText.trim();
        }

        let base = 'https://dictionary.cambridge.org/search/english-chinese-traditional/direct/?q=';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
console.log( "cb_tc:findCambridge() failed to fetch: " + url );
            return [];
        }

        let entries = doc.querySelectorAll('.pr .entry-body__el') || [];
//console.log( "cb_tc:findCambridge() entries: " + entries.length );
        for (const entry of entries) {
            let definitions = [];

            let expression = T(entry.querySelector('.headword'));
            let reading = '';
            let readings = entry.querySelectorAll('.pron .ipa');
            if (readings) {
                let reading_uk = T(readings[0]);
                let reading_us = T(readings[1]);
                reading = (reading_uk || reading_us) ? `UK[${reading_uk}] US[${reading_us}] ` : '';
            }

            let posheader = entry.querySelector('.pos-header');
            let header = '';
            let audios = [];

            if (posheader) {
                let posgram = T(posheader.querySelector('.posgram'));
                let dvar = T(posheader.querySelector('.dvar'));

                if (posgram) header += `<span class='posgram'>${posgram}</span><br>`;
                if (dvar) header += `<span class='dvar'>${dvar}</span><br>`;

                audios[0] = posheader.querySelector(".uk.dpron-i source");
                audios[0] = audios[0] ? 'https://dictionary.cambridge.org' + audios[0].getAttribute('src') : '';
                //audios[0] = audios[0].replace('https', 'http');
                audios[1] = posheader.querySelector(".us.dpron-i source");
                audios[1] = audios[1] ? 'https://dictionary.cambridge.org' + audios[1].getAttribute('src') : '';
                //audios[1] = audios[1].replace('https', 'http');
//console.log( "cb_tc:findCambridge() audios: " + JSON.stringify(audios) );
            }

            let posbody = entry.querySelector('.pos-body');
            this.pushPosBody( expression, header, posbody, definitions );

            let css = this.renderCSS();
            notes.push({
                css,
                expression,
                reading,
                dictionary: 'Cambridge Dictionary',
                definitions,
                audios
            });
        }

        return notes;
    }

    async findYoudao(word) {
        if (!word) return [];

        let base = 'http://dict.youdao.com/w/';
        let url = base + encodeURIComponent(word);
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
            let youdao = getYoudao(doc); //Combine Youdao Concise English-Chinese Dictionary to the end.
            let ydtrans = getYDTrans(doc); //Combine Youdao Translation (if any) to the end.
            return [].concat(youdao, ydtrans);
        } catch (err) {
            return [];
        }

        function getYoudao(doc) {
            let notes = [];

            //get Youdao EC data: check data availability
            let defNodes = doc.querySelectorAll('#phrsListTab .trans-container ul li');
            if (!defNodes || !defNodes.length) return notes;

            //get headword and phonetic
            let expression = T(doc.querySelector('#phrsListTab .wordbook-js .keyword')); //headword
            let reading = '';
            let readings = doc.querySelectorAll('#phrsListTab .wordbook-js .pronounce');
            if (readings) {
                let reading_uk = T(readings[0]);
                let reading_us = T(readings[1]);
                reading = (reading_uk || reading_us) ? `${reading_uk} ${reading_us}` : '';
            }

            let audios = [];
            audios[0] = `http://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=1`;
            audios[1] = `http://dict.youdao.com/dictvoice?audio=${encodeURIComponent(expression)}&type=2`;

            let definition = '<ul class="ec">';
            for (const defNode of defNodes){
                let pos = '';
                let def = T(defNode);
                let match = /(^.+?\.)\s/gi.exec(def);
                if (match && match.length > 1){
                    pos = match[1];
                    def = def.replace(pos, '');
                }
                pos = pos ? `<span class="pos simple">${pos}</span>`:'';
                definition += `<li class="ec">${pos}<span class="ec_chn">${def}</span></li>`;
            }
            definition += '</ul>';
            let css = `
                <style>
                    span.pos  {text-transform:lowercase; font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                    span.simple {background-color: #999!important}
                    ul.ec, li.ec {margin:0; padding:0;}
                </style>`;
            notes.push({
                css,
                expression,
                reading,
                dictionary: 'Youdao',
                definitions: [definition],
                audios
            });
            return notes;
        }

        function getYDTrans(doc) {
            let notes = [];

            //get Youdao EC data: check data availability
            let transNode = doc.querySelectorAll('#ydTrans .trans-container p')[1];
            if (!transNode) return notes;

            let definition = `${T(transNode)}`;
            let css = `
                <style>
                    .odh-expression {
                        font-size: 1em!important;
                        font-weight: normal!important;
                    }
                </style>`;
            notes.push({
                css,
                definitions: [definition],
            });
            return notes;
        }

        function T(node) {
            if (!node)
                return '';
            else
                return node.innerText.trim();
        }
    }

    renderCSS() {
        let css = `
            <style>
                div.phrasehead{margin: 2px 0;font-weight: bold;}
                span.star {color: #FFBB00;}
                span.posgram  {text-transform:lowercase; font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                span.dvar {color: orange;}
                span.dsense_h {color: purple;};
                span.def-info {color: orange;}
                span.tran {margin:0; padding:0;}
                span.eng_tran {margin-right:3px; padding:0;}
                span.chn_tran {color:#0d47a1;}
                ul.sents {font-size:0.8em; list-style:square inside; margin:3px 0;padding:5px;background:rgba(13,71,161,0.1); border-radius:5px;}
                li.sent  {margin:0; padding:0;}
                span.eng_sent {margin-right:5px;}
                span.chn_sent {color:#0d47a1;}
                span.xref {color: orange;}
            </style>`;
        return css;
    }
}
