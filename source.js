"use strict";
var SvgBezierSegment = function(p1x, p1y, c1x, c1y, c2x, c2y, p2x, p2y) {
  var solveEquation = function(curve) {
    if (curve.length > 3) {console.log('Error: Bezier>solveEquation: unsolvable equation ' + curve.join(','));}
    var a = curve[2] || 0, b = curve[1] || 0, c = curve[0] || 0;
    if (Math.abs(a) < 1e-10 && Math.abs(b) < 1e-10) {
      return([]);
    } else if (Math.abs(a) < 1e-10) {
      return([(-c) / b]);
    } else {
      var d = b * b - 4 * a * c;
      if (d > 0) {
        return([(-b + Math.sqrt(d)) / (2 * a), (-b - Math.sqrt(d)) / (2 * a)]);
      } else if (d === 0) {
        return([(-b) / (2 * a)]);
      } else {
        return([]);
      }
    }
  };
  var getCurveValue = function(t, curve) {
    return((curve[0] || 0) + (curve[1] || 0) * t + (curve[2] || 0) * t * t + (curve[3] || 0) * t * t * t);
  };
  var divisions = 15; // the accuracy isn't perfect but comparable to the arc-to-bezier conversion
  var equationX = [p1x, -3*p1x+3*c1x, 3*p1x-6*c1x+3*c2x, -p1x+3*c1x-3*c2x+p2x];
  var equationY = [p1y, -3*p1y+3*c1y, 3*p1y-6*c1y+3*c2y, -p1y+3*c1y-3*c2y+p2y];
  var derivativeX = [-3*p1x+3*c1x, 6*p1x-12*c1x+6*c2x, -3*p1x+9*c1x-9*c2x+3*p2x];
  var derivativeY = [-3*p1y+3*c1y, 6*p1y-12*c1y+6*c2y, -3*p1y+9*c1y-9*c2y+3*p2y];
  var lengthMap = (function() {
    var lengthMap = [0];
    for (var i = 1; i <= divisions; i++) {
      var t = (i - 0.5) / divisions;
      var dx = getCurveValue(t, derivativeX) / divisions,
          dy = getCurveValue(t, derivativeY) / divisions,
          l = Math.sqrt(dx*dx+dy*dy);
      lengthMap[i] = lengthMap[i - 1] + l;
    }
    return(lengthMap)
  })();
  var totalLength = this.totalLength = lengthMap[divisions];
  var boundingBox = this.boundingBox = (function() {
    var temp;
    var minX = getCurveValue(0, equationX), minY = getCurveValue(0, equationY),
        maxX = getCurveValue(1, equationX), maxY = getCurveValue(1, equationY);
    if (minX > maxX) {temp = maxX; maxX = minX; minX = temp;}
    if (minY > maxY) {temp = maxY; maxY = minY; minY = temp;}
    solveEquation(derivativeX).forEach(function(t) {
      if (t >= 0 && t <= 1) {
        var x = getCurveValue(t, equationX);
        if (x < minX) {minX = x;}
        if (x > maxX) {maxX = x;}
      }
    });
    solveEquation(derivativeY).forEach(function(t) {
      if (t >= 0 && t <= 1) {
        var y = getCurveValue(t, equationY);
        if (y < minY) {minY = y;}
        if (y > maxY) {maxY = y;}
      }
    });
    return([minX, minY, maxX, maxY]);
  })();
  this.getPointAtLength = function(l) {
    var i = 0;
    for (var i = 1; i <= divisions; i++) {
      var l1 = lengthMap[i-1], l2 = lengthMap[i];
      if (l1 <= l && l <= l2) {
        var t = (i - (l2 - l) / (l2 - l1)) / divisions;
        var x = getCurveValue(t, equationX), y = getCurveValue(t, equationY),
            dx = getCurveValue(t, derivativeX), dy = getCurveValue(t, derivativeY);
        return([x, y, Math.atan2(dy, dx)]);
      }
    }
  }
}
var SvgLineSegment = function(p1x, p1y, p2x, p2y) {
  var totalLength = this.totalLength = Math.sqrt((p2x - p1x) * (p2x - p1x) + (p2y - p1y) * (p2y - p1y));
  var boundingBox = this.boundingBox = [Math.min(p1x, p2x), Math.min(p1y, p2y), Math.max(p1x, p2x), Math.max(p1y, p2y)];
  this.getPointAtLength = function(l) {
    if (l >= 0 && l <= totalLength) {
      var r = l / totalLength || 0, x = p1x + r * (p2x - p1x), y = p1y + r * (p2y - p1y);
      return([x, y, Math.atan2(p2y - p1y, p2x - p1x)]);
    }
  }
}
var SvgPath = function(d) {
  var RawPath = [];
  var pathCommands = [];
  (function Parse() {
    d = (d || '').trim();
    var ArgumentsNumber = {A: 7, C: 6, H: 1, L: 2, M: 2, Q: 4, S: 4, T: 2, V: 1, Z: 0}
    var RegexNumber = /^[-+]?(?:[0-9]+[.][0-9]+|[0-9]+[.]|[.][0-9]+|[0-9]+)(?:[eE][-+]?[0-9]+)?/, RegexCommand = /^[astvzqmhlcASTVZQMHLC]/, RegexDelim = /^(?:\s*,\s*|\s*)/;
    function ConsumeMatch(RegExp) {
      var temp = d.match(RegExp);
      if (!temp) {return;}
      d = d.slice(temp[0].length);
      return(temp);
    }
    var Command, Value, Values, ArgsNumber;
    while (Command = ConsumeMatch(RegexCommand)) {
      Command = Command[0];
      ConsumeMatch(RegexDelim);
      ArgsNumber = ArgumentsNumber[Command.toUpperCase()];
      Values = [];
      while (Value = ConsumeMatch(RegexNumber)) {
        Value = Value[0];
        ConsumeMatch(RegexDelim);
        if (Values.length === ArgsNumber) {
          RawPath.push([Command].concat(Values));
          Values = [];
          if (Command === 'M') {Command = 'L';}
          else if (Command === 'm') {Command = 'l';}
        }
        Values.push(Number(Value));
      }
      if (Values.length === ArgsNumber) {
        RawPath.push([Command].concat(Values));
      } else {
        console.log('Error: ParseSvgPath: Command ' + Command + ' with ' + Values.length + ' numbers'); break;
      }
    }
    if (d.length !== 0) {
      console.log('Error: ParseSvgPath: Unexpected string ' + d);
    }
  })();
  (function Normalize() { // convert all path commands to M, L, C, Z
    function MoveTo(x, y) {
      pathCommands.push(['M', x, y]);
      StartX = CurrentX = x; StartY = CurrentY = y; LastCommand = 'M';
    }
    function ClosePath() {
      pathCommands.push(['Z']);
      CurrentX = StartX; CurrentY = StartY;
    }
    function LineTo(x, y) {
      pathCommands.push(['L', x, y]);
      CurrentX = x; CurrentY = y; LastCommand = 'L';
    }
    function CubicTo(c1x, c1y, c2x, c2y, x, y) {
      pathCommands.push(['C', c1x, c1y, c2x, c2y, x, y])
      CurrentX = x; CurrentY = y; LastCommand = 'C'; LastCtrlX = c2x; LastCtrlY = c2y;
    }
    function QuadraticTo(cx, cy, x, y) {
      var c1x = CurrentX + 2 / 3 * (cx - CurrentX), c1y = CurrentY + 2 / 3 * (cy - CurrentY),
          c2x = x + 2 / 3 * (cx - x), c2y = y + 2 / 3 * (cy - y);
      pathCommands.push(['C', c1x, c1y, c2x, c2y, x, y])
      CurrentX = x; CurrentY = y; LastCommand = 'Q'; LastCtrlX = cx; LastCtrlY = cy;
    }
    function ArcTo(rx, ry, rotAngle, arcLarge, arcSweep, x, y) { // From PDFKit
      var xInit = CurrentX, yInit = CurrentY, xEnd = x, yEnd = y;
      rx = Math.abs(rx); ry = Math.abs(ry); arcLarge = 1*!!arcLarge; arcSweep = 1*!!arcSweep;
      var th = rotAngle * (Math.PI / 180),
          sin_th = Math.sin(th),
          cos_th = Math.cos(th);
      var px = cos_th * (xInit - xEnd) * 0.5 + sin_th * (yInit - yEnd) * 0.5,
          py = cos_th * (yInit - yEnd) * 0.5 - sin_th * (xInit - xEnd) * 0.5,
          pl = (px * px) / (rx * rx) + (py * py) / (ry * ry);
      if (pl > 1) {
        pl = Math.sqrt(pl);
        rx *= pl;
        ry *= pl;
      }
      var a00 = cos_th / rx,
          a01 = sin_th / rx,
          a10 = -sin_th / ry,
          a11 = cos_th / ry,
          _a00 = cos_th * rx,
          _a01 = -sin_th * ry,
          _a10 = sin_th * rx,
          _a11 = cos_th * ry;
      var x0 = a00 * xInit + a01 * yInit,
          y0 = a10 * xInit + a11 * yInit,
          x1 = a00 * xEnd + a01 * yEnd,
          y1 = a10 * xEnd + a11 * yEnd;
      var sfactor = Math.sqrt(Math.max(0, 1 / ((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) - 0.25));
      if (arcSweep === arcLarge) {sfactor = -sfactor;}
      var xc = 0.5 * (x0 + x1) - sfactor * (y1 - y0),
          yc = 0.5 * (y0 + y1) + sfactor * (x1 - x0);
      var th0 = Math.atan2(y0 - yc, x0 - xc),
          th1 = Math.atan2(y1 - yc, x1 - xc),
          th_arc = th1 - th0;
      if (th_arc < 0 && arcSweep === 1) {
        th_arc += 2 * Math.PI;
      } else if (th_arc > 0 && arcSweep === 0) {
        th_arc -= 2 * Math.PI;
      }
      var segments = Math.ceil(Math.abs(th_arc / (Math.PI * 0.5 + 0.001)));
      for (var i = 0; i < segments; i++) {
        var th2 = th0 + i * th_arc / segments,
            th3 = th0 + (i + 1) * th_arc / segments,
            th_half = 0.5 * (th3 - th2);
        var t = 8/3 * Math.sin(th_half * 0.5) * Math.sin(th_half * 0.5) / Math.sin(th_half);
        var x1 = xc + Math.cos(th2) - t * Math.sin(th2),
            y1 = yc + Math.sin(th2) + t * Math.cos(th2),
            x3 = xc + Math.cos(th3),
            y3 = yc + Math.sin(th3),
            x2 = x3 + t * Math.sin(th3),
            y2 = y3 - t * Math.cos(th3);
        pathCommands.push(['C', _a00 * x1 + _a01 * y1, _a10 * x1 + _a11 * y1, _a00 * x2 + _a01 * y2, _a10 * x2 + _a11 * y2, _a00 * x3 + _a01 * y3, _a10 * x3 + _a11 * y3]);
      }
      CurrentX = x; CurrentY = y; LastCommand = 'A';
    }
    var StartX = 0, StartY = 0, CurrentX = 0, CurrentY = 0, LastCommand, LastCtrlX, LastCtrlY;
    for (var i = 0; i < RawPath.length; i++) {
      var Values = RawPath[i];
      switch(Values[0]) {
        case 'M':  MoveTo(Values[1], Values[2]);  break;
        case 'L':  LineTo(Values[1], Values[2]);  break;
        case 'H':  LineTo(Values[1], CurrentY);  break;
        case 'V':  LineTo(CurrentX, Values[1]);  break;
        case 'Z': case 'z':  ClosePath();  break;
        case 'm':  MoveTo(Values[1] + CurrentX, Values[2] + CurrentY);  break;
        case 'l':  LineTo(CurrentX + Values[1], CurrentY + Values[2]);  break;
        case 'h':  LineTo(CurrentX + Values[1], CurrentY);  break;
        case 'v':  LineTo(CurrentX, CurrentY + Values[1]);  break;
        case 'Q':  QuadraticTo(Values[1], Values[2], Values[3], Values[4]);  break;
        case 'q':  QuadraticTo(CurrentX + Values[1], CurrentY + Values[2], CurrentX + Values[3], CurrentY + Values[4]);  break;
        case 'T':  QuadraticTo(CurrentX + (LastCommand === 'Q' ? CurrentX - LastCtrlX : 0), CurrentY + (LastCommand === 'Q' ? CurrentY - LastCtrlY : 0), Values[3], Values[4]);  break;
        case 't':  QuadraticTo(CurrentX + (LastCommand === 'Q' ? CurrentX - LastCtrlX : 0), CurrentY + (LastCommand === 'Q' ? CurrentY - LastCtrlY : 0), Values[3] + CurrentX, Values[4] + CurrentY);  break;
        case 'C':  CubicTo(Values[1], Values[2], Values[3], Values[4], Values[5], Values[6]); break;
        case 'c':  CubicTo(Values[1] + CurrentX, Values[2] + CurrentY, Values[3] + CurrentX, Values[4] + CurrentY, Values[5] + CurrentX, Values[6] + CurrentY); break;
        case 'S':  CubicTo(CurrentX + (LastCommand === 'C' ? CurrentX - LastCtrlX : 0), CurrentY + (LastCommand === 'C' ? CurrentY - LastCtrlY : 0), Values[2], Values[3], Values[4], Values[5]);  break;
        case 's':  CubicTo(CurrentX + (LastCommand === 'C' ? CurrentX - LastCtrlX : 0), CurrentY + (LastCommand === 'C' ? CurrentY - LastCtrlY : 0), Values[2] + CurrentX, Values[3] + CurrentY, Values[4] + CurrentX, Values[5] + CurrentX); break;
        case 'A':  ArcTo(Values[1], Values[2], Values[3], Values[4], Values[5], Values[6], Values[7]); break;
        case 'a':  ArcTo(Values[1], Values[2], Values[3], Values[4], Values[5], Values[6] + CurrentX, Values[7] + CurrentY); break;
      }
    }
  })();
  SvgShape.call(this, pathCommands);
}
var SvgRect = function(x, y, w, h, rx, ry) {
  rx = rx || 0; ry = ry || rx;
  var pathCommands, k = (4 / 3) * (Math.sqrt(2) - 1);
  if (rx && ry) {
    var cx = Math.min(rx, 0.5 * w) * (1.0 - k), cy = Math.min(ry, 0.5 * h) * (1.0 - k);
    pathCommands = [
      ['M', x + rx, y],
      ['L', x + w - rx, y],
      ['C', x + w - cx, y, x + w, y + cy, x + w, y + ry],
      ['L', x + w, y + h - ry],
      ['C', x + w, y + h - cy, x + w - cx, y + h, x + w - rx, y + h],
      ['L', x + rx, y + h],
      ['C', x + cx, y + h, x, y + h - cy, x, y + h - ry],
      ['L', x, y + ry],
      ['C', x, y + cy, x + cx, y, x + rx, y],
      ['Z']];
  } else {
    pathCommands = [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
  }
  SvgShape.call(this, pathCommands);
}
var SvgEllipse = function(cx, cy, rx, ry) {
  var k = (4 / 3) * (Math.sqrt(2) - 1), ox = rx * k, oy = ry * k
  var pathCommands = [
    ['M', cx - rx, cy],
    ['C', cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry],
    ['C', cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy],
    ['C', cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry],
    ['C', cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy],
    ['Z']];
  SvgShape.call(this, pathCommands);
}
var SvgCircle = function(cx, cy, r) {
  SvgEllipse.call(this, cx, cy, r, r);
}
var SvgLine = function(x1, y1, x2, y2) {
  var pathCommands = [['M', x1, y1], ['L', x2, y1]];
  SvgShape.call(this, pathCommands);
}
var SvgPolyline = function(points) {
  SvgPath.call(this, points.map(function(x, i) {return((i===0?'M':(['L',''])[i%2]) + x);}).join(' '));
}
var SvgPolygon = function(points) {
  SvgPath.call(this, points.map(function(x, i) {return((i===0?'M':(['L',''])[i%2]) + x);}).join(' ') + ' Z');
}
var SvgShape = function(pathCommands) {
  this.pathCommands = pathCommands;
  var transform = this.transform = function(m1, m2, m3, m4, m5, m6) {
    var newPathCommands = [];
    for (var i = 0; i < pathCommands.length; i++) {
      var Values = pathCommands[i].slice();
      for (var j = 1; j < Values.length; j+=2) {
        var x = Values[j], y = Values[j+1];
        Values[j] = m1 * x + m3 * y + m5;
        Values[j+1] = m2 * x + m4 * y + m6;
      }
      newPathCommands.push(Values);
    }
    return(new SvgShape(newPathCommands));
  };
  var pathSegments = this.pathSegments = (function() {
    var CurrentX = 0, CurrentY = 0, StartX = 0, StartY = 0, segments = [];
    for (var i = 0; i < pathCommands.length; i++) {
      var Values = pathCommands[i];
      switch(Values[0]) {
        case 'M':
          StartX = CurrentX = Values[1]; StartY = CurrentY = Values[2];  break;
        case 'L':
          segments.push(new SvgLineSegment(CurrentX, CurrentY, Values[1], Values[2]));
          CurrentX = Values[1]; CurrentY = Values[2];  break;
        case 'C':
          segments.push(new SvgBezierSegment(CurrentX, CurrentY, Values[1], Values[2], Values[3], Values[4], Values[5], Values[6]));
          CurrentX = Values[5]; CurrentY = Values[6];  break;
        case 'Z':
          segments.push(new SvgLineSegment(CurrentX, CurrentY, StartX, StartY));
          CurrentX = StartX; CurrentY = StartY;  break;
      }
    }
    return(segments);
  })();
  var boundingBox = this.boundingBox = (function() {
    var bbox = [Infinity, Infinity, -Infinity, -Infinity];
    function AddBounds(bbox1) {
      if (bbox1[0] < bbox[0]) {bbox[0] = bbox1[0];}
      if (bbox1[2] > bbox[2]) {bbox[2] = bbox1[2];}
      if (bbox1[1] < bbox[1]) {bbox[1] = bbox1[1];}
      if (bbox1[3] > bbox[3]) {bbox[3] = bbox1[3];}
    }
    for (var i = 0; i < pathSegments.length; i++) {
      AddBounds(pathSegments[i].boundingBox);
    }
    if (bbox[0] === Infinity) {bbox[0] = 0;}
    if (bbox[1] === Infinity) {bbox[1] = 0;}
    if (bbox[2] === -Infinity) {bbox[2] = 0;}
    if (bbox[3] === -Infinity) {bbox[3] = 0;}
    return(bbox);
  })();
  var totalLength = this.totalLength = (function() {
    var length = 0;
    for (var i = 0; i < pathSegments.length; i++) {
      length += pathSegments[i].totalLength;
    }
    return(length);
  })();
  var getPointAtLength = this.getPointAtLength = function(l) {
    for (var i = 0; i < pathSegments.length; i++) {
      if (l > pathSegments[i].totalLength) {
        l -= pathSegments[i].totalLength;
      } else {
        return(pathSegments[i].getPointAtLength(l));
      }
    }
  };
  var insertInDocument = this.insertInDocument = function(doc) {
    for (var i = 0; i < pathCommands.length; i++) {
      var Values = pathCommands[i];
      switch(Values[0]) {
        case 'M':  doc.moveTo(Values[1], Values[2]);  break;
        case 'L':  doc.lineTo(Values[1], Values[2]);  break;
        case 'C':  doc.bezierCurveTo(Values[1], Values[2], Values[3], Values[4], Values[5], Values[6]);  break;
        case 'Z':  doc.closePath();  break;
      }
    }
    return(doc);
  }
}

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

    function ParseLength(v, percent) { // 'em' & 'ex' are wrong and should be computed
      var Units = {'':1, 'px':1, 'pt':96/72, 'cm':96/2.54, 'mm':96/25.4, 'in':96, 'pc':96/6, 'em':12, 'ex':6};
      var temp = (v || '').match(/^([-+]?(?:[0-9]+[.][0-9]+|[0-9]+[.]|[.][0-9]+|[0-9]+)(?:[eE][-+]?[0-9]+)?)(px|pt|cm|mm|in|pc|em|ex|%|)$/)
      if (temp) {
        if (temp[2] === '%') {
          if (typeof percent === 'number') {
            v = (+temp[1]) / 100 * percent;
          } else if (percent === 'x') {
            v = (+temp[1]) / 100 * ViewportWidth;
          } else if (percent === 'y') {
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

    function ParseLengthList(v, dir) {
      var RegexLength = /^[-+]?(?:[0-9]+[.][0-9]+|[0-9]+[.]|[.][0-9]+|[0-9]+)(?:[eE][-+]?[0-9]+)?(?:px|pt|cm|mm|in|pc|em|ex|%|)/;
      var temp, values = [];
      v = (v || '').trim();
      while (temp = v.match(RegexLength)) {
        v = v.slice(temp[0].length).replace(/^(?:\s*,\s*|\s*)/, '');
        values.push(ParseLength(temp[0], dir));
      }
      return(values);
    }

    function ParseNumberList(v) {
      var RegexNumber = /^[-+]?(?:[0-9]+[.][0-9]+|[0-9]+[.]|[.][0-9]+|[0-9]+)(?:[eE][-+]?[0-9]+)?/;
      var temp, values = [];
      v = (v || '').trim();
      while (temp = v.match(RegexNumber)) {
        v = v.slice(temp[0].length).replace(/^(?:\s*,\s*|\s*)/, '');
        values.push(Number(temp[0]));
      }
      return(values);
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
            if ((Tag !== 'svg' && Tag !== 'tspan' && Tag !== 'textpath') && (value = ParseTranforms(value))) {
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
            value = ParseLengthList(value, 'xy');
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
          case 'dominant-baseline':
            if (['auto', 'baseline', 'before-edge', 'text-before-edge', 'middle', 'central', 'after-edge', 'text-after-edge', 'ideographic', 'alphabetic', 'hanging', 'mathematical'].indexOf(value) !== -1) {
              Styles.baseline = value;
            }
            break;
          case 'baseline-shift':
            if (['sub', 'super'].indexOf(value) !== -1 || (ParseLength(value) > -Infinity && ParseLength(value) < Infinity)) {
              Styles.baselineShift = value;
            }
            break;
          case 'word-spacing':
            value = ParseLength(value, 'x');
            if (value > -Infinity && value < Infinity) {
              Styles.wordSpacing = value;
            }
            break;
          case 'letter-spacing':
            value = ParseLength(value, 'x');
            if (value > -Infinity && value < Infinity) {
              Styles.letterSpacing = value;
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
      var Link = (Obj.getAttribute('xlink:href') || '').slice(1),
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
          StrokeColor = Choose(Styles.stroke, [255, 255, 255, 0]),
          LineWidth = Choose(Styles.strokeWidth, 1);
      doc.fillColor(FillColor.slice(0,3), Choose(Styles.fillOpacity, 1) * Choose(Styles.opacity, 1) * FillColor[3])
         .strokeColor(StrokeColor.slice(0,3), (!!LineWidth) * Choose(Styles.strokeOpacity, 1) * Choose(Styles.opacity, 1) * StrokeColor[3])
         .lineWidth(LineWidth)
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
    
    function addSVGText(Obj, Styles, Tag) { // Elements: text and the children tspan, textPath
      var Child, Tag2;
      function Recursive(Obj, Styles, Tag) {
        findSVGStyles(Obj, Styles, Tag);
        if (Styles.displayNone) {return;}
        var FillColor = Choose(Styles.fill, [0, 0, 0, 1]),
            FillOpacity = Choose(Styles.fillOpacity, 1) * Choose(Styles.opacity, 1) * FillColor[3], 
            StrokeColor = Choose(Styles.stroke, [255, 255, 255, 0]),
            StrokeOpacity = Choose(Styles.strokeOpacity, 1) * Choose(Styles.opacity, 1) * StrokeColor[3],
            LineWidth = Choose(Styles.strokeWidth, 1);
        if (Obj._font.fauxbold) {
          LineWidth = Choose(Styles.strokeWidth, 0) + Obj._font.size * 0.03;
          if (Styles.stroke === undefined) {
            StrokeColor = FillColor;
            StrokeOpacity = FillOpacity;
          }
        }
        var TextOptions = {fill:true, stroke:Obj._font.fauxbold || Styles.stroke !== undefined, oblique:Obj._font.fauxitalic};
        for (var i = 0, children = Obj.childNodes; i < children.length; i++) {
          Child = children[i]; Tag2 = Child.nodeName.toLowerCase();
          switch(Tag2) {
            case 'tspan': case 'textpath':
              Recursive(Child, CloneObject(Styles), Tag2);
              break;
            case '#text':
              if (!Styles.invisible) {
                doc.miterLimit(Choose(Styles.strokeMiterlimit, 2))
                   .lineJoin(Choose(Styles.strokeLinejoin, 'miter'))
                   .lineCap(Choose(Styles.strokeLinecap, 'butt'))
                   .dash(Choose(Styles.strokeDasharray, []), {phase:Choose(Styles.strokeDashoffset, 0)})
                   .fillColor(FillColor.slice(0,3), FillOpacity)
                   .strokeColor(StrokeColor.slice(0,3), StrokeOpacity)
                   .lineWidth(LineWidth);
                doc._font = Obj._font.font;
                doc._fontSize = Obj._font.size;
                var pos = Child._pos;
                for (var j = 0; j < pos.length; j++) {
                  var posj = pos[j], string = posj.string;
                  if (!posj.hidden) {
                    while (pos[j+1] && (!pos[j+1].hidden) && Math.abs(pos[j].x + pos[j].xAdvance - pos[j+1].x) < 1e-6 && Math.abs(pos[j].y + pos[j].yAdvance - pos[j+1].y) < 1e-6) {
                      string += pos[++j].string;
                    }
                    doc.save();
                    doc.translate(posj.x, posj.y);
                    if (posj.rotate) {doc.rotate(posj.rotate * 180 / Math.PI);}
                    if (posj.scale !== 1) {doc.transform(posj.scale, 0, 0, 1, 0, 0);}
                    doc._fragment(string, 0, 0, TextOptions);
                    doc.restore();
                  }
                }
              }
              break;
          }
        }
      }
      doc.save();
      ComputeTextPositioning(Obj, Styles, Tag);
      doc.restore();
      Recursive(Obj, Styles, Tag);
    }

    function getBaseline(font, size, baseline, shift) {
      var scale = 0.001 * size, dy1, dy2;
      switch (baseline) {
        case 'middle': dy1 = 0.5 * font.xHeight * scale; break;
        case 'central': dy1 = 0.5 * (font.descender + font.ascender) * scale; break;
        case 'after-edge': case 'text-after-edge': dy1 = font.descender * scale; break;
        case 'alphabetic': case 'auto': case 'baseline': dy1 = 0; break;
        case 'mathematical': dy1 = 0.5 * font.ascender * scale; break;
        case 'hanging': dy1 = 0.8 * font.ascender * scale; break;
        case 'before-edge': case 'text-before-edge': dy1 = font.ascender * scale; break;
        default: dy1 = 0; break;
      }
      switch (shift) {
        case 'super': dy2 = 0.6 * (font.ascender - font.descender) * scale; break;
        case 'sub': dy2 = -0.6 * (font.ascender - font.descender) * scale; break;
        default: dy2 = Choose(ParseLength(shift, (font.ascender - font.descender) * scale), 0); break;
      }
      return(dy1 - dy2 - font.ascender * scale);
    }

    function getTextPos(font, size, text) {
      var fonttype = font.constructor.name, fontobject = font.font, unit = size / (fontobject.unitsPerEm || 1000);
      text = '' + text;
      if (fonttype === 'StandardFont') {
        var glyphs = fontobject.glyphsForString(text), advances = fontobject.advancesForGlyphs(glyphs), data = [];
        for (var i = 0; i < glyphs.length; i++) {
          data.push({
            string: (glyphs[i] !== '.notdef' ? text[i] : ''),
            width: fontobject.widthOfGlyph(glyphs[i]) * unit,
            xAdvance: advances[i] * unit,
            yAdvance: 0
          });
        }
        return(data);
      } else if (fonttype === 'EmbeddedFont') {
        var layout = fontobject.layout(text), glyphs = layout.glyphs, positions = layout.positions, data = [];
        for (var i = 0; i < glyphs.length; i++) {
          data.push({
            string: String.fromCharCode.apply(null, glyphs[i].codePoints),
            width: glyphs[i].advanceWidth * unit,
            xAdvance: positions[i].xAdvance * unit,
            yAdvance: positions[i].yAdvance * unit
          });
        }
        return(data);
      }
    }

    function ComputeTextPositioning(Obj, Styles, Tag) {
      var ProcessedText = '', RemainingText = Obj.textContent;
      var CurrentChunk = [], CurrentAnchor = undefined;
      var CurrentX = 0, CurrentY = 0;
      function CombineArrays(Arr1, Arr2) {return(Arr1.concat(Arr2.slice(Arr1.length)));}
      function DoAnchoring() {
        if (CurrentChunk.length) {
          var last = CurrentChunk[CurrentChunk.length - 1];
          var first = CurrentChunk[0]
          var width = last.x + last.width - first.x;
          var anchordx = {'start' : 0, 'middle' : 0.5, 'end' : 1}[CurrentAnchor] * width || 0;
          for (var i = 0; i < CurrentChunk.length; i++) {
            CurrentChunk[i].x -= anchordx;
          }
          CurrentX -= anchordx;
        }
        CurrentChunk = [];
      }
      function DoPositioningRecursive(Obj, Styles, Tag, Parent) {
        findSVGStyles(Obj, Styles, Tag);
        if (Tag === 'textpath') {
          Obj._x = Obj._y = Obj._dx = Obj._dy = Obj._rot = [];
        } else {
          Obj._x = CombineArrays(ParseLengthList(Obj.getAttribute('x'), 'x'), (Parent ? Parent._x.slice(Parent._pos.length) : []));
          Obj._y = CombineArrays(ParseLengthList(Obj.getAttribute('y'), 'y'), (Parent ? Parent._y.slice(Parent._pos.length) : []));
          Obj._dx = CombineArrays(ParseLengthList(Obj.getAttribute('dx'), 'x'), (Parent ? Parent._dx.slice(Parent._pos.length) : []));
          Obj._dy = CombineArrays(ParseLengthList(Obj.getAttribute('dy'), 'y'), (Parent ? Parent._dy.slice(Parent._pos.length) : []));
          Obj._rot = CombineArrays(ParseNumberList(Obj.getAttribute('rotate')), (Parent ? Parent._rot.slice(Parent._pos.length) : []));
        }
        var FontStylesFound = {};
        options.fontCallback(Styles.fontFamily, Styles.bold, Styles.italic, FontStylesFound);
        Obj._pos = [];
        Obj._font = {font: doc._font, size: Choose(Styles.fontSize, 16), fauxitalic: FontStylesFound.italicFound===false, fauxbold: FontStylesFound.boldFound===false};
        var TextLength = Choose(ParseLength(Obj.getAttribute('textLength'), 'x'), undefined),
            WordSpacing = Choose(Styles.wordSpacing, 0),
            LetterSpacing = Choose(Styles.letterSpacing, 0),
            TextAnchor = Styles.textAnchor,
            Baseline = getBaseline(Obj._font.font, Obj._font.size, Styles.baseline, Styles.baselineShift);
        if (Tag === 'textpath') {
          DoAnchoring();
          CurrentX = CurrentY = 0;
          CurrentAnchor = undefined;
        } else if (Obj._x.length || Obj._y.length) {
          DoAnchoring();
          CurrentAnchor = undefined;
        }
        if (TextAnchor !== undefined && CurrentAnchor === undefined) {
          CurrentAnchor = TextAnchor;
        }
        for (var i = 0, children = Obj.childNodes; i < children.length; i++) {
          var Child = children[i], Tag2 = Child.nodeName.toLowerCase();
          switch(Tag2) {
            case 'tspan': case 'textpath':
              DoPositioningRecursive(Child, CloneObject(Styles), Tag2, Obj);
              break;
            case '#text':
              var rawText = Child.nodeValue, renderedText = rawText;
              RemainingText = RemainingText.substring(rawText.length);
              if (!Styles.preserveWhiteSpace) {
                renderedText = renderedText.replace(/[\s]+/g, ' ');
                if (ProcessedText.match(/[\s]$|^$/)) {renderedText = renderedText.replace(/^[\s]/, '');}
                if (RemainingText.match(/^[\s]*$/)) {renderedText = renderedText.replace(/[\s]$/, '');}
              }
              ProcessedText += rawText;
              var pos = getTextPos(Obj._font.font, Obj._font.size, renderedText);
              for (var j = 0; j < pos.length; j++) {
                var indexInElement = Obj._pos.length + j;
                if (Obj._x[indexInElement] !== undefined) {DoAnchoring(); CurrentX = Obj._x[indexInElement];}
                if (Obj._y[indexInElement] !== undefined) {DoAnchoring(); CurrentY = Obj._y[indexInElement];}
                pos[j].dx = Obj._dx[indexInElement] || 0;
                pos[j].dy = Obj._dy[indexInElement] || 0;
                pos[j].rotate = Obj._rot[Math.min(indexInElement, Obj._rot.length - 1)] || 0;
                pos[j].x = CurrentX + pos[j].dx + (indexInElement > 0 ? LetterSpacing : 0) + (pos[j].string.match(/^[\s]$/) ? WordSpacing : 0);
                pos[j].y = CurrentY + pos[j].dy + Baseline;
                pos[j].scale = 1;
                pos[j].index = indexInElement;
                pos[j].hidden = false;
                CurrentX = pos[j].x + pos[j].xAdvance;
                CurrentY = pos[j].y + pos[j].yAdvance - Baseline;
              }
              Child._font = Obj._font;
              Child._pos = pos;
              Obj._pos = Obj._pos.concat(pos);
              CurrentChunk = CurrentChunk.concat(pos);
              break;
          }
        }
        if (TextLength && Obj._pos.length) {
          var FirstChar = Obj._pos[0], LastChar = Obj._pos[Obj._pos.length - 1],
              StartX = FirstChar.x, EndX = LastChar.x + LastChar.width,
              TextScale = TextLength / (EndX - StartX);
          for (var j = 0; j < Obj._pos.length; j++) {
            Obj._pos[j].x = StartX + TextScale * (Obj._pos[j].x - StartX);
            Obj._pos[j].scale *= TextScale;
            Obj._pos[j].width *= TextScale;
            Obj._pos[j].dx *= TextScale;
          }
          CurrentX += TextLength - (EndX - StartX);
        }
        if (Tag === 'textpath') {
          DoAnchoring();
          var Link = (Obj.getAttribute('xlink:href') || '').slice(1),
              PathElement = svg.getElementById(Link);
          if (PathElement) {
            var Transform = ParseTranforms(PathElement.getAttribute('transform')),
                PathObject = (new SvgPath(PathElement.getAttribute('d'))).transform(Transform[0], Transform[1], Transform[2], Transform[3], Transform[4], Transform[5]),
                PathLength = PathObject.totalLength,
                TextOffset = Choose(ParseLength(Obj.getAttribute('startOffset'), PathLength), 0);
            for (var j = 0; j < Obj._pos.length; j++) {
              var CharMidX = TextOffset + Obj._pos[j].x + 0.5 * Obj._pos[j].width
              if (CharMidX > PathLength || CharMidX < 0) {
                Obj._pos[j].hidden = true;
              } else {
                var PointOnPath = PathObject.getPointAtLength(CharMidX);
                Obj._pos[j].x = PointOnPath[0] - 0.5 * Obj._pos[j].width * Math.cos(PointOnPath[2]) - Obj._pos[j].y * Math.sin(PointOnPath[2]);
                Obj._pos[j].y = PointOnPath[1] - 0.5 * Obj._pos[j].width * Math.sin(PointOnPath[2]) + Obj._pos[j].y * Math.cos(PointOnPath[2]);
                Obj._pos[j].rotate = PointOnPath[2] + Obj._pos[j].rotate;
              }
            }
            var EndPoint = PathObject.getPointAtLength(PathLength);
            CurrentX = EndPoint[0]; CurrentY = EndPoint[1];
          } else {
            for (var j = 0; j < Obj._pos.length; j++) {
              Obj._pos[j].hidden = true;
            }
          }
        } else if (Tag === 'text') {
          DoAnchoring();
        }
        if (Parent) {
          Parent._pos = Parent._pos.concat(Obj._pos);
        }
      }
      DoPositioningRecursive(Obj, Styles, Tag, null);
    //  console.log(Obj._pos); // Temporary debugging
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

function Parser(str) {
  var parser = this;
  parser.match = function(exp, all) {
    var temp = str.match(exp);
    if (!temp || temp.index !== 0) {return;}
    str = str.substring(temp[0].length);
    return(all ? temp : temp[0]);
  }
  parser.matchSeparator = function() {
    return(parser.match(/^(?:\s*,\s*|\s*|)/));
  }
  parser.matchSpace = function() {
    return(parser.match(/^(?:\s*)/));
  }
  parser.matchLengthUnit = function() {
    return(parser.match(/^(?:px|pt|cm|mm|in|pc|em|ex|%|)/));
  }
  parser.matchNumber = function() {
    return(parser.match(/^(?:[-+]?(?:[0-9]+[.][0-9]+|[0-9]+[.]|[.][0-9]+|[0-9]+)(?:[eE][-+]?[0-9]+)?)/));
  }
  parser.matchPathCommand = function() {
    return(parser.match(/^(?:[astvzqmhlcASTVZQMHLC])/));
  }
  parser.parseNumberList = function() {
    var result = [], temp;
    while(temp = parser.matchNumber()) {
      result.push(temp);
      parser.matchSeparator();
    }
    return(result);
  }
  parser.parseLengthList = function() {
    var result = [], temp1, temp2;
    while(typeof (temp1 = parser.matchNumber()) === 'string' && typeof (temp2 = parser.matchLengthUnit()) === 'string') {
      result.push(temp1 + temp2);
      parser.matchSeparator();
    }
    return(result);
  }
}
