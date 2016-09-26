var ParseXml = function(XmlString) { // Convert a XML string into an object simulating the DOM nodes
  var SvgNode = function(tag) {
    this.nodeName = tag;
    this._attributes = {};
    this.childNodes = [];
    this.parentNode = null;
    this.nodeValue = null;
    if (tag === '#text') {this.nodeType = 3;} else {this.nodeType = 1;}
  };
  Object.defineProperty(SvgNode.prototype, 'attributes', { get: function() {
      if (this.nodeType === 1) {
        var temp = [], keys = Object.keys(this._attributes);
        for (var i = 0; i < keys.length; i++) { 
          temp.push({name:keys[i], value:this._attributes[keys[i]]})
        }
        return(temp);
      } else {return(undefined);}
  }});
  Object.defineProperty(SvgNode.prototype, 'children', { get: function() {
      if (this.nodeType === 1) {
        var temp = [];
        for (var i = 0; i < this.childNodes.length; i++) {
          if (this.childNodes[i].nodeType === 1) {temp.push(this.childNodes[i]);}
        }
        return(temp);
      } else {return(undefined);}
  }});
  Object.defineProperty(SvgNode.prototype, 'parentElement', { get: function() {
      return(this.parentNode);
  }});
  Object.defineProperty(SvgNode.prototype, 'tagName', { get: function() {
      if (this.nodeType === 1) {
        return(this.nodeName);
      } else {return(undefined);}
  }});
  Object.defineProperty(SvgNode.prototype, 'id', { get: function() {
      if (this.nodeType === 1) {
        return(this.getAttribute('id') || '');
      } else {return(undefined);}
  }});
  Object.defineProperty(SvgNode.prototype, 'name', { get: function() {
      if (this.nodeType === 1) {
        return(this.getAttribute('name') || '');
      } else {return(undefined);}
  }});
  Object.defineProperty(SvgNode.prototype, 'textContent', { get: function() {
      function TextContent(node) {
        if (node.nodeType === 3) {return(node.nodeValue);}
        var temp = '';
        for (var i = 0; i < node.childNodes.length; i++) {
          temp += TextContent(node.childNodes[i]);
        }
        return(temp);
      }
      return(TextContent(this));
  }});
  SvgNode.prototype.getAttribute = function(attr) {
      return((this.hasAttribute(attr) || null) && this._attributes[attr]);
  };
  SvgNode.prototype.hasAttribute = function(attr) {
      return(this._attributes.hasOwnProperty(attr));
  };
  SvgNode.prototype.getElementById = function(id) {
      function GetElementById(node, id) {
        var temp;
        if (node.nodeType === 1) {
          if (node._attributes.id === id) {return(node);}
          for (var i = 0; i < node.childNodes.length; i++) {
            if (temp = GetElementById(node.childNodes[i], id)) {return(temp);}
          }
        }
      }
      return(GetElementById(this, id) || null);
  };
  // Code adapted from this one: https://github.com/segmentio/xml-parser/
  XmlString = XmlString.replace(/<!--[\s\S]*?-->/g, '').replace(/<![\s\S]*?>/g, '').trim(); // Remove comments
  return(RecursiveParse());
  function RecursiveParse() {
    var temp, child, node, attr, value;
    if (temp = ConsumeMatch(/^<([\w-:.]+)\s*/)) { // Opening tag
      node = new SvgNode(temp[1]);
      while (temp = ConsumeMatch(/^([\w:-]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)')?\s*/)) { // Attribute
        attr = temp[1]; value = DecodeHtmlEntities(temp[2] || temp[3] || '');
        node._attributes[attr] = value;
      }
      if (ConsumeMatch(/^>/)) { // End of opening tag
        while (child = RecursiveParse()) {
          node.childNodes.push(child);
          child.parentNode = node;
        }
        temp = ConsumeMatch(/^<\/([\w-:.]+)>/); // Closing tag
        if (!temp || temp[1] !== node.nodeName) {
          console.log('Error: ParseXml: tag not matching, opening ' + node.nodeName + ' & closing ' + (temp && temp[1]));
        }
      } else if (ConsumeMatch(/^\/>/)) { // Self-closing tag
        return(node);
      } else {
        console.log('Error: ParseXml: tag could not be parsed ' + node.nodeName);
      }
      return(node);
    } else if (temp = ConsumeMatch(/^([^<]+)/)) { // Text node
      node = new SvgNode('#text');
      node.nodeValue = DecodeHtmlEntities(temp[1]);
      return(node);
    }
  }
  function ConsumeMatch(RegExp) {
    var temp = XmlString.match(RegExp);
    if (!temp) {return;}
    XmlString = XmlString.slice(temp[0].length);
    return(temp);
  }
  function DecodeHtmlEntities(Str) {
    var Entities = {quot: 34, amp: 38, lt: 60, gt: 62, apos: 39, OElig: 338, oelig: 339, Scaron: 352, scaron: 353, Yuml: 376, circ: 710, tilde: 732, ensp: 8194, emsp: 8195, thinsp: 8201, zwnj: 8204, zwj: 8205, lrm: 8206, rlm: 8207, ndash: 8211, mdash: 8212, lsquo: 8216, rsquo: 8217, sbquo: 8218, ldquo: 8220, rdquo: 8221, bdquo: 8222, dagger: 8224, Dagger: 8225, permil: 8240, lsaquo: 8249, 
         rsaquo: 8250, euro: 8364, nbsp: 160, iexcl: 161, cent: 162, pound: 163, curren: 164, yen: 165, brvbar: 166, sect: 167, uml: 168, copy: 169, ordf: 170, laquo: 171, not: 172, shy: 173, reg: 174, macr: 175, deg: 176, plusmn: 177, sup2: 178, sup3: 179, acute: 180, micro: 181, para: 182, middot: 183, cedil: 184, sup1: 185, ordm: 186, raquo: 187, frac14: 188, frac12: 189, frac34: 190, 
         iquest: 191, Agrave: 192, Aacute: 193, Acirc: 194, Atilde: 195, Auml: 196, Aring: 197, AElig: 198, Ccedil: 199, Egrave: 200, Eacute: 201, Ecirc: 202, Euml: 203, Igrave: 204, Iacute: 205, Icirc: 206, Iuml: 207, ETH: 208, Ntilde: 209, Ograve: 210, Oacute: 211, Ocirc: 212, Otilde: 213, Ouml: 214, times: 215, Oslash: 216, Ugrave: 217, Uacute: 218, Ucirc: 219, Uuml: 220, Yacute: 221, 
         THORN: 222, szlig: 223, agrave: 224, aacute: 225, acirc: 226, atilde: 227, auml: 228, aring: 229, aelig: 230, ccedil: 231, egrave: 232, eacute: 233, ecirc: 234, euml: 235, igrave: 236, iacute: 237, icirc: 238, iuml: 239, eth: 240, ntilde: 241, ograve: 242, oacute: 243, ocirc: 244, otilde: 245, ouml: 246, divide: 247, oslash: 248, ugrave: 249, uacute: 250, ucirc: 251, uuml: 252, 
         yacute: 253, thorn: 254, yuml: 255, fnof: 402, Alpha: 913, Beta: 914, Gamma: 915, Delta: 916, Epsilon: 917, Zeta: 918, Eta: 919, Theta: 920, Iota: 921, Kappa: 922, Lambda: 923, Mu: 924, Nu: 925, Xi: 926, Omicron: 927, Pi: 928, Rho: 929, Sigma: 931, Tau: 932, Upsilon: 933, Phi: 934, Chi: 935, Psi: 936, Omega: 937, alpha: 945, beta: 946, gamma: 947, delta: 948, epsilon: 949, 
         zeta: 950, eta: 951, theta: 952, iota: 953, kappa: 954, lambda: 955, mu: 956, nu: 957, xi: 958, omicron: 959, pi: 960, rho: 961, sigmaf: 962, sigma: 963, tau: 964, upsilon: 965, phi: 966, chi: 967, psi: 968, omega: 969, thetasym: 977, upsih: 978, piv: 982, bull: 8226, hellip: 8230, prime: 8242, Prime: 8243, oline: 8254, frasl: 8260, weierp: 8472, image: 8465, real: 8476, 
         trade: 8482, alefsym: 8501, larr: 8592, uarr: 8593, rarr: 8594, darr: 8595, harr: 8596, crarr: 8629, lArr: 8656, uArr: 8657, rArr: 8658, dArr: 8659, hArr: 8660, forall: 8704, part: 8706, exist: 8707, empty: 8709, nabla: 8711, isin: 8712, notin: 8713, ni: 8715, prod: 8719, sum: 8721, minus: 8722, lowast: 8727, radic: 8730, prop: 8733, infin: 8734, ang: 8736, and: 8743, or: 8744, 
         cap: 8745, cup: 8746, int: 8747, there4: 8756, sim: 8764, cong: 8773, asymp: 8776, ne: 8800, equiv: 8801, le: 8804, ge: 8805, sub: 8834, sup: 8835, nsub: 8836, sube: 8838, supe: 8839, oplus: 8853, otimes: 8855, perp: 8869, sdot: 8901, lceil: 8968, rceil: 8969, lfloor: 8970, rfloor: 8971, lang: 9001, rang: 9002, loz: 9674, spades: 9824, clubs: 9827, hearts: 9829, diams: 9830};
    return(Str.replace(/&(?:#([0-9]+)|#[xX]([0-9A-Fa-f]+)|([0-9A-Za-z]+));/g, function(mt, m0, m1, m2) {
      if (m0) {return(String.fromCharCode(parseInt(m0, 10)));}
      else if (m1) {return(String.fromCharCode(parseInt(m1, 16)));}
      else if (m2 && Entities[m2]) {return(String.fromCharCode(Entities[m2]));}
      else {return(mt);}
    }));
  }
};

var SVGtoPDF = function(doc, svg, x, y, options) {

    function ParseColor(v) { // Color string, rgba, rgb or hex value
      var NamedColors = {aliceblue: [240,248,255], antiquewhite: [250,235,215], aqua: [0,255,255], aquamarine: [127,255,212], azure: [240,255,255], beige: [245,245,220], bisque: [255,228,196], black: [0,0,0], blanchedalmond: [255,235,205], blue: [0,0,255], blueviolet: [138,43,226], brown: [165,42,42], burlywood: [222,184,135], cadetblue: [95,158,160], chartreuse: [127,255,0], 
           chocolate: [210,105,30], coral: [255,127,80], cornflowerblue: [100,149,237], cornsilk: [255,248,220], crimson: [220,20,60], cyan: [0,255,255], darkblue: [0,0,139], darkcyan: [0,139,139], darkgoldenrod: [184,134,11], darkgray: [169,169,169], darkgrey: [169,169,169], darkgreen: [0,100,0], darkkhaki: [189,183,107], darkmagenta: [139,0,139], darkolivegreen: [85,107,47], 
           darkorange: [255,140,0], darkorchid: [153,50,204], darkred: [139,0,0], darksalmon: [233,150,122], darkseagreen: [143,188,143], darkslateblue: [72,61,139], darkslategray: [47,79,79], darkslategrey: [47,79,79], darkturquoise: [0,206,209], darkviolet: [148,0,211], deeppink: [255,20,147], deepskyblue: [0,191,255], dimgray: [105,105,105], dimgrey: [105,105,105], 
           dodgerblue: [30,144,255], firebrick: [178,34,34], floralwhite: [255,250,240], forestgreen: [34,139,34], fuchsia: [255,0,255], gainsboro: [220,220,220], ghostwhite: [248,248,255], gold: [255,215,0], goldenrod: [218,165,32], gray: [128,128,128], grey: [128,128,128], green: [0,128,0], greenyellow: [173,255,47], honeydew: [240,255,240], hotpink: [255,105,180], 
           indianred: [205,92,92], indigo: [75,0,130], ivory: [255,255,240], khaki: [240,230,140], lavender: [230,230,250], lavenderblush: [255,240,245], lawngreen: [124,252,0], lemonchiffon: [255,250,205], lightblue: [173,216,230], lightcoral: [240,128,128], lightcyan: [224,255,255], lightgoldenrodyellow: [250,250,210], lightgray: [211,211,211], lightgrey: [211,211,211], 
           lightgreen: [144,238,144], lightpink: [255,182,193], lightsalmon: [255,160,122], lightseagreen: [32,178,170], lightskyblue: [135,206,250], lightslategray: [119,136,153], lightslategrey: [119,136,153], lightsteelblue: [176,196,222], lightyellow: [255,255,224], lime: [0,255,0], limegreen: [50,205,50], linen: [250,240,230], magenta: [255,0,255], maroon: [128,0,0], 
           mediumaquamarine: [102,205,170], mediumblue: [0,0,205], mediumorchid: [186,85,211], mediumpurple: [147,112,219], mediumseagreen: [60,179,113], mediumslateblue: [123,104,238], mediumspringgreen: [0,250,154], mediumturquoise: [72,209,204], mediumvioletred: [199,21,133], midnightblue: [25,25,112], mintcream: [245,255,250], mistyrose: [255,228,225], moccasin: [255,228,181], 
           navajowhite: [255,222,173], navy: [0,0,128], oldlace: [253,245,230], olive: [128,128,0], olivedrab: [107,142,35], orange: [255,165,0], orangered: [255,69,0], orchid: [218,112,214], palegoldenrod: [238,232,170], palegreen: [152,251,152], paleturquoise: [175,238,238], palevioletred: [219,112,147], papayawhip: [255,239,213], peachpuff: [255,218,185], peru: [205,133,63], 
           pink: [255,192,203], plum: [221,160,221], powderblue: [176,224,230], purple: [128,0,128], rebeccapurple: [102,51,153], red: [255,0,0], rosybrown: [188,143,143], royalblue: [65,105,225], saddlebrown: [139,69,19], salmon: [250,128,114], sandybrown: [244,164,96], seagreen: [46,139,87], seashell: [255,245,238], sienna: [160,82,45], silver: [192,192,192], skyblue: [135,206,235], 
           slateblue: [106,90,205], slategray: [112,128,144], slategrey: [112,128,144], snow: [255,250,250], springgreen: [0,255,127], steelblue: [70,130,180], tan: [210,180,140], teal: [0,128,128], thistle: [216,191,216], tomato: [255,99,71], turquoise: [64,224,208], violet: [238,130,238], wheat: [245,222,179], white: [255,255,255], whitesmoke: [245,245,245], yellow: [255,255,0]};
      var Temp;
      v = (v || '').toLowerCase().trim();
      if (v === 'none' || v === 'transparent') {
        return([255,255,255,0]);
      } else if (Temp = NamedColors[v]) {
        return(Temp.concat(1));
      } else if (Temp = v.match(/^rgba\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9.]+)\s*\)$/)) {
        Temp[1] = parseInt(Temp[1]); Temp[2] = parseInt(Temp[2]); Temp[3] = parseInt(Temp[3]); Temp[4] = parseFloat(Temp[4]);
        if (Temp[1] < 256 && Temp[2] < 256 && Temp[3] < 256 && Temp[4] <= 1) {
          return(Temp.slice(1, 5));
        }
      } else if (Temp = v.match(/^rgb\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)$/)) {
        Temp[1] = parseInt(Temp[1]); Temp[2] = parseInt(Temp[2]); Temp[3] = parseInt(Temp[3]);
        if (Temp[1] < 256 && Temp[2] < 256 && Temp[3] < 256) {
          return(Temp.slice(1, 4).concat(1));
        }
      } else if (Temp = v.match(/^rgb\(\s*([0-9.]+)%\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%\s*\)$/)) {
        Temp[1] = 2.55 * parseFloat(Temp[1]); Temp[2] = 2.55 * parseFloat(Temp[2]); Temp[3] = 2.55 * parseFloat(Temp[3]);
        if (Temp[1] < 256 && Temp[2] < 256 && Temp[3] < 256) {
          return(Temp.slice(1, 4).concat(1));
        }
      } else if (Temp = v.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/)) {
          return(Temp.slice(1,4).map(function(x) {return(parseInt(x, 16));}).concat(1));
      } else if (Temp = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/)) {
          return(Temp.slice(1,4).map(function(x) {return(0x11 * parseInt(x, 16));}).concat(1));
      }
      return(null);
    }

    function MatrixMultiply(a, b) { // Multiplication of 3x3 matrices
      return([
        a[0]*b[0]+a[1]*b[3]+a[2]*b[6], a[0]*b[1]+a[1]*b[4]+a[2]*b[7], a[0]*b[2]+a[1]*b[5]+a[2]*b[8],
        a[3]*b[0]+a[4]*b[3]+a[5]*b[6], a[3]*b[1]+a[4]*b[4]+a[5]*b[7], a[3]*b[2]+a[4]*b[5]+a[5]*b[8],
        a[6]*b[0]+a[7]*b[3]+a[8]*b[6], a[6]*b[1]+a[7]*b[4]+a[8]*b[7], a[6]*b[2]+a[7]*b[5]+a[8]*b[8]
      ]);
    }

    // Mathematical matrices have 9 elements but SVG transforms have only 6, conversion functions are needed
    function MatrixToMath(m) {return([m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1]);}

    function MatrixToSvg(m) {return([m[0], m[3], m[1], m[4], m[2], m[5]]);}

    function MatrixMultiplySvg () { // Combining the above function into one
      var result = MatrixToMath(arguments[0]);
      for (var i = 1; i < arguments.length; i++) {
        result = MatrixMultiply(result, MatrixToMath(arguments[i]));
      }
      return(MatrixToSvg(result));
    }

    function ParseTranforms(v) { // Convert the value of SVG transform attribute into a matrix
      var Exp = /([A-Za-z]+)[(]([^(]+)[)][\s,]*|(.+)/g, Res = [1, 0, 0, 1, 0, 0], Match, Func, Nums, a;
      v = (v || '').trim().toLowerCase();
      while(Match = Exp.exec(v)) {
        if (Match[3]) {return(null);}
        Func = Match[1];
        Nums = Match[2].split(/\s*,\s*|\s+/).map(function(x) {return(parseFloat(x));});
        if (!Nums.every(Number.isFinite)) {return(null);}
        if (Func === 'matrix' && Nums.length === 6) {
          Res = MatrixMultiplySvg(Res, [Nums[0], Nums[1], Nums[2], Nums[3], Nums[4], Nums[5]]);
        } else if (Func === 'translate' && Nums.length === 2) {
          Res = MatrixMultiplySvg(Res, [1, 0, 0, 1, Nums[0], Nums[1]]);
        } else if (Func === 'translate' && Nums.length === 1) {
          Res = MatrixMultiplySvg(Res, [1, 0, 0, 1, Nums[0], 0]);
        } else if (Func === 'scale' && Nums.length === 2) {
          Res = MatrixMultiplySvg(Res, [Nums[0], 0, 0, Nums[1], 0, 0]);
        } else if (Func === 'scale' && Nums.length === 1) {
          Res = MatrixMultiplySvg(Res, [Nums[0], 0, 0, Nums[0], 0, 0]);
        } else if (Func === 'rotate' && Nums.length === 3) {
          a = Nums[0] * Math.PI / 180;
          Res = MatrixMultiplySvg(Res, [1, 0, 0, 1, Nums[1], Nums[2]], [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0], [1, 0, 0, 1, -Nums[1], -Nums[2]]);
        } else if (Func === 'rotate' && Nums.length === 1) {
          a = Nums[0] * Math.PI / 180;
          Res = MatrixMultiplySvg(Res, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
        } else if (Func === 'skewx' && Nums.length === 1) {
          a = Nums[0] * Math.PI / 180;
          Res = MatrixMultiplySvg(Res, [1, 0, Math.tan(a), 1, 0, 0]);
        } else if (Func === 'skewy' && Nums.length === 1) {
          a = Nums[0] * Math.PI / 180;
          Res = MatrixMultiplySvg(Res, [1, Math.tan(a), 0, 1, 0, 0]);
        } else {
          return(null);
        }
      }
      return(Res);
    }

    function ParseLength(v, dir) { // 'em' & 'ex' are wrong and should be computed
      var Units = {'':1, 'px':1, 'pt':96/72, 'cm':96/2.54, 'mm':96/25.4, 'in':96, 'pc':96/6, 'em':12, 'ex':6};
      var temp = (v || '').match(/^([+-]?[0-9.]+)(px|pt|cm|mm|in|pc|em|ex|%|)$/)
      if (temp) {
        if (temp[2] === '%') {
          if (dir === 'x') {
            v = (+temp[1]) / 100 * ViewportWidth;
          } else if (dir === 'y') {
            v = (+temp[1]) / 100 * ViewportHeight;
          } else {
            v = (+temp[1]) / 100 * Math.sqrt(0.5 * ViewportWidth * ViewportWidth + 0.5 * ViewportHeight * ViewportHeight);
          }
        } else {
          v = (+temp[1]) * Units[temp[2]];
        }
        if (v > -Infinity && v < Infinity) {return(v);}
      }
    }

    function ParseAspectRatio(Value) {
      Value = (Value || '').trim().match(/^(none)$|^x(Min|Mid|Max)Y(Min|Mid|Max)(?:\s+(meet|slice))?$/) || [];
      var Type = Value[1] || Value[4] || 'meet';
      var XAlign = {'Min':'left', 'Mid':'center', 'Max':'right'}[Value[2] || 'Mid'];
      var YAlign = {'Min':'top', 'Mid':'center', 'Max':'bottom'}[Value[3] || 'Mid'];
      return({type: Type, xAlign: XAlign, yAlign:YAlign});
    }
    
    function ParseNumberList(v) {
      return((v || '').split(/\s*,\s*|\s+/).map(function(x) {return(ParseLength(x, 'xy'));}));
    }

    function Choose(value1, value2) { // Something like the '||' operator but with the 0 and the empty string being accepted
      if ((value1 !== undefined) && (value1 !== null) && (value1 !== NaN)) {return(value1);} else {return(value2);}
    }

    function CloneObject(original) { // Clone simple object with only one level containing values or arrays
      var clone = {}, keys = Object.keys(original);
      for (var i = 0; i < keys.length; i++) {
        if (original[keys[i]] instanceof Array) {
          clone[keys[i]] = original[keys[i]].slice();
        } else {
          clone[keys[i]] = original[keys[i]];
        }
      }
      return(clone);
    }

    function findSVGStyles(Obj, Styles, Tag) { // The styles from the attributes, css is unsupported
      Styles.currentColor = ParseColor(Obj.getAttribute('color')) || Styles.currentColor;
      var Attributes = Obj.attributes;
      for (var i = 0; i < Attributes.length; i++) {
        var name = Attributes[i].name.toLowerCase(), value0 = Attributes[i].value, value = value0.trim().toLowerCase();
        switch(name) {
          case 'display':
            if (value === 'none') {
              Styles.displayNone = true;
            }
            break;
          case 'visibility':
            if (value === 'hidden') {
              Styles.invisible = true;
            } else if (value === 'visible') {
              Styles.invisible = false;
            }
            break;
          case 'transform':
            if ((Tag !== 'svg') && (value = ParseTranforms(value))) {
              doc.transform(value[0], value[1], value[2], value[3], value[4], value[5]);
            }
            break;
          case 'opacity':
            value = parseFloat(value)
            if (value >= 0 && value <= 1) {
              Styles.opacity = ((Styles.opacity >= 0 && Styles.opacity <= 1) ? Styles.opacity : 1) * value;
            }
            break;
          case 'fill':
            if (value === 'currentcolor') {
              Styles.fill = Styles.currentColor;
            } else {
              Styles.fill = ParseColor(value) || Styles.fill;
            }
            break;
          case 'stroke':
            if (value === 'currentcolor') {
              Styles.stroke = Styles.currentColor;
            } else {
              Styles.stroke = ParseColor(value) || Styles.stroke;
            }
            break;
          case 'fill-opacity':
            value = parseFloat(value)
            if (value > -Infinity && value < Infinity) {
              Styles.fillOpacity = Math.max(0, Math.min(1, value));
            }
            break;
          case 'stroke-opacity':
            value = parseFloat(value)
            if (value > -Infinity && value < Infinity) {
              Styles.strokeOpacity = Math.max(0, Math.min(1, value));
            }
            break;
          case 'fill-rule':
            if (['evenodd', 'nonzero'].indexOf(value) !== -1) {
              Styles.fillRule = {'nonzero':'non-zero', 'evenodd':'even-odd'}[value];
            }
            break;
          case 'stroke-width':
            value = ParseLength(value, 'xy');
            if (value > -Infinity && value < Infinity) {
              Styles.strokeWidth = value;
            }
            break;
          case 'stroke-dasharray':
            value = ParseNumberList(value);
            if (value.every(function(x) {return(x >= 0 && x < Infinity);})) {
              if (value.length % 2 === 1) {
                value = value.concat(value);
              }
              Styles.strokeDasharray = value;
            }
            break;
          case 'stroke-dashoffset':
            value = ParseLength(value, 'xy');
            if (value > -Infinity && value < Infinity) {
              Styles.strokeDashoffset = value;
            }
            break;
          case 'stroke-miterlimit':
            value = ParseLength(value, 'xy');
            if (value > -Infinity && value < Infinity) {
              Styles.strokeMiterlimit = value;
            }
            break;
          case 'stroke-linejoin':
            if (['miter', 'round', 'bevel'].indexOf(value) !== -1) {
              Styles.strokeLinejoin = value;
            }
            break;
          case 'stroke-linecap':
            if (['butt', 'round', 'square'].indexOf(value) !== -1) {
              Styles.strokeLinecap = value;
            }
            break;
          case 'font-size':
            value = {'xx-small':9,'x-small':10,'small':13,'medium':16,'large':18,'x-large':24,'xx-large':32}[value] || ParseLength(value, 'xy');
            if (value > 0 && value < Infinity) {
              Styles.fontSize = value;
            }
            break;
          case 'font-family':
            if (value0) {
              Styles.fontFamily = value0;
            }
            break;
          case 'font-weight':
            if (['600', '700', '800', '900', 'bold', 'bolder'].indexOf(value) !== -1) {
              Styles.bold = true;
            } else if (['500', '400', '300', '200', '100', 'normal', 'lighter'].indexOf(value) !== -1) {
              Styles.bold = false;
            }
            break;
          case 'font-style':
            if (['italic', 'oblique'].indexOf(value) !== -1) {
              Styles.italic = true;
            } else if (value === 'normal') {
              Styles.italic = false;
            }
            break;
          case 'text-anchor':
            if (['start', 'middle', 'end'].indexOf(value) !== -1) {
              Styles.textAnchor = value;
            }
            break;
          case 'alignment-baseline':
            if (['auto', 'baseline', 'before-edge', 'text-before-edge', 'middle', 'central', 'after-edge', 'text-after-edge', 'ideographic', 'alphabetic', 'hanging', 'mathematical'].indexOf(value) !== -1) {
              Styles.alignmentBaseline = {'text-before-edge':'before-edge', 'text-after-edge':'after-edge', 'auto':'baseline', 'ideographic':'after-edge', 'alphabetic':'baseline'}[value] || value;
            }
            break;
          case 'xml:space':
            if (value === 'preserve') {
              Styles.preserveWhiteSpace = true;
            } else if (value === 'default') {
              Styles.preserveWhiteSpace = true;
            }
            break;
        }
      }
    }

    function addSVGGroup(Obj, Styles, Tag) { // Elements: g, svg
      var Child, Tag2;
      findSVGStyles(Obj, Styles, Tag);
      if (Styles.displayNone) {return;}
      if (Tag === 'svg') {
        var ViewBox = ParseNumberList(Obj.getAttribute('viewBox'));
        var PreserveRatio = ParseAspectRatio(Obj.getAttribute('preserveAspectRatio'));
        var Width = Choose(ParseLength(Obj.getAttribute('width'), 'x'), ViewportWidth),
            Height = Choose(ParseLength(Obj.getAttribute('height'), 'y'), ViewportHeight),
            X = Choose(ParseLength(Obj.getAttribute('x'), 'x'), 0),
            Y = Choose(ParseLength(Obj.getAttribute('y'), 'y'), 0),
            Overflow = ((Obj.getAttribute('overflow') || '').trim().toLowerCase() === 'visible');
        if (!Overflow) {
          doc.rect(X, Y, Width, Height).clip();
        }
        if (ViewBox[0] > -Infinity && ViewBox[0] < Infinity && ViewBox[1] > -Infinity && ViewBox[1] < Infinity &&
        ViewBox[2] >= 0 && ViewBox[2] < Infinity && ViewBox[3] >= 0 && ViewBox[3] < Infinity) {
          ViewportWidth = ViewBox[2];
          ViewportHeight = ViewBox[3];
          var ScaleX = Width / ViewportWidth, 
              ScaleY = Height / ViewportHeight, 
              Dx = 0, 
              Dy = 0;
          if (PreserveRatio.type === 'slice') {
            ScaleY = ScaleX = Math.max(ScaleX, ScaleY);
          } else if (PreserveRatio.type === 'meet') {
            ScaleY = ScaleX = Math.min(ScaleX, ScaleY);
          }
          Dx = {'left':0, 'center':0.5, 'right':1}[PreserveRatio.xAlign];
          Dy = {'top':0, 'center':0.5, 'bottom':1}[PreserveRatio.yAlign];
          doc.transform(ScaleX, 0, 0, ScaleY, X + Dx * (Width - ViewportWidth * ScaleX) - ScaleX * ViewBox[0], Y + Dy * (Height - ViewportHeight * ScaleY) - ScaleY * ViewBox[1]);
        } else {
          ViewportWidth = Width;
          ViewportHeight = Height;
        }
      }
      for (var i = 0, children = Obj.childNodes; i < children.length; i++) {
        Child = children[i]; Tag2 = Child.nodeName.toLowerCase();
        switch(Tag2) {
          case 'g': case 'svg':
            doc.save();
            addSVGGroup(Child, CloneObject(Styles), Tag2);
            doc.restore();
            break;
          case 'path': case 'rect': case 'polygon': case 'line': case 'polyline': case 'circle': case 'ellipse':
            doc.save();
            addSVGShape(Child, CloneObject(Styles), Tag2);
            doc.restore();
            break;
          case 'text':
            doc.save();
            addSVGText(Child, CloneObject(Styles), Tag2);
            doc.restore();
            break;
          case 'image':
            doc.save();
            addSVGImage(Child, CloneObject(Styles), Tag2);
            doc.restore();
            break;
          case 'use':
            doc.save();
            addSVGUseElem(Child, CloneObject(Styles), Tag2);
            doc.restore();
            break;
        }
      }
    }

    function addSVGUseElem(Obj, Styles, Tag) { // Element: use
      findSVGStyles(Obj, Styles, Tag);
      if (Styles.displayNone) {return;}
      var Link = Obj.getAttribute('xlink:href').slice(1),
          Child = svg.getElementById(Link),
          Tag2 = Child && Child.nodeName.toLowerCase();
      if (Child) {
        var X = Choose(ParseLength(Obj.getAttribute('x'), 'x'), 0),
            Y = Choose(ParseLength(Obj.getAttribute('y'), 'y'), 0);
        doc.translate(X, Y);
        switch(Tag2) {
          case 'g':
            doc.save();
            addSVGGroup(Child, CloneObject(Styles), Tag2);
            doc.restore();
            break;
          case 'path': case 'rect': case 'polygon': case 'line': case 'polyline': case 'circle': case 'ellipse':
            doc.save();
            addSVGShape(Child, CloneObject(Styles), Tag2);
            doc.restore();
            break;
          case 'text':
            doc.save();
            addSVGText(Child, CloneObject(Styles), Tag2);
            doc.restore();
            break;
          case 'image':
            doc.save();
            addSVGImage(Child, CloneObject(Styles), Tag2);
            doc.restore();
            break;
        }
      }
    }
    
    function addSVGImage(Obj, Styles, Tag) { // Element: image
      findSVGStyles(Obj, Styles, Tag);
      if (Styles.displayNone) {return;}
      var Link = Obj.getAttribute('xlink:href'), 
          Width = Choose(ParseLength(Obj.getAttribute('width'), 'x'), 0), 
          Height = Choose(ParseLength(Obj.getAttribute('height'), 'y'), 0),
          X = Choose(ParseLength(Obj.getAttribute('x'), 'x'), 0),
          Y = Choose(ParseLength(Obj.getAttribute('y'), 'y'), 0),
          PreserveRatio = ParseAspectRatio(Obj.getAttribute('preserveAspectRatio')),
          Overflow = ((Obj.getAttribute('overflow') || '').trim().toLowerCase() === 'visible');
      if (!Overflow) {
          doc.rect(X, Y, Width, Height).clip();
      }
      doc.fillOpacity(Choose(Styles.opacity, 1));
      var Options = {};
      if (PreserveRatio.type === 'none') {
        Options.width = Width;
        Options.height = Height;
      } else {
        Options.align = PreserveRatio.xAlign;
        Options.valign = PreserveRatio.yAlign;
        if (PreserveRatio.type === 'meet') {
          Options.fit = [Width, Height];
        } else if (PreserveRatio.type === 'slice') {
          Options.cover = [Width, Height]; // This is not yet supported in PdfKit
        }
      }
      if (Link && !Styles.invisible) {doc.image(Link.replace(/\s+/g, ''), X, Y, Options);}
    }

    function addSVGShape(Obj, Styles, Tag) { // Elements: path, rect, polygon, line, polyline, circle, ellipse
      findSVGStyles(Obj, Styles, Tag);
      if (Styles.displayNone) {return;}
      var FillColor = Choose(Styles.fill, [0, 0, 0, 1]),
          StrokeColor = Choose(Styles.stroke, [255, 255, 255, 0]);
      doc.fillColor(FillColor.slice(0,3), Choose(Styles.fillOpacity, 1) * Choose(Styles.opacity, 1) * FillColor[3])
         .strokeColor(StrokeColor.slice(0,3), Choose(Styles.strokeOpacity, 1) * Choose(Styles.opacity, 1) * StrokeColor[3])
         .lineWidth(Choose(Styles.strokeWidth, 1))
         .miterLimit(Choose(Styles.strokeMiterlimit, 10))
         .lineJoin(Choose(Styles.strokeLinejoin, 'miter'))
         .lineCap(Choose(Styles.strokeLinecap, 'butt'))
         .dash(Choose(Styles.strokeDasharray, []), {phase:Choose(Styles.strokeDashoffset, 0)});
      var FillRule = Choose(Styles.fillRule, 'non-zero');
      if (Tag === 'path') {
        if (!Styles.invisible) {
          doc.path(Obj.getAttribute('d')).fillAndStroke(FillRule);
        }
      } else if (Tag === 'rect') {
        var PosX = Choose(ParseLength(Obj.getAttribute('x'), 'x'), 0),
            PosY = Choose(ParseLength(Obj.getAttribute('y'), 'y'), 0),
            Width = Choose(ParseLength(Obj.getAttribute('width'), 'x'), 0), 
            Height = Choose(ParseLength(Obj.getAttribute('height'), 'y'), 0), 
            Radius = Choose(ParseLength(Obj.getAttribute('rx'), 'x'), 0);
        if (Radius) {
          if (!Styles.invisible) {
            doc.roundedRect(PosX, PosY, Width, Height, Radius).fillAndStroke(FillRule);
          }
        } else {
          if (!Styles.invisible) {
            doc.rect(PosX, PosY, Width, Height).fillAndStroke(FillRule);
          }
        }
      } else if (Tag === 'circle') {
        var PosX = Choose(ParseLength(Obj.getAttribute('cx'), 'x'), 0),
            PosY = Choose(ParseLength(Obj.getAttribute('cy'), 'y'), 0),
            Radius = Choose(ParseLength(Obj.getAttribute('r'), 'xy'), 0);
        if (!Styles.invisible) {
          doc.circle(PosX, PosY, Radius).fillAndStroke(FillRule);
        }
      } else if (Tag === 'ellipse') {
        var PosX = Choose(ParseLength(Obj.getAttribute('cx'), 'x'), 0),
            PosY = Choose(ParseLength(Obj.getAttribute('cy'), 'y'), 0),
            RadiusX = Choose(ParseLength(Obj.getAttribute('rx'), 'x'), 0),
            RadiusY = Choose(ParseLength(Obj.getAttribute('ry'), 'y'), 0);
        if (!Styles.invisible) {
          doc.ellipse(PosX, PosY, RadiusX, RadiusY).fillAndStroke(FillRule);
        }
      } else if (Tag === 'line') {
        var StartX = Choose(ParseLength(Obj.getAttribute('x1'), 'x'), 0),
            StartY = Choose(ParseLength(Obj.getAttribute('y1'), 'y'), 0),
            EndX = Choose(ParseLength(Obj.getAttribute('x2'), 'x'), 0),
            EndY = Choose(ParseLength(Obj.getAttribute('y2'), 'y'), 0);
        if (!Styles.invisible) {
          doc.moveTo(StartX, StartY).lineTo(EndX, EndY).fillAndStroke(FillRule);
        }
      } else if (Tag === 'polyline') {
        var Points = (Obj.getAttribute('points') || '').split(/\s*,\s*|\s+/);
        Points = Points.map(function(x, i) {return((i===0?'M':(['L',''])[i%2]) + x);}).join(' ');
        if (!Styles.invisible) {
          doc.path(Points).fillAndStroke(FillRule);
        }
      } else if (Tag === 'polygon') {
        var Points = (Obj.getAttribute('points') || '').split(/\s*,\s*|\s+/);
        Points = Points.map(function(x, i) {return((i===0?'M':(['L',''])[i%2]) + x);}).join(' ') + ' Z';
        if (!Styles.invisible) {
          doc.path(Points).fillAndStroke(FillRule);
        }
      }
    }
    
    function addSVGText(Obj, Styles, Tag) { // Elements: text, tspan (children)
      var CurrentTextX = 0, CurrentTextY = 0, AddedText = '', Child, Tag2;
      function Recursive(Obj, Styles, Tag) {
        findSVGStyles(Obj, Styles, Tag);
        if (Styles.displayNone) {return;}
        var FillColor = Choose(Styles.fill, [0, 0, 0, 1]),
            FillOpacity = Choose(Styles.fillOpacity, 1) * Choose(Styles.opacity, 1) * FillColor[3], 
            StrokeColor = Choose(Styles.stroke, [255, 255, 255, 0]),
            StrokeOpacity = Choose(Styles.strokeOpacity, 1) * Choose(Styles.opacity, 1) * StrokeColor[3],
            LineWidth = Choose(Styles.strokeWidth, 1), 
            Size = Choose(Styles.fontSize, 16),
            Anchor = Choose(Styles.textAnchor, 'start'),
            Baseline = Choose(Styles.alignmentBaseline, 'baseline');
        doc.miterLimit(Choose(Styles.strokeMiterlimit, 2))
           .lineJoin(Choose(Styles.strokeLinejoin, 'miter'))
           .lineCap(Choose(Styles.strokeLinecap, 'butt'))
           .fontSize(Size)
           .dash(Choose(Styles.strokeDasharray, []), {phase:Choose(Styles.strokeDashoffset, 0)});
        var Length = Choose(ParseLength(Obj.getAttribute('textLength'), 'x'), null);
        CurrentTextX = Choose(ParseLength(Obj.getAttribute('x'), 'x'), CurrentTextX);
        CurrentTextY = Choose(ParseLength(Obj.getAttribute('y'), 'y'), CurrentTextY);
        CurrentTextX += Choose(ParseLength(Obj.getAttribute('dx'), 'x'), 0);
        CurrentTextY += Choose(ParseLength(Obj.getAttribute('dy'), 'y'), 0);
        var FontStylesFound = {};
        options.fontCallback(Styles.fontFamily, Styles.bold, Styles.italic, FontStylesFound)
        if (FontStylesFound.boldFound === false) {
          LineWidth = Choose(Styles.strokeWidth, 0) + Size * 0.03;
          if (Styles.stroke === undefined) {
            StrokeColor = FillColor;
          }
          if (Styles.strokeOpacity === undefined) {
            StrokeOpacity = FillOpacity;
          }
        }
        doc.fillColor(FillColor.slice(0,3), FillOpacity)
           .strokeColor(StrokeColor.slice(0,3), StrokeOpacity)
           .lineWidth(LineWidth);
        for (var i = 0, children = Obj.childNodes; i < children.length; i++) {
          Child = children[i]; Tag2 = Child.nodeName.toLowerCase();
          switch(Tag2) {
            case 'tspan':
              doc.save();
              Recursive(Child, CloneObject(Styles), Tag2);
              doc.restore();
              break;
            case '#text':
              var Text = Child.nodeValue;
              if (!Styles.preserveWhiteSpace) {
                Text = Text.replace(/[\s]+/g, ' ');
                if (AddedText.match(/[\s]$/)) {Text = Text.replace(/^[\s]/, '');}
              }
              var MeasuredTextWidth = doc.widthOfString(Text), ScaleX = 1;
              if (Anchor === 'end' || Anchor === 'middle' || Length) {
                if (Length && Length !== MeasuredTextWidth) {
                  ScaleX = Length / MeasuredTextWidth;
                  doc.transform(ScaleX, 0, 0, 1, 0, 0);
                }
                if (Anchor === 'end') {
                  CurrentTextX -= MeasuredTextWidth;
                } else if (Anchor === 'middle') {
                  CurrentTextX -= 0.5 * MeasuredTextWidth;
                }
              }
              if (!Styles.invisible) {
                doc._fragment(Text, CurrentTextX / ScaleX, CurrentTextY, {fill:true, stroke:!!StrokeOpacity, baseline: Baseline, oblique:FontStylesFound.italicFound===false});
              }
              CurrentTextX += Length || MeasuredTextWidth;
              AddedText += Text;
              break;
          }
        }
      }
      Recursive(Obj, Styles, Tag);
    }
    
    var PxToPt = 72/96; // 1px = 72/96pt
    options = options || {};

    if (typeof svg === 'string') {svg = ParseXml(svg);}
    if (typeof options.fontCallback !== 'function') {
      options.fontCallback = function(family, bold, italic) {
        if (bold && italic) {doc.font('Helvetica-BoldOblique');}
        if (bold && !italic) {doc.font('Helvetica-Bold');}
        if (!bold && italic) {doc.font('Helvetica-Oblique');}
        if (!bold && !italic) {doc.font('Helvetica');}
      };
    }
    if (svg && svg.nodeName === 'svg') {
      doc.save()
         .translate(x || 0, y || 0).scale(PxToPt);
      var ViewportWidth = options.width || doc.page.width / PxToPt,
          ViewportHeight = options.height || doc.page.height / PxToPt;
      addSVGGroup(svg, {}, 'svg');
      doc.restore();
    } else {
      console.log('Error: SVGtoPDF: This element can\'t be processed as SVG : ' + (svg && svg.nodeName));
    }

}
