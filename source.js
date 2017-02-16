"use strict";
var SVGtoPDF = function(doc, svg, x, y, options) {

    doc.addContent = function(data) {
      (this._writeTarget || this.page).write(data);
      return this;
    };
    doc.createGroup = function() {
      let group = new (function PDFGroup() {})();
      group.name = 'G' + (this._groupCount = (this._groupCount || 0) + 1);
      group.closed = false;
      group.matrix = [1, 0, 0, 1, 0, 0];
      group.xobj = this.ref({
        Type: 'XObject',
        Subtype: 'Form',
        FormType: 1,
        BBox: [-1000000, -1000000, 1000000, 1000000],
        Group: {S: 'Transparency', CS: 'DeviceRGB', I: true, K: false}
      });
      group.previousGroup = this._currentGroup;
      this.writeToGroup(group);
      return group;
    };
    doc.writeToGroup = function(group) {
      let prevGroup = this._currentGroup || null,
          nextGroup = group && !group.closed ? group : null,
          currentCtm = doc._ctm;
      if (prevGroup && nextGroup) {
        this._currentGroup = nextGroup;
        this._writeTarget = nextGroup.xobj;
        doc._ctm = nextGroup.matrix;
        nextGroup.matrix = prevGroup.matrix;
        prevGroup.matrix = currentCtm;
      } else if (prevGroup && !nextGroup) {
        this._currentGroup = null;
        this._writeTarget = null;
        doc._ctm = prevGroup.matrix;
        prevGroup.matrix = currentCtm;
      } else if (!prevGroup && nextGroup) {
        this._currentGroup = nextGroup;
        this._writeTarget = nextGroup.xobj;
        doc._ctm = nextGroup.matrix;
        nextGroup.matrix = currentCtm;
      }
      return this;
    };
    doc.closeGroup = function(group) {
      this.page.xobjects[group.name] = group.xobj;
      group.xobj.end();
      group.closed = true;
      this.writeToGroup(group.previousGroup);
      return this;
    };
    doc.insertGroup = function(group) {
      if (!group.closed) {this.closeGroup(group);}
      this.addContent('/' + group.name + ' Do');
      return this;
    };
    doc.applyMask = function(group, clip) {
      if (!group.closed) {this.closeGroup(group);}
      let name = 'M'+ (this._maskCount = (this._maskCount || 0) + 1);
      let gstate = this.ref({
        Type: 'ExtGState', CA: 1, ca: 1, BM: 'Normal',
        SMask: {S: 'Luminosity', G: group.xobj, BC: (clip ? [0,0,0] : [1,1,1])}
      });
      gstate.end();
      this.page.ext_gstates[name] = gstate;
      this.addContent("/" + name + " gs");
      return this;
    };
    function docBeginText(font, size) {
      if (!doc.page.fonts[font.id]) {doc.page.fonts[font.id] = font.ref();}
      return doc.addContent('BT').addContent('/' + font.id + ' ' + size + ' Tf');
    }
    function docSetTextMatrix(a, b, c, d, e, f) {
      return doc.addContent(validateNumber(a) + ' ' + validateNumber(b) + ' ' + validateNumber(-c) + ' '  + validateNumber(-d) + ' ' + validateNumber(e) + ' ' + validateNumber(f) + ' Tm');
    }
    function docSetTextMode(fill, stroke) {
      let mode = fill && stroke ? 2 : stroke ? 1 : fill ? 0 : 3;
      return doc.addContent(mode + ' Tr');
    }
    function docWriteGlyph(glyphid) {
      return doc.addContent('<' + glyphid + '> Tj');
    }
    function docEndText() {
      return doc.addContent('ET');
    }
    function warningMessage(str) {
      if (typeof console !== undefined && typeof console.warn === 'function') {console.warn(str);}
    }
    function parseXml(xml) {
      let SvgNode = function(tag) {
        this.nodeName = tag;
        this.attributes = {};
        this.childNodes = [];
        this.parentNode = null;
        this.nodeValue = null;
        if (tag === '#text') {this.nodeType = 3;} else {this.nodeType = 1;}
      };
      Object.defineProperty(SvgNode.prototype, 'children', { get: function() {
        if (this.nodeType === 1) {
          let temp = [];
          for (let i = 0; i < this.childNodes.length; i++) {
            if (this.childNodes[i].nodeType === 1) {temp.push(this.childNodes[i]);}
          }
          return temp;
        }
      }});
      Object.defineProperty(SvgNode.prototype, 'parentElement', { get: function() {
        return this.parentNode;
      }});
      Object.defineProperty(SvgNode.prototype, 'tagName', { get: function() {
        if (this.nodeType === 1) {
          return this.nodeName;
        }
      }});
      Object.defineProperty(SvgNode.prototype, 'id', { get: function() {
        if (this.nodeType === 1) {
          return this.getAttribute('id') || '';
        }
      }});
      Object.defineProperty(SvgNode.prototype, 'name', { get: function() {
        if (this.nodeType === 1) {
          return this.getAttribute('name') || '';
        }
      }});
      Object.defineProperty(SvgNode.prototype, 'textContent', { get: function() {
        return (function recursive(node) {
          if (node.nodeType === 3) {return node.nodeValue;}
          let temp = '';
          for (let i = 0; i < node.childNodes.length; i++) {
            temp += recursive(node.childNodes[i]);
          }
          return temp;
        })(this);
      }});
      SvgNode.prototype.getAttribute = function(attr) {
        return (this.hasAttribute(attr) || null) && this.attributes[attr];
      };
      SvgNode.prototype.hasAttribute = function(attr) {
        return this.attributes.hasOwnProperty(attr);
      };
      SvgNode.prototype.getElementById = function(id) {
        return (function recursive(node, id) {
          let temp;
          if (node.nodeType === 1) {
            if (node.attributes.id === id) {return node;}
            for (let i = 0; i < node.childNodes.length; i++) {
              if (temp = recursive(node.childNodes[i], id)) {return temp;}
            }
          }
        })(this, '' + id) || null;
      };
      let parser = new StringParser(xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<![\s\S]*?>/g, '').trim());
      let result = (function recursive() {
        let temp, child, node, attr, value;
        if (temp = parser.match(/^<([\w:.-]+)\s*/, true)) { // Opening tag
          node = new SvgNode(temp[1]);
          while (temp = parser.match(/^([\w:.-]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?\s*/, true)) { // Attribute
            attr = temp[1]; value = decodeEntities(temp[2] || temp[3] || '');
            if (!node.attributes.hasOwnProperty(attr)) {
              node.attributes[attr] = value;
            } else {
              warningMessage('parseXml: duplicate attribute "' + attr + '"');
            }
          }
          if (parser.match(/^>/)) { // End of opening tag
            while (child = recursive()) {
              node.childNodes.push(child);
              child.parentNode = node;
            }
            if (temp = parser.match(/^<\/([\w:.-]+)\s*>/, true)) { // Closing tag
              if (temp[1] === node.nodeName) {
                return node;
              } else {
                warningMessage('parseXml: tag not matching, opening "' + node.nodeName + '" & closing "' + temp[1] + '"');
                node.error = true;
                return node;
              }
            } else {
              warningMessage('parseXml: tag not matching, opening "' + node.nodeName + '" & not closing');
              node.error = true;
              return node;
            }
          } else if (parser.match(/^\/>/)) { // Self-closing tag
            return node;
          } else {
            warningMessage('parseXml: tag could not be parsed "' + node.nodeName + '"');
          }
        } else if (temp = parser.match(/^([^<]+)/, true)) { // Text node
          node = new SvgNode('#text');
          node.nodeValue = decodeEntities(temp[1]);
          return node;
        }
      })();
      if (parser.matchAll()) {
        warningMessage('parseXml: data after document end has been discarded');
      }
      return result;
    };
    function decodeEntities(str) {
      let Entities = {quot: 34, amp: 38, lt: 60, gt: 62, apos: 39, OElig: 338, oelig: 339, Scaron: 352, scaron: 353, Yuml: 376, circ: 710, tilde: 732, ensp: 8194, emsp: 8195, thinsp: 8201, zwnj: 8204, zwj: 8205, lrm: 8206, rlm: 8207, ndash: 8211, mdash: 8212, lsquo: 8216, rsquo: 8217, sbquo: 8218, ldquo: 8220, rdquo: 8221, bdquo: 8222, dagger: 8224, Dagger: 8225, permil: 8240, lsaquo: 8249,
           rsaquo: 8250, euro: 8364, nbsp: 160, iexcl: 161, cent: 162, pound: 163, curren: 164, yen: 165, brvbar: 166, sect: 167, uml: 168, copy: 169, ordf: 170, laquo: 171, not: 172, shy: 173, reg: 174, macr: 175, deg: 176, plusmn: 177, sup2: 178, sup3: 179, acute: 180, micro: 181, para: 182, middot: 183, cedil: 184, sup1: 185, ordm: 186, raquo: 187, frac14: 188, frac12: 189, frac34: 190,
           iquest: 191, Agrave: 192, Aacute: 193, Acirc: 194, Atilde: 195, Auml: 196, Aring: 197, AElig: 198, Ccedil: 199, Egrave: 200, Eacute: 201, Ecirc: 202, Euml: 203, Igrave: 204, Iacute: 205, Icirc: 206, Iuml: 207, ETH: 208, Ntilde: 209, Ograve: 210, Oacute: 211, Ocirc: 212, Otilde: 213, Ouml: 214, times: 215, Oslash: 216, Ugrave: 217, Uacute: 218, Ucirc: 219, Uuml: 220, Yacute: 221,
           THORN: 222, szlig: 223, agrave: 224, aacute: 225, acirc: 226, atilde: 227, auml: 228, aring: 229, aelig: 230, ccedil: 231, egrave: 232, eacute: 233, ecirc: 234, euml: 235, igrave: 236, iacute: 237, icirc: 238, iuml: 239, eth: 240, ntilde: 241, ograve: 242, oacute: 243, ocirc: 244, otilde: 245, ouml: 246, divide: 247, oslash: 248, ugrave: 249, uacute: 250, ucirc: 251, uuml: 252,
           yacute: 253, thorn: 254, yuml: 255, fnof: 402, Alpha: 913, Beta: 914, Gamma: 915, Delta: 916, Epsilon: 917, Zeta: 918, Eta: 919, Theta: 920, Iota: 921, Kappa: 922, Lambda: 923, Mu: 924, Nu: 925, Xi: 926, Omicron: 927, Pi: 928, Rho: 929, Sigma: 931, Tau: 932, Upsilon: 933, Phi: 934, Chi: 935, Psi: 936, Omega: 937, alpha: 945, beta: 946, gamma: 947, delta: 948, epsilon: 949,
           zeta: 950, eta: 951, theta: 952, iota: 953, kappa: 954, lambda: 955, mu: 956, nu: 957, xi: 958, omicron: 959, pi: 960, rho: 961, sigmaf: 962, sigma: 963, tau: 964, upsilon: 965, phi: 966, chi: 967, psi: 968, omega: 969, thetasym: 977, upsih: 978, piv: 982, bull: 8226, hellip: 8230, prime: 8242, Prime: 8243, oline: 8254, frasl: 8260, weierp: 8472, image: 8465, real: 8476,
           trade: 8482, alefsym: 8501, larr: 8592, uarr: 8593, rarr: 8594, darr: 8595, harr: 8596, crarr: 8629, lArr: 8656, uArr: 8657, rArr: 8658, dArr: 8659, hArr: 8660, forall: 8704, part: 8706, exist: 8707, empty: 8709, nabla: 8711, isin: 8712, notin: 8713, ni: 8715, prod: 8719, sum: 8721, minus: 8722, lowast: 8727, radic: 8730, prop: 8733, infin: 8734, ang: 8736, and: 8743, or: 8744,
           cap: 8745, cup: 8746, int: 8747, there4: 8756, sim: 8764, cong: 8773, asymp: 8776, ne: 8800, equiv: 8801, le: 8804, ge: 8805, sub: 8834, sup: 8835, nsub: 8836, sube: 8838, supe: 8839, oplus: 8853, otimes: 8855, perp: 8869, sdot: 8901, lceil: 8968, rceil: 8969, lfloor: 8970, rfloor: 8971, lang: 9001, rang: 9002, loz: 9674, spades: 9824, clubs: 9827, hearts: 9829, diams: 9830};
      return(str.replace(/&(?:#([0-9]+)|#[xX]([0-9A-Fa-f]+)|([0-9A-Za-z]+));/g, function(mt, m0, m1, m2) {
        if (m0) {return String.fromCharCode(parseInt(m0, 10));}
        else if (m1) {return String.fromCharCode(parseInt(m1, 16));}
        else if (m2 && Entities[m2]) {return String.fromCharCode(Entities[m2]);}
        else {return mt;}
      }));
    }
    function parseColor(v) {
      let NamedColors = {aliceblue: [240,248,255], antiquewhite: [250,235,215], aqua: [0,255,255], aquamarine: [127,255,212], azure: [240,255,255], beige: [245,245,220], bisque: [255,228,196], black: [0,0,0], blanchedalmond: [255,235,205], blue: [0,0,255], blueviolet: [138,43,226], brown: [165,42,42], burlywood: [222,184,135], cadetblue: [95,158,160], chartreuse: [127,255,0],
           chocolate: [210,105,30], coral: [255,127,80], cornflowerblue: [100,149,237], cornsilk: [255,248,220], crimson: [220,20,60], cyan: [0,255,255], darkblue: [0,0,139], darkcyan: [0,139,139], darkgoldenrod: [184,134,11], darkgray: [169,169,169], darkgrey: [169,169,169], darkgreen: [0,100,0], darkkhaki: [189,183,107], darkmagenta: [139,0,139], darkolivegreen: [85,107,47],
           darkorange: [255,140,0], darkorchid: [153,50,204], darkred: [139,0,0], darksalmon: [233,150,122], darkseagreen: [143,188,143], darkslateblue: [72,61,139], darkslategray: [47,79,79], darkslategrey: [47,79,79], darkturquoise: [0,206,209], darkviolet: [148,0,211], deeppink: [255,20,147], deepskyblue: [0,191,255], dimgray: [105,105,105], dimgrey: [105,105,105],
           dodgerblue: [30,144,255], firebrick: [178,34,34], floralwhite: [255,250,240], forestgreen: [34,139,34], fuchsia: [255,0,255], gainsboro: [220,220,220], ghostwhite: [248,248,255], gold: [255,215,0], goldenrod: [218,165,32], gray: [128,128,128], grey: [128,128,128], green: [0,128,0], greenyellow: [173,255,47], honeydew: [240,255,240], hotpink: [255,105,180],
           indianred: [205,92,92], indigo: [75,0,130], ivory: [255,255,240], khaki: [240,230,140], lavender: [230,230,250], lavenderblush: [255,240,245], lawngreen: [124,252,0], lemonchiffon: [255,250,205], lightblue: [173,216,230], lightcoral: [240,128,128], lightcyan: [224,255,255], lightgoldenrodyellow: [250,250,210], lightgray: [211,211,211], lightgrey: [211,211,211],
           lightgreen: [144,238,144], lightpink: [255,182,193], lightsalmon: [255,160,122], lightseagreen: [32,178,170], lightskyblue: [135,206,250], lightslategray: [119,136,153], lightslategrey: [119,136,153], lightsteelblue: [176,196,222], lightyellow: [255,255,224], lime: [0,255,0], limegreen: [50,205,50], linen: [250,240,230], magenta: [255,0,255], maroon: [128,0,0],
           mediumaquamarine: [102,205,170], mediumblue: [0,0,205], mediumorchid: [186,85,211], mediumpurple: [147,112,219], mediumseagreen: [60,179,113], mediumslateblue: [123,104,238], mediumspringgreen: [0,250,154], mediumturquoise: [72,209,204], mediumvioletred: [199,21,133], midnightblue: [25,25,112], mintcream: [245,255,250], mistyrose: [255,228,225], moccasin: [255,228,181],
           navajowhite: [255,222,173], navy: [0,0,128], oldlace: [253,245,230], olive: [128,128,0], olivedrab: [107,142,35], orange: [255,165,0], orangered: [255,69,0], orchid: [218,112,214], palegoldenrod: [238,232,170], palegreen: [152,251,152], paleturquoise: [175,238,238], palevioletred: [219,112,147], papayawhip: [255,239,213], peachpuff: [255,218,185], peru: [205,133,63],
           pink: [255,192,203], plum: [221,160,221], powderblue: [176,224,230], purple: [128,0,128], rebeccapurple: [102,51,153], red: [255,0,0], rosybrown: [188,143,143], royalblue: [65,105,225], saddlebrown: [139,69,19], salmon: [250,128,114], sandybrown: [244,164,96], seagreen: [46,139,87], seashell: [255,245,238], sienna: [160,82,45], silver: [192,192,192], skyblue: [135,206,235],
           slateblue: [106,90,205], slategray: [112,128,144], slategrey: [112,128,144], snow: [255,250,250], springgreen: [0,255,127], steelblue: [70,130,180], tan: [210,180,140], teal: [0,128,128], thistle: [216,191,216], tomato: [255,99,71], turquoise: [64,224,208], violet: [238,130,238], wheat: [245,222,179], white: [255,255,255], whitesmoke: [245,245,245], yellow: [255,255,0]};
      let temp;
      v = (v || '').toLowerCase().trim();
      if (temp = NamedColors[v]) {
        return temp.concat(1);
      } else if (temp = v.match(/^rgba\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9.]+)\s*\)$/)) {
        temp[1] = parseInt(temp[1]); temp[2] = parseInt(temp[2]); temp[3] = parseInt(temp[3]); temp[4] = parseFloat(temp[4]);
        if (temp[1] < 256 && temp[2] < 256 && temp[3] < 256 && temp[4] <= 1) {
          return temp.slice(1, 5);
        }
      } else if (temp = v.match(/^rgb\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)$/)) {
        temp[1] = parseInt(temp[1]); temp[2] = parseInt(temp[2]); temp[3] = parseInt(temp[3]);
        if (temp[1] < 256 && temp[2] < 256 && temp[3] < 256) {
          return temp.slice(1, 4).concat(1);
        }
      } else if (temp = v.match(/^rgb\(\s*([0-9.]+)%\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%\s*\)$/)) {
        temp[1] = 2.55 * parseFloat(temp[1]); temp[2] = 2.55 * parseFloat(temp[2]); temp[3] = 2.55 * parseFloat(temp[3]);
        if (temp[1] < 256 && temp[2] < 256 && temp[3] < 256) {
          return temp.slice(1, 4).concat(1);
        }
      } else if (temp = v.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/)) {
        return temp.slice(1,4).map(function(x) {return parseInt(x, 16);}).concat(1);
      } else if (temp = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/)) {
        return temp.slice(1,4).map(function(x) {return 0x11 * parseInt(x, 16);}).concat(1);
      }
    }
    function multiplyMatrix() {
      function multiply(a, b) {
        return [ a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3],
                 a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5] ];
      }
      let result = arguments[0];
      for (let i = 1; i < arguments.length; i++) {
        result = multiply(result, arguments[i]);
      }
      return result;
    }
    function inverseMatrix(m) {
      let dt = m[0] * m[3] - m[1] * m[2];
      return [m[3] / dt, -m[1] / dt, -m[2] / dt, m[0] / dt, (m[2]*m[5] - m[3]*m[4]) / dt, (m[1]*m[4] - m[0]*m[5]) / dt];
    }
    function validateMatrix(m) {
      let m0 = validateNumber(m[0]), m1 = validateNumber(m[1]), m2 = validateNumber(m[2]),
          m3 = validateNumber(m[3]), m4 = validateNumber(m[4]), m5 = validateNumber(m[5]);
      if (m0 * m3 - m1 * m2 !== 0) {
        return [m0, m1, m2, m3, m4, m5];
      }
    }
    function validateNumber(n) {
      return n > -1e21 && n < 1e21 ? Math.round(n * 1e6) / 1e6 : 0;
    }
    function parseTranform(v) {
      let parser = new StringParser((v || '').trim()), result = [1, 0, 0, 1, 0, 0], temp;
      while (temp = parser.match(/^([A-Za-z]+)[(]([^(]+)[)]/, true)) {
        let func = temp[1], nums = [], parser2 = new StringParser(temp[2].trim()), temp2;
        while (temp2 = parser2.matchNumber()) {
          nums.push(Number(temp2));
          parser2.matchSeparator();
        }
        if (func === 'matrix' && nums.length === 6) {
          result = multiplyMatrix(result, [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]]);
        } else if (func === 'translate' && nums.length === 2) {
          result = multiplyMatrix(result, [1, 0, 0, 1, nums[0], nums[1]]);
        } else if (func === 'translate' && nums.length === 1) {
          result = multiplyMatrix(result, [1, 0, 0, 1, nums[0], 0]);
        } else if (func === 'scale' && nums.length === 2) {
          result = multiplyMatrix(result, [nums[0], 0, 0, nums[1], 0, 0]);
        } else if (func === 'scale' && nums.length === 1) {
          result = multiplyMatrix(result, [nums[0], 0, 0, nums[0], 0, 0]);
        } else if (func === 'rotate' && nums.length === 3) {
          let a = nums[0] * Math.PI / 180;
          result = multiplyMatrix(result, [1, 0, 0, 1, nums[1], nums[2]], [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0], [1, 0, 0, 1, -nums[1], -nums[2]]);
        } else if (func === 'rotate' && nums.length === 1) {
          let a = nums[0] * Math.PI / 180;
          result = multiplyMatrix(result, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
        } else if (func === 'skewX' && nums.length === 1) {
          let a = nums[0] * Math.PI / 180;
          result = multiplyMatrix(result, [1, 0, Math.tan(a), 1, 0, 0]);
        } else if (func === 'skewY' && nums.length === 1) {
          let a = nums[0] * Math.PI / 180;
          result = multiplyMatrix(result, [1, Math.tan(a), 0, 1, 0, 0]);
        } else {return;}
        parser.matchSeparator();
      }
      if (parser.matchAll()) {return;}
      return result;
    }

    var StringParser = function(str) {
      let parser = this;
      parser.match = function(exp, all) {
        let temp = str.match(exp);
        if (!temp || temp.index !== 0) {return;}
        str = str.substring(temp[0].length);
        return (all ? temp : temp[0]);
      };
      parser.matchSeparator = function() {
        return parser.match(/^(?:\s*,\s*|\s*|)/);
      };
      parser.matchSpace = function() {
        return parser.match(/^(?:\s*)/);
      };
      parser.matchLengthUnit = function() {
        return parser.match(/^(?:px|pt|cm|mm|in|pc|em|ex|%|)/);
      };
      parser.matchNumber = function() {
        return parser.match(/^(?:[-+]?(?:[0-9]+[.][0-9]+|[0-9]+[.]|[.][0-9]+|[0-9]+)(?:[eE][-+]?[0-9]+)?)/);
      };
      parser.matchAll = function() {
        return parser.match(/^[\s\S]+/);
      };
    };
    var BezierSegment = function(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y) {
      let solveEquation = function(curve) {
        let a = curve[2] || 0, b = curve[1] || 0, c = curve[0] || 0;
        if (Math.abs(a) < 1e-10 && Math.abs(b) < 1e-10) {
          return [];
        } else if (Math.abs(a) < 1e-10) {
          return [(-c) / b];
        } else {
          let d = b * b - 4 * a * c;
          if (d > 0) {
            return [(-b + Math.sqrt(d)) / (2 * a), (-b - Math.sqrt(d)) / (2 * a)];
          } else if (d === 0) {
            return [(-b) / (2 * a)];
          } else {
            return [];
          }
        }
      };
      let getCurveValue = function(t, curve) {
        return (curve[0] || 0) + (curve[1] || 0) * t + (curve[2] || 0) * t * t + (curve[3] || 0) * t * t * t;
      };
      let divisions = 15; // the accuracy isn't perfect but comparable to the arc-to-bezier conversion
      let equationX = [p1x, -3*p1x+3*c1x, 3*p1x-6*c1x+3*c2x, -p1x+3*c1x-3*c2x+p2x];
      let equationY = [p1y, -3*p1y+3*c1y, 3*p1y-6*c1y+3*c2y, -p1y+3*c1y-3*c2y+p2y];
      let derivativeX = [-3*p1x+3*c1x, 6*p1x-12*c1x+6*c2x, -3*p1x+9*c1x-9*c2x+3*p2x];
      let derivativeY = [-3*p1y+3*c1y, 6*p1y-12*c1y+6*c2y, -3*p1y+9*c1y-9*c2y+3*p2y];
      let lengthMap = (function() {
        let lengthMap = [0];
        for (let i = 1; i <= divisions; i++) {
          let t = (i - 0.5) / divisions;
          let dx = getCurveValue(t, derivativeX) / divisions,
              dy = getCurveValue(t, derivativeY) / divisions,
              l = Math.sqrt(dx * dx + dy * dy);
          lengthMap[i] = lengthMap[i - 1] + l;
        }
        return lengthMap;
      })();
      let totalLength = this.totalLength = lengthMap[divisions];
      this.startPoint = [p1x, p1y];
      this.endPoint = [p2x, p2y];
      this.boundingBox = (function() {
        let temp;
        let minX = getCurveValue(0, equationX), minY = getCurveValue(0, equationY),
            maxX = getCurveValue(1, equationX), maxY = getCurveValue(1, equationY);
        if (minX > maxX) {temp = maxX; maxX = minX; minX = temp;}
        if (minY > maxY) {temp = maxY; maxY = minY; minY = temp;}
        solveEquation(derivativeX).forEach(function(t) {
          if (t >= 0 && t <= 1) {
            let x = getCurveValue(t, equationX);
            if (x < minX) {minX = x;}
            if (x > maxX) {maxX = x;}
          }
        });
        solveEquation(derivativeY).forEach(function(t) {
          if (t >= 0 && t <= 1) {
            let y = getCurveValue(t, equationY);
            if (y < minY) {minY = y;}
            if (y > maxY) {maxY = y;}
          }
        });
        return [minX, minY, maxX, maxY];
      })();
      this.getPointAtLength = function(l) {
        if (l >= 0 && l <= totalLength) {
          for (let i = 1; i <= divisions; i++) {
            let l1 = lengthMap[i-1], l2 = lengthMap[i];
            if (l1 <= l && l <= l2) {
              let t = (i - (l2 - l) / (l2 - l1)) / divisions,
                  x = getCurveValue(t, equationX), y = getCurveValue(t, equationY),
                  dx = getCurveValue(t, derivativeX), dy = getCurveValue(t, derivativeY);
              return [x, y, Math.atan2(dy, dx)];
            }
          }
        }
      };
    };
    var LineSegment = function(p1x, p1y, p2x, p2y) {
      let totalLength = this.totalLength = Math.sqrt((p2x - p1x) * (p2x - p1x) + (p2y - p1y) * (p2y - p1y));
      this.boundingBox = [Math.min(p1x, p2x), Math.min(p1y, p2y), Math.max(p1x, p2x), Math.max(p1y, p2y)];
      this.startPoint = [p1x, p1y];
      this.endPoint = [p2x, p2y];
      this.getPointAtLength = function(l) {
        if (l >= 0 && l <= totalLength) {
          let r = l / totalLength || 0, x = p1x + r * (p2x - p1x), y = p1y + r * (p2y - p1y);
          return [x, y, Math.atan2(p2y - p1y, p2x - p1x)];
        }
      };
    };
    var SvgPath = function(d) {
      SvgShape.call(this);
      let ArgumentsNumber = {A:7,a:7, C:6,c:6, H:1,h:1, L:2,l:2, M:2,m:2, Q:4,q:4, S:4,s:4, T:2,t:2, V:1,v:1, Z:0,z:0};
      let command, value, values, argsNumber, temp, parser = new StringParser((d || '').trim());
      while (command = parser.match(/^[astvzqmhlcASTVZQMHLC]/)) {
        parser.matchSeparator();
        argsNumber = ArgumentsNumber[command];
        values = [];
        while (value = parser.matchNumber()) {
          parser.matchSeparator();
          if (values.length === argsNumber) {
            this[command].apply(this, values);
            values = [];
            if (command === 'M') {command = 'L';}
            else if (command === 'm') {command = 'l';}
          }
          values.push(Number(value));
        }
        if (values.length === argsNumber) {
          this[command].apply(this, values);
        } else {
          warningMessage('SvgPath: command ' + command + ' with ' + values.length + ' numbers'); break;
        }
      }
      if (temp = parser.matchAll()) {
        warningMessage('SvgPath: unexpected string ' + temp);
      }
    };
    var SvgShape = function(commands) {
      let pathCommands = this.pathCommands = [], startX = 0, startY = 0, currX = 0, currY = 0, lastCom, lastCtrlX, lastCtrlY;
      if (commands && commands.length) {
        for (let i = 0; i < commands.length; i++) {
          pathCommands.push(commands[i].slice());
        }
      }
      this.resetProperties = function() {
        pathSegments = startPoint = endPoint = totalLength = boundingBox = null;
        return this;
      }
      this.resetCommands = function() {
        startX = startY = currX = currY = lastCtrlX = lastCtrlY = 0; lastCom = null;
        return this;
      }
      // Shape creation
      this.addCommand = function(command) {
        pathCommands.push(command);
        return this.resetProperties();
      };
      this.M = function(x, y) {
        pathCommands.push(['M', true, true, x, y]);
        startX = currX = x; startY = currY = y; lastCom = 'M';
        return this.resetProperties();
      };
      this.m = function(x, y) {return this.M(currX + x, currY + y);};
      this.Z = this.z = function() {
        pathCommands.push(['Z', true, true]);
        currX = startX; currY = startY; lastCom = 'Z';
        return this.resetProperties();
      };
      this.L = function(x, y) {
        pathCommands.push(['L', true, true, x, y]);
        currX = x; currY = y; lastCom = 'L';
        return this.resetProperties();
      };
      this.l = function(x, y) {return this.L(currX + x, currY + y);};
      this.H = function(x) {return this.L(x, currY);};
      this.h = function(x) {return this.L(currX + x, currY);};
      this.V = function(y) {return this.L(currX, y);};
      this.v = function(y) {return this.L(currX, currY + y);};
      this.C = function(c1x, c1y, c2x, c2y, x, y) {
        pathCommands.push(['C', true, true, c1x, c1y, c2x, c2y, x, y]);
        currX = x; currY = y; lastCom = 'C'; lastCtrlX = c2x; lastCtrlY = c2y;
        return this.resetProperties();
      };
      this.c = function(c1x, c1y, c2x, c2y, x, y) {return this.C(currX + c1x, currY + c1y, currX + c2x, currY + c2y, currX + x, currY + y);};
      this.S = function(c1x, c1y, x, y) {return this.C(currX + (lastCom === 'C' ? currX - lastCtrlX : 0), currY + (lastCom === 'C' ? currY - lastCtrlY : 0), c1x, c1y, x, y);};
      this.s = function(c1x, c1y, x, y) {return this.C(currX + (lastCom === 'C' ? currX - lastCtrlX : 0), currY + (lastCom === 'C' ? currY - lastCtrlY : 0), currX + c1x, currY + c1y, currX + x, currY + y);};
      this.Q = function(cx, cy, x, y) {
        let c1x = currX + 2 / 3 * (cx - currX), c1y = currY + 2 / 3 * (cy - currY),
            c2x = x + 2 / 3 * (cx - x), c2y = y + 2 / 3 * (cy - y);
        pathCommands.push(['C', true, true, c1x, c1y, c2x, c2y, x, y]);
        currX = x; currY = y; lastCom = 'Q'; lastCtrlX = cx; lastCtrlY = cy;
        return this.resetProperties();
      };
      this.q = function(c1x, c1y, x, y) {return this.Q(currX + c1x, currY + c1y, currX + x, currY + y);};
      this.T = function(x, y) {return this.Q(currX + (lastCom === 'Q' ? currX - lastCtrlX : 0), currY + (lastCom === 'Q' ? currY - lastCtrlY : 0), x, y);};
      this.t = function(x, y) {return this.Q(currX + (lastCom === 'Q' ? currX - lastCtrlX : 0), currY + (lastCom === 'Q' ? currY - lastCtrlY : 0), currX + x, currY + y);};
      this.A = function(rx, ry, rotAngle, arcLarge, arcSweep, x, y) { // From PDFKit
        let xInit = currX, yInit = currY, xEnd = x, yEnd = y;
        rx = Math.abs(rx); ry = Math.abs(ry); arcLarge = 1*!!arcLarge; arcSweep = 1*!!arcSweep;
        let th = rotAngle * (Math.PI / 180), sin_th = Math.sin(th), cos_th = Math.cos(th);
        let px = cos_th * (xInit - xEnd) * 0.5 + sin_th * (yInit - yEnd) * 0.5,
            py = cos_th * (yInit - yEnd) * 0.5 - sin_th * (xInit - xEnd) * 0.5,
            pl = (px * px) / (rx * rx) + (py * py) / (ry * ry);
        if (pl > 1) {pl = Math.sqrt(pl); rx *= pl; ry *= pl;}
        let a00 = cos_th / rx, a01 = sin_th / rx, a10 = -sin_th / ry, a11 = cos_th / ry,
            _a00 = cos_th * rx, _a01 = -sin_th * ry, _a10 = sin_th * rx, _a11 = cos_th * ry;
        let x0 = a00 * xInit + a01 * yInit,
            y0 = a10 * xInit + a11 * yInit,
            x1 = a00 * xEnd + a01 * yEnd,
            y1 = a10 * xEnd + a11 * yEnd;
        let sfactor = Math.sqrt(Math.max(0, 1 / ((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) - 0.25));
        if (arcSweep === arcLarge) {sfactor = -sfactor;}
        let xc = 0.5 * (x0 + x1) - sfactor * (y1 - y0),
            yc = 0.5 * (y0 + y1) + sfactor * (x1 - x0);
        let th0 = Math.atan2(y0 - yc, x0 - xc),
            th1 = Math.atan2(y1 - yc, x1 - xc),
            th_arc = th1 - th0;
        if (th_arc < 0 && arcSweep === 1) {
          th_arc += 2 * Math.PI;
        } else if (th_arc > 0 && arcSweep === 0) {
          th_arc -= 2 * Math.PI;
        }
        let segments = Math.ceil(Math.abs(th_arc / (Math.PI * 0.5 + 0.001)));
        for (let i = 0; i < segments; i++) {
          let th2 = th0 + i * th_arc / segments,
              th3 = th0 + (i + 1) * th_arc / segments,
              th_half = 0.5 * (th3 - th2);
          let t = 8/3 * Math.sin(th_half * 0.5) * Math.sin(th_half * 0.5) / Math.sin(th_half);
          let _x1 = xc + Math.cos(th2) - t * Math.sin(th2),
              _y1 = yc + Math.sin(th2) + t * Math.cos(th2),
              _x3 = xc + Math.cos(th3),
              _y3 = yc + Math.sin(th3),
              _x2 = _x3 + t * Math.sin(th3),
              _y2 = _y3 - t * Math.cos(th3);
          let c1x = _a00 * _x1 + _a01 * _y1,
              c1y = _a10 * _x1 + _a11 * _y1,
              c2x = _a00 * _x2 + _a01 * _y2,
              c2y = _a10 * _x2 + _a11 * _y2,
              ex = _a00 * _x3 + _a01 * _y3,
              ey = _a10 * _x3 + _a11 * _y3;
          pathCommands.push(['C', (i === 0), (i === segments - 1), c1x, c1y, c2x, c2y, ex, ey]);
        }
        currX = x; currY = y; lastCom = 'A';
        return this.resetProperties();
      };
      this.a = function(rx, ry, rot, fa, fs, x, y) {return this.A(rx, ry, rot, fa, fs, currX + x, currY + y);};
      // Shape properties
      let pathSegments = null; Object.defineProperty(this, 'pathSegments', {get: function() {
        if (pathSegments !== null) {return pathSegments;}
        let currX = 0, currY = 0, startX = 0, startY = 0, segments = [];
        for (let i = 0; i < pathCommands.length; i++) {
          let command = pathCommands[i][0], values = pathCommands[i].slice(3), segment;
          switch(command) {
            case 'M':
              segment = null;
              startX = currX = values[0]; startY = currY = values[1];  break;
            case 'L':
              segment = new LineSegment(currX, currY, values[0], values[1]);
              currX = values[0]; currY = values[1];  break;
            case 'C':
              segment = new BezierSegment(currX, currY, values[0], values[1], values[2], values[3], values[4], values[5]);
              currX = values[4]; currY = values[5];  break;
            case 'Z':
              segment = new LineSegment(currX, currY, startX, startY);
              currX = startX; currY = startY;  break;
          }
          if (segment) {
            segment.hasStart = pathCommands[i][1];
            segment.hasEnd = pathCommands[i][2];
            segments.push(segment);
          }
        }
        return (pathSegments = segments);
      }});
      let startPoint = null; Object.defineProperty(this, 'startPoint', {get: function() {
        if (startPoint !== null) {return startPoint;}
        return (startPoint = this.pathSegments.length && this.pathSegments[0].startPoint);
      }});
      let endPoint = null; Object.defineProperty(this, 'endPoint', {get: function() {
        if (endPoint !== null) {return endPoint;}
        return (endPoint = this.pathSegments.length && this.pathSegments[this.pathSegments.length - 1].endPoint);
      }});
      let totalLength = null; Object.defineProperty(this, 'totalLength', {get: function() {
        if (totalLength !== null) {return totalLength;}
        let length = 0;
        for (let i = 0; i < this.pathSegments.length; i++) {
          length += this.pathSegments[i].totalLength;
        }
        return (totalLength = length);
      }});
      let boundingBox = null; Object.defineProperty(this, 'boundingBox', {get: function() {
        if (boundingBox !== null) {return boundingBox;}
        let bbox = [Infinity, Infinity, -Infinity, -Infinity];
        function addBounds(bbox1) {
          if (bbox1[0] < bbox[0]) {bbox[0] = bbox1[0];}
          if (bbox1[2] > bbox[2]) {bbox[2] = bbox1[2];}
          if (bbox1[1] < bbox[1]) {bbox[1] = bbox1[1];}
          if (bbox1[3] > bbox[3]) {bbox[3] = bbox1[3];}
        }
        for (let i = 0; i < this.pathSegments.length; i++) {
          addBounds(this.pathSegments[i].boundingBox);
        }
        if (bbox[0] === Infinity) {bbox[0] = 0;}
        if (bbox[1] === Infinity) {bbox[1] = 0;}
        if (bbox[2] === -Infinity) {bbox[2] = 0;}
        if (bbox[3] === -Infinity) {bbox[3] = 0;}
        return (boundingBox = bbox);
      }});
      this.getPointAtLength = function(l) {
        if (l >= 0 && l <= this.totalLength) {
          let temp;
          for (let i = 0; i < this.pathSegments.length; i++) {
            if (temp = this.pathSegments[i].getPointAtLength(l)) {
              return temp;
            }
            l -= this.pathSegments[i].totalLength;
          }
          return this.endPoint;
        }
      };
      // Shape functions
      this.transform = function(m) {
        for (var i = 0; i < pathCommands.length; i++) {
          let data = pathCommands[i];
          for (var j = 3; j < data.length; j+=2) {
            var x = data[j], y = data[j+1];
            data[j] = m[0] * x + m[2] * y + m[4];
            data[j+1] = m[1] * x + m[3] * y + m[5];
          }
        }
        return this.resetCommands().resetProperties();
      };
      this.clone = function() {
        return new SvgShape(pathCommands);
      };
      this.mergeShape = function(shape) {
        for (let i = 0; i < shape.pathCommands.length; i++) {
          pathCommands.push(shape.pathCommands[i]);
        }
        return this.resetCommands().resetProperties();
      };
      this.insertInDocument = function() {
        for (let i = 0; i < pathCommands.length; i++) {
          let command = pathCommands[i][0], values = pathCommands[i].slice(3);
          switch(command) {
            case 'M':  doc.moveTo(values[0], values[1]);  break;
            case 'L':  doc.lineTo(values[0], values[1]);  break;
            case 'C':  doc.bezierCurveTo(values[0], values[1], values[2], values[3], values[4], values[5]);  break;
            case 'Z':  doc.closePath();  break;
          }
        }
      };
      this.getSubPaths = function() {
        let subPaths = [], shape = new SvgShape();
        for (let i = 0; i < pathCommands.length; i++) {
          let data = pathCommands[i], command = pathCommands[i][0];
          if (command === 'M' && i !== 0) {
            subPaths.push(shape);
            shape = new SvgShape();
          }
          shape.addCommand(data);
        }
        subPaths.push(shape);
        return subPaths;
      };
      this.getMarkers = function() {
        let markers = [], subPaths = this.getSubPaths();
        for (let i = 0; i < subPaths.length; i++) {
          let subPath = subPaths[i], subPathMarkers = [];
          for (let j = 0; j < subPath.pathSegments.length; j++) {
            let segment = subPath.pathSegments[j];
            if (segment.totalLength !== 0 || j === 0 || j === subPath.pathSegments.length - 1) {
              if (segment.hasStart) {
                let startMarker = segment.getPointAtLength(0), prevEndMarker = subPathMarkers.pop();
                if (prevEndMarker) {startMarker[2] = 0.5 * (prevEndMarker[2] + startMarker[2]);}
                subPathMarkers.push(startMarker);
              }
              if (segment.hasEnd) {
                let endMarker = segment.getPointAtLength(segment.totalLength);
                subPathMarkers.push(endMarker);
              }
            }
          }
          markers = markers.concat(subPathMarkers);
        }
        return markers;
      };
    };

    var Properties = {
      'color':            {inherit: true, initial: undefined},
      'visibility':       {inherit: true, initial: 'visible', values: {'hidden': 'hidden', 'collapse': 'hidden', 'visible':'visible'}},
      'fill':             {inherit: true, initial: [0, 0, 0, 1]},
      'stroke':           {inherit: true, initial: 'none'},
      'stop-color':       {inherit: false, initial: [0, 0, 0, 1]},
      'fill-opacity':     {inherit: true, initial: 1},
      'stroke-opacity':   {inherit: true, initial: 1},
      'stop-opacity':     {inherit: false, initial: 1},
      'fill-rule':        {inherit: true, initial: 'nonzero', values: {'nonzero':'nonzero', 'evenodd':'evenodd'}},
      'clip-rule':        {inherit: true, initial: 'nonzero', values: {'nonzero':'nonzero', 'evenodd':'evenodd'}},
      'stroke-width':     {inherit: true, initial: 1},
      'stroke-dasharray': {inherit: true, initial: []},
      'stroke-dashoffset':{inherit: true, initial: 0},
      'stroke-miterlimit':{inherit: true, initial: 4},
      'stroke-linejoin':  {inherit: true, initial: 'miter', values: {'miter':'miter', 'round':'round', 'bevel':'bevel'}},
      'stroke-linecap':   {inherit: true, initial: 'butt', values: {'butt':'butt', 'round':'round', 'square':'square'}},
      'font-size':        {inherit: true, initial: 16, values: {'xx-small':9,'x-small':10,'small':13,'medium':16,'large':18,'x-large':24,'xx-large':32}},
      'font-family':      {inherit: true, initial: 'sans-serif'},
      'font-weight':      {inherit: true, initial: 'normal', values: {'600':'bold', '700':'bold', '800':'bold', '900':'bold', 'bold':'bold', 'bolder':'bold', '500':'normal', '400':'normal', '300':'normal', '200':'normal', '100':'normal', 'normal':'normal', 'lighter':'normal'}},
      'font-style':       {inherit: true, initial: 'normal', values: {'italic':'italic', 'oblique':'italic', 'normal':'normal'}},
      'text-anchor':      {inherit: true, initial: 'start', values: {'start':'start', 'middle':'middle', 'end':'end'}},
      'direction':        {inherit: true, initial: 'ltr', values: {'ltr':'ltr', 'rtl':'rtl'}},
      'dominant-baseline':{inherit: true, initial: 'baseline', values: {'auto':'baseline', 'baseline':'baseline', 'before-edge':'before-edge', 'text-before-edge':'before-edge', 'middle':'middle', 'central':'central', 'after-edge':'after-edge', 'text-after-edge':'after-edge', 'ideographic':'ideographic', 'alphabetic':'alphabetic', 'hanging':'hanging', 'mathematical':'mathematical'}},
      'baseline-shift':   {inherit: true, initial: 'baseline', values: {'baseline':'baseline', 'sub':'sub', 'super':'super'}},
      'word-spacing':     {inherit: true, initial: 0, values: {normal:0}},
      'letter-spacing':   {inherit: true, initial: 0, values: {normal:0}},
      'xml:space':        {inherit: true, initial: 'default', css: 'white-space', values: {'preserve':'preserve', 'default':'default', 'pre':'preserve', 'pre-line':'preserve', 'pre-wrap':'preserve', 'nowrap': 'default'}},
      'marker-start':     {inherit: true, initial: 'none'},
      'marker-mid':       {inherit: true, initial: 'none'},
      'marker-end':       {inherit: true, initial: 'none'},
      'opacity':          {inherit: false, initial: 1},
      'transform':        {inherit: false, initial: [1, 0, 0, 1, 0, 0]},
      'display':          {inherit: false, initial: 'inline', values: {'none':'none', 'inline':'inline', 'block':'inline'}},
      'clip-path':        {inherit: false, initial: 'none'},
      'mask':             {inherit: false, initial: 'none'},
      'overflow':         {inherit: false, initial: 'hidden', values: {'hidden':'hidden', 'scroll':'hidden', 'visible':'visible'}}
    };

    var SvgElem = function(obj, inherits) {
      switch (obj.nodeName) {
        case 'use': if (this instanceof SvgElemUse) {break;} else {return new SvgElemUse(obj, inherits);}
        case 'g': if (this instanceof SvgElemGroup) {break;} else {return new SvgElemGroup(obj, inherits);}
        case 'svg': if (this instanceof SvgElemSvg) {break;} else {return new SvgElemSvg(obj, inherits);}
        case 'image': if (this instanceof SVGElemImage) {break;} else {return new SVGElemImage(obj, inherits);}
        case 'rect': if (this instanceof SvgElemRect) {break;} else {return new SvgElemRect(obj, inherits);}
        case 'circle': if (this instanceof SvgElemCircle) {break;} else {return new SvgElemCircle(obj, inherits);}
        case 'ellipse': if (this instanceof SvgElemEllipse) {break;} else {return new SvgElemEllipse(obj, inherits);}
        case 'line': if (this instanceof SvgElemLine) {break;} else {return new SvgElemLine(obj, inherits);}
        case 'polyline': if (this instanceof SvgElemPolyline) {break;} else {return new SvgElemPolyline(obj, inherits);}
        case 'polygon': if (this instanceof SvgElemPolygon) {break;} else {return new SvgElemPolygon(obj, inherits);}
        case 'path': if (this instanceof SvgElemPath) {break;} else {return new SvgElemPath(obj, inherits);}
        case 'text': if (this instanceof SvgElemText) {break;} else {return new SvgElemText(obj, inherits);}
        case 'tspan': if (this instanceof SvgElemTspan) {break;} else {return new SvgElemTspan(obj, inherits);}
        case 'textPath': if (this instanceof SvgElemTextPath) {break;} else {return new SvgElemTextPath(obj, inherits);}
        case '#text': if (this instanceof SvgElemTextNode) {break;} else {return new SvgElemTextNode(obj, inherits);}
      }
      let cache = Object.create(null);
      this.name = obj.nodeName;
      this.node = obj;
      this.allowedChildren = [];
      this.attr = function(key) {
        return obj.getAttribute(key);
      };
      this.computeUnits = function(value, unit, percent) {
        if (unit === '%') {
          if (typeof percent === 'number') {
            return parseFloat(value) / 100 * percent;
          } else {
            return parseFloat(value) / 100 * this.getViewport();
          }
        } else if (unit === 'ex' || unit === 'em') {
          return value * {'em':1, 'ex':0.5}[unit] * this.get('font-size');
        } else {
          return value * {'':1, 'px':1, 'pt':96/72, 'cm':96/2.54, 'mm':96/25.4, 'in':96, 'pc':96/6}[unit];
        }
      };
      this.parseLength = function(value) {
        let parser = new StringParser((value || '').trim()), temp1, temp2;
        if (typeof (temp1 = parser.matchNumber()) === 'string' && typeof (temp2 = parser.matchLengthUnit()) === 'string' && !parser.matchAll()) {
          return {value: temp1, unit: temp2};
        }
      };
      this.parseLengthList = function(value) {
        let parser = new StringParser((value || '').trim()), result = [], temp1, temp2;
        while (typeof (temp1 = parser.matchNumber()) === 'string' && typeof (temp2 = parser.matchLengthUnit()) === 'string') {
          result.push({value: temp1, unit: temp2});
          parser.matchSeparator();
        }
        if (!parser.matchAll()) {return result;}
      };
      this.resolveUrl = function(value) {
        let temp = (value || '').match(/^\s*(?:url\(#(.*)\)|url\("#(.*)"\)|url\('#(.*)'\)|#(.*))\s*$/) || [];
        let id = temp[1] || temp[2] || temp[3] || temp[4];
        if (id) {
          let svgObj = svg.getElementById(id);
          if (this.getStack().indexOf(svgObj) === -1) {
            return svgObj;
          } else {
            warningMessage('SVGtoPDF: loop of circular references for id "' + id + '"');
          }
        }
      };
      this.computeLength = function(value, percent, initial) {
        let parsed = this.parseLength(value);
        if (parsed) {
          return this.computeUnits(parsed.value, parsed.unit, percent);
        }
        return initial;
      };
      this.computeLengthList = function(value, percent) {
        let parsed = this.parseLengthList(value), result = [];
        for (let i = 0; i < parsed.length; i++) {
          result.push(this.computeUnits(parsed[i].value, parsed[i].unit, percent));
        }
        return result;
      };
      this.getLength = function(key, percent, initial) {
        return this.computeLength(this.attr(key), percent, initial);
      };
      this.getLengthList = function(key, percent) {
        return this.computeLengthList(this.attr(key), percent);
      };
      this.getUrl = function(key) {
        return this.resolveUrl(this.attr(key))
      };
      this.getNumberList = function(key) {
        let parser = new StringParser((this.attr(key) || '').trim()), result = [], temp;
        while (temp = parser.matchNumber()) {
          result.push(Number(temp));
          parser.matchSeparator();
        }
        return result;
      }
      this.getViewbox = function(key, initial) {
        let viewBox = this.getNumberList(key);
        if (viewBox.length === 4 && viewBox[2] >= 0 && viewBox[3] >= 0) {return viewBox;}
        return initial;
      };
      this.getPercent = function(key, initial) {
        let value = this.attr(key);
        let parser = new StringParser((value || '').trim()), temp1, temp2;
        let number = parser.matchNumber();
        if (!number) {return initial;}
        if (parser.match('%')) {number *= 0.01;}
        if (parser.matchAll()) {return initial;}
        return Math.max(0, Math.min(1, number));
      };
      this.chooseValue = function(args) {
        for (let i = 0; i < arguments.length; i++) {
          if ((arguments[i] !== undefined) && (arguments[i] !== null) && (arguments[i] === arguments[i])) {return arguments[i];}
        }
        return arguments[arguments.length - 1];
      };
      this.get = function(key) {
        if (cache[key] !== undefined) {return cache[key];}
        let keyInfo = Properties[key] || {}, value, result;
        if (useCSS && key !== 'transform') { // the CSS transform behaves stangely
          if (!this.css) {this.css = getComputedStyle(obj);}
          value = this.css[keyInfo.css || key] || this.attr(key);
        } else {
          value = this.attr(key);
        }
        if (value === 'inherit') {
          result = (this.getInherit() ? this.getInherit().get(key) : keyInfo.initial);
          if (result != null) {return cache[key] = result;}
        }
        if (keyInfo.values != null) {
          result = keyInfo.values[value];
          if (result != null) {return cache[key] = result;}
        }
        switch (key) {
          case 'font-size':
            result = (function() {
              let parsed = this.parseLength(value);
              if (parsed) {
                if (parsed.unit === '%' || parsed.unit === 'em' || parsed.unit === 'ex') {
                  let parentValue = (this.getInherit() ? this.getInherit().get(key) : keyInfo.initial);
                  if (parsed.unit === '%') {return parsed.value / 100 * parentValue;}
                  else if (parsed.unit === 'em') {return cache[key] = parsed.value * parentValue;}
                  else if (parsed.unit === 'ex') {return cache[key] = parsed.value / 2 * parentValue;}
                }
                return this.computeUnits(parsed.value, parsed.unit, this.getViewport());
              }
            }).call(this);
            break;
          case 'baseline-shift':
            result = this.computeLength(value, this.get('font-size'));
            break;
          case 'font-family':
            result = value || undefined;
            break;
          case 'opacity': case 'stroke-opacity': case 'fill-opacity': case 'stop-opacity':
            result = (function() {
              let parsed = parseFloat(value);
              if (!isNaN(parsed)) {
                return Math.max(0, Math.min(1, parsed));
              }
            }).call(this);
            break;
          case 'transform':
            result = parseTranform(value);
            break;
          case 'stroke-dasharray':
            result = (function() {
              if (value === 'none') {return [];}
              let dasharray = this.computeLengthList(value, this.getViewport()),
                  sum = 0;
              for (let j = 0; j < dasharray.length; j++) {
                if (dasharray[j] < 0) {return;}
                sum += dasharray[j];
              }
              return (sum === 0 ? [] : dasharray);
            }).call(this);
            break;
          case 'color':
            result = (function() {
              if (value === 'none' || value === 'transparent') {return 'none';}
              return parseColor(value);
            }).call(this);
            break;
          case 'fill': case 'stroke':
            result = (function() {
              if (value === 'none' || value === 'transparent') {return 'none';}
              if (value === 'currentColor') {return this.get('color');}
              let color = parseColor(value);
              if (color) {return color;}
              let ref = this.resolveUrl(value);
              if (ref) { // TODO implement fallback syntax : <funciri> <color>
                if (ref.nodeName === 'linearGradient' || ref.nodeName === 'radialGradient') {
                  return ref;
                } else if (ref.nodeName === 'pattern') {
                  warningMessage('SVGtoPDF: patterns are not implemented');
                }
                return 'none';
              }
            }).call(this);
            break;
          case 'stop-color':
            result = (function() {
              if (value === 'none' || value === 'transparent') {return 'none';}
              if (value === 'currentColor') {return this.get('color');}
              return parseColor(value);
            }).call(this);
            break;
          case 'marker-start': case 'marker-mid': case 'marker-end': case 'clip-path': case 'mask':
            result = (function() {
              if (value === 'none') {return 'none';}
              return this.resolveUrl(value);
            }).call(this);
            break;
          case 'stroke-width': case 'stroke-miterlimit':
            result = (function() {
              let parsed = this.computeLength(value, this.getViewport());
              if (parsed != null && parsed >= 0) {return parsed;}
            }).call(this);
            break;
          case 'stroke-miterlimit':
            result = (function() {
              let parsed = parseFloat(value);
              if (parsed != null && parsed >= 1) {return parsed;}
            }).call(this);
            break;
          case 'word-spacing': case 'letter-spacing':
            result = this.computeLength(value, this.getViewport());
            break;
          case 'stroke-dashoffset':
            result = (function() {
              let result = this.computeLength(value, this.getViewport());
              if (result != null) {
                if (result < 0) { // fix for crbug.com/660850
                  let dasharray = this.get('stroke-dasharray');
                  for (let j = 0; j < dasharray.length; j++) {result += dasharray[j];}
                }
                return result;
              }
            }).call(this);
            break;
        }
        if (result != null) {return cache[key] = result;}
        return cache[key] = (keyInfo.inherit && this.getInherit() ? this.getInherit().get(key) : keyInfo.initial);
      };
      this.getInherit = function() {
        if (cache['<inherit>'] !== undefined) {return cache['<inherit>'];}
        if (!inherits && obj !== svg && obj.parentNode) {
          inherits = new SvgElem(obj.parentNode, null);
        }
        return cache['<inherit>'] = inherits;
      };
      this.getStack = function() {
        if (cache['<stack>'] !== undefined) {return cache['<stack>'];}
        let inherit = this.getInherit();
        if (inherit) {
          return cache['<stack>'] = inherit.getStack().concat(obj);
        } else {
          return cache['<stack>'] = [obj];
        }
      };
      this.getChildren = function() {
        if (cache['<children>'] !== undefined) {return cache['<children>'];}
        let children = [];
        for (let i = 0; i < obj.childNodes.length; i++) {
          let child = obj.childNodes[i];
          if (this.allowedChildren.indexOf(child.nodeName) !== -1) {
            children.push(new SvgElem(child, this));
          }
        }
        return cache['<children>'] = children;
      }
      this.getParentVWidth = function() {
        if (cache['<parentVWidth>'] !== undefined) {return cache['<parentVWidth>'];}
        let inherit = this.getInherit();
        if (inherit) {
          return cache['<parentVWidth>'] = inherit.getVWidth();
        } else {
          return cache['<parentVWidth>'] = viewportWidth;
        }
      };
      this.getParentVHeight = function() {
        if (cache['<parentVHeight>'] !== undefined) {return cache['<parentVHeight>'];}
        let inherit = this.getInherit();
        if (inherit) {
          return cache['<parentVHeight>'] = inherit.getVHeight();
        } else {
          return cache['<parentVHeight>'] = viewportHeight;
        }
      };
      this.getVWidth = function() {
        if (cache['<vWidth>'] !== undefined) {return cache['<vWidth>'];}
        return cache['<vWidth>'] = this.getParentVWidth();
      };
      this.getVHeight = function() {
        if (cache['<vHeight>'] !== undefined) {return cache['<vHeight>'];}
        return cache['<vHeight>'] = this.getParentVHeight();
      };
      this.getViewport = function() {
        if (cache['<viewport>'] !== undefined) {return cache['<viewport>'];}
        return cache['<viewport>'] = Math.sqrt(0.5 * this.getVWidth() * this.getVWidth() + 0.5 * this.getVHeight() * this.getVHeight());
      };
      this.getBoundingBox = function() {
        let shape = this.getBoundingShape();
        return shape.boundingBox;
      };
    };

    var SvgElemStylable = function(obj) {
      this.transform = function() {
        doc.transform.apply(doc, this.getTransformation());
      };
      this.clip = function() {
        if (this.get('clip-path') !== 'none') {
          let clipPath = new SvgElemClipPath(this.get('clip-path'), null, this.getBoundingBox());
          clipPath.drawInDocument();
          return true;
        }
      };
      this.mask = function() {
        if (this.get('mask') !== 'none') {
          let mask = new SvgElemMask(this.get('mask'), null, this.getBoundingBox());
          mask.drawInDocument();
          return true;
        }
      };
      this.getFill = function(isClip, isMask) {
        let opacity = this.get('opacity'),
            fill = this.get('fill'),
            fillOpacity = this.get('fill-opacity');
        if (fill !== 'none' && opacity && fillOpacity) {
          if (fill.nodeName === 'linearGradient' || fill.nodeName === 'radialGradient') {
            return new SvgElemGradient(fill, null, this.getBoundingBox(), fillOpacity * opacity).getGradient(isClip, isMask);
          }
          return [fill.slice(0, 3), fillOpacity * fill[3] * opacity];
        }
      };
      this.getStroke = function(isClip, isMask) {
        let opacity = this.get('opacity'),
            stroke = this.get('stroke'),
            strokeOpacity = this.get('stroke-opacity');
        if (stroke !== 'none' && opacity && strokeOpacity) {
          if (stroke.nodeName === 'linearGradient' || stroke.nodeName === 'radialGradient') {
            return new SvgElemGradient(stroke, null, this.getBoundingBox(), strokeOpacity * opacity).getGradient(isClip, isMask);
          }
          return [stroke.slice(0, 3), strokeOpacity * stroke[3] * opacity];
        }
      };
    };

    var SvgElemHasChildren = function(obj) {
      this.getBoundingShape = function() {
        let shape = new SvgShape(),
            children = this.getChildren();
        for (let i = 0; i < children.length; i++) {
          if (children[i].get('display') !== 'none') {
            if (typeof children[i].getBoundingShape === 'function') {
              let childShape = children[i].getBoundingShape()
              if (typeof children[i].getTransformation === 'function') {
                childShape.transform(children[i].getTransformation());
              }
              shape.mergeShape(childShape);
            }
          }
        }
        return shape;
      };
      this.drawChildren = function(isClip, isMask) {
        let children = this.getChildren();
        for (let i = 0; i < children.length; i++) {
          if (children[i].get('display') !== 'none') {
            if (typeof children[i].drawInDocument === 'function') {
              children[i].drawInDocument(isClip, isMask);
            }
          }
        }
      };
    };

    var SvgElemUse = function(obj, inherits) {
      SvgElem.call(this, obj, inherits);
      SvgElemStylable.call(this, obj);
      let x = this.getLength('x', this.getVWidth(), 0),
          y = this.getLength('y', this.getVHeight(), 0),
          child = this.getUrl('href') || this.getUrl('xlink:href');
      if (child) {child = new SvgElem(child, this);}
      this.getChildren  = function() {
        return [child];
      };
      this.getTransformation = function() {
        return multiplyMatrix(this.get('transform'), [1, 0, 0, 1, x, y]);
      };
      this.getBoundingShape = function() {
        if (child && typeof child.getBoundingShape === 'function') {
          return child.getBoundingShape().clone();
        }
        return new SvgShape();
      };
      this.drawInDocument = function(isClip, isMask) {
        if (child && typeof child.drawInDocument === 'function' && child.get('display') !== 'none') {
          doc.save();
          this.transform();
          this.clip();
          let masked = this.mask(), group;
          if ((this.get('opacity') < 1 || masked) && !isClip) {
            group = doc.createGroup();
          }
          child.drawInDocument(isClip, isMask);
          if (group) {
            doc.closeGroup(group);
            doc.fillOpacity(this.get('opacity'));
            doc.insertGroup(group);
          }
          doc.restore();
        }
      };
    };

    var SvgElemGroup = function(obj, inherits) {
      SvgElem.call(this, obj, inherits);
      SvgElemHasChildren.call(this, obj);
      SvgElemStylable.call(this, obj);
      this.allowedChildren = ['use', 'g', 'svg', 'image', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text'];
      this.getTransformation = function() {
        return this.get('transform');
      };
      this.drawInDocument = function(isClip, isMask) {
        doc.save();
        this.transform();
        this.clip();
        let masked = this.mask(), group;
        if ((this.get('opacity') < 1 || masked) && !isClip) {
          group = doc.createGroup();
        }
        this.drawChildren(isClip, isMask);
        if (group) {
          doc.closeGroup(group);
          doc.fillOpacity(this.get('opacity'));
          doc.insertGroup(group);
        }
        doc.restore();
      };
    };

    var SvgElemSvg = function(obj, inherits) {
      SvgElem.call(this, obj, inherits);
      SvgElemHasChildren.call(this, obj);
      SvgElemStylable.call(this, obj);
      this.allowedChildren = ['use', 'g', 'svg', 'image', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text'];
      let width = this.getLength('width', this.getParentVWidth(), this.getParentVWidth()),
          height = this.getLength('height', this.getParentVHeight(), this.getParentVHeight()),
          viewBox = this.getViewbox('viewBox', [0, 0, width, height]),
          x = this.getLength('x', this.getParentVWidth(), 0),
          y = this.getLength('y', this.getParentVHeight(), 0);
      this.getVWidth = function() {
        return viewBox[2];
      };
      this.getVHeight = function() {
        return viewBox[3];
      };
      this.getTransformation = function() {
        let aspectRatio = (this.attr('preserveAspectRatio') || '').trim(),
            temp = aspectRatio.match(/^(none)$|^x(Min|Mid|Max)Y(Min|Mid|Max)(?:\s+(meet|slice))?$/) || [],
            ratioType = temp[1] || temp[4] || 'meet',
            xAlign = temp[2] || 'Mid',
            yAlign = temp[3] || 'Mid',
            scaleX = width / viewBox[2],
            scaleY = height / viewBox[3],
            dx = {'Min':0, 'Mid':0.5, 'Max':1}[xAlign],
            dy = {'Min':0, 'Mid':0.5, 'Max':1}[yAlign];
        if (ratioType === 'slice') {
          scaleY = scaleX = Math.max(scaleX, scaleY);
        } else if (ratioType === 'meet') {
          scaleY = scaleX = Math.min(scaleX, scaleY);
        }
        return [scaleX, 0, 0, scaleY, x + dx * (width - viewBox[2] * scaleX) - scaleX * viewBox[0], y + dy * (height - viewBox[3] * scaleY) - scaleY * viewBox[1]];
      };
      this.drawInDocument = function(isClip, isMask) {
        doc.save();
        if (this.get('overflow') === 'hidden') {
          doc.rect(x, y, width, height).clip();
        }
        this.transform();
        this.clip();
        let masked = this.mask(), group;
        if ((this.get('opacity') < 1 || masked) && !isClip) {
          group = doc.createGroup();
        }
        this.drawChildren(isClip, isMask);
        if (group) {
          doc.closeGroup(group);
          doc.fillOpacity(this.get('opacity'));
          doc.insertGroup(group);
        }
        doc.restore();
      };
    };

    var SVGElemImage = function(obj, inherits) {
      SvgElem.call(this, obj, inherits);
      SvgElemStylable.call(this, obj);
      let link = imageCallback(this.attr('href') || this.attr('xlink:href') || ''),
          width = this.getLength('width', this.getVWidth(), 0),
          height = this.getLength('height', this.getVHeight(), 0),
          x = this.getLength('x', this.getVWidth(), 0),
          y = this.getLength('y', this.getVHeight(), 0),
          image;
      try {
        image = doc.openImage(link);
      } catch(e) {
        warningMessage('SVGElemImage: failed to open image "' + link + '" in PDFKit');
      }
      this.getTransformation2 = function() {
        let aspectRatio = (this.attr('preserveAspectRatio') || '').trim(),
            temp = aspectRatio.match(/^(none)$|^x(Min|Mid|Max)Y(Min|Mid|Max)(?:\s+(meet|slice))?$/) || [],
            ratioType = temp[1] || temp[4] || 'meet',
            xAlign = temp[2] || 'Mid',
            yAlign = temp[3] || 'Mid',
            scaleX = (image ? width / image.width : 1),
            scaleY = (image ? height / image.height : 1),
            dx = {'Min':0, 'Mid':0.5, 'Max':1}[xAlign],
            dy = {'Min':0, 'Mid':0.5, 'Max':1}[yAlign];
        if (ratioType === 'slice') {
          scaleY = scaleX = Math.max(scaleX, scaleY);
        } else if (ratioType === 'meet') {
          scaleY = scaleX = Math.min(scaleX, scaleY);
        }
        return [scaleX, 0, 0, scaleY, x + dx * (width - (image ? image.width : width) * scaleX) - scaleX * 0, y + dy * (height - (image ? image.height : height) * scaleY) - scaleY * 0];
      };
      this.getTransformation = function() {
        return this.get('transform');
      };
      this.getBoundingShape = function() {
        return new SvgShape().M(x, y).L(x + width, y).L(x + width, y + height).L(x, y + height).Z();
      };
      this.drawInDocument = function(isClip, isMask) {
        if (this.get('visibility') === 'hidden' || !image) {return;}
        doc.save();
        this.transform();
        this.clip();
        this.mask();
        if (this.get('overflow') === 'hidden') {
          doc.rect(x, y, width, height).clip();
        }
        doc.transform.apply(doc, this.getTransformation2());
        if (!isClip) {
          doc.fillOpacity(this.get('opacity'));
          doc.image(image, 0, 0);
        } else {
          doc.rect(0, 0, image.width, image.height).fill('white');
        }
        doc.restore();
      };
    };

    var SvgElemGradient = function(obj, inherits, bBox, gOpacity) {
      SvgElem.call(this, obj, inherits);
      this.allowedChildren = ['stop'];
      this.getGradient = function(isClip, isMask) {
        let children = this.getChildren();
        if (children.length === 0) {return;}
        if (children.length === 1) {
          let child = children[0],
              color = child.get('stop-color');
          if (color === 'none') {return;}
          return [color.slice(0, 3), child.get('stop-opacity') * color[3] * gOpacity];
        }
        let bBoxUnits = (this.attr('gradientUnits') !== 'userSpaceOnUse'),
            matrix = parseTranform(this.attr('gradientTransform')),
            grad,
            offset = 0;
        if (this.name === 'linearGradient') {
          let x1 = this.getLength('x1', (bBoxUnits ? 1 : this.getVWidth()), 0),
              x2 = this.getLength('x2', (bBoxUnits ? 1 : this.getVWidth()), 1),
              y1 = this.getLength('y1', (bBoxUnits ? 1 : this.getVHeight()), 0),
              y2 = this.getLength('y2', (bBoxUnits ? 1 : this.getVHeight()), 0);
          grad = doc.linearGradient(x1, y1, x2, y2);
        } else {
          let x2 = this.getLength('cx', (bBoxUnits ? 1 : this.getVWidth()), 0.5),
              y2 = this.getLength('cy', (bBoxUnits ? 1 : this.getVHeight()), 0.5),
              r2 = this.getLength('r', (bBoxUnits ? 1 : this.getViewport()), 0.5),
              x1 = this.getLength('fx', (bBoxUnits ? 1 : this.getVWidth()), x2),
              y1 = this.getLength('fy', (bBoxUnits ? 1 : this.getVHeight()), y2);
          x1 = Math.min(Math.max(x1, x2 - r2 + 1e-6), x2 + r2 - 1e-6);
          y1 = Math.min(Math.max(y1, y2 - r2 + 1e-6), y2 + r2 - 1e-6);
          grad = doc.radialGradient(x1, y1, 0, x2, y2, r2);
        }
        for (let i = 0; i < children.length; i++) {
          let child = children[i],
              color = child.get('stop-color');
          if (color === 'none') {color = [255, 255, 255, 0];}
          let opacity = color[3] * child.get('stop-opacity') * gOpacity;
          if (opacity < 1) {
            if (isMask) {
              color[0] *= opacity;
              color[1] *= opacity;
              color[2] *= opacity;
              opacity = 1;
            }
          }
          offset = Math.max(offset, child.getPercent('offset', 0));
          if (i === 0 && offset > 0) {
            grad.stop(0, color.slice(0, 3), opacity);
          }
          grad.stop(offset, color.slice(0, 3), opacity);
          if (i === children.length - 1 && offset < 1) {
            grad.stop(1, color.slice(0, 3), opacity);
          }
        }
        if (bBoxUnits) {
          matrix = multiplyMatrix([bBox[2] - bBox[0], 0, 0, bBox[3] - bBox[1], bBox[0], bBox[1]], matrix);
        }
        if (matrix = validateMatrix(matrix)) {
          grad.setTransform.apply(grad, matrix);
          return [grad, 1];
        } else {
          return;
        }
      }
    };

    var SvgElemBasicShape = function(obj, inherits) {
      SvgElem.call(this, obj, inherits);
      SvgElemStylable.call(this, obj);
      this.getBoundingShape = function() {
        return this.shape.clone();
      };
      this.getTransformation = function() {
        return this.get('transform');
      };
      this.drawInDocument = function(isClip, isMask) {
        if (this.get('visibility') === 'hidden' || !this.shape) {return;}
        doc.save();
        this.transform();
        this.clip();
        if (!isClip) {
          let masked = this.mask(), group;
          if (masked) {
            group = doc.createGroup();
          }
          let subPaths = this.shape.getSubPaths(),
              fill = this.getFill(isClip, isMask),
              stroke = this.getStroke(isClip, isMask);
          for (let j = 0; j < subPaths.length; j++) {
            if (stroke && subPaths[j].totalLength === 0) {
              let LineWidth = this.get('stroke-width'), LineCap = this.get('stroke-linecap');
              if ((LineCap === 'square' || LineCap === 'round') && LineWidth > 0) {
                let x = subPaths[j].boundingBox[0],
                    y = subPaths[j].boundingBox[1];
                doc.fillColor.apply(doc, stroke);
                if (LineCap === 'square') {
                  doc.rect(x - 0.5 * LineWidth, y - 0.5 * LineWidth, LineWidth, LineWidth);
                } else if (LineCap === 'round') {
                  doc.circle(x, y, 0.5 * LineWidth);
                }
                doc.fill();
              }
            }
          }
          if (fill || stroke) {
            if (fill) {
              doc.fillColor.apply(doc, fill);
            }
            if (stroke) {
              doc.strokeColor.apply(doc, stroke)
                 .lineWidth(this.get('stroke-width'))
                 .miterLimit(this.get('stroke-miterlimit'))
                 .lineJoin(this.get('stroke-linejoin'))
                 .lineCap(this.get('stroke-linecap'))
                 .dash(this.get('stroke-dasharray'), {phase: this.get('stroke-dashoffset')});
            }
            for (let j = 0; j < subPaths.length; j++) {
              if (subPaths[j].totalLength > 0) {
                subPaths[j].insertInDocument();
              }
            }
            if (fill && stroke) {
              doc.fillAndStroke(this.get('fill-rule'));
            } else if (fill) {
              doc.fill(this.get('fill-rule'));
            } else if (stroke) {
              doc.stroke();
            }
          }
          let markersPos = this.shape.getMarkers();
          if (this.get('marker-start') !== 'none') {
            let marker = new SvgElemMarker(this.get('marker-start'), null, markersPos[0], this.get('stroke-width'));
            marker.drawInDocument();
          }
          if (this.get('marker-mid') !== 'none') {
            for (let i = 1; i < markersPos.length - 1; i++) {
              let marker = new SvgElemMarker(this.get('marker-mid'), null, markersPos[i], this.get('stroke-width'));
              marker.drawInDocument();
            }
          }
          if (this.get('marker-end') !== 'none') {
            let marker = new SvgElemMarker(this.get('marker-end'), null, markersPos[markersPos.length - 1], this.get('stroke-width'));
            marker.drawInDocument();
          }
          if (group) {
            doc.closeGroup(group);
            doc.insertGroup(group);
          }
        } else {
          this.shape.insertInDocument();
          doc.fillColor('white')
             .fill(this.get('clip-rule'));
        }
        doc.restore();
      };
    };

    var SvgElemRect = function(obj, inherits) {
      SvgElemBasicShape.call(this, obj, inherits);
      let x = this.getLength('x', this.getVWidth(), 0),
          y = this.getLength('y', this.getVHeight(), 0),
          w = this.getLength('width', this.getVWidth(), 0),
          h = this.getLength('height', this.getVHeight(), 0),
          rx = this.getLength('rx', this.getVWidth()),
          ry = this.getLength('ry', this.getVHeight());
      if (rx === undefined && ry === undefined) {rx = ry = 0;}
      else if (rx === undefined && ry !== undefined) {rx = ry;}
      else if (rx !== undefined && ry === undefined) {ry = rx;}
      if (w > 0 && h > 0) {
        if (rx && ry) {
          rx = Math.min(rx, 0.5 * w);
          ry = Math.min(ry, 0.5 * h);
          let k = (4 / 3) * (Math.sqrt(2) - 1), cx = rx * (1.0 - k), cy = ry * (1.0 - k);
          this.shape = new SvgShape()
                        .M(x + rx, y)
                        .L(x + w - rx, y)
                        .C(x + w - cx, y, x + w, y + cy, x + w, y + ry)
                        .L(x + w, y + h - ry)
                        .C(x + w, y + h - cy, x + w - cx, y + h, x + w - rx, y + h)
                        .L(x + rx, y + h)
                        .C(x + cx, y + h, x, y + h - cy, x, y + h - ry)
                        .L(x, y + ry)
                        .C(x, y + cy, x + cx, y, x + rx, y)
                        .Z();
        } else {
          this.shape = new SvgShape()
                        .M(x, y)
                        .L(x + w, y)
                        .L(x + w, y + h)
                        .L(x, y + h)
                        .Z();
        }
      } else {
        this.shape = new SvgShape();
      }
    };

    var SvgElemCircle = function(obj, inherits) {
      SvgElemBasicShape.call(this, obj, inherits);
      let cx = this.getLength('cx', this.getVWidth(), 0),
          cy = this.getLength('cy', this.getVHeight(), 0),
          r = this.getLength('r', this.getViewport(), 0),
          k = (4 / 3) * (Math.sqrt(2) - 1);
      if (r > 0) {
        this.shape = new SvgShape()
                      .M(cx + r, cy)
                      .C(cx + r, cy + r * k, cx + r * k, cy + r, cx, cy + r)
                      .C(cx - r * k, cy + r, cx - r, cy + r * k, cx - r, cy)
                      .C(cx - r, cy - r * k, cx - r * k, cy - r, cx, cy - r)
                      .C(cx + r * k, cy - r, cx + r, cy - r * k, cx + r, cy)
                      .Z();
      } else {
        this.shape = new SvgShape();
      }
    };

    var SvgElemEllipse = function(obj, inherits) {
      SvgElemBasicShape.call(this, obj, inherits);
      let cx = this.getLength('cx', this.getVWidth(), 0),
          cy = this.getLength('cy', this.getVHeight(), 0),
          rx = this.getLength('rx', this.getVWidth(), 0),
          ry = this.getLength('ry', this.getVHeight(), 0),
          k = (4 / 3) * (Math.sqrt(2) - 1);
      if (rx > 0 && ry > 0) {
        this.shape = new SvgShape()
                      .M(cx + rx, cy)
                      .C(cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry)
                      .C(cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy)
                      .C(cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry)
                      .C(cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy)
                      .Z();
      } else {
        this.shape = new SvgShape();
      }
    };

    var SvgElemLine = function(obj, inherits) {
      SvgElemBasicShape.call(this, obj, inherits);
      let x1 = this.getLength('x1', this.getVWidth(), 0),
          y1 = this.getLength('y1', this.getVHeight(), 0),
          x2 = this.getLength('x2', this.getVWidth(), 0),
          y2 = this.getLength('y2', this.getVHeight(), 0);
      this.shape = new SvgShape().M(x1, y1).L(x2, y2);
    };

    var SvgElemPolyline = function(obj, inherits) {
      SvgElemBasicShape.call(this, obj, inherits);
      let points = this.parseLengthList(this.attr('points'));
      this.shape = new SvgShape();
      for (let i = 0; i < points.length - 1; i+=2) {
        let x = this.computeUnits(points[i].value, points[i].unit, this.getVWidth()),
            y = this.computeUnits(points[i+1].value, points[i+1].unit, this.getVHeight());
        if (i === 0) {
          this.shape.M(x, y);
        } else {
          this.shape.L(x, y);
        }
      }
    };

    var SvgElemPolygon = function(obj, inherits) {
      SvgElemBasicShape.call(this, obj, inherits);
      let points = this.parseLengthList(this.attr('points'));
      this.shape = new SvgShape();
      for (let i = 0; i < points.length - 1; i+=2) {
        let x = this.computeLength(points[i].value, points[i].unit, this.getVWidth()),
            y = this.computeLength(points[i+1].value, points[i+1].unit, this.getVHeight());
        if (i === 0) {
          this.shape.M(x, y);
        } else {
          this.shape.L(x, y);
        }
      }
      this.shape.Z();
    };

    var SvgElemPath = function(obj, inherits) {
      SvgElemBasicShape.call(this, obj, inherits);
      this.shape = new SvgPath(this.attr('d'));
    };

    var SvgElemMarker = function(obj, inherits, posArray, strokeWidth) {
      SvgElem.call(this, obj, inherits);
      SvgElemHasChildren.call(this, obj);
      this.allowedChildren = ['use', 'g', 'svg', 'image', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text'];
      let width = this.getLength('markerWidth', this.getParentVWidth(), 3),
          height = this.getLength('markerHeight', this.getParentVHeight(), 3),
          viewBox = this.getViewbox('viewBox', [0, 0, width, height]);
      this.getVWidth = function() {
        return viewBox[2];
      };
      this.getVHeight = function() {
        return viewBox[3];
      };
      this.getTransformation = function() {
        let orient = this.attr('orient'),
            units = this.attr('markerUnits'),
            rotate = (orient === 'auto' ? posArray[2] : (parseFloat(orient) || 0) * Math.PI / 180),
            scale = (units === 'userSpaceOnUse' ? 1 : strokeWidth);
        return [ Math.cos(rotate)*scale, Math.sin(rotate)*scale, -Math.sin(rotate)*scale, Math.cos(rotate)*scale, posArray[0], posArray[1] ];
      };
      this.getTransformation2 = function() {
        let aspectRatio = (this.attr('preserveAspectRatio') || '').trim(),
            temp = aspectRatio.match(/^(none)$|^x(Min|Mid|Max)Y(Min|Mid|Max)(?:\s+(meet|slice))?$/) || [],
            ratioType = temp[1] || temp[4] || 'meet',
            xAlign = temp[2] || 'Mid',
            yAlign = temp[3] || 'Mid',
            scaleX = width / viewBox[2],
            scaleY = height / viewBox[3],
            dx = {'Min':-0.5, 'Mid':0, 'Max':0.5}[xAlign],
            dy = {'Min':-0.5, 'Mid':0, 'Max':0.5}[yAlign];
        if (ratioType === 'slice') {
          scaleY = scaleX = Math.max(scaleX, scaleY);
        } else if (ratioType === 'meet') {
          scaleY = scaleX = Math.min(scaleX, scaleY);
        }
        return [scaleX, 0, 0, scaleY, dx * (width - viewBox[2] * scaleX), dy * (height - viewBox[3] * scaleY)];
      };
      this.drawInDocument = function(isClip, isMask) {
        let refX = this.getLength('refX', this.getVWidth(), 0),
            refY = this.getLength('refY', this.getVHeight(), 0),
            transform2 = this.getTransformation2();
        doc.save();
        doc.transform.apply(doc, this.getTransformation());
        if (this.get('overflow') === 'hidden') {
          doc.rect(-width/2 + transform2[0] * (viewBox[0] + viewBox[2]/2 - refX), -height/2 + transform2[3] * (viewBox[1] + viewBox[3]/2 - refY), width, height).clip();
        }
        doc.transform.apply(doc, transform2);
        doc.translate(-refX, -refY);
        let group;
        if (this.get('opacity') < 1 && !isClip) {
          group = doc.createGroup();
        }
        this.drawChildren(isClip, isMask);
        if (group) {
          doc.closeGroup(group);
          doc.fillOpacity(this.get('opacity'));
          doc.insertGroup(group);
        }
        doc.restore();
      };
    };

    var SvgElemClipPath = function(obj, inherits, bBox) {
      SvgElem.call(this, obj, inherits);
      SvgElemHasChildren.call(this, obj);
      SvgElemStylable.call(this, obj);
      this.allowedChildren = ['use', 'g', 'svg', 'image', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text'];
      this.getTransformation = function() {
        if (this.attr('clipPathUnits') === 'objectBoundingBox') {
          return [bBox[2] - bBox[0], 0, 0, bBox[3] - bBox[1], bBox[0], bBox[1]];
        } else {
          return [1, 0, 0, 1, 0, 0];
        }
      };
      this.drawInDocument = function() {
        let group = doc.createGroup();
        doc.save();
        doc.transform.apply(doc, this.getTransformation());
        this.clip();
        this.drawChildren(true, false);
        doc.restore();
        if (group) {
          doc.closeGroup(group);
          doc.applyMask(group, true);
        }
      };
    };

    var SvgElemMask = function(obj, inherits, bBox) {
      SvgElem.call(this, obj, inherits);
      SvgElemHasChildren.call(this, obj);
      this.allowedChildren = ['use', 'g', 'svg', 'image', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text'];
      this.getTransformation = function() {
        if (this.attr('maskContentUnits') === 'objectBoundingBox') {
          return [bBox[2] - bBox[0], 0, 0, bBox[3] - bBox[1], bBox[0], bBox[1]];
        } else {
          return [1, 0, 0, 1, 0, 0];
        }
      };
      this.drawInDocument = function() {
        let group = doc.createGroup();
        doc.save();
        let x, y, w, h;
        if (this.attr('maskUnits') === 'userSpaceOnUse') {
          x = this.getLength('x', this.getVWidth(), -0.1 * (bBox[2] - bBox[0]) + bBox[0]);
          y = this.getLength('y', this.getVHeight(), -0.1 * (bBox[3] - bBox[1]) + bBox[1]);
          w = this.getLength('width', this.getVWidth(), 1.2 * (bBox[2] - bBox[0]));
          h = this.getLength('height', this.getVHeight(), 1.2 * (bBox[3] - bBox[1]));
        } else {
          x = this.getLength('x', this.getVWidth(), -0.1) * (bBox[2] - bBox[0]) + bBox[0];
          y = this.getLength('y', this.getVHeight(), -0.1) * (bBox[3] - bBox[1]) + bBox[1];
          w = this.getLength('width', this.getVWidth(), 1.2) * (bBox[2] - bBox[0]);
          h = this.getLength('height', this.getVHeight(), 1.2) * (bBox[3] - bBox[1]);
        }
        doc.rect(x, y, w, h).clip();
        doc.transform.apply(doc, this.getTransformation());
        if (this.get('clip-path') !== 'none') {
          let clipPath = new SvgElemClipPath(this.get('clip-path'), null, this.getBoundingBox());
          clipPath.drawInDocument();
        }
        this.drawChildren(false, true);
        doc.restore()
        if (group) {
          doc.closeGroup(group);
          doc.applyMask(group, true);
        }
      };
    };

    var SvgElemTextContainer = function(obj, inherits) {
      SvgElem.call(this, obj, inherits);
      SvgElemStylable.call(this, obj);
      this.getBoundingShape = function() {
        return this.getInherit().getBoundingShape();
      };
    };

    var SvgElemTextNode = function(obj, inherits) {
      SvgElemTextContainer.call(this, obj, inherits);
      this.textContent = obj.nodeValue;
    };

    var SvgElemTspan = function(obj, inherits) {
      SvgElemTextContainer.call(this, obj, inherits);
      this.allowedChildren = ['tspan', '#text'];
    };

    var SvgElemTextPath = function(obj, inherits) {
      SvgElemTextContainer.call(this, obj, inherits);
      this.allowedChildren = ['tspan', '#text'];
      let pathObj = this.getUrl('href') || this.getUrl('xlink:href');
      if (pathObj && pathObj.nodeName === 'path') {
        this.path = new SvgElemPath(pathObj, this);
      }
    };

    var SvgElemText = function(obj, inherits) {
      SvgElemTextContainer.call(this, obj, inherits);
      this.allowedChildren = ['textPath', 'tspan', '#text'];
      (function (textParentElem) {
        let processedText = '', remainingText = obj.textContent, textPaths = [], currentChunk = [], currentAnchor, currentDirection, currentX = 0, currentY = 0;
        function combineArrays(array1, array2) {return array1.concat(array2.slice(array1.length));}
        function getAscent(font, size) {
          return Math.max(font.ascender, (font.bbox[3] || font.bbox.maxY) * (font.scale || 1)) * size / 1000;
        }
        function getDescent(font, size) {
          return Math.min(font.descender, (font.bbox[1] || font.bbox.minY) * (font.scale || 1)) * size / 1000;
        }
        function getXHeight(font, size) {
          return (font.xHeight || 0.5 * (font.ascender - font.descender)) * size / 1000;
        }
        function getBaseline(font, size, baseline, shift) {
          let dy1, dy2;
          switch (baseline) {
            case 'middle': dy1 = 0.5 * getXHeight(font, size); break;
            case 'central': dy1 = 0.5 * (getDescent(font, size) + getAscent(font, size)); break;
            case 'after-edge': case 'text-after-edge': dy1 = getDescent(font, size); break;
            case 'alphabetic': case 'auto': case 'baseline': dy1 = 0; break;
            case 'mathematical': dy1 = 0.5 * getAscent(font, size); break;
            case 'hanging': dy1 = 0.8 * getAscent(font, size); break;
            case 'before-edge': case 'text-before-edge': dy1 = getAscent(font, size); break;
            default: dy1 = 0; break;
          }
          switch (shift) {
            case 'baseline': dy2 = 0; break;
            case 'super': dy2 = 0.6 * size; break;
            case 'sub': dy2 = -0.6 * size; break;
            default: dy2 = shift; break;
          }
          return dy1 - dy2;
        }
        function getTextPos(font, size, text) {
          let unit = size / 1000, fontascent = getAscent(font, size), fontdescent = getDescent(font, size);
          let encoded = font.encode('' + text), hex = encoded[0], pos = encoded[1], data = [];
          for (let i = 0; i < hex.length; i++) {
            let unicode = font.unicode ? font.unicode[parseInt(hex[i], 16)] : [text.charCodeAt(i)];
            data.push({
              glyphid: hex[i],
              unicode: unicode,
              numchars: unicode.length,
              width: pos[i].advanceWidth * unit,
              ascent: fontascent,
              descent: fontdescent,
              xAdvance: pos[i].xAdvance * unit,
              yAdvance: pos[i].yAdvance * unit
            });
          }
          return data;
        }
        function doAnchoring() {
          if (currentChunk.length) {
            let last = currentChunk[currentChunk.length - 1];
            let first = currentChunk[0]
            let width = last.x + last.width - first.x;
            let anchordx = {'startltr': 0, 'middleltr': 0.5, 'endltr': 1, 'startrtl': 1, 'middlertl': 0.5, 'endrtl': 0}[currentAnchor + currentDirection] * width || 0;
            for (let i = 0; i < currentChunk.length; i++) {
              currentChunk[i].x -= anchordx;
            }
          }
          currentChunk = [];
        }
        function adjustLength(pos, length) {
          let firstChar = pos[0], lastChar = pos[pos.length - 1],
              startX = firstChar.x, endX = lastChar.x + lastChar.width,
              textScale = length / (endX - startX);
          if (textScale > 0 && textScale < Infinity) {
            for (let j = 0; j < pos.length; j++) {
              pos[j].x = startX + textScale * (pos[j].x - startX);
              pos[j].scale *= textScale;
              pos[j].xAdvance *= textScale;
              pos[j].width *= textScale;
            }
          }
          currentX += length - (endX - startX);
        }
        function recursive(currentElem, parentElem) {
          currentElem._x = combineArrays(currentElem.getLengthList('x', currentElem.getVWidth()), (parentElem ? parentElem._x.slice(parentElem._pos.length) : []));
          currentElem._y = combineArrays(currentElem.getLengthList('y', currentElem.getVHeight()), (parentElem ? parentElem._y.slice(parentElem._pos.length) : []));
          currentElem._dx = combineArrays(currentElem.getLengthList('dx', currentElem.getVWidth()), (parentElem ? parentElem._dx.slice(parentElem._pos.length) : []));
          currentElem._dy = combineArrays(currentElem.getLengthList('dy', currentElem.getVHeight()), (parentElem ? parentElem._dy.slice(parentElem._pos.length) : []));
          currentElem._rot = combineArrays(currentElem.getNumberList('rotate'), (parentElem ? parentElem._rot.slice(parentElem._pos.length) : []));
          currentElem._defRot = currentElem.chooseValue(currentElem._rot[currentElem._rot.length - 1], parentElem && parentElem._defRot, 0);
          if (currentElem.name === 'textPath') {currentElem._y = [];}
          let fontStylesFound = {},
              fontNameorLink = fontCallback(currentElem.get('font-family'), currentElem.get('font-weight') === 'bold', currentElem.get('font-style') === 'italic', fontStylesFound);
          try {
            doc.font(fontNameorLink);
          } catch(e) {
            warningMessage('SVGElemText: failed to open font "' + fontNameorLink + '" in PDFKit');
          }
          currentElem._pos = [];
          currentElem._index = 0;
          currentElem._font = {font: doc._font, size: currentElem.get('font-size'), fauxitalic: fontStylesFound.italicFound===false, fauxbold: fontStylesFound.boldFound===false};
          let textLength = currentElem.getLength('textLength', currentElem.getVWidth(), undefined),
              wordSpacing = currentElem.get('word-spacing'),
              letterSpacing = currentElem.get('letter-spacing'),
              textAnchor = currentElem.get('text-anchor'),
              textDirection = currentElem.get('direction'),
              baseline = getBaseline(currentElem._font.font, currentElem._font.size, currentElem.get('dominant-baseline'), currentElem.get('baseline-shift'));
          if (currentElem.name === 'textPath') {
            doAnchoring();
            currentX = currentY = 0;
          }
          let children = currentElem.getChildren();
          for (let i = 0; i < children.length; i++) {
            let childElem = children[i];
            switch(childElem.name) {
              case 'tspan': case 'textPath':
                recursive(childElem, currentElem);
                break;
              case '#text':
                let rawText = childElem.textContent, renderedText = rawText, words;
                childElem._font = currentElem._font;
                childElem._pos = [];
                remainingText = remainingText.substring(rawText.length);
                if (currentElem.get('xml:space') === 'preserve') {
                  renderedText = renderedText.replace(/[\s]/g, ' ');
                } else {
                  renderedText = renderedText.replace(/[\s]+/g, ' ');
                  if (processedText.match(/[\s]$|^$/)) {renderedText = renderedText.replace(/^[\s]/, '');}
                  if (remainingText.match(/^[\s]*$/)) {renderedText = renderedText.replace(/[\s]$/, '');}
                }
                processedText += rawText;
                if (wordSpacing === 0) {
                  words = [renderedText];
                } else {
                  words = renderedText.split(/(\s)/);
                }
                for (let w = 0; w < words.length; w++) {
                  let pos = getTextPos(currentElem._font.font, currentElem._font.size, words[w]);
                  for (let j = 0; j < pos.length; j++) {
                    let index = currentElem._index;
                    if (currentElem._x[index] !== undefined) {doAnchoring(); currentX = currentElem._x[index];}
                    if (currentElem._y[index] !== undefined) {doAnchoring(); currentY = currentElem._y[index];}
                    currentX += (currentElem._dx[index] || 0);
                    currentY += (currentElem._dy[index] || 0);
                    pos[j].rotate = (Math.PI / 180) * currentElem.chooseValue(currentElem._rot[index], currentElem._defRot);
                    pos[j].x = currentX;
                    pos[j].y = currentY + baseline;
                    pos[j].scale = 1;
                    pos[j].hidden = false;
                    currentChunk.push(pos[j]);
                    childElem._pos.push(pos[j]);
                    currentElem._pos.push(pos[j]);
                    currentElem._index += pos[j].numchars;
                    if (currentChunk.length === 1) {
                      currentAnchor = textAnchor;
                      currentDirection = textDirection;
                    }
                    currentX += pos[j].xAdvance + letterSpacing;
                    currentY += pos[j].yAdvance;
                  }
                  if (words[w] === ' ') {
                    currentX += wordSpacing;
                  }
                }
                break;
              default:
                remainingText = remainingText.substring(childElem.textContent.length);
            }
          }
          if (textLength && currentElem._pos.length) {
            adjustLength(currentElem._pos, textLength);
          }
          if (currentElem.name === 'textPath' || currentElem.name === 'text') {
            doAnchoring();
          }
          if (currentElem.name === 'textPath') {
            textPaths.push(currentElem);
          }
          if (parentElem) {
            parentElem._pos = parentElem._pos.concat(currentElem._pos);
            parentElem._index += currentElem._index;
          }
        }
        function textOnPath(currentElem) {
          let pathElem = currentElem.path;
          if (pathElem) {
            let pathObject = pathElem.shape.clone().transform(pathElem.get('transform')),
                pathComputedLength = pathObject.totalLength,
                textOffset = currentElem.getLength('startOffset', pathComputedLength, 0),
                pathLength = pathElem.getLength('pathLength', pathElem.getViewport(), undefined),
                pathLengthScale = (pathElem.pathLength !== undefined ? pathComputedLength / pathElem.pathLength : 1);
            for (let j = 0; j < currentElem._pos.length; j++) {
              if (pathLengthScale !== 1) {
                currentElem._pos[j].scale *= pathLengthScale;
                currentElem._pos[j].xAdvance *= pathLengthScale;
                currentElem._pos[j].width *= pathLengthScale;
              }
              let charMidX = textOffset + currentElem._pos[j].x * pathLengthScale + 0.5 * currentElem._pos[j].width;
              if (charMidX > pathComputedLength || charMidX < 0) {
                currentElem._pos[j].hidden = true;
              } else {
                let pointOnPath = pathObject.getPointAtLength(charMidX);
                currentElem._pos[j].x = pointOnPath[0] - 0.5 * currentElem._pos[j].width * Math.cos(pointOnPath[2]) - currentElem._pos[j].y * Math.sin(pointOnPath[2]);
                currentElem._pos[j].y = pointOnPath[1] - 0.5 * currentElem._pos[j].width * Math.sin(pointOnPath[2]) + currentElem._pos[j].y * Math.cos(pointOnPath[2]);
                currentElem._pos[j].rotate = pointOnPath[2] + currentElem._pos[j].rotate;
              }
            }
            let endPoint = pathObject.getPointAtLength(pathComputedLength);
            currentX = endPoint[0]; currentY = endPoint[1];
          } else {
            for (let j = 0; j < currentElem._pos.length; j++) {
              currentElem._pos[j].hidden = true;
            }
          }
        }
        recursive(textParentElem, null);
        for (let i = 0; i < textPaths.length; i++) {
          textOnPath(textPaths[i]);
        }
      })(this);
      this.getBoundingShape = function() {
        let shape = new SvgShape();
        for (let i = 0; i < this._pos.length; i++) {
          let pos = this._pos[i];
          if (!pos.hidden) {
            let dx0 = pos.ascent * Math.sin(pos.rotate), dy0 = -pos.ascent * Math.cos(pos.rotate),
                dx1 = pos.descent * Math.sin(pos.rotate), dy1 = -pos.descent * Math.cos(pos.rotate),
                dx2 = pos.width * Math.cos(pos.rotate), dy2 = pos.width * Math.sin(pos.rotate);
            shape.M(pos.x + dx0, pos.y + dy0).L(pos.x + dx0 + dx2, pos.y + dy0 + dy2)
                 .M(pos.x + dx1 + dx2, pos.y + dy1 + dy2).L(pos.x + dx1, pos.y + dy1);
          }
        }
        return shape;
      };
      this.getTransformation = function() {
        return this.get('transform');
      };
      this.drawInDocument = function(isClip, isMask) {
        function recursive(elem) {
          let fill = elem.getFill(isClip, isMask),
              stroke = elem.getStroke(isClip, isMask),
              strokeWidth = elem.get('stroke-width');
          if (elem._font.fauxbold) {
            if (!stroke) {
              stroke = fill;
              strokeWidth = elem._font.size * 0.03;
            } else {
              strokeWidth += elem._font.size * 0.03;
            }
          }
          let children = elem.getChildren();
          for (let i = 0; i < children.length; i++) {
            let childElem = children[i];
            switch(childElem.name) {
              case 'tspan': case 'textPath':
                if (childElem.get('display') !== 'none') {
                  recursive(childElem);
                }
                break;
              case '#text':
                if (elem.get('visibility') === 'hidden') {continue;}
                if (fill || stroke || isClip) {
                  if (!isClip) {
                    if (fill) {
                      doc.fillColor.apply(doc, fill);
                    }
                    if (stroke && strokeWidth) {
                      doc.strokeColor.apply(doc, stroke)
                         .lineWidth(strokeWidth)
                         .miterLimit(elem.get('stroke-miterlimit'))
                         .lineJoin(elem.get('stroke-linejoin'))
                         .lineCap(elem.get('stroke-linecap'))
                         .dash(elem.get('stroke-dasharray'), {phase:elem.get('stroke-dashoffset')});
                    }
                  } else {
                    doc.fillColor('white');
                  }
                  docBeginText(elem._font.font, elem._font.size);
                  if (!isClip) {
                    docSetTextMode(!!fill, !!stroke);
                  } else {
                    docSetTextMode(true, false);
                  }
                  for (let j = 0, pos = childElem._pos; j < pos.length; j++) {
                    if (!pos[j].hidden && pos[j].width !== 0) {
                      let cos = Math.cos(pos[j].rotate), sin = Math.sin(pos[j].rotate), skew = (elem._font.fauxitalic ? -0.25 : 0);
                      docSetTextMatrix(cos * pos[j].scale, sin * pos[j].scale, cos * skew - sin, sin * skew + cos, pos[j].x, pos[j].y);
                      docWriteGlyph(pos[j].glyphid);
                    }
                  }
                  docEndText();
                }
                break;
            }
          }
        }
        doc.save();
        doc.transform.apply(doc, this.getTransformation());
        this.clip();
        let masked = this.mask(), group;
        if (masked) {
          group = doc.createGroup();
        }
        recursive(this);
        if (group) {
          doc.closeGroup(group);
          doc.insertGroup(group);
        }
        doc.restore();
      };
    };

    options = options || {};
    if (typeof svg === 'string') {svg = parseXml(svg);}

    var pxToPt = 72/96, // 1px = 72/96pt
        viewportWidth = options.width || doc.page.width / pxToPt,
        viewportHeight = options.height || doc.page.height / pxToPt,
        useCSS = options.useCSS && typeof SVGSVGElement === 'function' && svg instanceof SVGSVGElement && typeof getComputedStyle === 'function',
        fontCallback = options.fontCallback,
        imageCallback = options.imageCallback;

    if (options.useCSS && !useCSS) {
      warningMessage('SVGtoPDF: useCSS option can only be used for SVG *elements* in compatible browsers');
    }
    if (typeof fontCallback !== 'function') {
      fontCallback = function(family, bold, italic) {
        if (family.match(/(?:^|,)\s*serif\s*$/)) {
          if (bold && italic) {return 'Times-BoldItalic';}
          if (bold && !italic) {return 'Times-Bold';}
          if (!bold && italic) {return 'Times-Italic';}
          if (!bold && !italic) {return 'Times-Roman';}
        } else if (family.match(/(?:^|,)\s*monospace\s*$/)) {
          if (bold && italic) {return 'Courier-BoldOblique';}
          if (bold && !italic) {return 'Courier-Bold';}
          if (!bold && italic) {return 'Courier-Oblique';}
          if (!bold && !italic) {return 'Courier';}
        } else if (family.match(/(?:^|,)\s*sans-serif\s*$/) || true) {
          if (bold && italic) {return 'Helvetica-BoldOblique';}
          if (bold && !italic) {return 'Helvetica-Bold';}
          if (!bold && italic) {return 'Helvetica-Oblique';}
          if (!bold && !italic) {return 'Helvetica';}
        }
      };
    }
    if (typeof imageCallback !== 'function') {
      imageCallback = function(link) {
        return link.replace(/\s+/g, '');
      };
    }
    if (svg) {
      let elem = new SvgElem(svg, null);
      if (typeof elem.drawInDocument === 'function') {
        doc.save().translate(x || 0, y || 0).scale(pxToPt);
        elem.drawInDocument();
        doc.restore();
      } else {
        warningMessage('SVGtoPDF: this element can\'t be rendered directly: ' + svg.nodeName);
      }
    } else {
      warningMessage('SVGtoPDF: the input does not look like a valid SVG');
    }

};


if (typeof module !== 'undefined' && module && typeof module.exports !== 'undefined') {
  module.exports = SVGtoPDF;
}
